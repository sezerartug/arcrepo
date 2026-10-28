import { randomInt } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { dbNow } from '../../../db/clock.js';
import type { AuctionStatus, Database } from '../../../db/schema.js';
import type { AuthContext, CompanyAuthContext } from '../../identity/index.js';
import { postJournal } from '../../ledger/index.js';
import {
  AppError,
  DB,
  conflict,
  forbidden,
  jsonSafe,
  notFound,
  recordAudit,
  validate,
  withIdempotency,
  type StoredResponse,
} from '../../platform/index.js';
import { computeExtension, validateBid, type RejectCode } from '../domain/rules.js';
import { AuctionCloser } from './closer.js';
import { releaseDeposits } from './deposits.js';
import { BidRateLimiter } from './rate-limit.js';
import { buildSnapshot, listAuctions } from './snapshot.js';
import { AUCTION_CONFIG, recordEvent, transitionStatus, type AuctionConfig } from './support.js';

// Fake bank details for the demo wire transfer (no real money in the MVP).
const DEMO_IBAN = 'TR00 DEMO 0000 0000 0000 0000 00';
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const DEPOSIT_REF_PREFIX = 'ARC-D-';

const REJECT: Record<RejectCode, { status: number; message: string }> = {
  AUCTION_NOT_LIVE: { status: 409, message: 'The auction is not live' },
  AUCTION_ENDED: { status: 409, message: 'The auction has ended' },
  ALREADY_HIGH_BIDDER: { status: 409, message: 'You already hold the highest bid' },
  BID_TOO_LOW: { status: 422, message: 'The bid is below the minimum next bid' },
  SELF_BID: { status: 422, message: 'You cannot bid on your own listing' },
  BIDDER_NOT_ELIGIBLE: {
    status: 422,
    message: 'A verified company with a confirmed deposit is required',
  },
};

