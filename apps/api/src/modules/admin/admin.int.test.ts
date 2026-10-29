/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/restrict-template-expressions --
   HTTP test bodies are untyped JSON. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Client,
  createTestApp,
  idem,
  listingBody,
  makeAdmin,
  registerCompany,
  seedCategory,
  type TestApp,
} from '../../test/app.js';

let t: TestApp;
let admin: Client;
let categoryId: string;

async function verified(tag: string) {
  const c = t.client();
  const reg = await registerCompany(c, tag);
  await t.db
    .updateTable('companies')
    .set({ status: 'verified' })
    .where('id', '=', reg.company.id)
    .execute();
  return { c, companyId: reg.company.id, email: reg.user.email };
}

beforeAll(async () => {
  t = await createTestApp();
  categoryId = (await seedCategory(t.db)).id;
  await makeAdmin(t.db);
  admin = t.client();
  await admin.post('/auth/login', { email: 'admin@arc.local', password: 'Admin!2345' });
}, 120_000);
afterAll(() => t.close());

const ENDPOINTS = ['/admin/companies', '/admin/users', `/admin/companies/${crypto.randomUUID()}`];

describe('admin directory access control', () => {
  it('rejects anonymous (401) and non-admin (403) callers on every endpoint', async () => {
    const seller = await verified('acl');
    for (const url of ENDPOINTS) {
      expect((await t.client().get(url)).status).toBe(401);
      expect((await seller.c.get(url)).status).toBe(403);
    }
    const id = crypto.randomUUID();
    expect((await t.client().post(`/admin/listings/${id}/remove`, {})).status).toBe(401);
    expect((await seller.c.post(`/admin/listings/${id}/remove`, { reason: 'xxx' })).status).toBe(
      403,
    );
  });
});

describe('company directory and detail', () => {
  it('lists with search, status filter, pagination and counts', async () => {
    const a = await verified('Dizinalfa');
    await a.c.post('/listings', listingBody(categoryId), idem());
    await verified('Dizinbeta');
    const res = await admin.get('/admin/companies?q=dizinalfa');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      id: a.companyId,
      status: 'verified',
      listingCount: 1,
      memberCount: 1,
    });
    const byTax = await admin.get(`/admin/companies?q=${res.body.items[0].taxNo}`);
    expect(byTax.body.items.map((i: { id: string }) => i.id)).toContain(a.companyId);
    expect((await admin.get('/admin/companies?q=dizin&status=pending')).body.total).toBe(0);
    const paged = await admin.get('/admin/companies?q=dizin&page=2');
    expect(paged.body.items).toHaveLength(0);
    expect(paged.body.total).toBe(2);
    expect((await admin.get('/admin/companies?status=bogus')).status).toBe(422);
    // LIKE wildcards in the search term are literal
    expect((await admin.get('/admin/companies?q=%25')).body.total).toBe(0);
  });

  it('returns members, listings, auctions, orders and audit; writes an admin.company.view entry', async () => {
    const seller = await verified('DetaySatici');
    const buyer = await verified('DetayAlici');
    // fixed listing, published directly + bought by the buyer
    const fixed = await seller.c.post('/listings', listingBody(categoryId), idem());
    expect((await admin.post(`/admin/listings/${fixed.body.id}/approve`, {})).status).toBe(200);
    const buy = await buyer.c.post(
      `/listings/${fixed.body.id}/buy`,
      { quantityBase: '10000' },
      idem(),
    );
    expect(buy.status).toBe(201);
    // auction listing, approved -> auction row
    const au = await seller.c.post(
      '/listings',
      listingBody(categoryId, {
        title: 'Mezat ilani',
        saleType: 'auction',
        auction: {
          startPriceMinor: '2450000',
          minIncrementMinor: '10000',
          startsAt: new Date(Date.now() - 60_000).toISOString(),
          endsAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
      }),
      idem(),
    );
    expect(au.status).toBe(201);
    expect((await admin.post(`/admin/listings/${au.body.id}/approve`, {})).status).toBe(200);
    await seller.c.post('/auth/login', { email: seller.email, password: 'Demo!2345' });

    const before = await t.db
      .selectFrom('audit_log')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('action', '=', 'admin.company.view')
      .executeTakeFirstOrThrow();
    const res = await admin.get(`/admin/companies/${seller.companyId}`);
    expect(res.status).toBe(200);
    const b = res.body;
    expect(b.company).toMatchObject({
      id: seller.companyId,
      status: 'verified',
      taxOffice: 'Kadıköy',
    });
    expect(b.members).toHaveLength(1);
    expect(b.members[0]).toMatchObject({ email: seller.email, role: 'owner' });
    expect(b.listings.map((l: { title: string }) => l.title)).toContain('Mezat ilani');
    expect(b.listings[0].unitPriceMinor).toBe('2450000');
    expect(b.auctions).toHaveLength(1);
    expect(b.auctions[0]).toMatchObject({
      listingTitle: 'Mezat ilani',
      status: 'LIVE',
      bidCount: 0,
      startPriceMinor: '2450000',
      heldDeposits: 0,
    });
    expect(typeof b.auctions[0].depositMinor).toBe('string');
    expect(b.orders).toHaveLength(1);
    expect(b.orders[0]).toMatchObject({ role: 'seller', totalMinor: '24500000' });
    expect(b.audit.length).toBeGreaterThan(0);
    expect(b.audit.length).toBeLessThanOrEqual(20);

    // buyer's view shows the same order with the buyer role
    const bd = await admin.get(`/admin/companies/${buyer.companyId}`);
    expect(bd.body.orders[0].role).toBe('buyer');

    // no secrets anywhere in the payload
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/password|token|hash|\$argon|\$2[aby]\$/i);

    const after = await t.db
      .selectFrom('audit_log')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('action', '=', 'admin.company.view')
      .executeTakeFirstOrThrow();
    expect(Number(after.n) - Number(before.n)).toBe(2);
    const entry = await t.db
      .selectFrom('audit_log')
      .selectAll()
      .where('action', '=', 'admin.company.view')
      .where('entity_id', '=', seller.companyId)
      .executeTakeFirstOrThrow();
    expect(entry).toMatchObject({ actor_type: 'admin', entity_type: 'company' });
    expect(entry.data).toEqual({});

    expect((await admin.get(`/admin/companies/${crypto.randomUUID()}`)).status).toBe(404);
    expect((await admin.get('/admin/companies/not-a-uuid')).status).toBe(404);
  });
});

