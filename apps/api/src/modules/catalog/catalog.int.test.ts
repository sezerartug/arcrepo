/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/restrict-template-expressions --
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
let categoryId: string;
let parentId: string;
let admin: Client;

beforeAll(async () => {
  t = await createTestApp();
  ({ id: categoryId, parentId } = await seedCategory(t.db));
  await makeAdmin(t.db);
  admin = t.client();
  await admin.post('/auth/login', { email: 'admin@arc.local', password: 'Admin!2345' });
});
afterAll(() => t.close());

async function verifiedSeller(tag: string) {
  const c = t.client();
  const reg = await registerCompany(c, tag);
  await t.db
    .updateTable('companies')
    .set({ status: 'verified' })
    .where('id', '=', reg.company.id)
    .execute();
  return { c, companyId: reg.company.id };
}

async function publish(c: Client, over: Record<string, unknown> = {}) {
  const created = await c.post('/listings', listingBody(categoryId, over), idem());
  expect(created.status).toBe(201);
  const ok = await admin.post(`/admin/listings/${created.body.id}/approve`, {});
  expect(ok.status).toBe(200);
  return created.body.id as string;
}

describe('categories', () => {
  it('returns a tree', async () => {
    const res = await t.client().get('/categories');
    expect(res.status).toBe(200);
    const root = res.body.find((n: { id: string }) => n.id === parentId);
    expect(root.children[0]).toMatchObject({ id: categoryId, unit: 'ton', basePerUnit: 1000 });
  });
});

describe('listing lifecycle and state machine', () => {
  it('creates pending_review, hides it publicly, publishes on approval, with money as strings', async () => {
    const { c } = await verifiedSeller('life');
    const created = await c.post('/listings', listingBody(categoryId), idem());
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      status: 'pending_review',
      unitPriceMinor: '2450000',
      quantityBase: '50000',
      unit: 'ton',
    });
    const id = created.body.id;

    expect((await t.client().get(`/listings/${id}`)).status).toBe(404); // not public yet
    expect((await c.get(`/listings/${id}`)).status).toBe(200); // owner sees it
    expect((await admin.get(`/listings/${id}`)).status).toBe(200); // admin sees it
    expect(
      (await t.client().get('/listings')).body.items.some((i: { id: string }) => i.id === id),
    ).toBe(false);

    expect((await admin.post(`/admin/listings/${id}/reject`, {})).status).toBe(422); // reason required
    expect((await admin.post(`/admin/listings/${id}/approve`, {})).body.status).toBe('published');
    expect((await t.client().get(`/listings/${id}`)).body.sellerName).toContain('life');
    // A second decision on a non-pending listing is an invalid transition.
    expect((await admin.post(`/admin/listings/${id}/approve`, {})).status).toBe(409);

    // Editing a published listing sends it back to review (price changes need re-approval).
    const patched = await c.req('PATCH', `/listings/${id}`, { unitPriceMinor: '2500000' });
    expect(patched.body.status).toBe('pending_review');
    expect((await t.client().get(`/listings/${id}`)).status).toBe(404);

    expect(
      (await admin.post(`/admin/listings/${id}/reject`, { reason: 'Fiyat uygunsuz' })).body.status,
    ).toBe('rejected');
    expect((await c.get(`/listings/${id}`)).body.reviewReason).toBe('Fiyat uygunsuz');
    expect((await admin.post(`/admin/listings/${id}/approve`, {})).status).toBe(409);

    expect((await c.post(`/listings/${id}/remove`)).body.status).toBe('removed');
    expect((await c.post(`/listings/${id}/remove`)).status).toBe(409);
    expect((await c.req('PATCH', `/listings/${id}`, { title: 'Yeni baslik burada' })).status).toBe(
      409,
    );

    const log = await admin.get(`/admin/audit?entityType=listing&entityId=${id}`);
    expect(log.body.items.map((i: { action: string }) => i.action)).toEqual([
      'listing.removed',
      'listing.rejected',
      'listing.updated',
      'listing.approved',
      'listing.created',
    ]);
  });

  it('validates input', async () => {
    const { c } = await verifiedSeller('valid');
    const post = (over: Record<string, unknown>) =>
      c.post('/listings', listingBody(categoryId, over), idem());
    expect((await post({ title: 'abc' })).status).toBe(422);
    expect((await post({ unitPriceMinor: '0' })).status).toBe(422);
    expect((await post({ unitPriceMinor: 12.5 })).status).toBe(422);
    expect((await post({ minOrderBase: '99999999' })).status).toBe(422);
    expect((await post({ saleType: 'auction' })).status).toBe(422); // auction params required
    expect((await post({ categoryId: '01a18159-a029-758d-99cd-3b478b442ac9' })).status).toBe(422);
    const noKey = await c.post('/listings', listingBody(categoryId));
    expect(noKey.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    const auction = await post({
      saleType: 'auction',
      auction: {
        startPriceMinor: '2000000',
        minIncrementMinor: '10000',
        reserveMinor: '2300000',
        startsAt: '2027-01-01T10:00:00Z',
        endsAt: '2027-01-02T10:00:00Z',
      },
    });
    expect(auction.status).toBe(201);
    expect(auction.body.auction.reserveMinor).toBe('2300000'); // owner sees the secret reserve
    const id = auction.body.id;
    await admin.post(`/admin/listings/${id}/approve`, {});
    const pub = await t.client().get(`/listings/${id}`);
    expect(pub.body.auction.startPriceMinor).toBe('2000000');
    expect(pub.body.auction.reserveMinor).toBeUndefined(); // reserve stays hidden from the public
  });
});

