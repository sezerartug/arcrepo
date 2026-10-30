/* global process, fetch, crypto, console */
// Demo anlık görüntüsü: çalışan yerel API'den (tohum veri) GET yanıtlarını rol bazında kaydeder.
// Kullanım: pnpm demo çalışırken `node apps/web/scripts/capture-demo.mjs` (API_URL ile değiştirilebilir).
// Çıktı: apps/web/lib/demo/snapshot.json — Vercel demosu bu dosyayla çalışır, arka uç gerekmez.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.API_URL ?? 'http://127.0.0.1:3001';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'demo', 'snapshot.json');

const ROLES = {
  visitor: null,
  buyer: { email: 'alici@arc.local', password: 'Demo!2345' },
  seller: { email: 'satici1@arc.local', password: 'Demo!2345' },
  admin: { email: 'admin@arc.local', password: 'Admin!2345' },
};

async function login(creds) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(creds),
  });
  if (!res.ok) throw new Error(`login ${creds.email}: ${res.status}`);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

const items = (b) => (Array.isArray(b) ? b : (b?.items ?? []));

async function captureRole(role, creds) {
  const cookie = creds ? await login(creds) : '';
  const out = {};
  const get = async (path) => {
    if (path in out) return out[path];
    const res = await fetch(API + path, { headers: cookie ? { cookie } : {} });
    if (!res.ok) return null;
    out[path] = await res.json();
    return out[path];
  };

  await get('/categories');
  await get('/me');
  if (creds && !out['/me']) throw new Error(`/me başarısız: ${role}`);

  // Herkese açık
  const listingPaths = [
    '/listings',
    '/listings?page=2',
    '/listings?page=3',
    '/listings?sort=newest',
    '/listings?sort=newest&saleType=fixed',
    '/listings?sort=newest&saleType=auction',
    '/listings?sort=newest&condition=ikinci_el',
  ];
  const ids = new Set();
  for (const p of listingPaths) for (const l of items(await get(p))) ids.add(l.id);
  for (const id of ids) await get(`/listings/${id}`);
  const auctionIds = new Set();
  for (const s of ['live', 'scheduled', 'ended', 'closed', 'settled']) {
    for (const a of items(await get(`/auctions?status=${s}`))) auctionIds.add(a.id);
  }
  for (const a of items(await get('/auctions'))) auctionIds.add(a.id);
  for (const id of auctionIds) await get(`/auctions/${id}`);

  if (!creds) return out;

  for (const p of [
    '/me/sessions',
    '/notifications',
    '/notifications?unread=1',
    '/favorites',
    '/company/members',
    '/seller/listings',
    '/seller/payouts',
  ])
    await get(p);
  for (const o of items(await get('/orders'))) await get(`/orders/${o.id}`);
  for (const l of items(out['/seller/listings'])) await get(`/listings/${l.id}`);

  if (role === 'admin') {
    for (const p of [
      '/admin/stats',
      '/admin/pending-counts',
      '/admin/payments?status=pending',
      '/admin/audit',
      '/admin/finance/summary',
      '/admin/finance/summary?range=30d',
      '/admin/finance/summary?range=7d',
      '/admin/finance/summary?range=all',
      '/admin/users',
      '/admin/listings?status=pending_review',
      '/admin/listings',
      '/admin/orders',
      '/admin/disputes',
      '/admin/auctions',
      '/admin/companies?perPage=100',
      '/admin/companies?status=verified&perPage=100',
    ])
      await get(p);
    for (const s of ['pending', 'verified', 'rejected', 'suspended'])
      await get(`/admin/companies?status=${s}`);
    for (const s of ['live', 'scheduled', 'ended', 'settled'])
      await get(`/admin/auctions?status=${s}`);
    for (const s of [
      'awaiting_payment',
      'paid_escrow',
      'shipped',
      'delivered',
      'completed',
      'disputed',
      'refunded',
    ])
      await get(`/admin/orders?status=${s}`);
    for (const s of ['open', 'resolved']) await get(`/admin/disputes?status=${s}`);
    for (const c of items(out['/admin/companies?perPage=100']))
      await get(`/admin/companies/${c.id}`);
    for (const a of items(out['/admin/auctions'])) await get(`/admin/auctions/${a.id}`);
  }
  return out;
}

// Tohum dışı elle açılmış deneme ilanları reklam demosuna girmez.
const EXCLUDE_TITLES = new Set(['Matkap']);

function dropExcluded(roles) {
  const banned = new Set();
  for (const r of Object.values(roles))
    for (const [k, v] of Object.entries(r))
      if (/^\/listings\/[^/?]+$/.test(k) && EXCLUDE_TITLES.has(v.title)) banned.add(v.id);
  for (const r of Object.values(roles))
    for (const v of Object.values(r))
      for (const a of items(v)) if (banned.has(a.listingId)) banned.add(a.id);
  for (const r of Object.values(roles)) {
    for (const k of Object.keys(r)) if ([...banned].some((id) => k.includes(id))) delete r[k];
    for (const v of Object.values(r)) {
      if (!Array.isArray(v?.items)) continue;
      const kept = v.items.filter((a) => !banned.has(a.id) && !banned.has(a.listingId));
      if (typeof v.total === 'number') v.total -= v.items.length - kept.length;
      v.items = kept;
    }
  }
}

const roles = {};
for (const [role, creds] of Object.entries(ROLES)) {
  roles[role] = await captureRole(role, creds);
  console.log(role, Object.keys(roles[role]).length, 'yanıt');
}
dropExcluded(roles);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ capturedAt: new Date().toISOString(), roles }));
console.log('yazıldı:', OUT);
