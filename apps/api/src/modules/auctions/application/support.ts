import type { Kysely, RawBuilder } from 'kysely';
import type { AuctionStatus, Database } from '../../../db/schema.js';
import { assertTransition } from '../domain/rules.js';
import type { AuctionOrderInput } from './order-port.js';

export interface AuctionConfig {
  // Background sweeper (SCHEDULED -> LIVE, LIVE -> closed). Lazy start/close still work when off.
  readonly sweeperEnabled: boolean;
  readonly sweepIntervalMs: number;
  readonly bidRateLimit: boolean;
}
export const AUCTION_CONFIG = Symbol('AUCTION_CONFIG');

// Tests switch the sweeper on explicitly; in NODE_ENV=test it is off by default.
export function readAuctionConfig(env: NodeJS.ProcessEnv = process.env): AuctionConfig {
  const sweep = Number(env.AUCTION_SWEEP_MS);
  return {
    sweeperEnabled: env.AUCTION_SWEEPER ? env.AUCTION_SWEEPER === 'on' : env.NODE_ENV !== 'test',
    sweepIntervalMs: Number.isInteger(sweep) && sweep >= 50 ? sweep : 1000,
    bidRateLimit: env.BID_RATE_LIMIT !== 'off',
  };
}

// The only code path that changes auctions.status (I9). The caller holds the row lock.
export async function transitionStatus(
  trx: Kysely<Database>,
  a: { id: string; status: AuctionStatus; version: number },
  to: AuctionStatus,
  set: { closed_at?: RawBuilder<Date>; cancel_reason?: string } = {},
): Promise<void> {
  assertTransition(a.status, to);
  const r = await trx
    .updateTable('auctions')
    .set({ status: to, version: a.version + 1, ...set })
    .where('id', '=', a.id)
    .where('status', '=', a.status)
    .executeTakeFirst();
  if (r.numUpdatedRows !== 1n) throw new Error('auction status changed concurrently');
}

export async function recordEvent(
  trx: Kysely<Database>,
  auctionId: string,
  seq: number,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await trx
    .insertInto('auction_events')
    .values({ auction_id: auctionId, seq, type, payload: JSON.stringify(payload) })
    .execute();
}

export type { AuctionOrderInput };
