import { sql, type Kysely } from 'kysely';
import type { Database, LedgerAccountType } from '../../db/schema.js';

// The single gate for money movement. Double entry in bigint minor units (TRY).
// Sign convention: a positive entry increases the account's balance, a negative one decreases it;
// every journal sums to zero (also enforced by a deferred constraint trigger in the database).

export interface AccountRef {
  readonly type: LedgerAccountType;
  // Required for seller_payable and buyer_credit; forbidden for system accounts.
  readonly companyId?: string;
}

export interface EntryInput {
  readonly account: AccountRef;
  readonly amountMinor: bigint;
}

export interface JournalInput {
  readonly entries: readonly EntryInput[];
  readonly reason: string;
  // Business event the journal belongs to; (reason, ref) is unique, so a retry cannot post twice.
  readonly ref?: { readonly type: string; readonly id: string };
}

export class LedgerError extends Error {
  override readonly name = 'LedgerError';
}

const PER_COMPANY: readonly LedgerAccountType[] = ['seller_payable', 'buyer_credit'];

export function assertBalanced(entries: readonly { readonly amountMinor: bigint }[]): void {
  if (entries.length < 2) throw new LedgerError('a journal needs at least two entries');
  let sum = 0n;
  for (const e of entries) {
    if (e.amountMinor === 0n) throw new LedgerError('entry amount must not be zero');
    sum += e.amountMinor;
  }
  if (sum !== 0n) throw new LedgerError(`journal is unbalanced (sum ${sum.toString()})`);
}

function assertAccountRef(a: AccountRef): void {
  if (PER_COMPANY.includes(a.type) ? a.companyId !== undefined : a.companyId === undefined) return;
  throw new LedgerError(`account ${a.type} has an invalid company scope`);
}

export async function ensureAccount(db: Kysely<Database>, a: AccountRef): Promise<string> {
  assertAccountRef(a);
  const find = () =>
    db
      .selectFrom('ledger_accounts')
      .select('id')
      .where('type', '=', a.type)
      .where(
        a.companyId === undefined
          ? sql<boolean>`company_id is null`
          : sql<boolean>`company_id = ${a.companyId}`,
      )
      .executeTakeFirst();
  const existing = await find();
  if (existing) return existing.id;
  await db
    .insertInto('ledger_accounts')
    .values({ type: a.type, company_id: a.companyId ?? null })
    .onConflict((oc) => oc.doNothing())
    .execute();
  const created = await find();
  if (!created) throw new LedgerError('could not create ledger account');
  return created.id;
}

// Call with the business transaction so money and state commit together.
export async function postJournal(trx: Kysely<Database>, journal: JournalInput): Promise<string> {
  assertBalanced(journal.entries);
  const header = await trx
    .insertInto('ledger_journals')
    .values({
      reason: journal.reason,
      ref_type: journal.ref?.type ?? null,
      ref_id: journal.ref?.id ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  for (const e of journal.entries) {
    await trx
      .insertInto('ledger_entries')
      .values({
        journal_id: header.id,
        account_id: await ensureAccount(trx, e.account),
        amount_minor: e.amountMinor,
      })
      .execute();
  }
  return header.id;
}

export async function accountBalance(db: Kysely<Database>, a: AccountRef): Promise<bigint> {
  const id = await ensureAccount(db, a);
  const row = await db
    .selectFrom('ledger_entries')
    .select(sql<bigint>`coalesce(sum(amount_minor), 0)::bigint`.as('balance'))
    .where('account_id', '=', id)
    .executeTakeFirstOrThrow();
  return row.balance;
}

// Sum of every entry in the ledger: always 0 (I7).
export async function ledgerTotal(db: Kysely<Database>): Promise<bigint> {
  const row = await db
    .selectFrom('ledger_entries')
    .select(sql<bigint>`coalesce(sum(amount_minor), 0)::bigint`.as('total'))
    .executeTakeFirstOrThrow();
  return row.total;
}