describe('user directory', () => {
  it('searches by name/email, shows companies, never returns credentials', async () => {
    const u = await verified('Kullanicitest');
    const res = await admin.get(`/admin/users?q=${encodeURIComponent(u.email)}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      email: u.email,
      isAdmin: false,
      companies: [{ id: u.companyId, status: 'verified', role: 'owner' }],
    });
    const all = await admin.get('/admin/users');
    expect(all.body.items.length).toBeGreaterThan(1);
    expect(JSON.stringify(all.body)).not.toMatch(/password|token|hash|\$argon|\$2[aby]\$/i);
    expect(Object.keys(all.body.items[0]).sort()).toEqual(
      ['companies', 'createdAt', 'email', 'fullName', 'id', 'isAdmin'].sort(),
    );
  });
});

describe('admin listing removal', () => {
  it('requires a reason, removes any listing, audits, and refuses while an auction is active', async () => {
    const seller = await verified('Kaldir');
    const created = await seller.c.post('/listings', listingBody(categoryId), idem());
    const id = created.body.id;
    expect((await admin.post(`/admin/listings/${id}/remove`, {})).status).toBe(422);
    expect(
      (await admin.post(`/admin/listings/${crypto.randomUUID()}/remove`, { reason: 'abc' })).status,
    ).toBe(404);
    const ok = await admin.post(`/admin/listings/${id}/remove`, { reason: 'Kural ihlali' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ id, status: 'removed' });
    expect(
      (await admin.post(`/admin/listings/${id}/remove`, { reason: 'Kural ihlali' })).status,
    ).toBe(409);
    const log = await t.db
      .selectFrom('audit_log')
      .selectAll()
      .where('entity_id', '=', id)
      .where('action', '=', 'listing.removed')
      .executeTakeFirstOrThrow();
    expect(log).toMatchObject({ actor_type: 'admin', reason: 'Kural ihlali' });

    const au = await seller.c.post(
      '/listings',
      listingBody(categoryId, {
        saleType: 'auction',
        auction: {
          startPriceMinor: '2450000',
          minIncrementMinor: '10000',
          startsAt: new Date(Date.now() - 60_000).toISOString(),
          endsAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
      }),
      idem(),
    );
    await admin.post(`/admin/listings/${au.body.id}/approve`, {});
    const blocked = await admin.post(`/admin/listings/${au.body.id}/remove`, { reason: 'abc' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('AUCTION_ACTIVE');
  });
});
