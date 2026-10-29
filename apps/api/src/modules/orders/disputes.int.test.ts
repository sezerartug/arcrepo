/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call,@typescript-eslint/restrict-template-expressions --
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
import { OrdersService } from './index.js';

// Real PostgreSQL, real HTTP. Disputes: buyer objection while shipped -> admin refund / reject.
process.env.BID_RATE_LIMIT = 'off';
process.env.COMMISSION_BPS = '200';

type Co = Awaited<ReturnType<typeof verifiedCompany>>;
let t: TestApp;
let admin: Client;
let categoryId: string;
let seller: Co;
let buyer: Co;
let other: Co;
let closer: AuctionCloser;
let orders: OrdersService;

beforeAll(async () => {
  t = await createTestApp();
  admin = await adminClient(t);
  categoryId = (await seedCategory(t.db)).id;
  seller = await verifiedCompany(t, 'dseller');
  buyer = await verifiedCompany(t, 'dbuyer');
  other = await verifiedCompany(t, 'dother');
  closer = t.app.get(AuctionCloser);
  orders = t.app.get(OrdersService);
}, 120_000);
afterAll(async () => {
  await t.close();
});

const bal = {
  escrow: () => accountBalance(t.db, { type: 'escrow' }),
  deposit: () => accountBalance(t.db, { type: 'deposit_held' }),
  revenue: () => accountBalance(t.db, { type: 'platform_revenue' }),
  bank: () => accountBalance(t.db, { type: 'bank_clearing' }),
  payable: () => accountBalance(t.db, { type: 'seller_payable', companyId: seller.companyId }),
};
const snapshot = async () => ({
  escrow: await bal.escrow(),
  deposit: await bal.deposit(),
  revenue: await bal.revenue(),
  bank: await bal.bank(),
  payable: await bal.payable(),
});

