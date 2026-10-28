import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AuctionStatus } from '../../../db/schema.js';
import { lineTotalMinor } from '../../pricing/index.js';
import {
  AUCTION_STATUSES,
  assertTransition,
  canTransition,
  computeExtension,
  depositMinor,
  minNextBid,
  pickWinner,
  reserveMet,
  validateBid,
  type BidContext,
  type ExtensionState,
} from './rules.js';

const T0 = new Date('2026-11-01T10:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

describe('state machine (I9)', () => {
  const allowed: [AuctionStatus, AuctionStatus][] = [
    ['DRAFT', 'SCHEDULED'],
    ['SCHEDULED', 'LIVE'],
    ['SCHEDULED', 'CANCELLED'],
    ['LIVE', 'PAYMENT_PENDING'],
    ['LIVE', 'ENDED_NO_SALE'],
    ['LIVE', 'CANCELLED'],
    ['PAYMENT_PENDING', 'SETTLED'],
    ['PAYMENT_PENDING', 'PAYMENT_FAILED'],
  ];
  it('allows exactly the transitions of AUCTION-RULES §1', () => {
    for (const from of AUCTION_STATUSES) {
      for (const to of AUCTION_STATUSES) {
        const expected = allowed.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to)).toBe(expected);
        if (!expected)
          expect(() => {
            assertTransition(from, to);
          }).toThrow();
      }
    }
  });
  it('terminal states have no exits', () => {
    for (const s of ['SETTLED', 'ENDED_NO_SALE', 'PAYMENT_FAILED', 'CANCELLED'] as const) {
      expect(AUCTION_STATUSES.some((to) => canTransition(s, to))).toBe(false);
    }
  });
});

describe('minNextBid, deposit, reserve', () => {
  it('first bid needs the start price, later bids current + increment', () => {
    const base = { startPriceMinor: 1000n, minIncrementMinor: 50n };
    expect(minNextBid({ ...base, bidCount: 0, currentPriceMinor: null })).toBe(1000n);
    expect(minNextBid({ ...base, bidCount: 3, currentPriceMinor: 1200n })).toBe(1250n);
  });
  it('deposit is 5% rounded up', () => {
    expect(depositMinor(100_000n)).toBe(5_000n);
    expect(depositMinor(100_001n)).toBe(5_001n);
    expect(depositMinor(1n)).toBe(1n);
    // 24500 TL/ton * 50 ton (50000 kg)
    expect(depositMinor(lineTotalMinor(2_450_000n, 50_000n, 1000n))).toBe(6_125_000n);
  });
  it('property: deposit >= 5% and less than 5% + 1 minor unit', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 1n, max: 10n ** 14n }), (total) => {
        const d = depositMinor(total);
        expect(d * 100n >= total * 5n).toBe(true);
        expect((d - 1n) * 100n < total * 5n).toBe(true);
      }),
    );
  });
  it('reserve: absent is met, otherwise price must reach it', () => {
    expect(reserveMet(null, 1n)).toBe(true);
    expect(reserveMet(500n, 499n)).toBe(false);
    expect(reserveMet(500n, 500n)).toBe(true);
  });
});

