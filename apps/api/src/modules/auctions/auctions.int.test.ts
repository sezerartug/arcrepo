/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/restrict-template-expressions --
   HTTP test bodies are untyped JSON. */
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestApp,
  idem,
  listingBody,
  seedCategory,
  type Client,
  type TestApp,
} from '../../test/app.js';
import {
  adminClient,
  createAuction,
  joinAuction,
  placeBid,
  verifiedCompany,
} from '../../test/auctions.js';
import { accountBalance, ledgerTotal } from '../ledger/index.js';
import { AuctionCloser } from './index.js';

// Real PostgreSQL, real HTTP. The sweeper runs every 100 ms; the bid rate limit is off here and
// exercised in its own app below.
process.env.AUCTION_SWEEPER = 'on';
process.env.AUCTION_SWEEP_MS = '100';
process.env.BID_RATE_LIMIT = 'off';

let t: TestApp;
let admin: Client;
let categoryId: string;
let seller: Awaited<ReturnType<typeof verifiedCompany>>;
let bidders: Awaited<ReturnType<typeof verifiedCompany>>[];
const N_BIDDERS = 20;

beforeAll(async () => {
  t = await createTestApp();
  admin = await adminClient(t);
  categoryId = (await seedCategory(t.db)).id;
  seller = await verifiedCompany(t, 'seller');
  bidders = await Promise.all(
    Array.from({ length: N_BIDDERS }, (_, i) => verifiedCompany(t, `bidder${String(i)}`)),
  );
}, 120_000);
afterAll(async () => {
  await t.close();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const bidRows = (auctionId: string) =>
  t.db.selectFrom('bids').selectAll().where('auction_id', '=', auctionId).orderBy('seq').execute();
const auctionRow = (auctionId: string) =>
  t.db.selectFrom('auctions').selectAll().where('id', '=', auctionId).executeTakeFirstOrThrow();
const resultRows = (auctionId: string) =>
  t.db.selectFrom('auction_results').selectAll().where('auction_id', '=', auctionId).execute();
const join = (auctionId: string, who: typeof bidders) =>
  Promise.all(who.map((b) => joinAuction(admin, b, auctionId)));

function checkBidChain(rows: Awaited<ReturnType<typeof bidRows>>, start: bigint, inc: bigint) {
  rows.forEach((b, i) => {
    expect(b.seq).toBe(i + 1); // I1: gapless from 1
    const prev = rows[i - 1];
    if (prev)
      expect(b.amount_minor - prev.amount_minor >= inc).toBe(true); // I2
    else expect(b.amount_minor >= start).toBe(true);
  });
}

describe('auction lifecycle through the HTTP API', () => {
  it('admin approval creates the auction; deposit, eligibility, bidding and visibility', async () => {
    const body = listingBody(categoryId, {
      saleType: 'auction',
      auction: {
        startPriceMinor: '2450000',
        minIncrementMinor: '10000',
        reserveMinor: '3000000',
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        endsAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });
    const created = await seller.c.post('/listings', body, idem());
    expect(created.status).toBe(201);
    const approved = await admin.post(`/admin/listings/${created.body.id}/approve`, {});
    expect(approved.status).toBe(200);

    const list = await t.client().get('/auctions?status=live');
    const item = list.body.items.find(
      (i: { listingId: string }) => i.listingId === created.body.id,
    );
    expect(item.status).toBe('LIVE'); // starts_at already passed
    const id = item.id as string;
    expect(item.depositMinor).toBe('6125000'); // 5% of 50 t * 24,500 TL

    const b = bidders[0]!;
    // no deposit yet
    const early = await placeBid(b.c, id, 2_450_000n);
    expect(early.status).toBe(422);
    expect(early.body.error.code).toBe('BIDDER_NOT_ELIGIBLE');

    const dep = await b.c.post(`/auctions/${id}/deposit`, {}, idem());
    expect(dep.status).toBe(201);
    expect(dep.body.reference).toMatch(/^ARC-D-[A-Z2-9]{6}$/);
    expect(dep.body.status).toBe('pending');
    const pending = await admin.get('/admin/payments?status=pending');
    expect(pending.body.items).toContainEqual(
      expect.objectContaining({
        reference: dep.body.reference,
        kind: 'deposit',
        amountMinor: '6125000',
      }),
    );
    expect((await placeBid(b.c, id, 2_450_000n)).body.error.code).toBe('BIDDER_NOT_ELIGIBLE');

    // non-admin cannot confirm
    expect(
      (await b.c.post('/admin/payments/confirm', { reference: dep.body.reference })).status,
    ).toBe(403);
    expect(
      (await admin.post('/admin/payments/confirm', { reference: dep.body.reference })).status,
    ).toBe(200);
    // confirming again is a no-op (no second journal)
    expect(
      (await admin.post('/admin/payments/confirm', { reference: dep.body.reference })).status,
    ).toBe(200);
    expect(await accountBalance(t.db, { type: 'deposit_held' })).toBeGreaterThanOrEqual(6_125_000n);

    // seller cannot bid; too-low bid says what is needed
    expect((await placeBid(seller.c, id, 2_450_000n)).body.error.code).toBe('SELF_BID');
    const low = await placeBid(b.c, id, 2_000_000n);
    expect(low.status).toBe(422);
    expect(low.body.error).toMatchObject({ code: 'BID_TOO_LOW', minNextBidMinor: '2450000' });

    const ok = await placeBid(b.c, id, 2_450_000n);
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({
      seq: 1,
      currentPriceMinor: '2450000',
      minNextBidMinor: '2460000',
    });
    expect(ok.body.myState).toMatchObject({
      eligible: true,
      isHighBidder: true,
      depositStatus: 'held',
    });
    expect(ok.body.bids[0]).toMatchObject({ seq: 1, bidder: 'Teklif veren #1' });
    expect(ok.body).not.toHaveProperty('reserveMinor');
    expect(JSON.stringify(ok.body)).not.toContain('Çelik A.Ş.'); // anonymous

    // same bidder again, while leading
    expect((await placeBid(b.c, id, 2_460_000n)).body.error.code).toBe('ALREADY_HIGH_BIDDER');

    // anonymous viewers see the snapshot without a reserve; the seller sees it plus real names
    const anon = await t.client().get(`/auctions/${id}`);
    expect(anon.status).toBe(200);
    expect(anon.body).not.toHaveProperty('reserveMinor');
    expect(anon.body.serverNow).toEqual(expect.any(String));
    expect(anon.body.myState.eligible).toBe(false);
    const own = await seller.c.get(`/auctions/${id}`);
    expect(own.body.reserveMinor).toBe('3000000');
    expect(own.body.bids[0].bidderName).toContain('bidder0');

    // audit trail
    const audit = await admin.get(`/admin/audit?entityType=auction&entityId=${id}`);
    expect(audit.body.items.map((a: { action: string }) => a.action)).toEqual(
      expect.arrayContaining(['auction.created', 'auction.bid_accepted']),
    );
  });

  it('rejects unauthenticated, unverified and malformed requests', async () => {
    const id = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      endsInMs: 600_000,
    });
    expect((await placeBid(t.client(), id, 100_000n)).status).toBe(401);
    expect((await bidders[1]!.c.post(`/auctions/${id}/bids`, { amountMinor: '1' })).status).toBe(
      400,
    ); // no key
    await join(id, [bidders[1]!]);
    expect(
      (await bidders[1]!.c.post(`/auctions/${id}/bids`, { amountMinor: -5 }, idem())).status,
    ).toBe(422);
    expect((await bidders[1]!.c.get('/auctions/not-a-uuid')).status).toBe(404);
  });
});

describe('idempotency (I10)', () => {
  it('same key twice -> one bid; different body -> 422; concurrent duplicates -> one bid', async () => {
    const id = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      endsInMs: 600_000,
    });
    await join(id, [bidders[0]!, bidders[1]!]);
    const key = idem();
    const first = await placeBid(bidders[0]!.c, id, 100_000n, key);
    const again = await placeBid(bidders[0]!.c, id, 100_000n, key);
    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.body).toEqual(first.body);
    expect(await bidRows(id)).toHaveLength(1);

    const clash = await placeBid(bidders[0]!.c, id, 105_000n, key);
    expect(clash.status).toBe(422);
    expect(clash.body.error.code).toBe('IDEMPOTENCY_MISMATCH');

    const k2 = idem();
    const replies = await Promise.all(
      Array.from({ length: 6 }, () => placeBid(bidders[1]!.c, id, 101_000n, k2)),
    );
    expect(replies.every((r) => r.status === 201)).toBe(true);
    expect(await bidRows(id)).toHaveLength(2);

    // a business rejection is stored too: the retry gets the same answer and logs one attempt
    const k3 = idem();
    const r1 = await placeBid(bidders[0]!.c, id, 90_000n, k3);
    const r2 = await placeBid(bidders[0]!.c, id, 90_000n, k3);
    expect(r1.body.error.code).toBe('BID_TOO_LOW');
    expect(r2.body).toEqual(r1.body);
    const attempts = await t.db
      .selectFrom('bid_attempts')
      .select('id')
      .where('auction_id', '=', id)
      .execute();
    expect(attempts).toHaveLength(1);
  });
});