let n = 0;
async function fixedListing() {
  const row = await t.db
    .insertInto('listings')
    .values({
      company_id: seller.companyId,
      category_id: categoryId,
      title: `Itiraz ilani ${String(++n)}`,
      description: 'test',
      attrs: '{}',
      sale_type: 'fixed',
      unit_price_minor: 2_450_000n,
      quantity_base: 50_000n,
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
const orderRow = (id: string) =>
  t.db.selectFrom('orders').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
const pay = (reference: string) => admin.post('/admin/payments/confirm', { reference });
const dispute = (
  c: Client,
  orderId: string,
  reason = 'Mal siparis edilenden farkli geldi',
  h = idem(),
) => c.post(`/orders/${orderId}/dispute`, { reason }, h);
const resolve = (disputeId: string, body: Record<string, unknown>, h = idem()) =>
  admin.post(`/admin/disputes/${disputeId}/resolve`, body, h);
const journalCount = (reason: string, orderId: string) =>
  t.db
    .selectFrom('ledger_journals')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('reason', '=', reason)
    .where('ref_id', '=', orderId)
    .executeTakeFirstOrThrow()
    .then((r) => Number(r.n));
// Net effect of all of an order's journals on one account type (I8: ledger == order).
async function orderLedger(orderId: string, type: string) {
  const r = await t.db
    .selectFrom('ledger_entries as e')
    .innerJoin('ledger_journals as j', 'j.id', 'e.journal_id')
    .innerJoin('ledger_accounts as a', 'a.id', 'e.account_id')
    .select(sql<string>`coalesce(sum(e.amount_minor), 0)`.as('s'))
    .where('j.ref_id', '=', orderId)
    .where('a.type', '=', type as 'escrow')
    .executeTakeFirstOrThrow();
  return BigInt(r.s);
}

// 24 500 000 kurus total (2 450 000 x 10 ton), 2 % commission = 490 000. Shipped, escrow funded.
async function shippedOrder() {
  const buyRes = await buyer.c.post(
    `/listings/${await fixedListing()}/buy`,
    { quantityBase: '10000' },
    idem(),
  );
  expect(buyRes.status).toBe(201);
  const o = buyRes.body;
  expect((await pay(o.paymentReference)).status).toBe(200);
  expect((await seller.c.post(`/orders/${o.id}/ship`, {})).status).toBe(200);
  return o.id as string;
}
async function disputedOrder() {
  const id = await shippedOrder();
  const d = await dispute(buyer.c, id);
  expect(d.status).toBe(201);
  return { id, disputeId: d.body.id as string };
}

describe('opening a dispute', () => {
  it('is allowed only for the buyer while shipped, and is idempotent', async () => {
    const buyRes = await buyer.c.post(
      `/listings/${await fixedListing()}/buy`,
      { quantityBase: '1000' },
      idem(),
    );
    const o = buyRes.body;
    // awaiting_payment and paid_escrow: no dispute yet
    expect((await dispute(buyer.c, o.id)).status).toBe(409);
    expect((await pay(o.paymentReference)).status).toBe(200);
    expect((await dispute(buyer.c, o.id)).status).toBe(409);
    expect((await seller.c.post(`/orders/${o.id}/ship`, {})).status).toBe(200);

    expect((await dispute(seller.c, o.id)).status).toBe(403); // seller
    expect((await dispute(other.c, o.id)).status).toBe(404); // unrelated company
    expect((await dispute(admin, o.id)).status).toBeGreaterThanOrEqual(400); // admin has no company
    expect((await dispute(t.client(), o.id)).status).toBe(401);
    expect((await dispute(buyer.c, o.id, 'kisa')).status).toBe(422);
    expect(
      (await buyer.c.post(`/orders/${o.id}/dispute`, { reason: 'yeterince uzun neden' })).status,
    ).toBe(400); // Idempotency-Key required
    expect((await orderRow(o.id)).status).toBe('shipped');

    const key = idem();
    const first = await dispute(buyer.c, o.id, 'Urun hasarli teslim edildi', key);
    expect(first.status).toBe(201);
    const replay = await dispute(buyer.c, o.id, 'Urun hasarli teslim edildi', key);
    expect(replay.body.id).toBe(first.body.id);
    expect((await dispute(buyer.c, o.id, 'Baska bir neden yazdim', idem())).status).toBe(409);
    const count = await t.db
      .selectFrom('order_disputes')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('order_id', '=', o.id)
      .executeTakeFirstOrThrow();
    expect(Number(count.n)).toBe(1);

    expect((await orderRow(o.id)).status).toBe('disputed');
    for (const who of [buyer, seller]) {
      const view = (await who.c.get(`/orders/${o.id}`)).body;
      expect(view.status).toBe('disputed');
      expect(view.dispute).toMatchObject({ status: 'open', resolution: null });
      expect(view.history.map((h: { type: string }) => h.type)).toContain('order.disputed');
    }
    const audit = await t.db
      .selectFrom('audit_log')
      .select(['actor_id', 'data'])
      .where('entity_id', '=', o.id)
      .where('action', '=', 'order.dispute.opened')
      .execute();
    expect(audit).toHaveLength(1);
    expect(audit[0]!.actor_id).toBe(buyer.userId);
  });

  it('stops delivery confirmation and the automatic confirmation', async () => {
    const { id } = await disputedOrder();
    const before = await snapshot();
    expect((await buyer.c.post(`/orders/${id}/confirm-delivery`, {})).status).toBe(409);
    expect((await seller.c.post(`/orders/${id}/ship`, {})).status).toBe(409);
    await sql`update orders set shipped_at = clock_timestamp() - interval '30 days' where id = ${id}`.execute(
      t.db,
    );
    await orders.sweepAutoConfirm();
    expect((await orderRow(id)).status).toBe('disputed');
    expect(await snapshot()).toEqual(before); // payout stays frozen
    expect(await journalCount('order.release', id)).toBe(0);
  });
});

describe('resolving: partial refund', () => {
  it('returns the refund, takes commission on the kept amount, empties escrow', async () => {
    const { id, disputeId } = await disputedOrder();
    const before = await snapshot();
    const res = await resolve(disputeId, {
      outcome: 'refund',
      refundMinor: '10000000',
      note: 'Kismi iade kararlastirildi',
    });
    expect(res.status).toBe(200);
    // kept 14 500 000, commission 2 % = 290 000, seller 14 210 000
    expect(res.body).toMatchObject({
      orderStatus: 'completed',
      refundMinor: '10000000',
      commissionMinor: '290000',
      sellerPayoutMinor: '14210000',
    });
    const o = await orderRow(id);
    expect(o.status).toBe('completed');
    expect(o.refund_minor).toBe(10_000_000n);
    expect(o.commission_minor).toBe(290_000n);
    expect(await bal.escrow()).toBe(before.escrow - 24_500_000n);
    expect(await bal.bank()).toBe(before.bank + 10_000_000n);
    expect(await bal.payable()).toBe(before.payable + 14_210_000n);
    expect(await bal.revenue()).toBe(before.revenue + 290_000n);
    expect(await orderLedger(id, 'escrow')).toBe(0n); // I8: paid in == paid out
    expect(await ledgerTotal(t.db)).toBe(0n); // I7
    expect(await journalCount('order.dispute_resolution', id)).toBe(1);

    const view = (await seller.c.get(`/orders/${id}`)).body;
    expect(view.dispute).toMatchObject({
      status: 'resolved',
      resolution: 'refund',
      refundMinor: '10000000',
    });
    expect(view.netPayoutMinor).toBe('14210000');
    const payouts = (await seller.c.get('/seller/payouts')).body;
    expect(payouts.orders.find((x: { orderId: string }) => x.orderId === id).netMinor).toBe(
      '14210000',
    );

    const audit = await t.db
      .selectFrom('audit_log')
      .select(['actor_id', 'data', 'reason'])
      .where('entity_id', '=', id)
      .where('action', '=', 'admin.dispute.resolved')
      .execute();
    expect(audit).toHaveLength(1);
    expect(audit[0]!.actor_id).not.toBeNull();
    expect(audit[0]!.data).toMatchObject({ outcome: 'refund', refundMinor: '10000000' });
    // after resolution nothing more can be confirmed or disputed
    expect((await buyer.c.post(`/orders/${id}/confirm-delivery`, {})).status).toBe(409);
    expect((await dispute(buyer.c, id)).status).toBe(409);
  });
});

describe('resolving: full refund', () => {
  it('fixed price: whole amount back to the buyer, nothing to seller or platform', async () => {
    const { id, disputeId } = await disputedOrder();
    const before = await snapshot();
    const res = await resolve(disputeId, {
      outcome: 'refund',
      refundMinor: '24500000',
      note: 'Tam iade',
    });
    expect(res.status).toBe(200);
    expect(res.body.orderStatus).toBe('refunded');
    const o = await orderRow(id);
    expect([o.status, o.refund_minor, o.commission_minor]).toEqual(['refunded', 24_500_000n, 0n]);
    expect(await bal.escrow()).toBe(before.escrow - 24_500_000n);
    expect(await bal.bank()).toBe(before.bank + 24_500_000n);
    expect(await bal.payable()).toBe(before.payable);
    expect(await bal.revenue()).toBe(before.revenue);
    expect(await orderLedger(id, 'escrow')).toBe(0n);
    expect(await ledgerTotal(t.db)).toBe(0n);
    // terminal: no way out
    expect((await buyer.c.post(`/orders/${id}/confirm-delivery`, {})).status).toBe(409);
  });

  it('auction order: deposit goes back with the payment, auction still SETTLED', async () => {
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
    await placeBid(buyer.c, auctionId, 110_000n);
    await sql`update auctions set ends_at = clock_timestamp() - interval '1 second' where id = ${auctionId}`.execute(
      t.db,
    );
    await closer.closeAuction(auctionId);
    const o = await t.db
      .selectFrom('orders')
      .selectAll()
      .where('source_auction_id', '=', auctionId)
      .executeTakeFirstOrThrow();
    // total 1 100 000, deposit 50 000 applied, 1 050 000 paid by transfer
    expect([o.total_minor, o.deposit_applied_minor]).toEqual([1_100_000n, 50_000n]);
    expect((await pay(o.payment_reference)).status).toBe(200);
    expect((await seller.c.post(`/orders/${o.id}/ship`, {})).status).toBe(200);
    const d = await dispute(buyer.c, o.id);
    expect(d.status).toBe(201);

    const before = await snapshot();
    const res = await resolve(d.body.id, {
      outcome: 'refund',
      refundMinor: '1100000',
      note: 'Tam iade',
    });
    expect(res.status).toBe(200);
    expect(res.body.orderStatus).toBe('refunded');
    expect(await bal.bank()).toBe(before.bank + 1_100_000n); // paid 1 050 000 + deposit 50 000
    expect(await bal.escrow()).toBe(before.escrow - 1_100_000n);
    expect(await bal.payable()).toBe(before.payable);
    expect(await bal.revenue()).toBe(before.revenue);
    expect(await orderLedger(o.id, 'escrow')).toBe(0n);
    expect(await ledgerTotal(t.db)).toBe(0n);
    const dep = await t.db
      .selectFrom('deposits')
      .select('status')
      .where('auction_id', '=', auctionId)
      .where('company_id', '=', buyer.companyId)
      .executeTakeFirstOrThrow();
    expect(dep.status).toBe('refunded');
    const a = await t.db
      .selectFrom('auctions')
      .select('status')
      .where('id', '=', auctionId)
      .executeTakeFirstOrThrow();
    expect(a.status).toBe('SETTLED');
  });
});

describe('resolving: reject', () => {
  it('releases the payout as in the normal flow', async () => {
    const { id, disputeId } = await disputedOrder();
    const before = await snapshot();
    const res = await resolve(disputeId, { outcome: 'reject', note: 'Itiraz haksiz bulundu' });
    expect(res.status).toBe(200);
    expect(res.body.orderStatus).toBe('completed');
    const o = await orderRow(id);
    expect([o.status, o.refund_minor, o.commission_minor]).toEqual(['completed', 0n, 490_000n]);
    expect(await bal.payable()).toBe(before.payable + 24_010_000n);
    expect(await bal.revenue()).toBe(before.revenue + 490_000n);
    expect(await bal.bank()).toBe(before.bank);
    expect(await bal.escrow()).toBe(before.escrow - 24_500_000n);
    expect(await orderLedger(id, 'escrow')).toBe(0n);
    expect(await ledgerTotal(t.db)).toBe(0n);
    const view = (await buyer.c.get(`/orders/${id}`)).body;
    expect(view.dispute).toMatchObject({ status: 'resolved', resolution: 'rejected' });
    expect(view.dispute.resolutionNote).toBe('Itiraz haksiz bulundu');
  });
});

describe('resolve safety', () => {
  it('rejects invalid input without side effects', async () => {
    const { id, disputeId } = await disputedOrder();
    const before = await snapshot();
    const bad = (body: Record<string, unknown>) => resolve(disputeId, body);
    expect((await bad({ outcome: 'refund', refundMinor: '0', note: 'not' })).status).toBe(422);
    expect((await bad({ outcome: 'refund', refundMinor: '-5', note: 'not' })).status).toBe(422);
    expect((await bad({ outcome: 'refund', refundMinor: '1.5', note: 'not' })).status).toBe(422);
    expect((await bad({ outcome: 'refund', note: 'not' })).status).toBe(422);
    const over = await bad({ outcome: 'refund', refundMinor: '24500001', note: 'not' });
    expect(over.status).toBe(422);
    expect(over.body.error?.code ?? over.body.code).toBe('REFUND_EXCEEDS_TOTAL');
    expect((await bad({ outcome: 'refund', refundMinor: '100' })).status).toBe(422); // note required
    expect((await bad({ outcome: 'refund', refundMinor: '100', note: '  ' })).status).toBe(422);
    expect((await bad({ outcome: 'reject', refundMinor: '100', note: 'not' })).status).toBe(422);
    expect((await bad({ outcome: 'maybe', note: 'not' })).status).toBe(422);
    expect(
      (await admin.post(`/admin/disputes/${disputeId}/resolve`, { outcome: 'reject', note: 'abc' }))
        .status,
    ).toBe(400);
    expect(
      (
        await buyer.c.post(
          `/admin/disputes/${disputeId}/resolve`,
          { outcome: 'reject', note: 'abc' },
          idem(),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await seller.c.post(
          `/admin/disputes/${disputeId}/resolve`,
          { outcome: 'reject', note: 'abc' },
          idem(),
        )
      ).status,
    ).toBe(403);
    expect(
      (await resolve('00000000-0000-4000-8000-000000000000', { outcome: 'reject', note: 'abc' }))
        .status,
    ).toBe(404);
    expect((await orderRow(id)).status).toBe('disputed');
    expect(await snapshot()).toEqual(before);
    expect(await journalCount('order.dispute_resolution', id)).toBe(0);
    // a minimal 1 kurus refund is valid
    const ok = await resolve(disputeId, {
      outcome: 'refund',
      refundMinor: '1',
      note: 'Sembolik iade',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.commissionMinor).toBe('490000'); // 2 % of 24 499 999 = 489 999.98 -> half up
    expect(await ledgerTotal(t.db)).toBe(0n);
  });

  it('a second resolve has no effect (same key replays, new key conflicts)', async () => {
    const { id, disputeId } = await disputedOrder();
    const key = idem();
    const body = { outcome: 'refund', refundMinor: '5000000', note: 'Kismi iade' };
    const first = await resolve(disputeId, body, key);
    const after = await snapshot();
    expect(first.status).toBe(200);
    expect((await resolve(disputeId, body, key)).body).toEqual(first.body);
    expect((await resolve(disputeId, body, idem())).status).toBe(409);
    expect((await resolve(disputeId, { outcome: 'reject', note: 'abc' }, idem())).status).toBe(409);
    expect(await snapshot()).toEqual(after);
    expect(await journalCount('order.dispute_resolution', id)).toBe(1);
  });

  it('parallel resolves produce exactly one effect', async () => {
    const { id, disputeId } = await disputedOrder();
    const before = await snapshot();
    const results = await Promise.all([
      resolve(disputeId, { outcome: 'refund', refundMinor: '24500000', note: 'Tam iade bir' }),
      resolve(disputeId, { outcome: 'reject', note: 'Reddet iki' }),
      resolve(disputeId, { outcome: 'refund', refundMinor: '1000', note: 'Kismi uc' }),
      resolve(disputeId, { outcome: 'refund', refundMinor: '24500000', note: 'Tam iade dort' }),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409]);
    expect(await journalCount('order.dispute_resolution', id)).toBe(1);
    expect(await orderLedger(id, 'escrow')).toBe(0n);
    expect(await bal.escrow()).toBe(before.escrow - 24_500_000n);
    expect(await ledgerTotal(t.db)).toBe(0n);
    const audit = await t.db
      .selectFrom('audit_log')
      .select('id')
      .where('entity_id', '=', id)
      .where('action', '=', 'admin.dispute.resolved')
      .execute();
    expect(audit).toHaveLength(1);
  });
});

describe('admin lists', () => {
  it('lists disputes and orders for admins only, with filters', async () => {
    const { id, disputeId } = await disputedOrder();
    const open = await admin.get('/admin/disputes?status=open');
    expect(open.status).toBe(200);
    const row = open.body.items.find((i: { id: string }) => i.id === disputeId);
    expect(row).toMatchObject({
      orderId: id,
      status: 'open',
      totalMinor: '24500000',
      orderStatus: 'disputed',
    });
    expect(row.buyerName).toBeTruthy();
    expect(row.sellerName).toBeTruthy();
    expect((await admin.get('/admin/disputes?status=zzz')).status).toBe(422);
    expect((await buyer.c.get('/admin/disputes')).status).toBe(403);
    expect((await t.client().get('/admin/disputes')).status).toBe(401);
    expect((await buyer.c.get('/admin/orders')).status).toBe(403);

    const list = await admin.get('/admin/orders?status=disputed&q=Itiraz&page=1');
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThanOrEqual(1);
    const item = list.body.items.find((i: { id: string }) => i.id === id);
    expect(item).toMatchObject({ status: 'disputed', totalMinor: '24500000' });
    expect(list.body.items.every((i: { status: string }) => i.status === 'disputed')).toBe(true);
    expect((await admin.get('/admin/orders?status=nope')).status).toBe(422);
    await resolve(disputeId, { outcome: 'reject', note: 'Temizlik' });
    const resolved = await admin.get('/admin/disputes?status=resolved');
    expect(resolved.body.items.some((i: { id: string }) => i.id === disputeId)).toBe(true);
  });
});
