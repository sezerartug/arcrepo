// Abuse control v1 (AUCTION-RULES §9): at most `max` bid requests per user per `windowMs`, in memory.
// Not a decision input for auction state, so the process clock is acceptable here.
export class BidRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max = 3,
    private readonly windowMs = 1000,
  ) {}

  allow(userId: string, now = Date.now()): boolean {
    const recent = (this.hits.get(userId) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(userId, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(userId, recent);
    if (this.hits.size > 10_000) this.prune(now);
    return true;
  }

  private prune(now: number): void {
    for (const [k, v] of this.hits) {
      if (v.every((t) => now - t >= this.windowMs)) this.hits.delete(k);
    }
  }
}
