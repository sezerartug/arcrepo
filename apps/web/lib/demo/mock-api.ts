// Demo kipi (NEXT_PUBLIC_DEMO_MODE=1): API yerine `snapshot.json` (scripts/capture-demo.mjs) sunulur.
// Arka uç, veritabanı ve kalıcı yazma yoktur; yazma istekleri açıklayıcı bir hata döner.
import type { Category } from '../types';
import snapshotJson from './snapshot.json';

export const DEMO_ROLE_COOKIE = 'arc-demo-role';
export const DEMO_ROLES = ['visitor', 'buyer', 'seller', 'admin'] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === '1';

export function parseRole(v: string | undefined): DemoRole {
  return DEMO_ROLES.find((r) => r === v) ?? 'visitor';
}

const ACCOUNT_ROLES: Record<string, DemoRole> = {
  'alici@arc.local': 'buyer',
  'satici1@arc.local': 'seller',
  'admin@arc.local': 'admin',
};

export type MockResult = { status: number; body?: unknown; setRole?: DemoRole };

type Json = unknown;
type Obj = Record<string, Json>;
const snapshot = snapshotJson as unknown as { capturedAt: string; roles: Record<string, Obj> };

const PAGE_SIZE = 20;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

const err = (status: number, code: string, message: string): MockResult => ({
  status,
  body: { error: { code, message } },
});

const str = (v: Json, d = ''): string => (typeof v === 'string' ? v : d);
const isObj = (v: Json): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const itemsOf = (b: Json): Obj[] =>
  Array.isArray(b) ? (b as Obj[]) : isObj(b) && Array.isArray(b.items) ? (b.items as Obj[]) : [];

/** Tarihleri "şimdi"ye kaydırır: anlık görüntü alındıktan sonra geçen süre kadar. */
function shiftDates(v: Json, deltaMs: number): Json {
  if (typeof v === 'string')
    return ISO.test(v) ? new Date(Date.parse(v) + deltaMs).toISOString() : v;
  if (Array.isArray(v)) return v.map((x) => shiftDates(x, deltaMs));
  if (isObj(v))
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shiftDates(x, deltaMs)]));
  return v;
}

// ---- Mezat: tohum mezatları saatler önce bittiği için demoda "canlı" gösterilir -----------------

type LiveWindow = { startOffsetMin: number; endOffsetMin: number; bids: number };
const DEFAULT_WINDOW: LiveWindow = { startOffsetMin: -95, endOffsetMin: 38, bids: 7 };
const LIVE_WINDOWS: LiveWindow[] = [
  DEFAULT_WINDOW,
  { startOffsetMin: -140, endOffsetMin: 112, bids: 5 },
  { startOffsetMin: -60, endOffsetMin: 190, bids: 4 },
];

function auctionIndex(): Map<string, { listingId: string; idx: number }> {
  const seen = new Map<string, { listingId: string; idx: number }>();
  for (const r of Object.values(snapshot.roles))
    for (const [k, v] of Object.entries(r))
      if (
        /^\/auctions\/[^/?]+$/.test(k) &&
        isObj(v) &&
        v.status === 'ENDED_NO_SALE' &&
        !seen.has(String(v.id))
      )
        seen.set(String(v.id), {
          listingId: String(v.listingId),
          idx: seen.size % LIVE_WINDOWS.length,
        });
  return seen;
}
const AUCTIONS = auctionIndex();
const LISTING_TO_AUCTION = new Map([...AUCTIONS].map(([id, a]) => [a.listingId, id]));

function windowFor(auctionId: string, now: number) {
  const a = AUCTIONS.get(auctionId);
  if (!a) return null;
  const w = LIVE_WINDOWS[a.idx] ?? DEFAULT_WINDOW;
  return {
    w,
    startsAt: new Date(now + w.startOffsetMin * 60_000).toISOString(),
    endsAt: new Date(now + w.endOffsetMin * 60_000).toISOString(),
  };
}

