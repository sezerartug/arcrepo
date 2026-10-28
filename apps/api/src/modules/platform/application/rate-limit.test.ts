import { describe, expect, it } from 'vitest';
import { HitLimiter, LockoutLimiter } from './rate-limit.js';

describe('LockoutLimiter', () => {
  it('locks for 15 minutes after 5 failures and unlocks on time', () => {
    let now = 1_000_000;
    const l = new LockoutLimiter(5, 15 * 60_000, () => now);
    for (let i = 0; i < 4; i += 1) l.fail('k');
    expect(l.lockedForMs('k')).toBe(0);
    l.fail('k');
    expect(l.lockedForMs('k')).toBe(15 * 60_000);
    now += 14 * 60_000;
    expect(l.lockedForMs('k')).toBe(60_000);
    now += 60_000;
    expect(l.lockedForMs('k')).toBe(0);
    // after the lock the counter starts over: 4 more failures do not lock again
    for (let i = 0; i < 4; i += 1) l.fail('k');
    expect(l.lockedForMs('k')).toBe(0);
  });

  it('a success (reset) clears the counter; keys are independent', () => {
    const l = new LockoutLimiter(5, 15 * 60_000, () => 0);
    for (let i = 0; i < 4; i += 1) l.fail('a');
    l.reset('a');
    l.fail('a');
    expect(l.lockedForMs('a')).toBe(0);
    for (let i = 0; i < 5; i += 1) l.fail('b');
    expect(l.lockedForMs('b')).toBeGreaterThan(0);
    expect(l.lockedForMs('a')).toBe(0);
  });

  it('forgets stale failures', () => {
    let now = 0;
    const l = new LockoutLimiter(5, 15 * 60_000, () => now);
    for (let i = 0; i < 4; i += 1) l.fail('k');
    now += 16 * 60_000;
    l.fail('k');
    expect(l.lockedForMs('k')).toBe(0);
  });
});

describe('HitLimiter', () => {
  it('allows max hits per window, then refuses until the window slides', () => {
    let now = 0;
    const l = new HitLimiter(3, 1000, () => now);
    expect([l.allow('ip'), l.allow('ip'), l.allow('ip'), l.allow('ip')]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(l.allow('other')).toBe(true);
    now = 1000;
    expect(l.allow('ip')).toBe(true);
  });
});
