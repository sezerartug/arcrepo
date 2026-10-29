/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-template-expressions, @typescript-eslint/restrict-plus-operands --
   HTTP test bodies are untyped JSON. */
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, idem, seedCategory, type Client, type TestApp } from '../../test/app.js';
import {
  adminClient,
  createAuction,
  joinAuction,
  placeBid,
  verifiedCompany,
} from '../../test/auctions.js';
import { AuctionCloser } from '../auctions/index.js';
import { OrdersService } from '../orders/index.js';

// Real PostgreSQL, real HTTP. In-app notifications: right recipient, nobody else, read state.
process.env.BID_RATE_LIMIT = 'off';

type Co = Awaited<ReturnType<typeof verifiedCompany>>;
let t: TestApp;
let admin: Client;
let categoryId: string;
let seller: Co;
let a: Co;
let b: Co;
let c: Co;
let closer: AuctionCloser;
let orders: OrdersService;

beforeAll(async () => {
  t = await createTestApp();
  admin = await adminClient(t);
  categoryId = (await seedCategory(t.db)).id;
  seller = await verifiedCompany(t, 'nseller');
  a = await verifiedCompany(t, 'na');
  b = await verifiedCompany(t, 'nb');
  c = await verifiedCompany(t, 'nc');
  closer = t.app.get(AuctionCloser);
  orders = t.app.get(OrdersService);
}, 120_000);
afterAll(async () => {
  await t.close();
});

const list = async (who: { c: Client }, qs = '') => (await who.c.get(`/notifications${qs}`)).body;
const types = async (who: { c: Client }) =>
  (await list(who)).items.map((i: { type: string }) => i.type) as string[];
const unread = async (who: { c: Client }) => (await who.c.get('/notifications/unread-count')).body;

async function liveAuction() {
  const id = await createAuction(t, {
    sellerCompanyId: seller.companyId,
    categoryId,
    endsInMs: 3_600_000,
  });
  for (const w of [a, b, c]) await joinAuction(admin, w, id);
  return id;
}
const endAuction = (id: string) =>
  sql`update auctions set ends_at = clock_timestamp() - interval '1 second' where id = ${id}`
    .execute(t.db)
    .then(() => closer.closeAuction(id));

describe('outbid', () => {
  it('goes only to the previous leader, not to everybody', async () => {
    const id = await liveAuction();
    expect((await placeBid(a.c, id, 110_000n)).status).toBe(201);
    expect(await types(a)).not.toContain('auction.outbid'); // first bid: nobody to outbid
    expect((await placeBid(b.c, id, 120_000n)).status).toBe(201);
    expect(
      (await list(a)).items.filter((i: { type: string }) => i.type === 'auction.outbid'),
    ).toHaveLength(1);
    expect(await types(b)).not.toContain('auction.outbid');
    expect(await types(c)).not.toContain('auction.outbid');
    expect(await types(seller)).not.toContain('auction.outbid');
    const n = (await list(a)).items.find((i: { type: string }) => i.type === 'auction.outbid');
    expect(n.link).toBe(`/mezat/${id}`);
    expect(n.read).toBe(false);
  });

  it('is not written for a rejected bid', async () => {
    const id = await liveAuction();
    expect((await placeBid(a.c, id, 110_000n)).status).toBe(201);
    const before = (await list(a)).total;
    expect((await placeBid(b.c, id, 110_500n)).status).toBeGreaterThanOrEqual(400); // below increment
    expect((await list(a)).total).toBe(before);
  });
});

