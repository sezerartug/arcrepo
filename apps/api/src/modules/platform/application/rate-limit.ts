// In-memory abuse controls for the auth endpoints (MVP: single process, no Redis). The clock is
// injectable so tests move time without sleeping; none of this is a decision input for money or
// auction state, so the process clock is acceptable here.

export type Clock = () => number;

// Locks a key for `lockMs` after `max` recorded failures; a success clears it.
export class LockoutLimiter {
  private readonly entries = new Map<
    string,
    { failures: number; lockedUntil: number; at: number }
  >();

  constructor(
    private readonly max = 5,
    private readonly lockMs = 15 * 60_000,
    private readonly now: Clock = Date.now,
  ) {}

  /** Milliseconds the key stays locked (0 = not locked). */
  lockedForMs(key: string): number {
    const e = this.entries.get(key);
    return e && e.lockedUntil > this.now() ? e.lockedUntil - this.now() : 0;
  }

  fail(key: string): void {
    const t = this.now();
    const prev = this.entries.get(key);
    // Failures older than the lock window are forgotten.
    const failures = prev && t - prev.at < this.lockMs ? prev.failures + 1 : 1;
    this.entries.set(key, {
      failures,
      at: t,
      lockedUntil: failures >= this.max ? t + this.lockMs : 0,
    });
    if (this.entries.size > 10_000) this.prune(t);
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  private prune(t: number): void {
    for (const [k, e] of this.entries) if (t - e.at >= this.lockMs) this.entries.delete(k);
  }
}

// Sliding window: at most `max` hits per key per `windowMs`.
export class HitLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: Clock = Date.now,
  ) {}

  /** Records a hit; false when the key is over its limit (the hit is not counted then). */
  allow(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    const ok = recent.length < this.max;
    if (ok) recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits)
        if (v.every((x) => t - x >= this.windowMs)) this.hits.delete(k);
    }
    return ok;
  }
}
