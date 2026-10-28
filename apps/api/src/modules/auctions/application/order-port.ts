import { Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { Database } from '../../../db/schema.js';

export interface AuctionOrderInput {
  readonly auctionId: string;
  readonly listingId: string;
  readonly sellerCompanyId: string;
  readonly buyerCompanyId: string;
  readonly winningBidId: string;
  readonly unitPriceMinor: bigint;
  readonly quantityBase: bigint;
  readonly totalMinor: bigint;
  readonly depositMinor: bigint;
}

// Closing a sold auction calls this inside the closing transaction. S4 (orders) replaces the no-op by
// overriding the AUCTION_ORDER_PORT provider; it must be idempotent per auctionId (I6).
export interface AuctionOrderPort {
  createOrderFromAuction(trx: Kysely<Database>, input: AuctionOrderInput): Promise<void>;
}
export const AUCTION_ORDER_PORT = Symbol('AUCTION_ORDER_PORT');

@Injectable()
export class NoopAuctionOrderPort implements AuctionOrderPort {
  createOrderFromAuction(): Promise<void> {
    return Promise.resolve(); // S4 creates the order here.
  }
}