describe('concurrency (real PostgreSQL)', () => {
  it('same amount race: exactly one accepted, the other BID_TOO_LOW', async () => {
    const id = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      endsInMs: 600_000,
    });
    await join(id, [bidders[2]!, bidders[3]!]);
    const [a, b] = await Promise.all([
      placeBid(bidders[2]!.c, id, 100_000n),
      placeBid(bidders[3]!.c, id, 100_000n),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 422]);
    const loser = a.status === 422 ? a : b;
    expect(loser.body.error).toMatchObject({ code: 'BID_TOO_LOW', minNextBidMinor: '101000' });
    expect(await bidRows(id)).toHaveLength(1);
  });

  it('200 parallel bids: gapless seq, strictly increasing, one winner (I1, I2, I4, I5)', async () => {
    const id = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      endsInMs: 600_000,
    });
    await join(id, bidders);
    const latencies: number[] = [];
    const started = performance.now();
    const replies = await Promise.all(
      Array.from({ length: 200 }, async (_, i) => {
        const t0 = performance.now();
        const r = await placeBid(bidders[i % N_BIDDERS]!.c, id, 100_000n + BigInt(i + 1) * 1000n);
        latencies.push(performance.now() - t0);
        return r;
      }),
    );
    const wall = performance.now() - started;

    const accepted = replies.filter((r) => r.status === 201);
    for (const r of replies) {
      if (r.status === 201) continue;
      expect(['BID_TOO_LOW', 'ALREADY_HIGH_BIDDER']).toContain(r.body.error.code);
    }
    const rows = await bidRows(id);
    expect(rows.length).toBe(accepted.length);
    expect(rows.length).toBeGreaterThan(0);
    checkBidChain(rows, 100_000n, 1000n);
    const a = await auctionRow(id);
    expect(a.last_seq).toBe(rows.length);
    expect(a.bid_count).toBe(rows.length);
    expect(a.current_price_minor).toBe(rows.at(-1)!.amount_minor);
    expect(a.high_bid_id).toBe(rows.at(-1)!.id);
    const attempts = await t.db
      .selectFrom('bid_attempts')
      .select('id')
      .where('auction_id', '=', id)
      .execute();
    expect(attempts.length).toBe(200 - accepted.length);

    // close it now and check the single result
    await sql`update auctions set ends_at = clock_timestamp() - interval '1 second', starts_at = starts_at - interval '1 hour' where id = ${id}`.execute(
      t.db,
    );
    await sleep(500);
    const results = await resultRows(id);
    expect(results).toHaveLength(1);
    expect(results[0]!.winning_bid_id).toBe(rows.at(-1)!.id);
    expect(results[0]!.final_price_minor).toBe(rows.at(-1)!.amount_minor);

    latencies.sort((x, y) => x - y);
    const pct = (p: number) =>
      latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))]!;
    console.log(
      `[auction-concurrency] 200 parallel bids / ${String(N_BIDDERS)} bidders: accepted=${String(accepted.length)} ` +
        `wall=${wall.toFixed(0)}ms latency p50=${pct(0.5).toFixed(0)} p95=${pct(0.95).toFixed(0)} ` +
        `p99=${pct(0.99).toFixed(0)} max=${pct(1).toFixed(0)} ms; winners=${String(results.length)}`,
    );
  });

  it('close/bid race: no bid is accepted at or after ends_at (I3), one result (I4), winner = last bid (I5)', async () => {
    const id = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      endsInMs: 4000,
      windowSecs: 0, // no extension: ends_at stays fixed so I3 is checkable
    });
    await join(id, bidders.slice(0, 10));
    const stop = (await auctionRow(id)).ends_at.getTime() + 1500;
    let amount = 100_000n;
    const codes = new Map<string, number>();
    await Promise.all(
      bidders.slice(0, 10).map(async (b) => {
        while (Date.now() < stop) {
          amount += 1000n;
          const r = await placeBid(b.c, id, amount);
          const code = r.status === 201 ? 'ACCEPTED' : (r.body.error.code as string);
          codes.set(code, (codes.get(code) ?? 0) + 1);
        }
      }),
    );
    await sleep(300);
    const a = await auctionRow(id);
    const rows = await bidRows(id);
    const known = new Set([
      'ACCEPTED',
      'AUCTION_ENDED',
      'AUCTION_NOT_LIVE',
      'BID_TOO_LOW',
      'ALREADY_HIGH_BIDDER',
    ]);
    expect([...codes.keys()].filter((k) => !known.has(k))).toEqual([]);
    expect(codes.get('ACCEPTED')).toBeGreaterThan(0);
    expect(
      (codes.get('AUCTION_ENDED') ?? 0) + (codes.get('AUCTION_NOT_LIVE') ?? 0),
    ).toBeGreaterThan(0);
    expect(rows.length).toBe(codes.get('ACCEPTED'));
    for (const b of rows) expect(b.accepted_at.getTime()).toBeLessThan(a.ends_at.getTime()); // I3
    checkBidChain(rows, 100_000n, 1000n);
    expect(a.status).toBe('PAYMENT_PENDING');
    expect(a.closed_at).not.toBeNull();
    const results = await resultRows(id);
    expect(results).toHaveLength(1);
    expect(results[0]!.winning_bid_id).toBe(rows.at(-1)!.id);
    expect(results[0]!.winner_company_id).toBe(rows.at(-1)!.bidder_company_id);
  });

  it('closeAuction twice and in parallel -> one result, one set of refunds (I4)', async () => {
    const id = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      endsInMs: 600_000,
    });
    await join(id, [bidders[4]!, bidders[5]!, bidders[6]!]);
    expect((await placeBid(bidders[4]!.c, id, 100_000n)).status).toBe(201);
    expect((await placeBid(bidders[5]!.c, id, 101_000n)).status).toBe(201);
    expect((await placeBid(bidders[6]!.c, id, 102_000n)).status).toBe(201);
    // not due yet: no-op
    const closer = t.app.get(AuctionCloser);
    expect(await closer.closeAuction(id)).toBe(false);
    await sql`update auctions set ends_at = clock_timestamp() - interval '1 second', starts_at = starts_at - interval '1 day' where id = ${id}`.execute(
      t.db,
    );
    await Promise.all(Array.from({ length: 8 }, () => closer.closeAuction(id)));
    expect(await closer.closeAuction(id)).toBe(false);
    const results = await resultRows(id);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      outcome: 'sold',
      winner_company_id: bidders[6]!.companyId,
      final_price_minor: 102_000n,
    });
    // total = round(102000 * 10000 kg / 1000)
    expect(results[0]!.total_minor).toBe(1_020_000n);
    expect((await auctionRow(id)).status).toBe('PAYMENT_PENDING');

    // losers refunded (ledger), the winner's deposit stays held
    const deps = await t.db
      .selectFrom('deposits')
      .selectAll()
      .where('auction_id', '=', id)
      .execute();
    const byCompany = new Map(deps.map((d) => [d.company_id, d.status]));
    expect(byCompany.get(bidders[6]!.companyId)).toBe('held');
    expect(byCompany.get(bidders[4]!.companyId)).toBe('refunded');
    expect(byCompany.get(bidders[5]!.companyId)).toBe('refunded');
    const refundJournals = await t.db
      .selectFrom('ledger_journals')
      .select('ref_id')
      .where('reason', '=', 'deposit.refund')
      .where(
        'ref_id',
        'in',
        deps.map((d) => d.id),
      )
      .execute();
    expect(refundJournals).toHaveLength(2);
    expect(await ledgerTotal(t.db)).toBe(0n);
  });
});

