import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../db/schema.js';
import { postJournal } from '../../ledger/index.js';
import { recordAudit, type AuditEntry } from '../../platform/index.js';

type Actor = Pick<AuditEntry, 'actorType' | 'actorId'>;

// Money back: held deposits are refunded through the ledger (deposit_held -> bank_clearing); pending
// ones (no money received) are cancelled. `keepCompanyId` is the winner, whose deposit stays held.
// The caller holds the auction row lock, so a deposit cannot be confirmed concurrently.
export async function releaseDeposits(
  trx: Kysely<Database>,
  auctionId: string,
  keepCompanyId: string | null,
  actor: Actor,
): Promise<number> {
  const rows = await trx
    .selectFrom('deposits')
    .selectAll()
    .where('auction_id', '=', auctionId)
    .where('status', 'in', ['pending', 'held'])
    .orderBy('id')
    .forUpdate()
    .execute();
  let released = 0;
  for (const d of rows) {
    if (d.company_id === keepCompanyId) continue;
    if (d.status === 'held') {
      await postJournal(trx, {
        reason: 'deposit.refund',
        ref: { type: 'deposit', id: d.id },
        entries: [
          { account: { type: 'deposit_held' }, amountMinor: -d.amount_minor },
          { account: { type: 'bank_clearing' }, amountMinor: d.amount_minor },
        ],
      });
    }
    const to = d.status === 'held' ? 'refunded' : 'cancelled';
    await trx
      .updateTable('deposits')
      .set({ status: to, settled_at: sql<Date>`clock_timestamp()` })
      .where('id', '=', d.id)
      .execute();
    await recordAudit(trx, {
      ...actor,
      companyId: d.company_id,
      action: `deposit.${to}`,
      entityType: 'deposit',
      entityId: d.id,
      data: { auctionId, amountMinor: d.amount_minor.toString() },
    });
    released += 1;
  }
  return released;
}