describe('object-level authorization (BOLA)', () => {
  it("another verified company cannot edit, remove or upload to a company's listing", async () => {
    const a = await verifiedSeller('owner-a');
    const b = await verifiedSeller('other-b');
    const id = await publish(a.c);

    const patch = await b.c.req('PATCH', `/listings/${id}`, { title: 'Ele gecirilmis ilan' });
    expect(patch.status).toBe(403);
    expect((await b.c.post(`/listings/${id}/remove`)).status).toBe(403);
    const form = new FormData();
    form.append(
      'file',
      new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' }),
      'x.jpg',
    );
    expect((await b.c.req('POST', `/listings/${id}/images`, form)).status).toBe(403);

    const row = await t.db
      .selectFrom('listings')
      .select(['title', 'status'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ title: 'B500C Ø12 nervürlü inşaat demiri', status: 'published' });
    expect((await b.c.get('/seller/listings')).body.items).toHaveLength(0);
  });

  it("a non-published listing of another company is invisible (404), not 'forbidden'", async () => {
    const a = await verifiedSeller('priv-a');
    const b = await verifiedSeller('priv-b');
    const created = await a.c.post('/listings', listingBody(categoryId), idem());
    expect((await b.c.get(`/listings/${created.body.id}`)).status).toBe(404);
    expect(
      (await b.c.req('PATCH', `/listings/${created.body.id}`, { title: 'Ele gecirilmis ilan' }))
        .status,
    ).toBe(404);
  });

  it('a suspended seller can no longer sell and its listings leave the public catalog', async () => {
    const a = await verifiedSeller('susp');
    const id = await publish(a.c);
    expect((await t.client().get(`/listings/${id}`)).status).toBe(200);
    await admin.post(`/admin/companies/${a.companyId}/suspend`, { reason: 'inceleme' });
    expect((await t.client().get(`/listings/${id}`)).status).toBe(404);
    expect((await a.c.post('/listings', listingBody(categoryId), idem())).status).toBe(403);
  });
});

describe('idempotency on POST /listings', () => {
  it('replays the stored response for the same key and body: one listing, one audit entry', async () => {
    const { c, companyId } = await verifiedSeller('idem');
    const headers = idem();
    const body = listingBody(categoryId, { title: 'Idempotent ilan basligi' });
    const first = await c.post('/listings', body, headers);
    const second = await c.post('/listings', body, headers);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    const rows = await t.db
      .selectFrom('listings')
      .select('id')
      .where('company_id', '=', companyId)
      .execute();
    expect(rows).toHaveLength(1);
    const audits = await t.db
      .selectFrom('audit_log')
      .select('id')
      .where('entity_id', '=', first.body.id)
      .execute();
    expect(audits).toHaveLength(1);
  });

  it('rejects the same key with a different body (422 IDEMPOTENCY_MISMATCH)', async () => {
    const { c } = await verifiedSeller('idem2');
    const headers = idem();
    expect((await c.post('/listings', listingBody(categoryId), headers)).status).toBe(201);
    const other = await c.post(
      '/listings',
      listingBody(categoryId, { unitPriceMinor: '1' }),
      headers,
    );
    expect(other.status).toBe(422);
    expect(other.body.error.code).toBe('IDEMPOTENCY_MISMATCH');
  });

  it('concurrent duplicates create exactly one listing', async () => {
    const { c, companyId } = await verifiedSeller('idem3');
    const headers = idem();
    const body = listingBody(categoryId, { title: 'Es zamanli ilan basligi' });
    const results = await Promise.all(
      Array.from({ length: 6 }, () => c.post('/listings', body, headers)),
    );
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(results.every((r) => r.status === 201)).toBe(true);
    const rows = await t.db
      .selectFrom('listings')
      .select('id')
      .where('company_id', '=', companyId)
      .execute();
    expect(rows).toHaveLength(1);
  });

  it('a failed action leaves no key behind, so the client can retry with the same key', async () => {
    const { c } = await verifiedSeller('idem4');
    const headers = idem();
    expect(
      (await c.post('/listings', listingBody(categoryId, { title: 'abc' }), headers)).status,
    ).toBe(422);
    expect((await c.post('/listings', listingBody(categoryId), headers)).status).toBe(201);
  });
});