describe('auction closed + order status', () => {
  it('tells winner, losers and seller; then follows the order through its life', async () => {
    const id = await liveAuction();
    await placeBid(a.c, id, 110_000n);
    await placeBid(b.c, id, 120_000n);
    expect(await endAuction(id)).toBe(true);

    expect(await types(b)).toContain('auction.won');
    expect(await types(b)).not.toContain('auction.lost');
    expect(await types(a)).toContain('auction.lost');
    expect(await types(c)).toContain('auction.lost'); // deposited but never bid
    expect(await types(seller)).toContain('auction.closed_seller');
    expect(await types(a)).not.toContain('auction.won');
    const won = (await list(b)).items.find((i: { type: string }) => i.type === 'auction.won');
    const order = await t.db
      .selectFrom('orders')
      .select(['id', 'payment_reference'])
      .where('source_auction_id', '=', id)
      .executeTakeFirstOrThrow();
    expect(won.link).toBe(`/siparisler/${order.id}`);

    // paid -> seller
    expect(
      (await admin.post('/admin/payments/confirm', { reference: order.payment_reference })).status,
    ).toBe(200);
    expect(await types(seller)).toContain('order.paid_escrow');
    expect(await types(b)).not.toContain('order.paid_escrow');
    // shipped -> buyer
    expect((await seller.c.post(`/orders/${order.id}/ship`, {})).status).toBe(200);
    expect(await types(b)).toContain('order.shipped');
    expect(await types(seller)).not.toContain('order.shipped');
    // disputed -> seller
    expect(
      (
        await b.c.post(
          `/orders/${order.id}/dispute`,
          { reason: 'Mal farkli geldi, tutanak var' },
          idem(),
        )
      ).status,
    ).toBe(201);
    expect(await types(seller)).toContain('order.disputed');
    // resolved -> both
    const d = await t.db
      .selectFrom('order_disputes')
      .select('id')
      .where('order_id', '=', order.id)
      .executeTakeFirstOrThrow();
    expect(
      (
        await admin.post(
          `/admin/disputes/${d.id}/resolve`,
          { outcome: 'reject', note: 'Gecersiz' },
          idem(),
        )
      ).status,
    ).toBe(200);
    expect(await types(b)).toContain('order.completed');
    expect(await types(seller)).toContain('order.completed');
    // an uninvolved company sees none of the order events
    expect((await types(c)).filter((x) => x.startsWith('order.'))).toHaveLength(0);
  });

  it('tells the seller about delivery and the buyer about a missed payment', async () => {
    const id = await liveAuction();
    await placeBid(a.c, id, 110_000n);
    await endAuction(id);
    const order = await t.db
      .selectFrom('orders')
      .select(['id', 'payment_reference'])
      .where('source_auction_id', '=', id)
      .executeTakeFirstOrThrow();
    await admin.post('/admin/payments/confirm', { reference: order.payment_reference });
    await seller.c.post(`/orders/${order.id}/ship`, {});
    const before = (await list(seller)).items.filter(
      (i: { type: string }) => i.type === 'order.delivered',
    ).length;
    expect((await a.c.post(`/orders/${order.id}/confirm-delivery`, {})).status).toBe(200);
    const after = (await list(seller)).items.filter(
      (i: { type: string }) => i.type === 'order.delivered',
    ).length;
    expect(after).toBe(before + 1);

    const id2 = await liveAuction();
    await placeBid(b.c, id2, 110_000n);
    await endAuction(id2);
    const o2 = await t.db
      .selectFrom('orders')
      .select('id')
      .where('source_auction_id', '=', id2)
      .executeTakeFirstOrThrow();
    await sql`update orders set payment_due_at = clock_timestamp() - interval '1 minute' where id = ${o2.id}`.execute(
      t.db,
    );
    await orders.sweepExpired();
    const failed = (await list(b)).items.filter(
      (i: { type: string }) => i.type === 'order.payment_failed',
    );
    expect(failed).toHaveLength(1);
    expect(failed[0].link).toBe(`/siparisler/${o2.id}`);
  });
});

describe('reading', () => {
  it('counts, marks one read, marks all read, filters unread', async () => {
    const id = await liveAuction();
    await placeBid(c.c, id, 110_000n);
    await placeBid(a.c, id, 120_000n); // c is outbid
    const before = (await unread(c)).count as number;
    expect(before).toBeGreaterThan(0);
    const firstUnread = (await list(c, '?unread=1')).items[0];
    expect((await c.c.post(`/notifications/${firstUnread.id}/read`)).status).toBe(200);
    expect((await unread(c)).count).toBe(before - 1);
    expect((await c.c.post(`/notifications/${firstUnread.id}/read`)).status).toBe(200); // idempotent
    expect((await unread(c)).count).toBe(before - 1);
    expect((await list(c, '?unread=1')).items.map((i: { id: string }) => i.id)).not.toContain(
      firstUnread.id,
    );
    expect((await c.c.post('/notifications/read-all')).body.updated).toBe(before - 1);
    expect((await unread(c)).count).toBe(0);
    expect((await list(c)).total).toBeGreaterThanOrEqual(before);
  });

  it('is private: another company cannot read or mark my notifications (BOLA)', async () => {
    const mine = (await list(a)).items[0];
    expect(mine).toBeDefined();
    const unreadA = (await unread(a)).count as number;
    expect((await b.c.post(`/notifications/${mine.id}/read`)).status).toBe(404);
    expect((await b.c.post('/notifications/not-a-uuid/read')).status).toBe(404);
    expect((await unread(a)).count).toBe(unreadA);
    expect((await list(b)).items.map((i: { id: string }) => i.id)).not.toContain(mine.id);
    await b.c.post('/notifications/read-all');
    expect((await unread(a)).count).toBe(unreadA);
  });

  it('requires a session', async () => {
    const anon = t.client();
    expect((await anon.get('/notifications')).status).toBe(401);
    expect((await anon.get('/notifications/unread-count')).status).toBe(401);
    expect((await anon.post('/notifications/read-all')).status).toBe(401);
  });

  it('reaches every member of the company, each with their own read state', async () => {
    const added = await a.c.post('/company/members', {
      email: 'nmember@example.com',
      fullName: 'Uye Kisi',
    });
    expect(added.status).toBe(201);
    const m = t.client();
    expect(
      (
        await m.post('/auth/login', {
          email: 'nmember@example.com',
          password: added.body.tempPassword,
        })
      ).status,
    ).toBe(200);
    const id = await liveAuction();
    await placeBid(a.c, id, 110_000n);
    await placeBid(b.c, id, 120_000n);
    expect(
      (await m.get('/notifications')).body.items.map((i: { type: string }) => i.type),
    ).toContain('auction.outbid');
    const before = (await unread(a)).count as number;
    await m.post('/notifications/read-all');
    expect((await unread(a)).count).toBe(before); // owner's copy untouched
  });
});
