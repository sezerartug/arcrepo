import type { Kysely } from 'kysely';
import { dbNow } from '../../../db/clock.js';
import type { Database } from '../../../db/schema.js';
import { lineTotalMinor } from '../../pricing/index.js';
import { recordAudit } from '../../platform/index.js';
import { depositMinor } from '../domain/rules.js';
import { recordEvent, transitionStatus } from './support.js';

export interface AuctionSource {
  readonly listingId: string;
  readonly companyId: string;
  readonly quantityBase: bigint;
  readonly basePerUnit: number;
  // The listing's auction_draft (strings): startPriceMinor, minIncrementMinor, reserveMinor?, startsAt, endsAt.
  readonly draft: Readonly<Record<string, string>>;
}

const HARD_CAP_MS = 15 * 60_000; // OPEN-AU-02: first ends_at + 15 min

// Runs inside the transaction that publishes the listing. DRAFT -> SCHEDULED, and straight to LIVE when
// starts_at has already passed (DB clock).
export async function createAuctionFromListing(
  trx: Kysely<Database>,
  src: AuctionSource,
): Promise<{ id: string }> {
  const d = src.draft;
  const startPrice = BigInt(d.startPriceMinor ?? '');
  const endsAt = new Date(d.endsAt ?? '');
  const startsAt = new Date(d.startsAt ?? '');
  const row = await trx
    .insertInto('auctions')
    .values({
      listing_id: src.listingId,
      seller_company_id: src.companyId,
      status: 'DRAFT',
      start_price_minor: startPrice,
      min_increment_minor: BigInt(d.minIncrementMinor ?? ''),
      reserve_minor: d.reserveMinor ? BigInt(d.reserveMinor) : null,
      quantity_base: src.quantityBase,
      base_per_unit: src.basePerUnit,
      deposit_minor: depositMinor(
        lineTotalMinor(startPrice, src.quantityBase, BigInt(src.basePerUnit)),
      ),
      starts_at: startsAt,
      ends_at: endsAt,
      original_ends_at: endsAt,
      hard_end_cap: new Date(endsAt.getTime() + HARD_CAP_MS),
    })
    .returning(['id', 'status', 'version'])
    .executeTakeFirstOrThrow();

  const a = { id: row.id, status: row.status, version: row.version };
  await transitionStatus(trx, a, 'SCHEDULED');
  a.status = 'SCHEDULED';
  a.version += 1;
  if (startsAt <= (await dbNow(trx))) await transitionStatus(trx, a, 'LIVE');
  await recordEvent(trx, row.id, 0, 'auction.scheduled', { startsAt, endsAt });
  await recordAudit(trx, {
    actorType: 'system',
    companyId: src.companyId,
    action: 'auction.created',
    entityType: 'auction',
    entityId: row.id,
    data: { listingId: src.listingId, startPriceMinor: startPrice.toString() },
  });
  return { id: row.id };
}
