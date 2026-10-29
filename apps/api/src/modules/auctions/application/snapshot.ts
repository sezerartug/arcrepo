import { sql, type Kysely } from 'kysely';
import { dbNow } from '../../../db/clock.js';
import type { AuctionStatus, Database } from '../../../db/schema.js';
import type { AuthContext } from '../../identity/index.js';
import { notFound } from '../../platform/index.js';
import { minNextBid } from '../domain/rules.js';

const LIVE_GROUPS: Record<string, readonly AuctionStatus[]> = {
  live: ['LIVE'],
  scheduled: ['SCHEDULED'],
  closed: ['PAYMENT_PENDING', 'SETTLED', 'ENDED_NO_SALE', 'PAYMENT_FAILED', 'CANCELLED'],
};

export async function listAuctions(db: Kysely<Database>, status: unknown) {
  let q = db
    .selectFrom('auctions as a')
    .innerJoin('listings as l', 'l.id', 'a.listing_id')
    .select((eb) => [
      'a.id',
      'a.listing_id',
      'l.title',
      'a.status',
      'a.start_price_minor',
      'a.current_price_minor',
      'a.min_increment_minor',
      'a.bid_count',
      'a.starts_at',
      'a.ends_at',
      'a.deposit_minor',
      eb
        .selectFrom('listing_images as i')
        .select('i.file_name')
        .whereRef('i.listing_id', '=', 'a.listing_id')
        .orderBy('i.position')
        .orderBy('i.id')
        .limit(1)
        .as('image_file'),
    ])
    .limit(100);
  const group = typeof status === 'string' ? LIVE_GROUPS[status] : undefined;
  if (group) q = q.where('a.status', 'in', group);
  q = status === 'closed' ? q.orderBy('a.ends_at', 'desc') : q.orderBy('a.ends_at', 'asc');
  const [rows, serverNow] = await Promise.all([q.execute(), dbNow(db)]);
  return {
    serverNow,
    items: rows.map((r) => ({
      id: r.id,
      listingId: r.listing_id,
      title: r.title,
      status: r.status,
      startPriceMinor: r.start_price_minor,
      currentPriceMinor: r.current_price_minor,
      minNextBidMinor: minNextBid({
        bidCount: r.bid_count,
        startPriceMinor: r.start_price_minor,
        currentPriceMinor: r.current_price_minor,
        minIncrementMinor: r.min_increment_minor,
      }),
      bidCount: r.bid_count,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      depositMinor: r.deposit_minor,
      imageUrl: r.image_file ? `/uploads/${r.image_file}` : null,
    })),
  };
}

// MVP-PLAN contract: GET /auctions/:id. Bidders are anonymous ("Teklif veren #n"), the reserve is
// visible to the seller and admins only. Pass a transaction to get a view consistent with it.
export async function buildSnapshot(
  db: Kysely<Database>,
  auctionId: string,
  actor: AuthContext | null,
) {
  const a = await db
    .selectFrom('auctions as a')
    .innerJoin('listings as l', 'l.id', 'a.listing_id')
    .selectAll('a')
    .select('l.title')
    .where('a.id', '=', auctionId)
    .executeTakeFirst();
  if (!a) throw notFound('Auction not found');
  const serverNow = await dbNow(db);
  const myCompanyId = actor?.company?.id ?? null;
  const privileged = !!actor && (actor.isAdmin || myCompanyId === a.seller_company_id);

  const recent = await db
    .selectFrom('bids as b')
    .innerJoin('companies as c', 'c.id', 'b.bidder_company_id')
    .select(['b.seq', 'b.amount_minor', 'b.accepted_at', 'b.bidder_company_id', 'c.legal_name'])
    .where('b.auction_id', '=', auctionId)
    .orderBy('b.seq', 'desc')
    .limit(20)
    .execute();
  const firsts = await db
    .selectFrom('bids')
    .select(['bidder_company_id', sql<number>`min(seq)`.as('first_seq')])
    .where('auction_id', '=', auctionId)
    .groupBy('bidder_company_id')
    .orderBy('first_seq')
    .execute();
  const alias = new Map(
    firsts.map((f, i) => [f.bidder_company_id, `Teklif veren #${String(i + 1)}`]),
  );

  const deposit = myCompanyId
    ? await db
        .selectFrom('deposits')
        .select(['status', 'reference'])
        .where('auction_id', '=', auctionId)
        .where('company_id', '=', myCompanyId)
        .executeTakeFirst()
    : undefined;
  const result = await db
    .selectFrom('auction_results as r')
    .leftJoin('companies as c', 'c.id', 'r.winner_company_id')
    .select([
      'r.outcome',
      'r.winner_company_id',
      'r.final_price_minor',
      'r.total_minor',
      'c.legal_name',
    ])
    .where('r.auction_id', '=', auctionId)
    .executeTakeFirst();

  const isSeller = myCompanyId === a.seller_company_id;
  const highCompany = recent[0]?.bidder_company_id ?? null;
  const winnerCompany = result?.outcome === 'sold' ? result.winner_company_id : null;
  return {
    id: a.id,
    listingId: a.listing_id,
    title: a.title,
    status: a.status,
    startPriceMinor: a.start_price_minor,
    minIncrementMinor: a.min_increment_minor,
    currentPriceMinor: a.current_price_minor,
    minNextBidMinor: minNextBid({
      bidCount: a.bid_count,
      startPriceMinor: a.start_price_minor,
      currentPriceMinor: a.current_price_minor,
      minIncrementMinor: a.min_increment_minor,
    }),
    bidCount: a.bid_count,
    quantityBase: a.quantity_base,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    serverNow,
    depositMinor: a.deposit_minor,
    ...(privileged
      ? {
          reserveMinor: a.reserve_minor,
          reserveMet: a.reserve_minor === null || (a.current_price_minor ?? 0n) >= a.reserve_minor,
        }
      : {}),
    bids: recent.map((b) => ({
      seq: b.seq,
      amountMinor: b.amount_minor,
      bidder: alias.get(b.bidder_company_id) ?? 'Teklif veren',
      ...(privileged ? { bidderName: b.legal_name } : {}),
      at: b.accepted_at,
    })),
    ...(result?.outcome === 'sold'
      ? {
          winner: {
            bidder: alias.get(result.winner_company_id ?? '') ?? 'Teklif veren',
            finalPriceMinor: result.final_price_minor,
            totalMinor: result.total_minor,
            ...(privileged ? { bidderName: result.legal_name } : {}),
          },
        }
      : {}),
    myState: {
      eligible:
        !!actor?.company &&
        actor.company.status === 'verified' &&
        !isSeller &&
        deposit?.status === 'held',
      depositStatus: deposit?.status ?? 'none',
      ...(deposit ? { depositReference: deposit.reference } : {}),
      isHighBidder: myCompanyId !== null && highCompany === myCompanyId,
      isSeller,
      isWinner: myCompanyId !== null && winnerCompany === myCompanyId,
    },
  };
}
