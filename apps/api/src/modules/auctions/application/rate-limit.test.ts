import { describe, expect, it } from 'vitest';
import { BidRateLimiter } from './rate-limit.js';

describe('BidRateLimiter', () => {
  it('allows 3 per second per user, independently per user, and recovers', () => {
    const l = new BidRateLimiter(3, 1000);
    expect([1, 2, 3, 4].map(() => l.allow('u1', 10_000))).toEqual([true, true, true, false]);
    expect(l.allow('u2', 10_000)).toBe(true);
    expect(l.allow('u1', 10_999)).toBe(false);
    expect(l.allow('u1', 11_001)).toBe(true);
  });
});
