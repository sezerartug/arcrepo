import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../db/schema.js';
import { recordAudit } from '../../platform/index.js';
import { recordEvent, transitionStatus } from './support.js';

// What the orders module may do to auction state (called inside its own transaction). Money never
// moves here: the ledger is posted by orders; these functions only keep auction rows consistent.

// The winner's held deposit becomes 'applied' (it stays in deposit_held until the order is paid).
// Returns the applied amount, 0 when the winner has no held deposit.
export async function applyWinnerDeposit(
  trx: Kysely<Database>,
  auctionId: string,
  companyId: string,
): Promise<bigint> {
  const d = await trx
    .updateTable('deposits')
    .set({ status: 'applied' })
    .where('auction_id', '=', auctionId)
    .where('company_id', '=', companyId)
    .where('status', '=', 'held')
    .returning('amount_minor')
    .executeTakeFirst();
  return d?.amount_minor ?? 0n;
}

// An applied deposit that did not become payment: forfeited (buyer breach) or refunded (admin cancel).
export async function resolveAppliedDeposit(
  trx: Kysely<Database>,
  auctionId: string,
  companyId: string,
  to: 'forfeited' | 'refunded',
  actor: { actorType: 'user' | 'admin' | 'system'; actorId?: string },
): Promise<void> {
  const d = await trx
    .updateTable('deposits')
    .set({ status: to, settled_at: sql<Date>`clock_timestamp()` })
    .where('auction_id', '=', auctionId)
    .where('company_id', '=', companyId)
    .where('status', '=', 'applied')
    .returning(['id', 'amount_minor'])
    .executeTakeFirst();
  if (!d) return;
  await recordAudit(trx, {
    ...actor,
    companyId,
    action: `deposit.${to}`,
    entityType: 'deposit',
    entityId: d.id,
    data: { auctionId, amountMinor: d.amount_minor.toString() },
  });
}

// PAYMENT_PENDING -> SETTLED | PAYMENT_FAILED (AUCTION-RULES §1), idempotent for the target state.
export async function finishAuctionPayment(
  trx: Kysely<Database>,
  auctionId: string,
  to: 'SETTLED' | 'PAYMENT_FAILED',
): Promise<void> {
  const a = await trx
    .selectFrom('auctions')
    .select(['id', 'status', 'version', 'last_seq', 'seller_company_id'])
    .where('id', '=', auctionId)
    .forUpdate()
    .executeTakeFirstOrThrow();
  if (a.status === to) return;
  await transitionStatus(trx, a, to);
  const type = to === 'SETTLED' ? 'auction.settled' : 'auction.payment_failed';
  await recordEvent(trx, auctionId, a.last_seq, type, {});
  await recordAudit(trx, {
    actorType: 'system',
    companyId: a.seller_company_id,
    action: type,
    entityType: 'auction',
    entityId: auctionId,
  });
}
