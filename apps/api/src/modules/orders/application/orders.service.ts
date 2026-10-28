import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely, type Selectable } from 'kysely';
import { dbNow } from '../../../db/clock.js';
import type { Database, OrderStatus, OrdersTable } from '../../../db/schema.js';
import {
  applyWinnerDeposit,
  finishAuctionPayment,
  resolveAppliedDeposit,
  type AuctionOrderInput,
  type AuctionOrderPort,
} from '../../auctions/index.js';
import type { AuthContext, CompanyAuthContext } from '../../identity/index.js';
import { accountBalance, ensureAccount, postJournal, type EntryInput } from '../../ledger/index.js';
import {
  AppError,
  DB,
  conflict,
  forbidden,
  notFound,
  recordAudit,
  validate,
  withIdempotency,
  type StoredResponse,
} from '../../platform/index.js';
import { lineTotalMinor } from '../../pricing/index.js';
import { canTransition, commissionMinor } from '../domain/rules.js';
import {
  DEMO_IBAN,
  ORDER_CONFIG,
  insertOrder,
  transitionOrder,
  type OrderConfig,
} from './support.js';

type OrderRow = Selectable<OrdersTable>;
type Actor = { actorType: 'user' | 'admin' | 'system'; actorId?: string };

export interface PendingOrderPayment {
  readonly reference: string;
  readonly amountMinor: bigint;
  readonly kind: 'order';
  readonly companyName: string;
  readonly orderId: string;
  readonly createdAt: Date;
}