describe('computeExtension (anti-sniping)', () => {
  const s: ExtensionState = {
    endsAt: at(120_000),
    hardEndCap: at(120_000 + 15 * 60_000),
    windowMs: 60_000,
    extensionMs: 60_000,
    extensionCount: 0,
    maxExtensions: 10,
  };
  it('does not extend outside the window', () => {
    expect(computeExtension(s, at(59_000)).extended).toBe(false);
  });
  it('extends to t + 60 s inside the window', () => {
    const r = computeExtension(s, at(61_000));
    expect(r.extended).toBe(true);
    expect(r.endsAt.getTime()).toBe(at(121_000).getTime());
  });
  it('respects the extension count and the hard cap', () => {
    expect(computeExtension({ ...s, extensionCount: 10 }, at(119_000)).extended).toBe(false);
    const near = { ...s, endsAt: at(1000), hardEndCap: at(30_000) };
    expect(computeExtension(near, at(500)).endsAt.getTime()).toBe(at(30_000).getTime());
    const capped = { ...s, endsAt: at(30_000), hardEndCap: at(30_000) };
    expect(computeExtension(capped, at(29_000)).extended).toBe(false);
  });
  it('property: never moves the end backwards or past the cap', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200_000 }),
        fc.integer({ min: 0, max: 12 }),
        fc.integer({ min: 0, max: 400_000 }),
        (tOffset, count, capOffset) => {
          const state = {
            ...s,
            extensionCount: count,
            hardEndCap: at(Math.max(120_000, capOffset)),
          };
          const r = computeExtension(state, at(Math.min(tOffset, 119_999)));
          expect(r.endsAt.getTime()).toBeGreaterThanOrEqual(state.endsAt.getTime());
          expect(r.endsAt.getTime()).toBeLessThanOrEqual(state.hardEndCap.getTime());
        },
      ),
    );
  });
});

describe('validateBid', () => {
  const ctx: BidContext = {
    status: 'LIVE',
    endsAt: at(60_000),
    sellerCompanyId: 'seller',
    highBidderCompanyId: 'high',
    bidCount: 1,
    startPriceMinor: 1000n,
    currentPriceMinor: 1000n,
    minIncrementMinor: 100n,
  };
  const bid = { bidderCompanyId: 'b1', eligible: true, amountMinor: 1100n };

  it('accepts a valid bid', () => {
    expect(validateBid(ctx, bid, at(0))).toBeNull();
  });
  it('rejects in the documented order', () => {
    expect(validateBid({ ...ctx, status: 'SCHEDULED' }, bid, at(0))?.code).toBe('AUCTION_NOT_LIVE');
    expect(validateBid(ctx, bid, at(60_000))?.code).toBe('AUCTION_ENDED'); // I3: equal is ended
    expect(validateBid(ctx, { ...bid, bidderCompanyId: 'seller' }, at(0))?.code).toBe('SELF_BID');
    expect(validateBid(ctx, { ...bid, eligible: false }, at(0))?.code).toBe('BIDDER_NOT_ELIGIBLE');
    expect(validateBid(ctx, { ...bid, bidderCompanyId: 'high' }, at(0))?.code).toBe(
      'ALREADY_HIGH_BIDDER',
    );
    const low = validateBid(ctx, { ...bid, amountMinor: 1099n }, at(0));
    expect(low).toEqual({ code: 'BID_TOO_LOW', minNextBidMinor: 1100n });
  });
  it('property: a sequence of accepted bids is gapless, strictly increasing by >= increment (I1, I2, I5)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            company: fc.integer({ min: 0, max: 4 }),
            amount: fc.bigInt({ min: 1n, max: 100_000n }),
          }),
          { maxLength: 80 },
        ),
        (attempts) => {
          let c: BidContext = {
            ...ctx,
            bidCount: 0,
            currentPriceMinor: null,
            highBidderCompanyId: null,
          };
          const accepted: { seq: number; amountMinor: bigint }[] = [];
          for (const a of attempts) {
            const b = {
              bidderCompanyId: `c${String(a.company)}`,
              eligible: true,
              amountMinor: a.amount,
            };
            if (validateBid(c, b, at(0)) === null) {
              accepted.push({ seq: accepted.length + 1, amountMinor: a.amount });
              c = {
                ...c,
                bidCount: c.bidCount + 1,
                currentPriceMinor: a.amount,
                highBidderCompanyId: b.bidderCompanyId,
              };
            }
          }
          accepted.forEach((x, i) => {
            expect(x.seq).toBe(i + 1);
            const prev = accepted[i - 1];
            if (prev) expect(x.amountMinor - prev.amountMinor >= 100n).toBe(true);
            else expect(x.amountMinor >= 1000n).toBe(true);
          });
          const winner = pickWinner(accepted);
          expect(winner?.seq).toBe(accepted.length === 0 ? undefined : accepted.length);
          if (winner) expect(winner.amountMinor).toBe(c.currentPriceMinor);
        },
      ),
    );
  });
});