describe('closing outcomes', () => {
  it('reserve not met -> ENDED_NO_SALE and every deposit refunded', async () => {
    const id = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      endsInMs: 600_000,
      reserveMinor: 500_000n,
    });
    await join(id, [bidders[7]!, bidders[8]!]);
    const heldBefore = await accountBalance(t.db, { type: 'deposit_held' });
    expect((await placeBid(bidders[7]!.c, id, 100_000n)).status).toBe(201);
    expect((await placeBid(bidders[8]!.c, id, 110_000n)).status).toBe(201);
    await sql`update auctions set ends_at = clock_timestamp() - interval '1 second', starts_at = starts_at - interval '1 day' where id = ${id}`.execute(
      t.db,
    );
    await t.app.get(AuctionCloser).closeAuction(id);
    expect((await auctionRow(id)).status).toBe('ENDED_NO_SALE');
    const results = await resultRows(id);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      outcome: 'no_sale',
      winner_company_id: null,
      winning_bid_id: null,
    });
    const deps = await t.db
      .selectFrom('deposits')
      .select('status')
      .where('auction_id', '=', id)
      .execute();
    expect(deps.map((d) => d.status)).toEqual(['refunded', 'refunded']);
    expect(await ledgerTotal(t.db)).toBe(0n);
    // two deposits of 50,000 (5% of 100,000 x 10 t) left deposit_held
    expect(await accountBalance(t.db, { type: 'deposit_held' })).toBe(heldBefore - 100_000n);
    const snap = await seller.c.get(`/auctions/${id}`);
    expect(snap.body).not.toHaveProperty('winner');
  });

  it('no bids -> ENDED_NO_SALE; pending (unpaid) deposits are cancelled', async () => {
    const id = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      endsInMs: 600_000,
    });
    const dep = await bidders[9]!.c.post(`/auctions/${id}/deposit`, {}, idem());
    expect(dep.status).toBe(201);
    // same company again with another key: same deposit, no second row
    const again = await bidders[9]!.c.post(`/auctions/${id}/deposit`, {}, idem());
    expect(again.status).toBe(200);
    expect(again.body.reference).toBe(dep.body.reference);
    await sql`update auctions set ends_at = clock_timestamp() - interval '1 second', starts_at = starts_at - interval '1 day' where id = ${id}`.execute(
      t.db,
    );
    await sleep(500); // the sweeper closes it
    expect((await auctionRow(id)).status).toBe('ENDED_NO_SALE');
    const d = await t.db
      .selectFrom('deposits')
      .select('status')
      .where('auction_id', '=', id)
      .executeTakeFirstOrThrow();
    expect(d.status).toBe('cancelled');
    // a late bank confirmation cannot revive it
    const late = await admin.post('/admin/payments/confirm', { reference: dep.body.reference });
    expect(late.status).toBe(409);
    // and a closed auction accepts no new bid or deposit
    expect((await placeBid(bidders[9]!.c, id, 100_000n)).body.error.code).toBe('AUCTION_NOT_LIVE');
    expect((await bidders[10]!.c.post(`/auctions/${id}/deposit`, {}, idem())).status).toBe(409);
  });

  it('SCHEDULED auctions go LIVE by the sweeper once starts_at passes', async () => {
    const id = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      startsInMs: 800,
      endsInMs: 600_000,
    });
    expect((await auctionRow(id)).status).toBe('SCHEDULED');
    expect((await placeBid(bidders[11]!.c, id, 100_000n)).body.error.code).toBe('AUCTION_NOT_LIVE');
    await sleep(1500);
    expect((await auctionRow(id)).status).toBe('LIVE');
  });
});

