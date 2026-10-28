import type { AuctionStatus } from '../../../db/schema.js';

// Pure auction rules (docs/AUCTION-RULES.md). No I/O: everything here is unit and property tested.
// Bid amounts are unit prices in minor units (kurus per sales unit), bigint.

// ---- §1 state machine: the only place that decides which transitions exist (I9) ---------------------
const TRANSITIONS: Readonly<Record<AuctionStatus, readonly AuctionStatus[]>> = {
  DRAFT: ['SCHEDULED'],
  SCHEDULED: ['LIVE', 'CANCELLED'],
  LIVE: ['PAYMENT_PENDING', 'ENDED_NO_SALE', 'CANCELLED'],
  PAYMENT_PENDING: ['SETTLED', 'PAYMENT_FAILED'],
  SETTLED: [],
  ENDED_NO_SALE: [],
  PAYMENT_FAILED: [],
  CANCELLED: [],
};

export const AUCTION_STATUSES = Object.keys(TRANSITIONS) as AuctionStatus[];

export function canTransition(from: AuctionStatus, to: AuctionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: AuctionStatus, to: AuctionStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`illegal auction transition ${from} -> ${to}`);
  }
}

// ---- pricing ----------------------------------------------------------------------------------------
export interface PriceState {
  readonly bidCount: number;
  readonly startPriceMinor: bigint;
  readonly currentPriceMinor: bigint | null;
  readonly minIncrementMinor: bigint;
}

// First bid: at least the start price. Later bids: current + increment.
export function minNextBid(s: PriceState): bigint {
  return s.bidCount === 0 || s.currentPriceMinor === null
    ? s.startPriceMinor
    : s.currentPriceMinor + s.minIncrementMinor;
}

// OPEN-AU-06: 5% of the total at start price, rounded up.
export const DEPOSIT_BPS = 500n;
export function depositMinor(startTotalMinor: bigint): bigint {
  if (startTotalMinor <= 0n) throw new RangeError('start total must be positive');
  return (startTotalMinor * DEPOSIT_BPS + 9_999n) / 10_000n;
}

// OPEN-AU-03: a missing reserve is always met.
export function reserveMet(reserveMinor: bigint | null, priceMinor: bigint): boolean {
  return reserveMinor === null || priceMinor >= reserveMinor;
}

// ---- §6 anti-sniping extension ------------------------------------------------------------------------
export interface ExtensionState {
  readonly endsAt: Date;
  readonly hardEndCap: Date;
  readonly windowMs: number;
  readonly extensionMs: number;
  readonly extensionCount: number;
  readonly maxExtensions: number;
}

export function computeExtension(s: ExtensionState, t: Date): { endsAt: Date; extended: boolean } {
  const unchanged = { endsAt: s.endsAt, extended: false };
  if (s.extensionCount >= s.maxExtensions) return unchanged;
  if (s.endsAt.getTime() - t.getTime() > s.windowMs) return unchanged;
  const target = Math.min(t.getTime() + s.extensionMs, s.hardEndCap.getTime());
  if (target <= s.endsAt.getTime()) return unchanged;
  return { endsAt: new Date(target), extended: true };
}

// ---- §4 step 4 bid validation (saturated order of checks matches the contract) ----------------------
export type RejectCode =
  | 'AUCTION_NOT_LIVE'
  | 'AUCTION_ENDED'
  | 'SELF_BID'
  | 'BIDDER_NOT_ELIGIBLE'
  | 'ALREADY_HIGH_BIDDER'
  | 'BID_TOO_LOW';

export interface BidContext extends PriceState {
  readonly status: AuctionStatus;
  readonly endsAt: Date;
  readonly sellerCompanyId: string;
  readonly highBidderCompanyId: string | null;
}

export interface BidInput {
  readonly bidderCompanyId: string;
  readonly eligible: boolean;
  readonly amountMinor: bigint;
}

export interface Rejection {
  readonly code: RejectCode;
  readonly minNextBidMinor?: bigint;
}

// t is the DB clock read after the row lock. I3: a bid at or after ends_at is never accepted.
export function validateBid(c: BidContext, b: BidInput, t: Date): Rejection | null {
  if (c.status !== 'LIVE') return { code: 'AUCTION_NOT_LIVE' };
  if (t.getTime() >= c.endsAt.getTime()) return { code: 'AUCTION_ENDED' };
  if (b.bidderCompanyId === c.sellerCompanyId) return { code: 'SELF_BID' };
  if (!b.eligible) return { code: 'BIDDER_NOT_ELIGIBLE' };
  if (c.highBidderCompanyId === b.bidderCompanyId) return { code: 'ALREADY_HIGH_BIDDER' };
  const min = minNextBid(c);
  if (b.amountMinor < min) return { code: 'BID_TOO_LOW', minNextBidMinor: min };
  return null;
}

// ---- §5 winner (I5) -----------------------------------------------------------------------------------
export interface AcceptedBid {
  readonly seq: number;
  readonly amountMinor: bigint;
}

export function pickWinner<T extends AcceptedBid>(bids: readonly T[]): T | null {
  let best: T | null = null;
  for (const b of bids) if (best === null || b.seq > best.seq) best = b;
  return best;
}
