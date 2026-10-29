/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-member-access --
   HTTP test bodies are untyped JSON. */
import { sql } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { createTestApp, seedCategory, type Client, type TestApp } from '../../test/app.js';
import {
  adminClient,
  createAuction,
  joinAuction,
  placeBid,
  verifiedCompany,
} from '../../test/auctions.js';
import { ledgerTotal } from '../ledger/index.js';
import { AUCTION_ORDER_PORT, AuctionCloser, type AuctionOrderPort } from './index.js';

// P4-15: resilience of the closing / bidding paths against real PostgreSQL. The sweeper is OFF so
// every sweep in this file is an explicit call.
process.env.AUCTION_SWEEPER = 'off';
process.env.BID_RATE_LIMIT = 'off';

let t: TestApp;
let admin: Client;
let categoryId: string;
let seller: Awaited<ReturnType<typeof verifiedCompany>>;
let bidders: Awaited<ReturnType<typeof verifiedCompany>>[];

beforeAll(async () => {
  t = await createTestApp();
  admin = await adminClient(t);
  categoryId = (await seedCategory(t.db)).id;
  seller = await verifiedCompany(t, 'seller');
  bidders = await Promise.all(
    Array.from({ length: 10 }, (_, i) => verifiedCompany(t, `b${String(i)}`)),
  );
}, 120_000);
afterAll(async () => {
  await t.close();
});

const closer = () => t.app.get(AuctionCloser);
const auctionRow = (id: string) =>
  t.db.selectFrom('auctions').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
const results = (id: string) =>
  t.db.selectFrom('auction_results').selectAll().where('auction_id', '=', id).execute();
const orders = (id: string) =>
  t.db.selectFrom('orders').select('id').where('source_auction_id', '=', id).execute();
const journalCount = async () =>
  Number(
    (await sql<{ n: string }>`select count(*) as n from ledger_journals`.execute(t.db)).rows[0]!.n,
  );
const expire = (id: string) =>
  sql`update auctions set ends_at = clock_timestamp() - interval '1 second', starts_at = starts_at - interval '1 day' where id = ${id}`.execute(
    t.db,
  );

// An auction with three deposits and three bids, ready to be expired.
async function liveAuctionWithBids(): Promise<string> {
  const id = await createAuction(t, {
    sellerCompanyId: seller.companyId,
    categoryId,
    endsInMs: 600_000,
  });
  const who = [bidders[0]!, bidders[1]!, bidders[2]!];
  await Promise.all(who.map((b) => joinAuction(admin, b, id)));
  for (const [i, b] of who.entries()) {
    expect((await placeBid(b.c, id, 100_000n + BigInt(i) * 1000n)).status).toBe(201);
  }
  return id;
}

// Makes the next closing transaction fail AFTER the order and deposit side effects were written
// inside it, so a rollback has real work to undo.
function failNextOrderCreation(): () => void {
  const port = t.app.get<AuctionOrderPort>(AUCTION_ORDER_PORT);
  const original = port.createOrderFromAuction.bind(port);
  const spy = vi
    .spyOn(port, 'createOrderFromAuction')
    .mockImplementationOnce(async (trx, input) => {
      await original(trx, input);
      throw new Error('injected closer failure');
    });
  return () => {
    spy.mockRestore();
  };
}

describe('closer failure atomicity', () => {
  it('I4/I6: closer error mid-transaction rolls back; auction stays LIVE; next sweep closes once with one order', async () => {
    const id = await liveAuctionWithBids();
    await expire(id);
    const restore = failNextOrderCreation();
    try {
      await expect(closer().closeAuction(id)).rejects.toThrow('injected closer failure');
    } finally {
      restore();
    }

    expect((await auctionRow(id)).status).toBe('LIVE');
    expect(await results(id)).toHaveLength(0);
    expect(await orders(id)).toHaveLength(0);
    const deps = await t.db
      .selectFrom('deposits')
      .select('status')
      .where('auction_id', '=', id)
      .execute();
    expect(deps.every((d) => d.status === 'held')).toBe(true); // refunds rolled back too

    await closer().sweep(); // a failing pass must not poison the next one
    expect((await auctionRow(id)).status).toBe('PAYMENT_PENDING');
    expect(await results(id)).toHaveLength(1);
    expect(await orders(id)).toHaveLength(1);
    await closer().sweep();
    expect(await results(id)).toHaveLength(1);
    expect(await orders(id)).toHaveLength(1);
  });

  it('I7/ledger: closer error leaves ledger total 0 and no half-written journal', async () => {
    const id = await liveAuctionWithBids();
    await expire(id);
    const before = await journalCount();
    expect(await ledgerTotal(t.db)).toBe(0n);

    const restore = failNextOrderCreation();
    try {
      await expect(closer().closeAuction(id)).rejects.toThrow('injected closer failure');
    } finally {
      restore();
    }
    // deposit refunds / winner-deposit application were posted inside the failed trx
    expect(await journalCount()).toBe(before);
    expect(await ledgerTotal(t.db)).toBe(0n);
    const unbalanced = await sql<{ n: string }>`
      select count(*) as n from (
        select journal_id from ledger_entries group by journal_id having sum(amount_minor) <> 0
      ) x`.execute(t.db);
    expect(Number(unbalanced.rows[0]!.n)).toBe(0);

    await closer().sweep();
    expect(await ledgerTotal(t.db)).toBe(0n);
    expect(await journalCount()).toBeGreaterThan(before); // refunds now posted, balanced
  });
});