describe('anti-sniping extension', () => {
  it('extends to t+60 s inside the window, stops at max extensions and at the hard cap', async () => {
    const id = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      endsInMs: 30_000,
      maxExtensions: 2,
    });
    await join(id, bidders.slice(12, 16));
    const before = await auctionRow(id);
    const r1 = await placeBid(bidders[12]!.c, id, 100_000n);
    expect(r1.status).toBe(201);
    const a1 = await auctionRow(id);
    expect(a1.extension_count).toBe(1);
    expect(a1.ends_at.getTime()).toBeGreaterThan(before.ends_at.getTime() + 25_000);
    expect(a1.ends_at.getTime() - Date.now()).toBeLessThanOrEqual(60_500);
    expect(a1.original_ends_at.getTime()).toBe(before.original_ends_at.getTime());
    expect(r1.body.endsAt).toBe(a1.ends_at.toISOString());

    // second extension: the end moves again only if t is within 60 s of it (it is: ~60 s left)
    await placeBid(bidders[13]!.c, id, 101_000n);
    expect((await auctionRow(id)).extension_count).toBe(2);
    // max_extensions = 2 reached -> never extended again
    const endsAfter2 = (await auctionRow(id)).ends_at.getTime();
    await placeBid(bidders[14]!.c, id, 102_000n);
    await placeBid(bidders[15]!.c, id, 103_000n);
    const last = await auctionRow(id);
    expect(last.extension_count).toBe(2);
    expect(last.ends_at.getTime()).toBe(endsAfter2);
    expect((await bidRows(id)).length).toBe(4);

    // hard cap
    const id2 = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      endsInMs: 20_000,
    });
    await join(id2, [bidders[16]!]);
    await sql`update auctions set hard_end_cap = ends_at + interval '10 seconds' where id = ${id2}`.execute(
      t.db,
    );
    const capRow = await auctionRow(id2);
    expect((await placeBid(bidders[16]!.c, id2, 100_000n)).status).toBe(201);
    const capped = await auctionRow(id2);
    expect(capped.ends_at.getTime()).toBe(capRow.hard_end_cap.getTime());
  });
});