@Injectable()
export class OrdersService implements AuctionOrderPort {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    @Inject(ORDER_CONFIG) private readonly cfg: OrderConfig,
  ) {}

  // ---- creation ----------------------------------------------------------------------------------
  // AUCTION_ORDER_PORT: runs inside the closing transaction (the auction row is locked). Idempotent per
  // auction (I6): the partial unique index is the backstop.
  async createOrderFromAuction(trx: Kysely<Database>, i: AuctionOrderInput): Promise<void> {
    const existing = await trx
      .selectFrom('orders')
      .select('id')
      .where('source_auction_id', '=', i.auctionId)
      .executeTakeFirst();
    if (existing) return;
    const deposit = await applyWinnerDeposit(trx, i.auctionId, i.buyerCompanyId);
    await insertOrder(
      trx,
      this.cfg,
      {
        listingId: i.listingId,
        auctionId: i.auctionId,
        buyerCompanyId: i.buyerCompanyId,
        sellerCompanyId: i.sellerCompanyId,
        unitPriceMinor: i.unitPriceMinor,
        quantityBase: i.quantityBase,
        basePerUnit: i.basePerUnit,
        totalMinor: i.totalMinor,
        commissionMinor: commissionMinor(i.totalMinor, this.cfg.commissionBps),
        depositAppliedMinor: deposit,
      },
      { actorType: 'system' },
    );
  }

  // Fixed-price purchase. The listing row lock serialises concurrent buyers: stock can never go negative.
  buy(
    actor: CompanyAuthContext,
    listingId: string,
    key: string,
    body: unknown,
  ): Promise<StoredResponse> {
    return withIdempotency(
      this.db,
      { userId: actor.userId, key, scope: `POST /listings/${listingId}/buy`, body },
      async (trx) => {
        const quantity = validate.bigintField(validate.asObject(body), 'quantityBase');
        const l = await trx
          .selectFrom('listings')
          .select([
            'id',
            'company_id',
            'category_id',
            'sale_type',
            'status',
            'unit_price_minor',
            'quantity_base',
            'min_order_base',
          ])
          .where('id', '=', listingId)
          .forUpdate()
          .executeTakeFirst();
        if (!l || (l.status !== 'published' && l.status !== 'sold')) throw notFound();
        if (l.sale_type !== 'fixed') {
          throw conflict('NOT_FIXED_PRICE', 'This listing is sold by auction');
        }
        if (l.company_id === actor.company.id) {
          throw forbidden('SELF_PURCHASE', 'You cannot buy your own listing');
        }
        if (l.status === 'sold' || quantity > l.quantity_base) {
          throw conflict('INSUFFICIENT_STOCK', 'Not enough stock for this quantity');
        }
        // The last remainder may be bought even when it is below the minimum order.
        if (quantity < l.min_order_base && quantity !== l.quantity_base) {
          throw new AppError(422, 'QUANTITY_BELOW_MINIMUM', 'Quantity is below the minimum order');
        }
        const category = await trx
          .selectFrom('categories')
          .select('base_per_unit')
          .where('id', '=', l.category_id)
          .executeTakeFirstOrThrow();
        const remaining = l.quantity_base - quantity;
        await trx
          .updateTable('listings')
          .set({
            quantity_base: remaining,
            ...(remaining === 0n && { status: 'sold' as const }),
            updated_at: sql<Date>`clock_timestamp()`,
          })
          .where('id', '=', listingId)
          .execute();
        const total = lineTotalMinor(l.unit_price_minor, quantity, BigInt(category.base_per_unit));
        const created = await insertOrder(
          trx,
          this.cfg,
          {
            listingId,
            auctionId: null,
            buyerCompanyId: actor.company.id,
            sellerCompanyId: l.company_id,
            unitPriceMinor: l.unit_price_minor,
            quantityBase: quantity,
            basePerUnit: category.base_per_unit,
            totalMinor: total,
            commissionMinor: commissionMinor(total, this.cfg.commissionBps),
            depositAppliedMinor: 0n,
          },
          { actorType: 'user', actorId: actor.userId },
        );
        return { status: 201, body: await this.detail(trx, created.id, actor.company.id) };
      },
    );
  }

  // ---- reads (buyer and seller company members only; anyone else gets 404) ----------------------
  async list(actor: CompanyAuthContext, status: unknown) {
    let q = this.base(this.db)
      .where((eb) =>
        eb.or([
          eb('o.buyer_company_id', '=', actor.company.id),
          eb('o.seller_company_id', '=', actor.company.id),
        ]),
      )
      .orderBy('o.created_at', 'desc')
      .orderBy('o.id', 'desc')
      .limit(100);
    if (typeof status === 'string' && status !== '') {
      q = q.where('o.status', '=', validate.oneOf({ status }, 'status', STATUSES));
    }
    return { items: (await q.execute()).map((r) => toView(r, actor.company.id)) };
  }

  async get(actor: CompanyAuthContext, id: string) {
    return this.detail(this.db, id, actor.company.id);
  }

  private base(db: Kysely<Database>) {
    return db
      .selectFrom('orders as o')
      .innerJoin('listings as l', 'l.id', 'o.source_listing_id')
      .innerJoin('companies as b', 'b.id', 'o.buyer_company_id')
      .innerJoin('companies as s', 's.id', 'o.seller_company_id')
      .selectAll('o')
      .select([
        'l.title as listing_title',
        'b.legal_name as buyer_name',
        's.legal_name as seller_name',
      ]);
  }

  private async detail(db: Kysely<Database>, id: string, viewerCompanyId: string) {
    const r = await this.base(db).where('o.id', '=', id).executeTakeFirst();
    if (!r || (r.buyer_company_id !== viewerCompanyId && r.seller_company_id !== viewerCompanyId)) {
      throw notFound('Order not found');
    }
    const history = await db
      .selectFrom('order_events')
      .select(['type', 'from_status', 'to_status', 'at'])
      .where('order_id', '=', id)
      .orderBy('at')
      .orderBy('id')
      .execute();
    return {
      ...toView(r, viewerCompanyId),
      history: history.map((h) => ({
        type: h.type,
        from: h.from_status,
        to: h.to_status,
        at: h.at,
      })),
    };
  }

  // ---- payment (admin bank reconciliation, reference ARC-O-) -------------------------------------
  async confirmPayment(admin: AuthContext, reference: string, amountMinor?: bigint) {
    return this.db.transaction().execute(async (trx) => {
      const found = await trx
        .selectFrom('orders')
        .select('id')
        .where('payment_reference', '=', reference)
        .executeTakeFirst();
      if (!found) throw notFound('Unknown payment reference');
      const o = await this.lock(trx, found.id);
      const done = { reference, kind: 'order' as const, orderId: o.id };
      if (o.status !== 'awaiting_payment') {
        // Already confirmed (retry or double click): same answer, no second journal.
        if (o.status !== 'cancelled' && o.status !== 'payment_failed') {
          return { ...done, status: o.status };
        }
        throw conflict('PAYMENT_NOT_CONFIRMABLE', `Order is ${o.status}`);
      }
      if (amountMinor !== undefined && amountMinor !== o.amount_due_minor) {
        throw new AppError(422, 'PAYMENT_AMOUNT_MISMATCH', 'Amount does not match the amount due', {
          amountDueMinor: o.amount_due_minor.toString(),
        });
      }
      await postJournal(trx, {
        reason: 'order.payment',
        ref: { type: 'order', id: o.id },
        entries: [
          { account: { type: 'bank_clearing' }, amountMinor: -o.amount_due_minor },
          ...(o.deposit_applied_minor > 0n
            ? [
                {
                  account: { type: 'deposit_held' as const },
                  amountMinor: -o.deposit_applied_minor,
                },
              ]
            : []),
          { account: { type: 'escrow' }, amountMinor: o.total_minor },
        ],
      });
      await transitionOrder(
        trx,
        o,
        'paid_escrow',
        {},
        { amountDueMinor: o.amount_due_minor.toString() },
      );
      await recordAudit(trx, {
        actorType: 'admin',
        actorId: admin.userId,
        companyId: o.buyer_company_id,
        action: 'order.payment_confirmed',
        entityType: 'order',
        entityId: o.id,
        data: {
          reference,
          amountDueMinor: o.amount_due_minor.toString(),
          depositAppliedMinor: o.deposit_applied_minor.toString(),
        },
      });
      return { ...done, status: 'paid_escrow' as const };
    });
  }

  async pendingPayments(): Promise<PendingOrderPayment[]> {
    const rows = await this.db
      .selectFrom('orders as o')
      .innerJoin('companies as c', 'c.id', 'o.buyer_company_id')
      .select(['o.id', 'o.payment_reference', 'o.amount_due_minor', 'c.legal_name', 'o.created_at'])
      .where('o.status', '=', 'awaiting_payment')
      .orderBy('o.created_at')
      .limit(200)
      .execute();
    return rows.map((r) => ({
      reference: r.payment_reference,
      amountMinor: r.amount_due_minor,
      kind: 'order',
      companyName: r.legal_name,
      orderId: r.id,
      createdAt: r.created_at,
    }));
  }

  // ---- fulfilment --------------------------------------------------------------------------------
  async ship(actor: CompanyAuthContext, id: string, body: unknown) {
    const note = validate.optStr(validate.asObject(body ?? {}), 'trackingNote', 500);
    return this.db.transaction().execute(async (trx) => {
      const o = await this.lock(trx, id);
      this.assertParty(o, actor.company.id, 'seller');
      this.assertCan(o, 'shipped');
      await transitionOrder(trx, o, 'shipped', note ? { tracking_note: note } : {});
      await recordAudit(trx, {
        actorType: 'user',
        actorId: actor.userId,
        companyId: actor.company.id,
        action: 'order.shipped',
        entityType: 'order',
        entityId: id,
        data: { hasTrackingNote: Boolean(note) },
      });
      return { id, status: 'shipped' as const };
    });
  }

  // Buyer confirms delivery: shipped -> delivered -> completed at once, escrow is released.
  // MVP: no automatic delivery confirmation (a timeout rule needs a product decision).
  async confirmDelivery(actor: CompanyAuthContext, id: string) {
    return this.db.transaction().execute(async (trx) => {
      const o = await this.lock(trx, id);
      this.assertParty(o, actor.company.id, 'buyer');
      this.assertCan(o, 'delivered');
      await transitionOrder(trx, o, 'delivered');
      await transitionOrder(trx, { id, status: 'delivered' }, 'completed');
      const payout = o.total_minor - o.commission_minor;
      const entries: EntryInput[] = [
        { account: { type: 'escrow' }, amountMinor: -o.total_minor },
        {
          account: { type: 'seller_payable', companyId: o.seller_company_id },
          amountMinor: payout,
        },
        { account: { type: 'platform_revenue' }, amountMinor: o.commission_minor },
      ];
      await postJournal(trx, {
        reason: 'order.release',
        ref: { type: 'order', id },
        entries: entries.filter((e) => e.amountMinor !== 0n),
      });
      if (o.source_auction_id) await finishAuctionPayment(trx, o.source_auction_id, 'SETTLED');
      await recordAudit(trx, {
        actorType: 'user',
        actorId: actor.userId,
        companyId: actor.company.id,
        action: 'order.delivered',
        entityType: 'order',
        entityId: id,
        data: {
          totalMinor: o.total_minor.toString(),
          commissionMinor: o.commission_minor.toString(),
          sellerPayoutMinor: payout.toString(),
        },
      });
      return { id, status: 'completed' as const };
    });
  }

  // ---- cancel / expiry (awaiting_payment only) ---------------------------------------------------
  // Buyer cancellation of an auction win is a breach: the deposit is forfeited. An admin cancellation
  // refunds it. Either way the auction ends as PAYMENT_FAILED (AUCTION-RULES §1 has no other exit).
  async cancel(actor: AuthContext, id: string, body: unknown) {
    const reason = validate.optStr(validate.asObject(body ?? {}), 'reason', 500);
    return this.db.transaction().execute(async (trx) => {
      const o = await this.lock(trx, id);
      const asAdmin = actor.isAdmin;
      if (!asAdmin) {
        if (actor.company?.status !== 'verified') throw notFound('Order not found');
        this.assertParty(o, actor.company.id, 'buyer');
      }
      this.assertCan(o, 'cancelled');
      await this.closeUnpaid(
        trx,
        o,
        'cancelled',
        asAdmin ? 'refund' : 'forfeit',
        {
          actorType: asAdmin ? 'admin' : 'user',
          actorId: actor.userId,
        },
        reason,
      );
      return { id, status: 'cancelled' as const };
    });
  }

  // One sweeper pass: unpaid orders past payment_due_at become payment_failed.
  async sweepExpired(): Promise<number> {
    const due = await this.db
      .selectFrom('orders')
      .select('id')
      .where('status', '=', 'awaiting_payment')
      .where(sql<boolean>`payment_due_at <= clock_timestamp()`)
      .orderBy('payment_due_at')
      .limit(100)
      .execute();
    let failed = 0;
    for (const { id } of due) if (await this.failIfExpired(id)) failed += 1;
    return failed;
  }

  private failIfExpired(id: string): Promise<boolean> {
    return this.db.transaction().execute(async (trx) => {
      const o = await trx
        .selectFrom('orders')
        .selectAll()
        .where('id', '=', id)
        .forUpdate()
        .skipLocked()
        .executeTakeFirst();
      if (o?.status !== 'awaiting_payment' || o.payment_due_at > (await dbNow(trx))) return false;
      await this.closeUnpaid(trx, o, 'payment_failed', 'forfeit', { actorType: 'system' });
      return true;
    });
  }

  private async closeUnpaid(
    trx: Kysely<Database>,
    o: OrderRow,
    to: 'cancelled' | 'payment_failed',
    deposit: 'forfeit' | 'refund',
    actor: Actor,
    reason?: string,
  ): Promise<void> {
    await transitionOrder(trx, o, to, reason ? { cancel_reason: reason } : {}, {
      depositOutcome: o.deposit_applied_minor > 0n ? deposit : null,
    });
    if (o.source_auction_id) {
      if (o.deposit_applied_minor > 0n) {
        const forfeit = deposit === 'forfeit';
        await postJournal(trx, {
          reason: forfeit ? 'order.deposit_forfeit' : 'order.deposit_refund',
          ref: { type: 'order', id: o.id },
          entries: [
            { account: { type: 'deposit_held' }, amountMinor: -o.deposit_applied_minor },
            {
              account: { type: forfeit ? 'platform_revenue' : 'bank_clearing' },
              amountMinor: o.deposit_applied_minor,
            },
          ],
        });
        await resolveAppliedDeposit(
          trx,
          o.source_auction_id,
          o.buyer_company_id,
          forfeit ? 'forfeited' : 'refunded',
          actor,
        );
      }
      await finishAuctionPayment(trx, o.source_auction_id, 'PAYMENT_FAILED');
    } else {
      // Fixed price: the reserved stock goes back on sale.
      await trx
        .updateTable('listings')
        .set({
          quantity_base: sql<bigint>`quantity_base + ${o.quantity_base}`,
          status: sql<'published'>`case when status = 'sold' then 'published' else status end`,
          updated_at: sql<Date>`clock_timestamp()`,
        })
        .where('id', '=', o.source_listing_id)
        .execute();
    }
    await recordAudit(trx, {
      ...actor,
      companyId: o.buyer_company_id,
      action: `order.${to}`,
      entityType: 'order',
      entityId: o.id,
      ...(reason && { reason }),
      data: {
        depositAppliedMinor: o.deposit_applied_minor.toString(),
        depositOutcome: o.deposit_applied_minor > 0n ? deposit : null,
      },
    });
  }

  // ---- seller payouts ----------------------------------------------------------------------------
  async sellerPayouts(actor: CompanyAuthContext) {
    const [balance, orders] = await Promise.all([
      accountBalance(this.db, { type: 'seller_payable', companyId: actor.company.id }),
      this.base(this.db)
        .where('o.seller_company_id', '=', actor.company.id)
        .where('o.status', '=', 'completed')
        .orderBy('o.completed_at', 'desc')
        .limit(100)
        .execute(),
    ]);
    return {
      balanceMinor: balance,
      orders: orders.map((r) => ({
        orderId: r.id,
        listingTitle: r.listing_title,
        totalMinor: r.total_minor,
        commissionMinor: r.commission_minor,
        netMinor: r.total_minor - r.commission_minor,
        completedAt: r.completed_at,
      })),
    };
  }

  // Fake bank transfer of the whole seller_payable balance to the seller (MVP: no real money).
  async transferPayout(admin: AuthContext, companyId: string) {
    return this.db.transaction().execute(async (trx) => {
      const company = await trx
        .selectFrom('companies')
        .select('id')
        .where('id', '=', companyId)
        .executeTakeFirst();
      if (!company) throw notFound('Company not found');
      const accountId = await ensureAccount(trx, { type: 'seller_payable', companyId });
      // Serialises concurrent transfers for the same company.
      await sql`select 1 from ledger_accounts where id = ${accountId} for update`.execute(trx);
      const balance = await accountBalance(trx, { type: 'seller_payable', companyId });
      if (balance <= 0n) throw conflict('NOTHING_TO_TRANSFER', 'No payable balance');
      const payoutId = randomUUID();
      await postJournal(trx, {
        reason: 'payout.transfer',
        ref: { type: 'payout', id: payoutId },
        entries: [
          { account: { type: 'seller_payable', companyId }, amountMinor: -balance },
          { account: { type: 'bank_clearing' }, amountMinor: balance },
        ],
      });
      await recordAudit(trx, {
        actorType: 'admin',
        actorId: admin.userId,
        companyId,
        action: 'payout.transferred',
        entityType: 'company',
        entityId: companyId,
        data: { payoutId, amountMinor: balance.toString() },
      });
      return { companyId, payoutId, transferredMinor: balance };
    });
  }

  // ---- stats -------------------------------------------------------------------------------------
  async stats() {
    const rows = await this.db
      .selectFrom('orders')
      .select(['status', (eb) => eb.fn.countAll<string>().as('n')])
      .groupBy('status')
      .execute();
    return {
      ...Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])),
      escrowBalanceMinor: await accountBalance(this.db, { type: 'escrow' }),
    };
  }

  // ---- helpers -----------------------------------------------------------------------------------
  private async lock(trx: Kysely<Database>, id: string): Promise<OrderRow> {
    const o = await trx
      .selectFrom('orders')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!o) throw notFound('Order not found');
    return o;
  }

  // Non-parties get 404 (no existence leak); a party acting in the wrong role gets 403.
  private assertParty(o: OrderRow, companyId: string, role: 'buyer' | 'seller'): void {
    const isBuyer = o.buyer_company_id === companyId;
    const isSeller = o.seller_company_id === companyId;
    if (!isBuyer && !isSeller) throw notFound('Order not found');
    if (!(role === 'buyer' ? isBuyer : isSeller)) {
      throw forbidden('WRONG_ROLE', `Only the ${role} can do this`);
    }
  }

  private assertCan(o: OrderRow, to: OrderStatus): void {
    if (!canTransition(o.status, to)) {
      throw conflict('INVALID_TRANSITION', `Order is ${o.status}`);
    }
  }
}