describe('concurrent sweepers', () => {
  it('I4/I6: two sweeps in parallel -> one result, one order, one refund set', async () => {
    const id = await liveAuctionWithBids();
    await expire(id);
    const journalsBefore = await journalCount();
    await Promise.all([closer().sweep(), closer().sweep(), closer().sweep()]);
    expect(await results(id)).toHaveLength(1);
    expect(await orders(id)).toHaveLength(1);
    expect((await auctionRow(id)).status).toBe('PAYMENT_PENDING');
    const refunds = await t.db
      .selectFrom('deposits')
      .select('status')
      .where('auction_id', '=', id)
      .where('status', '=', 'refunded')
      .execute();
    expect(refunds).toHaveLength(2); // two losers, once each
    expect(await journalCount()).toBe(journalsBefore + 2);
    expect(await ledgerTotal(t.db)).toBe(0n);
  });
});

describe('lazy close of an unswept expired auction', () => {
  it('I3/I4: bid on an expired-but-unswept auction -> AUCTION_ENDED and the lazy close runs', async () => {
    const id = await liveAuctionWithBids();
    await expire(id); // sweeper is off: status is still LIVE
    expect((await auctionRow(id)).status).toBe('LIVE');
    const late = await placeBid(bidders[3]!.c, id, 500_000n);
    expect(late.status).toBeGreaterThanOrEqual(400);
    expect(late.body.error.code).toBe('AUCTION_ENDED');

    const row = await auctionRow(id);
    expect(row.status).toBe('PAYMENT_PENDING');
    expect(row.last_seq).toBe(3); // the late bid was not stored
    const bids = await t.db.selectFrom('bids').select('id').where('auction_id', '=', id).execute();
    expect(bids).toHaveLength(3);
    expect(await results(id)).toHaveLength(1);
    expect(await orders(id)).toHaveLength(1);
  });
});

describe('connection loss mid-transaction', () => {
  it('I1/I2: backends terminated while bids are in flight -> each bid fully accepted or fully rejected, seq gapless', async () => {
    const id = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      endsInMs: 600_000,
    });
    await Promise.all(bidders.map((b) => joinAuction(admin, b, id)));

    const dbName = (await sql<{ d: string }>`select current_database() as d`.execute(t.db)).rows[0]!
      .d;
    const kc = new pg.Client({ connectionString: `${inject('pgBaseUrl')}/${dbName}` });
    await kc.connect();
    let killed = 0;
    const flag = { stop: false };
    const killLoop = (async () => {
      while (!flag.stop) {
        try {
          const r = await kc.query(
            `select pg_terminate_backend(pid) from pg_stat_activity
             where datname = current_database() and pid <> pg_backend_pid() and state <> 'idle'`,
          );
          killed += r.rowCount ?? 0;
        } catch {
          /* ignore */
        }
        await new Promise((r) => setTimeout(r, 20));
      }
    })();

    const accepted: bigint[] = [];
    try {
      for (let round = 0; round < 25; round += 1) {
        const replies = await Promise.all(
          bidders.map(async (b, i) => {
            const amount = 100_000n + BigInt(round * 10 + i) * 1000n;
            try {
              const r = await placeBid(b.c, id, amount);
              if (r.status === 201) accepted.push(amount);
              return r.status;
            } catch {
              return 0;
            }
          }),
        );
        expect(replies.length).toBe(bidders.length);
      }
    } finally {
      flag.stop = true;
      await killLoop;
      await kc.end();
    }
    expect(killed).toBeGreaterThan(0); // the test really cut connections
    // the pool recovers: a clean bid right after the cuts is accepted
    // (the current high bidder is correctly refused with ALREADY_HIGH_BIDDER, so try each bidder)
    let recovered = false;
    for (const b of bidders) {
      if ((await placeBid(b.c, id, 900_000n)).status === 201) {
        recovered = true;
        break;
      }
    }
    expect(recovered).toBe(true);
    accepted.push(900_000n);

    const rows = await t.db
      .selectFrom('bids')
      .selectAll()
      .where('auction_id', '=', id)
      .orderBy('seq')
      .execute();
    rows.forEach((b, i) => {
      expect(b.seq).toBe(i + 1); // I1: gapless
      if (i > 0) expect(b.amount_minor - rows[i - 1]!.amount_minor >= 1000n).toBe(true); // I2
    });
    const a = await auctionRow(id);
    expect(a.last_seq).toBe(rows.length);
    expect(a.bid_count).toBe(rows.length);
    expect(a.current_price_minor).toBe(rows.at(-1)!.amount_minor);
    // every acknowledged (201) bid is durable
    const stored = new Set(rows.map((r) => r.amount_minor));
    for (const amount of accepted) expect(stored.has(amount)).toBe(true);
    expect(await ledgerTotal(t.db)).toBe(0n);
  });
});