describe('admin cancel', () => {
  it('refunds all deposits, audits, and blocks further bids', async () => {
    const id = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      endsInMs: 600_000,
    });
    await join(id, [bidders[17]!, bidders[18]!]);
    expect((await placeBid(bidders[17]!.c, id, 100_000n)).status).toBe(201);
    expect(
      (await bidders[17]!.c.post(`/admin/auctions/${id}/cancel`, { reason: 'abuse' })).status,
    ).toBe(403);
    expect((await admin.post(`/admin/auctions/${id}/cancel`, {})).status).toBe(422); // reason required
    const res = await admin.post(`/admin/auctions/${id}/cancel`, {
      reason: 'Satici talebi ve dogrulama sorunu',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'CANCELLED', refundedDeposits: 2 });
    expect((await auctionRow(id)).status).toBe('CANCELLED');
    const deps = await t.db
      .selectFrom('deposits')
      .select('status')
      .where('auction_id', '=', id)
      .execute();
    expect(deps.every((d) => d.status === 'refunded')).toBe(true);
    expect((await placeBid(bidders[18]!.c, id, 200_000n)).body.error.code).toBe('AUCTION_NOT_LIVE');
    expect(
      (await admin.post(`/admin/auctions/${id}/cancel`, { reason: 'again again' })).status,
    ).toBe(409);
    const audit = await admin.get(`/admin/audit?entityType=auction&entityId=${id}`);
    expect(audit.body.items.map((a: { action: string }) => a.action)).toContain(
      'auction.cancelled',
    );
    expect(await ledgerTotal(t.db)).toBe(0n);
  });
});

describe('bid rate limit', () => {
  it('allows 3 bid requests per second per user, then RATE_LIMITED', async () => {
    process.env.BID_RATE_LIMIT = 'on';
    const t2 = await createTestApp();
    process.env.BID_RATE_LIMIT = 'off';
    try {
      const cat = (await seedCategory(t2.db)).id;
      const s = await verifiedCompany(t2, 'rl-seller');
      const b = await verifiedCompany(t2, 'rl-bidder');
      const adm = await adminClient(t2);
      const id = await createAuction(t2, {
        sellerCompanyId: s.companyId,
        categoryId: cat,
        endsInMs: 600_000,
      });
      await joinAuction(adm, b, id);
      const codes: number[] = [];
      for (let i = 0; i < 5; i += 1) codes.push((await placeBid(b.c, id, 50_000n)).status); // all too low
      expect(codes.filter((c) => c === 429)).toHaveLength(2);
      const limited = await placeBid(b.c, id, 50_000n);
      expect(limited.body.error.code).toBe('RATE_LIMITED');
    } finally {
      await t2.close();
    }
  });
});