describe('search', () => {
  it('finds Turkish text regardless of case, dotted/dotless I and diacritics', async () => {
    const { c } = await verifiedSeller('search');
    const demir = await publish(c, { title: 'İnşaat DEMİRİ B500C Ø16', location: 'Iğdır' });
    const cimento = await publish(c, {
      title: 'Çimento torbası CEM I 42.5',
      unitPriceMinor: '300',
      location: 'Ankara',
    });
    const search = async (q: string) =>
      (
        (await t.client().get(`/listings?q=${encodeURIComponent(q)}`)).body.items as {
          id: string;
        }[]
      ).map((i) => i.id);

    for (const q of ['demir', 'DEMİR', 'demiri', 'insaat', 'İNŞAAT', 'ınşaat', 'Demir B500C']) {
      const found = await search(q);
      expect(found, q).toContain(demir);
      expect(found, q).not.toContain(cimento);
    }
    expect(await search('cimento')).toEqual([cimento]);
    expect(await search('ÇİMENTO')).toEqual([cimento]);
    expect(await search('yok-boyle-bir-sey')).toHaveLength(0);
    expect(await search('100%_')).toHaveLength(0); // LIKE wildcards are escaped

    const byLoc = (await t.client().get(`/listings?location=${encodeURIComponent('IĞDIR')}`)).body;
    expect(byLoc.items.map((i: { id: string }) => i.id)).toEqual([demir]);
  });

  it('filters, sorts and paginates', async () => {
    const { c } = await verifiedSeller('filter');
    const cheap = await publish(c, { title: 'Ucuz profil HEA 200', unitPriceMinor: '100' });
    const dear = await publish(c, { title: 'Pahali profil HEA 300', unitPriceMinor: '900000000' });
    const get = async (qs: string) => (await t.client().get(`/listings?${qs}`)).body;

    const asc = await get(`sort=price_asc&categoryId=${parentId}`); // parent includes child categories
    const ids = asc.items.map((i: { id: string }) => i.id);
    expect(ids.indexOf(cheap)).toBeLessThan(ids.indexOf(dear));
    expect(ids[0]).toBe(cheap);
    const desc = await get('sort=price_desc');
    expect(desc.items[0].id).toBe(dear);
    expect(
      (await get('minPrice=500000000&maxPrice=999999999')).items.map((i: { id: string }) => i.id),
    ).toEqual([dear]);
    const auctions = (await get('saleType=auction')).items as { saleType: string }[];
    expect(auctions.every((i) => i.saleType === 'auction')).toBe(true);
    expect((await t.client().get('/listings?sort=bogus')).status).toBe(422);
    expect((await t.client().get('/listings?saleType=x')).status).toBe(422);

    const page = await get('page=1');
    expect(page.page).toBe(1);
    expect(page.total).toBeGreaterThanOrEqual(2);
    expect(page.items.length).toBeLessThanOrEqual(20);
    expect(typeof page.items[0].unitPriceMinor).toBe('string');
  });
});

describe('images and favorites', () => {
  const PNG = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(64, 1),
  ]);
  const form = (data: Buffer, name = 'a.png', type = 'image/png') => {
    const f = new FormData();
    f.append('file', new Blob([new Uint8Array(data)], { type }), name);
    return f;
  };

  it('accepts a real PNG, serves it, and rejects fakes by magic bytes and oversize files', async () => {
    const { c } = await verifiedSeller('img');
    const id = await publish(c);
    const ok = await c.req('POST', `/listings/${id}/images`, form(PNG));
    expect(ok.status).toBe(201);
    const served = await t.client().req('GET', ok.body.url);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/png');
    expect(served.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await t.client().get(`/listings/${id}`)).body.images).toHaveLength(1);

    // Declared as image/png and named .png, but the bytes are HTML.
    const fake = await c.req(
      'POST',
      `/listings/${id}/images`,
      form(Buffer.from('<html><script>1</script>')),
    );
    expect(fake.status).toBe(415);
    const big = await c.req(
      'POST',
      `/listings/${id}/images`,
      form(Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)])),
    );
    expect(big.status).toBe(413);
    expect((await t.client().get('/uploads/..%2F..%2Fetc%2Fpasswd')).status).toBe(404);
    expect((await t.client().get('/uploads/nope.png')).status).toBe(404);
  });

  it('favorites a published listing; hides it again when the listing is gone', async () => {
    const { c } = await verifiedSeller('fav');
    const id = await publish(c);
    const buyer = t.client();
    await registerCompany(buyer, 'buyer');
    expect((await t.client().post(`/listings/${id}/favorite`)).status).toBe(401);
    expect((await buyer.post(`/listings/${id}/favorite`)).body).toEqual({ favorite: true });
    expect((await buyer.post(`/listings/${id}/favorite`)).status).toBe(200); // idempotent
    const favs = await buyer.get('/favorites');
    expect(favs.body.items.map((i: { id: string }) => i.id)).toEqual([id]);
    expect(favs.body.items[0].isFavorite).toBe(true);
    expect((await buyer.req('DELETE', `/listings/${id}/favorite`)).body).toEqual({
      favorite: false,
    });
    expect((await buyer.get('/favorites')).body.items).toHaveLength(0);
    const pending = await c.post('/listings', listingBody(categoryId), idem());
    expect((await buyer.post(`/listings/${pending.body.id}/favorite`)).status).toBe(404);
  });
});