const newReference = (): string =>
  DEPOSIT_REF_PREFIX +
  Array.from({ length: 6 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join('');

export interface PendingPayment {
  readonly reference: string;
  readonly amountMinor: bigint;
  readonly kind: 'deposit';
  readonly companyName: string;
  readonly auctionId: string;
  readonly createdAt: Date;
}

@Injectable()
export class AuctionsService {
  private readonly logger = new Logger('Auctions');
  private readonly limiter = new BidRateLimiter();

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    @Inject(AUCTION_CONFIG) private readonly config: AuctionConfig,
    private readonly closer: AuctionCloser,
  ) {}

  // ---- reads ---------------------------------------------------------------------------------------
  list(status: unknown) {
    return listAuctions(this.db, status);
  }

  async snapshot(actor: AuthContext | null, id: string) {
    await this.touch(id);
    return buildSnapshot(this.db, id, actor);
  }

  // Lazy start / close: a request that finds the auction due moves it, without waiting for the sweeper.
  private async touch(id: string): Promise<void> {
    const row = await this.db
      .selectFrom('auctions')
      .select([
        'status',
        sql<boolean>`starts_at <= clock_timestamp()`.as('start_due'),
        sql<boolean>`ends_at <= clock_timestamp()`.as('end_due'),
      ])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) throw notFound('Auction not found');
    if (row.status === 'SCHEDULED' && row.start_due) await this.closer.startAuction(id);
    if ((row.status === 'LIVE' || row.status === 'SCHEDULED') && row.end_due) {
      await this.closer.closeAuction(id);
    }
  }

  // ---- deposit (guarantee) -------------------------------------------------------------------------
  deposit(actor: CompanyAuthContext, auctionId: string, key: string): Promise<StoredResponse> {
    return withIdempotency(
      this.db,
      { userId: actor.userId, key, scope: `POST /auctions/${auctionId}/deposit`, body: {} },
      async (trx) => {
        // Shared lock: close/cancel (FOR UPDATE) cannot run between this check and the insert.
        const a = await trx
          .selectFrom('auctions')
          .select(['id', 'status', 'seller_company_id', 'deposit_minor'])
          .where('id', '=', auctionId)
          .forShare()
          .executeTakeFirst();
        if (!a) throw notFound('Auction not found');
        if (a.seller_company_id === actor.company.id) {
          throw forbidden('SELF_BID', 'You cannot bid on your own listing');
        }
        if (a.status !== 'SCHEDULED' && a.status !== 'LIVE') {
          throw conflict(
            'AUCTION_NOT_LIVE',
            'Deposits are only accepted before the auction closes',
          );
        }
        const find = () =>
          trx
            .selectFrom('deposits')
            .selectAll()
            .where('auction_id', '=', auctionId)
            .where('company_id', '=', actor.company.id)
            .executeTakeFirst();
        const view = (
          d: { reference: string; amount_minor: bigint; status: string },
          status: number,
        ) => ({
          status,
          body: {
            auctionId,
            reference: d.reference,
            amountMinor: d.amount_minor,
            iban: DEMO_IBAN,
            status: d.status,
          },
        });
        const existing = await find();
        if (existing) return view(existing, 200);

        for (let attempt = 0; attempt < 5; attempt += 1) {
          const created = await trx
            .insertInto('deposits')
            .values({
              auction_id: auctionId,
              company_id: actor.company.id,
              amount_minor: a.deposit_minor,
              reference: newReference(),
            })
            .onConflict((oc) => oc.doNothing())
            .returningAll()
            .executeTakeFirst();
          if (created) {
            await recordAudit(trx, {
              actorType: 'user',
              actorId: actor.userId,
              companyId: actor.company.id,
              action: 'deposit.requested',
              entityType: 'deposit',
              entityId: created.id,
              data: { auctionId, amountMinor: a.deposit_minor.toString() },
            });
            return view(created, 201);
          }
          const raced = await find(); // (auction, company) won by a concurrent request
          if (raced) return view(raced, 200);
        }
        throw new AppError(500, 'INTERNAL', 'Could not allocate a deposit reference');
      },
    );
  }

  // Admin bank reconciliation for a deposit reference: pending -> held, money enters the ledger.
  async confirmDepositPayment(admin: AuthContext, reference: string) {
    return this.db.transaction().execute(async (trx) => {
      const ref = await trx
        .selectFrom('deposits')
        .select(['id', 'auction_id'])
        .where('reference', '=', reference)
        .executeTakeFirst();
      if (!ref) throw notFound('Unknown payment reference');
      // Same lock order as close/cancel: auction first, then the deposit.
      const a = await trx
        .selectFrom('auctions')
        .select(['id', 'status'])
        .where('id', '=', ref.auction_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const d = await trx
        .selectFrom('deposits')
        .selectAll()
        .where('id', '=', ref.id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (d.status === 'held') return { reference, kind: 'deposit' as const, status: d.status };
      if (d.status !== 'pending' || (a.status !== 'SCHEDULED' && a.status !== 'LIVE')) {
        throw conflict('PAYMENT_NOT_CONFIRMABLE', `Deposit is ${d.status}; auction is ${a.status}`);
      }
      await postJournal(trx, {
        reason: 'deposit.hold',
        ref: { type: 'deposit', id: d.id },
        entries: [
          { account: { type: 'bank_clearing' }, amountMinor: -d.amount_minor },
          { account: { type: 'deposit_held' }, amountMinor: d.amount_minor },
        ],
      });
      await trx
        .updateTable('deposits')
        .set({ status: 'held', confirmed_at: sql<Date>`clock_timestamp()` })
        .where('id', '=', d.id)
        .execute();
      await recordAudit(trx, {
        actorType: 'admin',
        actorId: admin.userId,
        companyId: d.company_id,
        action: 'deposit.confirmed',
        entityType: 'deposit',
        entityId: d.id,
        data: { auctionId: d.auction_id, amountMinor: d.amount_minor.toString(), reference },
      });
      return { reference, kind: 'deposit' as const, status: 'held' as const };
    });
  }

  async pendingDeposits(): Promise<PendingPayment[]> {
    const rows = await this.db
      .selectFrom('deposits as d')
      .innerJoin('companies as c', 'c.id', 'd.company_id')
      .select(['d.reference', 'd.amount_minor', 'c.legal_name', 'd.auction_id', 'd.created_at'])
      .where('d.status', '=', 'pending')
      .orderBy('d.created_at')
      .limit(200)
      .execute();
    return rows.map((r) => ({
      reference: r.reference,
      amountMinor: r.amount_minor,
      kind: 'deposit',
      companyName: r.legal_name,
      auctionId: r.auction_id,
      createdAt: r.created_at,
    }));
  }

  // ---- bids (AUCTION-RULES §4) ---------------------------------------------------------------------
  async placeBid(
    actor: CompanyAuthContext,
    auctionId: string,
    key: string,
    body: unknown,
  ): Promise<StoredResponse> {
    if (this.config.bidRateLimit && !this.limiter.allow(actor.userId)) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many bids, slow down');
    }
    const res = await withIdempotency(
      this.db,
      { userId: actor.userId, key, scope: `POST /auctions/${auctionId}/bids`, body },
      (trx) => this.placeBidTx(trx, actor, auctionId, body),
    );
    // Lazy close: a bid that finds the auction over triggers its closing.
    if (errorCode(res) === 'AUCTION_ENDED') {
      await this.closer.closeAuction(auctionId).catch((e: unknown) => {
        this.logger.warn(e instanceof Error ? e.message : 'lazy close failed');
      });
    }
    return res;
  }

  private async placeBidTx(
    trx: Kysely<Database>,
    actor: CompanyAuthContext,
    auctionId: string,
    body: unknown,
  ): Promise<StoredResponse> {
    const amount = validate.bigintField(validate.asObject(body), 'amountMinor');

    // 2) lock, 3) time after the lock
    let a = await trx
      .selectFrom('auctions')
      .selectAll()
      .where('id', '=', auctionId)
      .forUpdate()
      .executeTakeFirst();
    if (!a) throw notFound('Auction not found');
    const t = await dbNow(trx);
    if (a.status === 'SCHEDULED' && a.starts_at <= t) {
      await transitionStatus(trx, a, 'LIVE');
      a = { ...a, status: 'LIVE', version: a.version + 1 };
    }

    const deposit = await trx
      .selectFrom('deposits')
      .select('status')
      .where('auction_id', '=', auctionId)
      .where('company_id', '=', actor.company.id)
      .executeTakeFirst();
    const high =
      a.last_seq > 0
        ? await trx
            .selectFrom('bids')
            .select('bidder_company_id')
            .where('auction_id', '=', auctionId)
            .where('seq', '=', a.last_seq)
            .executeTakeFirstOrThrow()
        : null;

    // 4) pure validation
    const rejection = validateBid(
      {
        status: a.status,
        endsAt: a.ends_at,
        sellerCompanyId: a.seller_company_id,
        highBidderCompanyId: high?.bidder_company_id ?? null,
        bidCount: a.bid_count,
        startPriceMinor: a.start_price_minor,
        currentPriceMinor: a.current_price_minor,
        minIncrementMinor: a.min_increment_minor,
      },
      {
        bidderCompanyId: actor.company.id,
        eligible: actor.company.status === 'verified' && deposit?.status === 'held',
        amountMinor: amount,
      },
      t,
    );

    // 5b) business rejection: committed with the idempotency response
    if (rejection) {
      await trx
        .insertInto('bid_attempts')
        .values({
          auction_id: auctionId,
          bidder_company_id: actor.company.id,
          bidder_user_id: actor.userId,
          amount_minor: amount,
          reason_code: rejection.code,
        })
        .execute();
      const r = REJECT[rejection.code];
      return {
        status: r.status,
        body: {
          error: {
            code: rejection.code,
            message: r.message,
            ...(rejection.minNextBidMinor !== undefined
              ? { minNextBidMinor: rejection.minNextBidMinor }
              : {}),
          },
        },
      };
    }

    // 5a) accept
    const seq = a.last_seq + 1;
    const bid = await trx
      .insertInto('bids')
      .values({
        auction_id: auctionId,
        seq,
        bidder_company_id: actor.company.id,
        bidder_user_id: actor.userId,
        amount_minor: amount,
        accepted_at: t,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const ext = computeExtension(
      {
        endsAt: a.ends_at,
        hardEndCap: a.hard_end_cap,
        windowMs: a.extension_window_secs * 1000,
        extensionMs: a.extension_secs * 1000,
        extensionCount: a.extension_count,
        maxExtensions: a.max_extensions,
      },
      t,
    );
    await trx
      .updateTable('auctions')
      .set({
        current_price_minor: amount,
        high_bid_id: bid.id,
        last_seq: seq,
        bid_count: a.bid_count + 1,
        version: a.version + 1,
        ends_at: ext.endsAt,
        extension_count: a.extension_count + (ext.extended ? 1 : 0),
      })
      .where('id', '=', auctionId)
      .execute();
    await recordEvent(
      trx,
      auctionId,
      seq,
      'bid.accepted',
      jsonSafe({ seq, amountMinor: amount, endsAt: ext.endsAt, serverNow: t }) as Record<
        string,
        unknown
      >,
    );
    if (ext.extended) {
      await recordEvent(
        trx,
        auctionId,
        seq,
        'auction.extended',
        jsonSafe({ endsAt: ext.endsAt, extensionCount: a.extension_count + 1 }) as Record<
          string,
          unknown
        >,
      );
    }
    await recordAudit(trx, {
      actorType: 'user',
      actorId: actor.userId,
      companyId: actor.company.id,
      action: 'auction.bid_accepted',
      entityType: 'auction',
      entityId: auctionId,
      data: { seq, amountMinor: amount.toString(), extended: ext.extended },
    });
    return { status: 201, body: { seq, ...(await buildSnapshot(trx, auctionId, actor)) } };
  }

  // ---- admin cancel (OPEN-AU-09) -------------------------------------------------------------------
  async adminCancel(admin: AuthContext, auctionId: string, body: unknown) {
    const reason = validate.str(validate.asObject(body ?? {}), 'reason', 3, 500);
    return this.db.transaction().execute(async (trx) => {
      const a = await trx
        .selectFrom('auctions')
        .selectAll()
        .where('id', '=', auctionId)
        .forUpdate()
        .executeTakeFirst();
      if (!a) throw notFound('Auction not found');
      const cancellable: AuctionStatus[] = ['SCHEDULED', 'LIVE'];
      if (!cancellable.includes(a.status)) {
        throw conflict('INVALID_TRANSITION', `Cannot cancel a ${a.status} auction`);
      }
      await transitionStatus(trx, a, 'CANCELLED', {
        closed_at: sql<Date>`clock_timestamp()`,
        cancel_reason: reason,
      });
      const refunded = await releaseDeposits(trx, auctionId, null, {
        actorType: 'admin',
        actorId: admin.userId,
      });
      await recordEvent(trx, auctionId, a.last_seq, 'auction.cancelled', { reason });
      await recordAudit(trx, {
        actorType: 'admin',
        actorId: admin.userId,
        companyId: a.seller_company_id,
        action: 'auction.cancelled',
        entityType: 'auction',
        entityId: auctionId,
        reason,
        data: { from: a.status, bidCount: a.bid_count, refundedDeposits: refunded },
      });
      return { id: auctionId, status: 'CANCELLED' as const, refundedDeposits: refunded };
    });
  }
}

function errorCode(res: StoredResponse): string | undefined {
  const b = res.body as { error?: { code?: string } } | null;
  return b?.error?.code;
}
