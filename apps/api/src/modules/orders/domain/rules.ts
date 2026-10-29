import type { OrderStatus } from '../../../db/schema.js';

// ---- order state machine: the only place that decides which transitions exist ---------------------
const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  awaiting_payment: ['paid_escrow', 'cancelled', 'payment_failed'],
  paid_escrow: ['shipped'],
  shipped: ['delivered', 'disputed'],
  delivered: ['completed'],
  disputed: ['completed', 'refunded'],
  completed: [],
  refunded: [],
  cancelled: [],
  payment_failed: [],
};

export const ORDER_STATUSES = Object.keys(TRANSITIONS) as OrderStatus[];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new Error(`illegal order transition ${from} -> ${to}`);
}

// ---- money ----------------------------------------------------------------------------------------
// Seller commission on the VAT-exclusive total, round half up (OPEN-AU 11).
export function commissionMinor(totalMinor: bigint, bps: number): bigint {
  if (totalMinor < 0n) throw new RangeError('total must not be negative');
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) throw new RangeError('bps out of range');
  return (2n * totalMinor * BigInt(bps) + 10_000n) / 20_000n;
}

// Dispute resolution split of an escrowed order: `refundMinor` goes back to the buyer, the rest is the
// sale on which commission is taken (same bps, half up). refund + sellerPayout + commission === total.
export interface DisputeSplit {
  readonly refundMinor: bigint;
  readonly commissionMinor: bigint;
  readonly sellerPayoutMinor: bigint;
}
export function splitDispute(totalMinor: bigint, refundMinor: bigint, bps: number): DisputeSplit {
  if (refundMinor < 0n || refundMinor > totalMinor) throw new RangeError('refund out of range');
  const kept = totalMinor - refundMinor;
  const commission = commissionMinor(kept, bps);
  return { refundMinor, commissionMinor: commission, sellerPayoutMinor: kept - commission };
}
