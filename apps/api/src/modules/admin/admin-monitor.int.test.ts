/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment --
   HTTP test bodies are untyped JSON. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, idem, listingBody, seedCategory, type TestApp } from '../../test/app.js';
import {
  adminClient,
  createAuction,
  joinAuction,
  placeBid,
  verifiedCompany,
} from '../../test/auctions.js';

let t: TestApp;
let categoryId: string;
let admin: Awaited<ReturnType<typeof adminClient>>;

beforeAll(async () => {
  t = await createTestApp();
  categoryId = (await seedCategory(t.db)).id;
  admin = await adminClient(t);
}, 120_000);
afterAll(() => t.close());

describe('admin auction monitoring', () => {
  it('is admin-only, shows real identities only there, and audits detail views', async () => {
    const seller = await verifiedCompany(t, 'TakipSatici');
    const b1 = await verifiedCompany(t, 'TakipAlici1');
    const b2 = await verifiedCompany(t, 'TakipAlici2');
    const id = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      endsInMs: 3_600_000,
    });
    await joinAuction(admin, b1, id);
    await joinAuction(admin, b2, id);
    expect((await placeBid(b1.c, id, 100_000n)).status).toBe(201);
    expect((await placeBid(b2.c, id, 101_000n)).status).toBe(201);
    expect((await placeBid(b1.c, id, 101_500n)).status).toBe(422); // below min increment -> attempt

    const urls = ['/admin/auctions', `/admin/auctions/${id}`];
    for (const u of urls) {
      expect((await t.client().get(u)).status).toBe(401);
      expect((await seller.c.get(u)).status).toBe(403);
      expect((await b1.c.get(u)).status).toBe(403);
    }

    const list = await admin.get('/admin/auctions?status=LIVE&q=takipsatici');
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      id,
      status: 'LIVE',
      bidCount: 2,
      currentPriceMinor: '101000',
      sellerName: expect.stringContaining('TakipSatici'),
    });
    expect(list.body.items[0].heldDepositTotalMinor).not.toBe('0');
    expect((await admin.get('/admin/auctions?status=bogus')).status).toBe(422);
    expect((await admin.get('/admin/auctions?status=SETTLED&q=takipsatici')).body.total).toBe(0);

    const d = await admin.get(`/admin/auctions/${id}`);
    expect(d.status).toBe(200);
    expect((d.body.bids as { seq: number }[]).map((b) => b.seq)).toEqual([1, 2]);
    expect(d.body.bids[0].companyName).toContain('TakipAlici1');
    expect(d.body.bids[0].userName).toBeTruthy();
    expect(d.body.deposits).toHaveLength(2);
    expect(d.body.attempts).toHaveLength(1);
    expect(d.body.rejectionSummary).toHaveLength(1);
    expect(d.body.events.length).toBeGreaterThan(0);
    expect(d.body.serverNow).toBeTruthy();

    // The public snapshot stays anonymous.
    const pub = await t.client().get(`/auctions/${id}`);
    expect(pub.status).toBe(200);
    expect(JSON.stringify(pub.body)).not.toContain('TakipAlici');
    expect(pub.body.bids[0].bidder).toMatch(/^Teklif veren #/);

    const audit = await t.db
      .selectFrom('audit_log')
      .select(['actor_type', 'data'])
      .where('action', '=', 'admin.auction.view')
      .where('entity_id', '=', id)
      .execute();
    expect(audit).toHaveLength(1);
    const entry = audit[0];
    // live polling re-reads without writing another audit entry
    expect((await admin.get(`/admin/auctions/${id}?poll=1`)).status).toBe(200);
    const again = await t.db
      .selectFrom('audit_log')
      .select('id')
      .where('action', '=', 'admin.auction.view')
      .where('entity_id', '=', id)
      .execute();
    expect(again).toHaveLength(1);
    expect(entry?.actor_type).toBe('admin');
    expect(JSON.stringify(entry?.data)).not.toContain('TakipAlici');

    expect((await admin.get(`/admin/auctions/${crypto.randomUUID()}`)).status).toBe(404);
    expect((await admin.get('/admin/auctions/not-a-uuid')).status).toBe(404);
  });

  it('lists the first listing image url on public GET /auctions', async () => {
    const seller = await verifiedCompany(t, 'GorselSatici');
    const id = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      endsInMs: 3_600_000,
    });
    const row = await t.db
      .selectFrom('auctions')
      .select('listing_id')
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    const before = await t.client().get('/auctions?status=live');
    const items = (b: { items: { id: string; imageUrl: string | null }[] }) =>
      b.items.find((i) => i.id === id)?.imageUrl;
    expect(items(before.body as Parameters<typeof items>[0])).toBeNull();
    await t.db
      .insertInto('listing_images')
      .values({ listing_id: row.listing_id, file_name: 'x.png' })
      .execute();
    const after = await t.client().get('/auctions?status=live');
    expect(items(after.body as Parameters<typeof items>[0])).toBe('/uploads/x.png');
  });
});

describe('admin listing edit', () => {
  it('keeps a published listing published and audits field names; owner edit still re-reviews', async () => {
    const seller = await verifiedCompany(t, 'DuzenleSatici');
    const l = await seller.c.post('/listings', listingBody(categoryId), idem());
    expect((await admin.post(`/admin/listings/${String(l.body.id)}/approve`, {})).status).toBe(200);

    const url = `/admin/listings/${String(l.body.id)}`;
    expect(
      (await seller.c.req('PATCH', url, { title: 'Yeni baslik 1', reason: 'xxx' })).status,
    ).toBe(403);
    expect((await admin.req('PATCH', url, { title: 'Yeni baslik 1' })).status).toBe(422);
    expect((await admin.req('PATCH', url, { reason: 'neden var' })).status).toBe(422);
    const ok = await admin.req('PATCH', url, {
      title: 'Yonetici baslik',
      location: 'Izmir',
      reason: 'Hatali konum duzeltildi',
    });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      title: 'Yonetici baslik',
      location: 'Izmir',
      status: 'published',
    });
    const a = await t.db
      .selectFrom('audit_log')
      .select(['reason', 'data', 'actor_type'])
      .where('action', '=', 'admin.listing.update')
      .where('entity_id', '=', l.body.id)
      .executeTakeFirstOrThrow();
    expect(a.reason).toBe('Hatali konum duzeltildi');
    expect(a.actor_type).toBe('admin');
    expect((a.data as { fields: string[] }).fields.sort()).toEqual(['location', 'title']);

    const own = await seller.c.req('PATCH', `/listings/${String(l.body.id)}`, {
      title: 'Satici baslik 2',
    });
    expect(own.status).toBe(200);
    expect(own.body.status).toBe('pending_review');
  });

  it('refuses a published auction listing (AUCTION_LISTING_LOCKED), also while LIVE', async () => {
    const seller = await verifiedCompany(t, 'KilitSatici');
    const id = await createAuction(t, {
      sellerCompanyId: seller.companyId,
      categoryId,
      endsInMs: 3_600_000,
    });
    const row = await t.db
      .selectFrom('auctions')
      .select('listing_id')
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    const r = await admin.req('PATCH', `/admin/listings/${row.listing_id}`, {
      title: 'Kilitli baslik',
      reason: 'deneme',
    });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('AUCTION_LISTING_LOCKED');
  });
});
