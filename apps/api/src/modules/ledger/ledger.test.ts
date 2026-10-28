import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LedgerError, assertBalanced } from './ledger.js';

const amount = fc.bigInt({ min: 1n, max: 10n ** 12n });

// A valid journal: arbitrary positive credits balanced by one debit.
const validJournal = fc
  .array(amount, { minLength: 1, maxLength: 8 })
  .map((credits) => [
    ...credits.map((c) => ({ amountMinor: c })),
    { amountMinor: -credits.reduce((s, c) => s + c, 0n) },
  ]);

describe('assertBalanced', () => {
  it('accepts every balanced journal and the entries sum to zero', () => {
    fc.assert(
      fc.property(validJournal, (entries) => {
        assertBalanced(entries);
        expect(entries.reduce((s, e) => s + e.amountMinor, 0n)).toBe(0n);
      }),
    );
  });

  it('rejects any journal whose sum is not zero', () => {
    fc.assert(
      fc.property(validJournal, fc.bigInt({ min: 1n, max: 1000n }), (entries, skew) => {
        const bad = [...entries, { amountMinor: skew }];
        expect(() => {
          assertBalanced(bad);
        }).toThrow(LedgerError);
      }),
    );
  });

  it('rejects empty, single-entry and zero-amount journals', () => {
    expect(() => {
      assertBalanced([]);
    }).toThrow(LedgerError);
    expect(() => {
      assertBalanced([{ amountMinor: 0n }]);
    }).toThrow(LedgerError);
    expect(() => {
      assertBalanced([{ amountMinor: 5n }, { amountMinor: -5n }, { amountMinor: 0n }]);
    }).toThrow(LedgerError);
  });
});