const STATUSES = [
  'awaiting_payment',
  'paid_escrow',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'payment_failed',
] as const satisfies readonly OrderStatus[];

interface ViewRow extends OrderRow {
  listing_title: string;
  buyer_name: string;
  seller_name: string;
}

// Bank details and the reference are for the buyer; the commission is for the seller.
function toView(r: ViewRow, viewerCompanyId: string) {
  const buyer = r.buyer_company_id === viewerCompanyId;
  return {
    id: r.id,
    role: buyer ? 'buyer' : 'seller',
    status: r.status,
    listingId: r.source_listing_id,
    listingTitle: r.listing_title,
    auctionId: r.source_auction_id,
    buyerCompanyId: r.buyer_company_id,
    buyerName: r.buyer_name,
    sellerCompanyId: r.seller_company_id,
    sellerName: r.seller_name,
    unitPriceMinor: r.unit_price_minor,
    quantityBase: r.quantity_base,
    totalMinor: r.total_minor,
    depositAppliedMinor: r.deposit_applied_minor,
    amountDueMinor: r.amount_due_minor,
    paymentDueAt: r.payment_due_at,
    trackingNote: r.tracking_note,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    shippedAt: r.shipped_at,
    completedAt: r.completed_at,
    ...(buyer
      ? { iban: DEMO_IBAN, paymentReference: r.payment_reference }
      : {
          commissionMinor: r.commission_minor,
          netPayoutMinor: r.total_minor - r.commission_minor,
        }),
  };
}
