import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely, type Selectable } from 'kysely';
import type { Database, OrdersTable } from '../../../db/schema.js';
import { finishAuctionPayment, resolveAppliedDeposit } from '../../auctions/index.js';
import type { AuthContext, CompanyAuthContext } from '../../identity/index.js';
import { postJournal, type EntryInput } from '../../ledger/index.js';
import {
  AppError,
  DB,
  conflict,
  forbidden,
  invalid,
  notFound,
  recordAudit,
  validate,
  withIdempotency,
  type StoredResponse,
} from '../../platform/index.js';
import { canTransition, splitDispute } from '../domain/rules.js';
import { ORDER_CONFIG, transitionOrder, type OrderConfig } from './support.js';

type OrderRow = Selectable<OrdersTable>;
const PAGE_SIZE = 20;
const DISPUTE_STATUSES = ['open', 'resolved'] as const;

// Buyer objections while an order is shipped, and the admin decision that closes them.
@Injectable()
export class DisputesService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    @Inject(ORDER_CONFIG) private readonly cfg: OrderConfig,
  ) {}

  // shipped -> disputed. Only the buyer; auto-confirm and delivery confirmation stop because the order
  // is no longer `shipped` (the state machine has no disputed -> delivered edge).
  open(
    actor: CompanyAuthContext,
    orderId: string,
    key: string,
    body: unknown,
  ): Promise<StoredResponse> {
    return withIdempotency(
      this.db,
      { userId: actor.userId, key, scope: `POST /orders/${orderId}/dispute`, body },
      async (trx) => {
        const reason = validate.str(validate.asObject(body), 'reason', 10, 2000);
        const o = await this.lockOrder(trx, orderId);
        if (o.buyer_company_id !== actor.company.id) {
          if (o.seller_company_id !== actor.company.id) throw notFound('Order not found');
          throw forbidden('WRONG_ROLE', 'Only the buyer can do this');
        }
        if (!canTransition(o.status, 'disputed')) {
          throw conflict('INVALID_TRANSITION', `Order is ${o.status}`);
        }
        const d = await trx
          .insertInto('order_disputes')
          .values({ order_id: o.id, opened_by_user_id: actor.userId, reason })
          .returning('id')
          .executeTakeFirstOrThrow();
        await transitionOrder(trx, o, 'disputed', {}, { disputeId: d.id });
        await recordAudit(trx, {
          actorType: 'user',
          actorId: actor.userId,
          companyId: actor.company.id,
          action: 'order.dispute.opened',
          entityType: 'order',
          entityId: o.id,
          data: { disputeId: d.id, totalMinor: o.total_minor.toString() },
        });
        return { status: 201, body: { id: d.id, orderId: o.id, status: 'open' } };
      },
    );
  }

  // Admin closes an open dispute: partial/full refund, or reject (payout proceeds as normal).
  // One transaction: order row lock -> state check -> one balanced ledger journal -> order/deposit/auction.
  resolve(
    admin: AuthContext,
    disputeId: string,
    key: string,
    body: unknown,
  ): Promise<StoredResponse> {
    return withIdempotency(
      this.db,
      { userId: admin.userId, key, scope: `POST /admin/disputes/${disputeId}/resolve`, body },
      async (trx) => {
        const b = validate.asObject(body);
        const outcome = validate.oneOf(b, 'outcome', ['refund', 'reject'] as const);
        const note = validate.str(b, 'note', 3, 1000);
        const requested = outcome === 'refund' ? validate.bigintField(b, 'refundMinor') : undefined;
        if (outcome === 'reject' && b.refundMinor !== undefined && b.refundMinor !== null) {
          throw invalid('refundMinor is only allowed for outcome refund');
        }

        const found = await trx
          .selectFrom('order_disputes')
          .select('order_id')
          .where('id', '=', disputeId)
          .executeTakeFirst();
        if (!found) throw notFound('Dispute not found');
        const o = await this.lockOrder(trx, found.order_id);
        const d = await trx
          .selectFrom('order_disputes')
          .select(['id', 'status'])
          .where('id', '=', disputeId)
          .forUpdate()
          .executeTakeFirstOrThrow();
        if (d.status !== 'open' || o.status !== 'disputed') {
          throw conflict('DISPUTE_ALREADY_RESOLVED', 'Dispute is not open');
        }
        if (requested !== undefined && requested > o.total_minor) {
          throw new AppError(422, 'REFUND_EXCEEDS_TOTAL', 'Refund exceeds the order total', {
            totalMinor: o.total_minor.toString(),
          });
        }

        const refund = requested ?? 0n;
        const full = refund === o.total_minor;
        // Reject keeps the commission the order was created with; a partial refund recomputes it on the
        // kept amount.
        const split =
          outcome === 'reject'
            ? {
                refundMinor: 0n,
                commissionMinor: o.commission_minor,
                sellerPayoutMinor: o.total_minor - o.commission_minor,
              }
            : splitDispute(o.total_minor, refund, this.cfg.commissionBps);

        const entries: EntryInput[] = [
          { account: { type: 'escrow' }, amountMinor: -o.total_minor },
          { account: { type: 'bank_clearing' }, amountMinor: split.refundMinor },
          {
            account: { type: 'seller_payable', companyId: o.seller_company_id },
            amountMinor: split.sellerPayoutMinor,
          },
          { account: { type: 'platform_revenue' }, amountMinor: split.commissionMinor },
        ];
        await postJournal(trx, {
          reason: 'order.dispute_resolution',
          ref: { type: 'order', id: o.id },
          entries: entries.filter((e) => e.amountMinor !== 0n),
        });

        await trx
          .updateTable('orders')
          .set({ refund_minor: split.refundMinor, commission_minor: split.commissionMinor })
          .where('id', '=', o.id)
          .execute();
        const to = full ? 'refunded' : 'completed';
        const data = {
          disputeId,
          outcome,
          totalMinor: o.total_minor.toString(),
          refundMinor: split.refundMinor.toString(),
          commissionMinor: split.commissionMinor.toString(),
          sellerPayoutMinor: split.sellerPayoutMinor.toString(),
        };
        await transitionOrder(trx, o, to, {}, data);
        await trx
          .updateTable('order_disputes')
          .set({
            status: 'resolved',
            resolution: outcome === 'refund' ? 'refund' : 'rejected',
            refund_minor: outcome === 'refund' ? refund : null,
            resolution_note: note,
            resolved_by_user_id: admin.userId,
            resolved_at: sql<Date>`clock_timestamp()`,
          })
          .where('id', '=', disputeId)
          .execute();

        if (o.source_auction_id) {
          // The auction was paid, so it ends SETTLED also on a full refund; the deposit goes back to the buyer.
          if (full && o.deposit_applied_minor > 0n) {
            await resolveAppliedDeposit(trx, o.source_auction_id, o.buyer_company_id, 'refunded', {
              actorType: 'admin',
              actorId: admin.userId,
            });
          }
          await finishAuctionPayment(trx, o.source_auction_id, 'SETTLED');
        }
        await recordAudit(trx, {
          actorType: 'admin',
          actorId: admin.userId,
          companyId: o.buyer_company_id,
          action: 'admin.dispute.resolved',
          entityType: 'order',
          entityId: o.id,
          reason: note,
          data: { ...data, orderStatus: to },
        });
        return { status: 200, body: { id: disputeId, orderId: o.id, orderStatus: to, ...data } };
      },
    );
  }

  async adminList(params: { status?: unknown; page?: unknown }) {
    const page = validate.pageParam(params.page);
    const raw =
      typeof params.status === 'string' && params.status !== '' ? params.status : undefined;
    if (raw !== undefined && !(DISPUTE_STATUSES as readonly string[]).includes(raw)) {
      throw invalid('unknown status');
    }
    const status = raw as (typeof DISPUTE_STATUSES)[number] | undefined;
    const base = this.db
      .selectFrom('order_disputes as d')
      .innerJoin('orders as o', 'o.id', 'd.order_id')
      .innerJoin('listings as l', 'l.id', 'o.source_listing_id')
      .innerJoin('companies as b', 'b.id', 'o.buyer_company_id')
      .innerJoin('companies as s', 's.id', 'o.seller_company_id')
      .$if(status !== undefined, (qb) => qb.where('d.status', '=', status as 'open' | 'resolved'));
    const total = await base
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    const rows = await base
      .select([
        'd.id',
        'd.order_id',
        'd.reason',
        'd.status',
        'd.resolution',
        'd.refund_minor',
        'd.resolution_note',
        'd.opened_at',
        'd.resolved_at',
        'o.status as order_status',
        'o.total_minor',
        'o.source_auction_id',
        'l.title as listing_title',
        'b.legal_name as buyer_name',
        's.legal_name as seller_name',
      ])
      .orderBy('d.opened_at', 'desc')
      .orderBy('d.id')
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute();
    return {
      page,
      total: Number(total.n),
      items: rows.map((r) => ({
        id: r.id,
        orderId: r.order_id,
        listingTitle: r.listing_title,
        buyerName: r.buyer_name,
        sellerName: r.seller_name,
        totalMinor: r.total_minor,
        orderStatus: r.order_status,
        fromAuction: r.source_auction_id !== null,
        reason: r.reason,
        status: r.status,
        resolution: r.resolution,
        refundMinor: r.refund_minor,
        resolutionNote: r.resolution_note,
        openedAt: r.opened_at,
        resolvedAt: r.resolved_at,
      })),
    };
  }

  private async lockOrder(trx: Kysely<Database>, id: string): Promise<OrderRow> {
    const o = await trx
      .selectFrom('orders')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!o) throw notFound('Order not found');
    return o;
  }
}