function liveBids(o: Obj, now: number, count: number) {
  const start = BigInt(String(o.startPriceMinor));
  const step = BigInt(str(o.minIncrementMinor, '10000'));
  const span = Math.abs(DEFAULT_WINDOW.startOffsetMin);
  return Array.from({ length: count }, (_, i) => ({
    seq: i + 1,
    amountMinor: (start + step * BigInt(i + 1)).toString(),
    bidder: `Teklif veren #${String((i % 3) + 1)}`,
    at: new Date(now - (span - 8 * (i + 1)) * 60_000).toISOString(),
  }));
}

const stripSuffix = (t: unknown) =>
  typeof t === 'string' ? t.replace(/\s*\((canlı|\d+ saat sonra)\)\s*$/, '') : t;

function liveify(v: Json, now: number): Json {
  if (Array.isArray(v)) return v.map((x) => liveify(x, now));
  if (!isObj(v)) return v;
  const out: Obj = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, liveify(x, now)]));
  const id = typeof out.id === 'string' ? out.id : '';

  const win = windowFor(id, now);
  const bids = win ? liveBids(out, now, win.w.bids) : [];
  const last = bids.at(-1);
  if (win && last && out.status === 'ENDED_NO_SALE') {
    Object.assign(out, {
      status: 'LIVE',
      startsAt: win.startsAt,
      endsAt: win.endsAt,
      bidCount: bids.length,
      currentPriceMinor: last.amountMinor,
      minNextBidMinor: (
        BigInt(last.amountMinor) + BigInt(str(out.minIncrementMinor, '10000'))
      ).toString(),
      title: stripSuffix(out.title),
    });
    if ('bids' in out) out.bids = bids;
  }

  const listingAuction = LISTING_TO_AUCTION.get(id);
  if (listingAuction && isObj(out.auction)) {
    const lw = windowFor(listingAuction, now);
    if (lw) out.auction = { ...out.auction, startsAt: lw.startsAt, endsAt: lw.endsAt };
    out.title = stripSuffix(out.title);
  }
  return out;
}

// ---- GET /listings: yerelde süz + sayfala ---------------------------------------------------------

function descendantIds(tree: Category[], id: string): Set<string> {
  const out = new Set<string>();
  const collect = (c: Category) => {
    out.add(c.id);
    c.children?.forEach(collect);
  };
  const find = (nodes: Category[]): boolean =>
    nodes.some((c) => (c.id === id ? (collect(c), true) : find(c.children ?? [])));
  find(tree);
  return out;
}

function listListings(data: Obj, p: URLSearchParams): MockResult {
  const all = ['/listings', '/listings?page=2', '/listings?page=3'].flatMap((k) =>
    itemsOf(data[k]),
  );
  const tree = (data['/categories'] ?? []) as Category[];
  const cat = p.get('categoryId');
  const cats = cat ? descendantIds(tree, cat) : null;
  const q = p.get('q')?.toLocaleLowerCase('tr');
  const loc = p.get('location')?.toLocaleLowerCase('tr');
  const min = p.get('minPrice');
  const max = p.get('maxPrice');
  const price = (l: Obj) => BigInt(String(l.unitPriceMinor));

  let rows = all.filter(
    (l) =>
      (!cats || cats.has(String(l.categoryId))) &&
      (!p.get('condition') || l.condition === p.get('condition')) &&
      (!p.get('saleType') || l.saleType === p.get('saleType')) &&
      (!q || `${String(l.title)} ${str(l.description)}`.toLocaleLowerCase('tr').includes(q)) &&
      (!loc || str(l.location).toLocaleLowerCase('tr').includes(loc)) &&
      (!min || price(l) >= BigInt(min)) &&
      (!max || price(l) <= BigInt(max)),
  );
  const sort = p.get('sort');
  if (sort === 'price_asc') rows = [...rows].sort((a, b) => Number(price(a) - price(b)));
  else if (sort === 'price_desc') rows = [...rows].sort((a, b) => Number(price(b) - price(a)));

  const page = Math.max(1, Number(p.get('page')) || 1);
  return {
    status: 200,
    body: { items: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: rows.length, page },
  };
}

// ---- Genel anlık görüntü araması ------------------------------------------------------------------

const LOOSE = new Set(['page', 'perPage', 'q', 'from', 'to', 'sort']);

