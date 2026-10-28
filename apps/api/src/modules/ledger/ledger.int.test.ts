import fc from 'fast-check';
import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../db/schema.js';
import { createTestDb } from '../../test/db.js';
import { LedgerError, accountBalance, ledgerTotal, postJournal, type AccountRef } from './index.js';

let db: Kysely<Database>;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.destroy();
});

const SYSTEM: AccountRef[] = [
  { type: 'bank_clearing' },
  { type: 'deposit_held' },
  { type: 'escrow' },
  { type: 'platform_revenue' },
];

describe('ledger (real PostgreSQL)', () => {
  it('property: random valid journals keep total 0 and balances equal the model', async () => {
    const model = new Map<string, bigint>();
    const step = fc.record({
      from: fc.integer({ min: 0, max: 3 }),
      to: fc.integer({ min: 0, max: 3 }),
      amount: fc.bigInt({ min: 1n, max: 10n ** 9n }),
    });
    await fc.assert(
      fc.asyncProperty(fc.array(step, { minLength: 1, maxLength: 6 }), async (steps) => {
        await db.transaction().execute(async (trx) => {
          for (const s of steps) {
            const from = SYSTEM[s.from] as AccountRef;
            const to = SYSTEM[s.to] as AccountRef;
            if (from.type === to.type) continue;
            await postJournal(trx, {
              reason: 'test.transfer',
              entries: [
                { account: from, amountMinor: -s.amount },
                { account: to, amountMinor: s.amount },
              ],
            });
            model.set(from.type, (model.get(from.type) ?? 0n) - s.amount);
            model.set(to.type, (model.get(to.type) ?? 0n) + s.amount);
          }
        });
        expect(await ledgerTotal(db)).toBe(0n);
        for (const a of SYSTEM) expect(await accountBalance(db, a)).toBe(model.get(a.type) ?? 0n);
      }),
      { numRuns: 25 },
    );
  });

  it('refuses an unbalanced journal in the service', async () => {
    await expect(
      db.transaction().execute((trx) =>
        postJournal(trx, {
          reason: 'test.bad',
          entries: [
            { account: { type: 'escrow' }, amountMinor: 10n },
            { account: { type: 'bank_clearing' }, amountMinor: -9n },
          ],
        }),
      ),
    ).rejects.toThrow(LedgerError);
  });

  it('the database itself refuses unbalanced entries at commit, and updates and deletes', async () => {
    const accounts = await db.selectFrom('ledger_accounts').select('id').limit(1).execute();
    const accountId = accounts[0]?.id as string;
    await expect(
      db.transaction().execute(async (trx) => {
        const j = await trx
          .insertInto('ledger_journals')
          .values({ reason: 'test.raw', ref_type: null, ref_id: null })
          .returning('id')
          .executeTakeFirstOrThrow();
        await trx
          .insertInto('ledger_entries')
          .values({ journal_id: j.id, account_id: accountId, amount_minor: 5n })
          .execute();
      }),
    ).rejects.toThrow(/unbalanced/);
    await expect(sql`update ledger_entries set amount_minor = 1`.execute(db)).rejects.toThrow(
      /append-only/,
    );
    await expect(sql`delete from ledger_journals`.execute(db)).rejects.toThrow(/append-only/);
  });

  it('a (reason, ref) pair posts at most once', async () => {
    const ref = { type: 'test', id: '0198f6c0-0000-7000-8000-000000000001' };
    const post = () =>
      db.transaction().execute((trx) =>
        postJournal(trx, {
          reason: 'test.once',
          ref,
          entries: [
            { account: { type: 'escrow' }, amountMinor: 3n },
            { account: { type: 'bank_clearing' }, amountMinor: -3n },
          ],
        }),
      );
    await post();
    await expect(post()).rejects.toThrow();
  });
});
