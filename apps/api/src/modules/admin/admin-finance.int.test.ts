/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/restrict-template-expressions --
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
import { accountBalance, ledgerTotal } from '../ledger/index.js';

// Real PostgreSQL, real HTTP. Admin finance report on a known scenario (2 % commission, 5 % deposit):
//   A completed 24 500 000 (commission 490 000) · B disputed, partial refund 10 000 000 (commission 290 000)
//   C disputed, full refund 2 450 000 · D shipped, still in escrow 2 450 000 · E unpaid
//   F auction win cancelled by the buyer: deposit 50 000 forfeited.
process.env.BID_RATE_LIMIT = 'off';
process.env.COMMISSION_BPS = '200';

type Co = Awaited<ReturnType<typeof verifiedCompany>>;
let t: TestApp;
let admin: Client;
let seller: Co;
let buyer: Co;
let other: Co;
let categoryId: string;
let orderA: string;

async function fixedListing() {
  const row = await t.db
    .insertInto('listings')
    .values({
      company_id: seller.companyId,
      category_id: categoryId,
      title: 'Mali rapor ilani',
      description: 'test',
      attrs: '{}',
      sale_type: 'fixed',
      unit_price_minor: 2_450_000n,
      quantity_base: 500_000n,
      min_order_base: 1_000n,
      location: 'Gebze',
      delivery_terms: '',
      auction_draft: null,
      status: 'published',
      review_reason: null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}
const pay = (reference: string) => admin.post('/admin/payments/confirm', { reference });
async function order(quantityBase: string, upTo: 'unpaid' | 'paid' | 'shipped') {
  const r = await buyer.c.post(`/listings/${await fixedListing()}/buy`, { quantityBase }, idem());
  expect(r.status).toBe(201);
  if (upTo !== 'unpaid') expect((await pay(r.body.paymentReference)).status).toBe(200);
  if (upTo === 'shipped')
    expect((await seller.c.post(`/orders/${r.body.id}/ship`, {})).status).toBe(200);
  return r.body.id as string;
}
async function disputeAndResolve(id: string, refundMinor: string) {
  const d = await buyer.c.post(
    `/orders/${id}/dispute`,
    { reason: 'Mal siparis edilenden farkli geldi' },
    idem(),
  );
  expect(d.status).toBe(201);
  const r = await admin.post(
    `/admin/disputes/${d.body.id}/resolve`,
    { outcome: 'refund', refundMinor, note: 'Iade karari' },
    idem(),
  );
  expect(r.status).toBe(200);
}

beforeAll(async () => {
  t = await createTestApp();
  admin = await adminClient(t);
  categoryId = (await seedCategory(t.db)).id;
  seller = await verifiedCompany(t, 'frseller');
  buyer = await verifiedCompany(t, 'frbuyer');
  other = await verifiedCompany(t, 'frother');

  orderA = await order('10000', 'shipped');
  expect((await buyer.c.post(`/orders/${orderA}/confirm-delivery`, {})).status).toBe(200);
  await disputeAndResolve(await order('10000', 'shipped'), '10000000');
  await disputeAndResolve(await order('1000', 'shipped'), '2450000');
  await order('1000', 'shipped'); // D
  await order('1000', 'unpaid'); // E

  const auctionId = await createAuction(t, {
    sellerCompanyId: seller.companyId,
    categoryId,
    startPriceMinor: 100_000n,
    incrementMinor: 1_000n,
    endsInMs: 3_600_000,
    quantityBase: 10_000n,
    windowSecs: 0,
  });
  await joinAuction(admin, buyer, auctionId);
  await joinAuction(admin, other, auctionId);
  expect((await placeBid(other.c, auctionId, 105_000n)).status).toBe(201);
  expect((await placeBid(buyer.c, auctionId, 110_000n)).status).toBe(201);
  await sql`update auctions set ends_at = clock_timestamp() - interval '1 second' where id = ${auctionId}`.execute(
    t.db,
  );
  await t.app.get(AuctionCloser).closeAuction(auctionId);
  const won = await t.db
    .selectFrom('orders')
    .select('id')
    .where('source_auction_id', '=', auctionId)
    .executeTakeFirstOrThrow();
  expect((await buyer.c.post(`/orders/${won.id}/cancel`, {})).status).toBe(200);
}, 180_000);
afterAll(() => t.close());

describe('GET /admin/finance/summary', () => {
  it('returns the expected amounts for the known scenario', async () => {
    const r = await admin.get('/admin/finance/summary');
    expect(r.status).toBe(200);
    const b = r.body;
    expect(b.currency).toBe('TRY');
    expect(b.range).toEqual({ from: null, to: null });
    expect(b.commission.amountMinor).toBe('780000');
    expect(b.forfeitedDeposits.amountMinor).toBe('50000');
    expect(b.escrow.amountMinor).toBe('2450000');
    expect(b.pendingPayables.amountMinor).toBe('38220000');
    expect(b.pendingPayables.companies).toEqual([
      expect.objectContaining({ companyId: seller.companyId, amountMinor: '38220000' }),
    ]);
    expect(b.depositHeld.amountMinor).toBe('0');
    expect(b.bankClearing.amountMinor).toBe(
      (await accountBalance(t.db, { type: 'bank_clearing' })).toString(),
    );
    expect(b.completedOrders).toMatchObject({ count: '2', totalMinor: '49000000' });
    expect(b.refunds).toMatchObject({ count: '2', amountMinor: '12450000' });
    expect(b.disputes.count).toBe('2');
    for (const k of [
      'commission',
      'forfeitedDeposits',
      'escrow',
      'pendingPayables',
      'depositHeld',
      'bankClearing',
      'completedOrders',
      'refunds',
      'disputes',
      'consistency',
    ]) {
      expect(typeof b[k].kaynak).toBe('string');
    }
  });

  it('is consistent after normal flows', async () => {
    const { consistency } = (await admin.get('/admin/finance/summary')).body;
    expect(consistency).toMatchObject({
      ok: true,
      ledgerTotalMinor: '0',
      escrowMinor: '2450000',
      openOrdersEscrowMinor: '2450000',
      diffMinor: '0',
    });
    expect(await ledgerTotal(t.db)).toBe(0n);
  });

  it('filters range metrics by UTC date and keeps balances as they are now', async () => {
    const old = (await admin.get('/admin/finance/summary?from=2000-01-01&to=2000-01-31')).body;
    expect(old.range).toEqual({ from: '2000-01-01', to: '2000-01-31' });
    expect(old.commission.amountMinor).toBe('0');
    expect(old.forfeitedDeposits.amountMinor).toBe('0');
    expect(old.completedOrders).toMatchObject({ count: '0', totalMinor: '0' });
    expect(old.refunds).toMatchObject({ count: '0', amountMinor: '0' });
    expect(old.disputes.count).toBe('0');
    expect(old.escrow.amountMinor).toBe('2450000'); // balance, not a range metric
    expect(old.pendingPayables.amountMinor).toBe('38220000');

    const today = (await admin.get('/admin/finance/summary?range=today')).body;
    expect(today.commission.amountMinor).toBe('780000');
    expect(today.completedOrders.count).toBe('2');
    expect(today.range.from).toBe(today.range.to);

    // Order A completed 10 days ago: out of the 7-day window, in "all".
    await sql`update orders set completed_at = clock_timestamp() - interval '10 days' where id = ${orderA}`.execute(
      t.db,
    );
    const week = (await admin.get('/admin/finance/summary?range=7d')).body;
    expect(week.completedOrders).toMatchObject({ count: '1', totalMinor: '24500000' });
    const month = (await admin.get('/admin/finance/summary?range=30d')).body;
    expect(month.completedOrders.count).toBe('2');
    expect((await admin.get('/admin/finance/summary?range=all')).body.completedOrders.count).toBe(
      '2',
    );
  });

  it('rejects bad input and non-admins', async () => {
    for (const q of [
      'from=2026-13-40',
      'from=abc',
      'range=year',
      'from=2026-02-10&to=2026-02-01',
    ]) {
      expect((await admin.get(`/admin/finance/summary?${q}`)).status).toBe(422);
    }
    for (const u of [
      '/admin/finance/summary',
      '/admin/finance/orders.csv',
      '/admin/finance/payouts.csv',
    ]) {
      expect((await t.client().get(u)).status).toBe(401);
      expect((await seller.c.get(u)).status).toBe(403);
      expect((await buyer.c.get(u)).status).toBe(403);
    }
  });
});

describe('CSV exports', () => {
  it('orders.csv has BOM, Turkish headers, decimal comma, neutralised formulas and an audit entry', async () => {
    await t.db
      .updateTable('companies')
      .set({ legal_name: '=1+1 Celik' })
      .where('id', '=', seller.companyId)
      .execute();
    await t.db
      .updateTable('companies')
      .set({ legal_name: '+Alici "X"; Ltd' })
      .where('id', '=', buyer.companyId)
      .execute();
    const before = await auditCount();
    const r = await admin.get('/admin/finance/orders.csv');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/csv');
    expect(r.headers.get('content-disposition')).toContain('attachment');
    const text = r.body as string;
    expect(await hasBom('/admin/finance/orders.csv')).toBe(true);
    const lines = text.trimEnd().split('\r\n');
    expect(lines[0]).toBe(
      'Sipariş no;Tarih (UTC);Alıcı şirket;Satıcı şirket;Toplam (TL);Komisyon (TL);İade (TL);Net satıcı payı (TL);Durum',
    );
    expect(lines).toHaveLength(4); // header + A, B, C
    const a = lines.find((l) => l.startsWith(orderA))!;
    expect(a).toContain(
      `;"'+Alici ""X""; Ltd";'=1+1 Celik;245000,00;4900,00;0,00;240100,00;Tamamlandı`,
    );
    expect(lines.some((l) => l.endsWith(';24500,00;0,00;24500,00;0,00;İade edildi'))).toBe(true);
    expect(lines.some((l) => l.endsWith(';245000,00;2900,00;100000,00;142100,00;Tamamlandı'))).toBe(
      true,
    );

    const ranged = await admin.get('/admin/finance/orders.csv?from=2000-01-01&to=2000-01-02');
    expect((ranged.body as string).trimEnd().split('\r\n')).toHaveLength(1);
    expect(await auditCount()).toBe(before + 3); // orders.csv x2 + the BOM probe
    const entry = await t.db
      .selectFrom('audit_log')
      .select(['actor_id', 'data'])
      .where('action', '=', 'admin.finance.export')
      .orderBy('occurred_at', 'desc')
      .executeTakeFirstOrThrow();
    expect(entry.data).toMatchObject({ kind: 'orders', from: '2000-01-01', rows: 0 });
  });

  it('payouts.csv lists pending seller payables and is audited', async () => {
    const before = await auditCount();
    const r = await admin.get('/admin/finance/payouts.csv');
    expect(r.status).toBe(200);
    const text = r.body as string;
    expect(await hasBom('/admin/finance/payouts.csv')).toBe(true);
    const lines = text.trimEnd().split('\r\n');
    expect(lines[0]).toBe('Şirket no;Şirket;Vergi no;Bekleyen hakediş (TL)');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(`${seller.companyId};'=1+1 Celik;`);
    expect(lines[1]!.endsWith(';382200,00')).toBe(true);
    expect(await auditCount()).toBe(before + 2); // request + BOM probe
  });
});

// fetch().text() drops a UTF-8 BOM, so the BOM is checked on the raw bytes.
async function hasBom(path: string) {
  const base = (await t.app.getUrl()).replace('[::1]', '127.0.0.1');
  const res = await fetch(`${base}${path}`, {
    headers: { cookie: admin.cookie },
  });
  const b = new Uint8Array(await res.arrayBuffer());
  return b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;
}

async function auditCount() {
  const r = await t.db
    .selectFrom('audit_log')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('action', '=', 'admin.finance.export')
    .executeTakeFirstOrThrow();
  return Number(r.n);
}
