import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  assertTransition,
  canTransition,
  commissionMinor,
  splitDispute,
} from './rules.js';

describe('order state machine', () => {
  const allowed = new Set([
    'awaiting_payment>paid_escrow',
    'awaiting_payment>cancelled',
    'awaiting_payment>payment_failed',
    'paid_escrow>shipped',
    'shipped>delivered',
    'shipped>disputed',
    'disputed>completed',
    'disputed>refunded',
    'delivered>completed',
  ]);

  it('allows exactly the documented transitions and nothing else', () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        expect(canTransition(from, to), `${from}>${to}`).toBe(allowed.has(`${from}>${to}`));
      }
    }
  });

  it('throws on an illegal transition', () => {
    expect(() => {
      assertTransition('completed', 'shipped');
    }).toThrow(/illegal order transition/);
    expect(() => {
      assertTransition('awaiting_payment', 'shipped');
    }).toThrow();
    expect(() => {
      assertTransition('awaiting_payment', 'paid_escrow');
    }).not.toThrow();
  });

  it('terminal states have no way out', () => {
    for (const s of ['completed', 'refunded', 'cancelled', 'payment_failed'] as const) {
      expect(ORDER_STATUSES.some((to) => canTransition(s, to))).toBe(false);
    }
  });
});

describe('commissionMinor', () => {
  it('rounds half up', () => {
    expect(commissionMinor(1_000_000n, 200)).toBe(20_000n);
    expect(commissionMinor(25n, 200)).toBe(1n); // 0.5 -> 1
    expect(commissionMinor(24n, 200)).toBe(0n); // 0.48 -> 0
    expect(commissionMinor(100n, 0)).toBe(0n);
  });

  it('is never above the total and matches exact rational rounding', () => {
    fc.assert(
      fc.property(fc.bigInt(1n, 10n ** 15n), fc.integer({ min: 0, max: 10_000 }), (total, bps) => {
        const c = commissionMinor(total, bps);
        expect(c <= total).toBe(true);
        const exactTimes2 = 2n * total * BigInt(bps); // compare 2c with exact*2 +- 1 unit of 10_000
        expect(2n * c * 10_000n >= exactTimes2 - 10_000n).toBe(true);
        expect(2n * c * 10_000n <= exactTimes2 + 10_000n).toBe(true);
      }),
    );
  });
});

describe('splitDispute', () => {
  it('takes commission on the kept amount only', () => {
    // 24 500 000 total, 10 000 000 refunded: kept 14 500 000, 2 % = 290 000
    expect(splitDispute(24_500_000n, 10_000_000n, 200)).toEqual({
      refundMinor: 10_000_000n,
      commissionMinor: 290_000n,
      sellerPayoutMinor: 14_210_000n,
    });
    expect(splitDispute(1_000n, 1_000n, 200)).toEqual({
      refundMinor: 1_000n,
      commissionMinor: 0n,
      sellerPayoutMinor: 0n,
    });
    expect(splitDispute(1_000n, 0n, 200).commissionMinor).toBe(commissionMinor(1_000n, 200));
  });

  it('always sums to the total and rejects out-of-range refunds', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 10n ** 12n }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.integer({ min: 0, max: 10_000 }),
        (total, ratio, bps) => {
          const refund = BigInt(Math.floor(Number(total) * ratio));
          const s = splitDispute(total, refund > total ? total : refund, bps);
          expect(s.refundMinor + s.commissionMinor + s.sellerPayoutMinor).toBe(total);
          expect(s.sellerPayoutMinor >= 0n).toBe(true);
        },
      ),
    );
    expect(() => splitDispute(100n, 101n, 200)).toThrow(RangeError);
    expect(() => splitDispute(100n, -1n, 200)).toThrow(RangeError);
  });
});
