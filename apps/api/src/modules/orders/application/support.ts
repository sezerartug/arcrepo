import { randomInt } from 'node:crypto';
import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { Database, OrderStatus } from '../../../db/schema.js';
import { recordAudit } from '../../platform/index.js';
import { assertTransition } from '../domain/rules.js';

export const DEMO_IBAN = 'TR00 DEMO 0000 0000 0000 0000 00';
export const ORDER_REF_PREFIX = 'ARC-O-';
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const newOrderReference = (): string =>
  ORDER_REF_PREFIX +
  Array.from({ length: 6 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join('');

export interface OrderConfig {
  readonly commissionBps: number;
  readonly paymentHours: number;
  // A shipped order is confirmed automatically this many days after shipping (product decision: 7).
  readonly autoConfirmDays: number;
  // Background sweeper for unpaid orders. Off in NODE_ENV=test unless ORDER_SWEEPER=on.
  readonly sweeperEnabled: boolean;
  readonly sweepIntervalMs: number;
}
export const ORDER_CONFIG = Symbol('ORDER_CONFIG');

export function readOrderConfig(env: NodeJS.ProcessEnv = process.env): OrderConfig {
  const bps = Number(env.COMMISSION_BPS ?? '200');
  const hours = Number(env.ORDER_PAYMENT_HOURS ?? '48');
  const autoDays = Number(env.AUTO_CONFIRM_DAYS ?? '7');
  const sweep = Number(env.ORDER_SWEEP_MS);
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new Error('COMMISSION_BPS must be an integer between 0 and 10000');
  }
  if (!Number.isInteger(hours) || hours < 1 || hours > 24 * 30) {
    throw new Error('ORDER_PAYMENT_HOURS must be an integer between 1 and 720');
  }
  if (!Number.isInteger(autoDays) || autoDays < 1 || autoDays > 90) {
    throw new Error('AUTO_CONFIRM_DAYS must be an integer between 1 and 90');
  }
  return {
    commissionBps: bps,
    paymentHours: hours,
    autoConfirmDays: autoDays,
    sweeperEnabled: env.ORDER_SWEEPER ? env.ORDER_SWEEPER === 'on' : env.NODE_ENV !== 'test',
    sweepIntervalMs: Number.isInteger(sweep) && sweep >= 50 ? sweep : 30_000,
  };
}

type Stamp = {
  [
    K in 'paid_at' | 'shipped_at' | 'delivered_at' | 'completed_at' | 'cancelled_at'
  ]?: RawBuilder<Date>;
};
const now = sql<Date>`clock_timestamp()`;
function stampFor(to: OrderStatus): Stamp {
  switch (to) {
    case 'paid_escrow':
      return { paid_at: now };
    case 'shipped':
      return { shipped_at: now };
    case 'delivered':
      return { delivered_at: now };
    case 'completed':
      return { completed_at: now };
    case 'cancelled':
    case 'payment_failed':
      return { cancelled_at: now };
    default:
      return {};
  }
}

// The only code path that changes orders.status. The caller holds the order row lock. Writes the
// timeline entry in the same transaction.
export async function transitionOrder(
  trx: Kysely<Database>,
  o: { id: string; status: OrderStatus },
  to: OrderStatus,
  extra: { tracking_note?: string; cancel_reason?: string } = {},
  data: Record<string, unknown> = {},
): Promise<void> {
  assertTransition(o.status, to);
  const r = await trx
    .updateTable('orders')
    .set({ status: to, ...stampFor(to), ...extra })
    .where('id', '=', o.id)
    .where('status', '=', o.status)
    .executeTakeFirst();
  if (r.numUpdatedRows !== 1n) throw new Error('order status changed concurrently');
  await addOrderEvent(trx, o.id, `order.${to}`, o.status, to, data);
}

export async function addOrderEvent(
  trx: Kysely<Database>,
  orderId: string,
  type: string,
  from: OrderStatus | null,
  to: OrderStatus | null,
  data: Record<string, unknown> = {},
): Promise<void> {
  await trx
    .insertInto('order_events')
    .values({
      order_id: orderId,
      type,
      from_status: from,
      to_status: to,
      data: JSON.stringify(data),
    })
    .execute();
}

export interface NewOrder {
  readonly listingId: string;
  readonly auctionId: string | null;
  readonly buyerCompanyId: string;
  readonly sellerCompanyId: string;
  readonly unitPriceMinor: bigint;
  readonly quantityBase: bigint;
  readonly basePerUnit: number;
  readonly totalMinor: bigint;
  readonly commissionMinor: bigint;
  readonly depositAppliedMinor: bigint;
}

// awaiting_payment order with a unique ARC-O reference and a payment deadline on the DB clock.
export async function insertOrder(
  trx: Kysely<Database>,
  cfg: OrderConfig,
  p: NewOrder,
  actor: { actorType: 'user' | 'system'; actorId?: string },
): Promise<{ id: string; paymentReference: string }> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const paymentReference = newOrderReference();
    const row = await trx
      .insertInto('orders')
      .values({
        source_listing_id: p.listingId,
        source_auction_id: p.auctionId,
        buyer_company_id: p.buyerCompanyId,
        seller_company_id: p.sellerCompanyId,
        unit_price_minor: p.unitPriceMinor,
        quantity_base: p.quantityBase,
        base_per_unit: p.basePerUnit,
        total_minor: p.totalMinor,
        commission_minor: p.commissionMinor,
        deposit_applied_minor: p.depositAppliedMinor,
        amount_due_minor: p.totalMinor - p.depositAppliedMinor,
        status: 'awaiting_payment',
        payment_reference: paymentReference,
        payment_due_at: sql<Date>`clock_timestamp() + make_interval(hours => ${cfg.paymentHours})`,
      })
      .onConflict((oc) => oc.column('payment_reference').doNothing())
      .returning('id')
      .executeTakeFirst();
    if (!row) continue; // reference collision: draw another
    const data = {
      totalMinor: p.totalMinor.toString(),
      depositAppliedMinor: p.depositAppliedMinor.toString(),
      auctionId: p.auctionId,
    };
    await addOrderEvent(trx, row.id, 'order.created', null, 'awaiting_payment', data);
    await recordAudit(trx, {
      ...actor,
      companyId: p.buyerCompanyId,
      action: 'order.created',
      entityType: 'order',
      entityId: row.id,
      data: { ...data, listingId: p.listingId, sellerCompanyId: p.sellerCompanyId },
    });
    return { id: row.id, paymentReference };
  }
  throw new Error('could not allocate an order reference');
}