/** Aynı yolun kayıtlı sorguları arasından en çok eşleşeni seçer; çelişen süzgeçli kaydı almaz. */
function lookup(data: Obj, path: string, p: URLSearchParams): Json {
  const exact = path + (p.size ? `?${p.toString()}` : '');
  if (exact in data) return data[exact];
  let best: { score: number; extra: number; value: Json } | null = null;
  for (const [k, value] of Object.entries(data)) {
    const [kp, kq = ''] = k.split('?');
    if (kp !== path) continue;
    const kparams = new URLSearchParams(kq);
    let score = 0;
    let conflict = false;
    for (const [name, val] of kparams) {
      if (p.get(name) === val) score++;
      else if (!LOOSE.has(name)) conflict = true;
    }
    if (conflict) continue;
    const extra = [...p.keys()].filter((n) => !LOOSE.has(n) && !kparams.has(n)).length;
    if (!best || score > best.score || (score === best.score && extra < best.extra))
      best = { score, extra, value };
  }
  return best?.value;
}

function auctionList(data: Obj, status: string | null): Json {
  const live = itemsOf(data['/auctions']).filter((a) => AUCTIONS.has(String(a.id)));
  const base = data['/auctions?status=live'] ?? data['/auctions'];
  const items = !status || status === 'live' ? live : [];
  return { ...(isObj(base) ? base : {}), items };
}

export function handleDemo(
  method: string,
  rawPath: string,
  role: DemoRole,
  body: unknown,
): MockResult {
  const url = new URL(rawPath, 'http://demo.local');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const p = url.searchParams;

  if (method === 'POST' && path === '/demo/role') {
    const next = parseRole(isObj(body) ? String(body.role) : undefined);
    return { status: 200, body: { role: next }, setRole: next };
  }
  if (method === 'POST' && path === '/auth/login') {
    const next = ACCOUNT_ROLES[isObj(body) ? str(body.email).toLowerCase() : ''];
    return next
      ? { status: 200, body: { ok: true }, setRole: next }
      : err(
          401,
          'INVALID_CREDENTIALS',
          'Demo sürümünde yalnızca “Demo hesabı seç” çubuğundaki roller kullanılabilir.',
        );
  }
  if (method === 'POST' && path === '/auth/logout') return { status: 204, setRole: 'visitor' };
  if (
    method === 'POST' &&
    (path === '/notifications/read-all' || /^\/notifications\/[^/]+\/read$/.test(path))
  )
    return { status: 204 };
  if (method !== 'GET')
    return err(403, 'DEMO_MODE', 'Bu bir demo sürümüdür; işlemler kaydedilmez.');

  if (path.startsWith('/admin') && role !== 'admin')
    return err(403, 'FORBIDDEN', 'Bu sayfa yalnızca yönetici içindir.');

  const data = snapshot.roles[role] ?? {};
  const now = Date.now();
  const delta = Math.max(0, now - Date.parse(snapshot.capturedAt));
  const finish = (v: Json): MockResult => {
    if (path.startsWith('/notifications') && isObj(v) && Array.isArray(v.items)) {
      // Mezat sonuç bildirimleri canlıya çevrilen mezatlarla çelişir.
      const kept = (v.items as Obj[]).filter((n) => !str(n.type).startsWith('auction.closed'));
      v = { ...v, items: kept, total: kept.length };
    }
    return finishRaw(v);
  };
  const finishRaw = (v: Json): MockResult => ({
    status: 200,
    body: liveify(shiftDates(v, delta), now),
  });

  if (path === '/listings') return finish(listListings(data, p).body);
  if (path === '/auctions') return finish(auctionList(data, p.get('status')));

  const found = lookup(data, path, p);
  if (found === undefined) {
    if (path === '/me' || /^\/(orders|notifications|favorites|seller|company|me)/.test(path)) {
      return role === 'visitor'
        ? err(401, 'UNAUTHENTICATED', 'Giriş gerekli.')
        : err(404, 'NOT_FOUND', 'Demo verisinde yok.');
    }
    return err(404, 'NOT_FOUND', 'Demo verisinde yok.');
  }
  return finish(found);
}
