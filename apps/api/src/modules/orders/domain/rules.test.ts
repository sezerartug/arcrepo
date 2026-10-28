import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, assertTransition, canTransition, commissionMinor } from './rules.js';

describe('order state machine', () => {
  const allowed = new Set([
    'awaiting_payment>paid_escrow',
    'awaiting_payment>cancelled',
    'awaiting_payment>payment_failed',
    'paid_escrow>shipped',
    'shipped>delivered',
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
    for (const s of ['completed', 'cancelled', 'payment_failed'] as const) {
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
