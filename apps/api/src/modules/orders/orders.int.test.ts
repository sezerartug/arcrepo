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

// Real PostgreSQL, real HTTP. Sweepers are off (NODE_ENV=test); tests drive close/expiry directly.
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
  seller = await verifiedCompany(t, 'seller');
  buyer = await verifiedCompany(t, 'buyer');
  other = await verifiedCompany(t, 'other');
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
  payable: (companyId: string) => accountBalance(t.db, { type: 'seller_payable', companyId }),
};

// Fixed-price listing, published directly (catalog moderation has its own tests). Price is kurus per ton.
let n = 0;
async function fixedListing(
  s: Co,
  o: { priceMinor?: bigint; quantityBase?: bigint; minOrderBase?: bigint } = {},
) {
  const row = await t.db
    .insertInto('listings')
    .values({
      company_id: s.companyId,
      category_id: categoryId,
      title: `Sabit fiyat ilani ${String(++n)}`,
      description: 'test',
      attrs: '{}',
      sale_type: 'fixed',
      unit_price_minor: o.priceMinor ?? 2_450_000n,
      quantity_base: o.quantityBase ?? 50_000n,
      min_order_base: o.minOrderBase ?? 1_000n,
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

const buy = (c: Client, listingId: string, quantityBase: string, headers = idem()) =>
  c.post(`/listings/${listingId}/buy`, { quantityBase }, headers);
const orderRow = (id: string) =>
  t.db.selectFrom('orders').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
const confirm = (reference: string, extra: Record<string, unknown> = {}) =>
  admin.post('/admin/payments/confirm', { reference, ...extra });
const journalCount = (reason: string, orderId: string) =>
  t.db
    .selectFrom('ledger_journals')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('reason', '=', reason)
    .where('ref_id', '=', orderId)
    .executeTakeFirstOrThrow()
    .then((r) => Number(r.n));

describe('fixed-price order: buy -> pay -> ship -> deliver', () => {
  it('moves money through escrow and releases it to the seller minus commission', async () => {
    const [escrow0, revenue0, payable0, deposit0] = [
      await bal.escrow(),
      await bal.revenue(),
      await bal.payable(seller.companyId),
      await bal.deposit(),
    ];
    const listingId = await fixedListing(seller);
    const res = await buy(buyer.c, listingId, '10000');
    expect(res.status).toBe(201);
    const o = res.body;
    // 2 450 000 kurus/ton x 10 ton = 24 500 000 kurus; 2 % commission = 490 000.
    expect(o.totalMinor).toBe('24500000');
    expect(o.amountDueMinor).toBe('24500000');
    expect(o.depositAppliedMinor).toBe('0');
    expect(o.status).toBe('awaiting_payment');
    expect(o.paymentReference).toMatch(/^ARC-O-[A-Z2-9]{6}$/);
    expect(o.iban).toBe('TR00 DEMO 0000 0000 0000 0000 00');
    expect(o.commissionMinor).toBeUndefined(); // buyer does not see the seller's commission
    const row = await orderRow(o.id);
    expect(row.commission_minor).toBe(490_000n);
    expect(row.payment_due_at.getTime()).toBeGreaterThan(Date.now() + 47 * 3_600_000);

    const stock = await t.db
      .selectFrom('listings')
      .select('quantity_base')
      .where('id', '=', listingId)
      .executeTakeFirstOrThrow();
    expect(stock.quantity_base).toBe(40_000n);

    // both parties see it, with the right role-specific fields
    const asSeller = await seller.c.get(`/orders/${o.id}`);
    expect(asSeller.status).toBe(200);
    expect(asSeller.body.role).toBe('seller');
    expect(asSeller.body.commissionMinor).toBe('490000');
    expect(asSeller.body.paymentReference).toBeUndefined();
    expect(asSeller.body.history.map((h: { type: string }) => h.type)).toEqual(['order.created']);
    const list = await buyer.c.get('/orders');
    expect(list.body.items.some((i: { id: string }) => i.id === o.id)).toBe(true);

    // not paid yet: shipping is a conflict, nothing moved
    expect((await seller.c.post(`/orders/${o.id}/ship`, {})).status).toBe(409);
    expect(await bal.escrow()).toBe(escrow0);

    // the pending transfer shows up for the admin; confirm twice -> one journal
    const pending = await admin.get('/admin/payments?status=pending');
    expect(
      pending.body.items.some(
        (i: { reference: string; kind: string }) =>
          i.reference === o.paymentReference && i.kind === 'order',
      ),
    ).toBe(true);
    const [c1, c2] = await Promise.all([confirm(o.paymentReference), confirm(o.paymentReference)]);
    expect([c1.status, c2.status]).toEqual([200, 200]);
    expect(c1.body.status).toBe('paid_escrow');
    expect(await journalCount('order.payment', o.id)).toBe(1);
    expect((await confirm(o.paymentReference)).status).toBe(200);
    expect(await journalCount('order.payment', o.id)).toBe(1);
    expect(await bal.escrow()).toBe(escrow0 + 24_500_000n);

    // roles: buyer cannot ship, seller cannot confirm delivery
    expect((await buyer.c.post(`/orders/${o.id}/ship`, {})).status).toBe(403);
    expect((await seller.c.post(`/orders/${o.id}/confirm-delivery`, {})).status).toBe(403);
    expect((await buyer.c.post(`/orders/${o.id}/confirm-delivery`, {})).status).toBe(409); // not shipped
    const shipped = await seller.c.post(`/orders/${o.id}/ship`, { trackingNote: 'TIR 34 ABC 123' });
    expect(shipped.status).toBe(200);
    expect(shipped.body.status).toBe('shipped');
    expect((await seller.c.post(`/orders/${o.id}/ship`, {})).status).toBe(409);

    const done = await buyer.c.post(`/orders/${o.id}/confirm-delivery`, {});
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('completed');
    expect((await buyer.c.post(`/orders/${o.id}/confirm-delivery`, {})).status).toBe(409);

    // I7: escrow back to its start, seller owed total - commission, platform earned the commission
    expect(await bal.escrow()).toBe(escrow0);
    expect(await bal.payable(seller.companyId)).toBe(payable0 + 24_010_000n);
    expect(await bal.revenue()).toBe(revenue0 + 490_000n);
    expect(await bal.deposit()).toBe(deposit0);
    expect(await ledgerTotal(t.db)).toBe(0n);

    const detail = await buyer.c.get(`/orders/${o.id}`);
    expect(detail.body.status).toBe('completed');
    expect(detail.body.history.map((h: { type: string }) => h.type)).toEqual([
      'order.created',
      'order.paid_escrow',
      'order.shipped',
      'order.delivered',
      'order.completed',
    ]);

    // audit trail of the critical steps
    const audit = await admin.get(`/admin/audit?entityType=order&entityId=${o.id}`);
    const actions = audit.body.items.map((a: { action: string }) => a.action);
    for (const a of [
      'order.created',
      'order.payment_confirmed',
      'order.shipped',
      'order.delivered',
    ]) {
      expect(actions).toContain(a);
    }

    // payout view and the fake transfer
    const payouts = await seller.c.get('/seller/payouts');
    expect(payouts.status).toBe(200);
    expect(payouts.body.balanceMinor).toBe((payable0 + 24_010_000n).toString());
    expect(payouts.body.orders.some((p: { orderId: string }) => p.orderId === o.id)).toBe(true);
    const bank0 = await bal.bank();
    const tr = await admin.post(`/admin/payouts/${seller.companyId}/transfer`, {});
    expect(tr.status).toBe(200);
    expect(tr.body.transferredMinor).toBe((payable0 + 24_010_000n).toString());
    expect(await bal.payable(seller.companyId)).toBe(0n);
    expect(await bal.bank()).toBe(bank0 + payable0 + 24_010_000n);
    expect((await admin.post(`/admin/payouts/${seller.companyId}/transfer`, {})).status).toBe(409);
    expect((await buyer.c.post(`/admin/payouts/${seller.companyId}/transfer`, {})).status).toBe(
      403,
    );
    expect(await ledgerTotal(t.db)).toBe(0n);

    const stats = await admin.get('/admin/stats');
    expect(stats.body.orders.completed).toBeGreaterThanOrEqual(1);
    expect(stats.body.orders.escrowBalanceMinor).toBeDefined();
    expect(stats.body.listings).toBeDefined(); // existing shape intact
  });

  it('rejects a payment whose amount differs and keeps the order unpaid', async () => {
    const listingId = await fixedListing(seller);
    const o = (await buy(buyer.c, listingId, '2000')).body;
    const bad = await confirm(o.paymentReference, { amountMinor: '1' });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('PAYMENT_AMOUNT_MISMATCH');
    expect((await orderRow(o.id)).status).toBe('awaiting_payment');
    expect(await journalCount('order.payment', o.id)).toBe(0);
    const ok = await confirm(o.paymentReference, { amountMinor: o.amountDueMinor });
    expect(ok.status).toBe(200);
    expect((await confirm('ARC-O-ZZZZZZ')).status).toBe(404);
  });
});

describe('buy validation and overselling', () => {
  it('enforces minimum order, own listing, idempotency and sold-out', async () => {
    const listingId = await fixedListing(seller, { quantityBase: 5_000n, minOrderBase: 2_000n });
    expect((await buy(buyer.c, listingId, '1000')).status).toBe(422); // below minimum
    expect((await buy(seller.c, listingId, '2000')).status).toBe(403); // own listing
    expect(
      (await t.client().post(`/listings/${listingId}/buy`, { quantityBase: '2000' })).status,
    ).toBe(401);
    expect((await buy(buyer.c, listingId, '0')).status).toBe(422);
    expect((await buy(buyer.c, listingId, '6000')).status).toBe(409); // more than stock

    const key = idem();
    const first = await buy(buyer.c, listingId, '2000', key);
    const replay = await buy(buyer.c, listingId, '2000', key);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(first.body.id);
    expect((await buy(buyer.c, listingId, '3000', key)).status).toBe(422); // same key, other body
    const orderCount = await t.db
      .selectFrom('orders')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('source_listing_id', '=', listingId)
      .executeTakeFirstOrThrow();
    expect(Number(orderCount.n)).toBe(1);

    // the last remainder (3 000 kg) may be bought; then the listing is sold out
    const rest = await buy(other.c, listingId, '3000');
    expect(rest.status).toBe(201);
    const l = await t.db
      .selectFrom('listings')
      .select(['status', 'quantity_base'])
      .where('id', '=', listingId)
      .executeTakeFirstOrThrow();
    expect(l).toEqual({ status: 'sold', quantity_base: 0n });
    expect((await buy(buyer.c, listingId, '1000')).status).toBe(409);
  });

  it('never oversells under parallel purchases', async () => {
    const buyers = await Promise.all(
      Array.from({ length: 12 }, (_, i) => verifiedCompany(t, `p${String(i)}`)),
    );
    const listingId = await fixedListing(seller, { quantityBase: 8_000n, minOrderBase: 1_000n });
    const results = await Promise.all(buyers.map((b) => buy(b.c, listingId, '1000')));
    const ok = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 409);
    expect(ok).toHaveLength(8);
    expect(rejected).toHaveLength(4);
    for (const r of rejected) expect(r.body.error.code).toBe('INSUFFICIENT_STOCK');
    const sold = await t.db
      .selectFrom('orders')
      .select(sql<string>`sum(quantity_base)`.as('q'))
      .where('source_listing_id', '=', listingId)
      .executeTakeFirstOrThrow();
    expect(BigInt(sold.q)).toBe(8_000n);
    const l = await t.db
      .selectFrom('listings')
      .select(['status', 'quantity_base'])
      .where('id', '=', listingId)
      .executeTakeFirstOrThrow();
    expect(l).toEqual({ status: 'sold', quantity_base: 0n });
  });
});

describe('authorization (BOLA)', () => {
  it('hides orders from other companies and anonymous callers', async () => {
    const listingId = await fixedListing(seller);
    const o = (await buy(buyer.c, listingId, '1000')).body;
    expect((await t.client().get('/orders')).status).toBe(401);
    expect((await t.client().get(`/orders/${o.id}`)).status).toBe(401);
    expect((await other.c.get(`/orders/${o.id}`)).status).toBe(404);
    const theirs = await other.c.get('/orders');
    expect(theirs.body.items.some((i: { id: string }) => i.id === o.id)).toBe(false);
    for (const p of ['ship', 'confirm-delivery', 'cancel']) {
      expect((await other.c.post(`/orders/${o.id}/${p}`, {})).status, p).toBe(404);
    }
    expect((await seller.c.post(`/orders/${o.id}/cancel`, {})).status).toBe(403); // seller is not the buyer
    expect((await other.c.get('/orders/not-a-uuid')).status).toBe(404);
    expect(
      (await buyer.c.post('/admin/payments/confirm', { reference: o.paymentReference })).status,
    ).toBe(403);
    expect((await orderRow(o.id)).status).toBe('awaiting_payment');
  });
});

// ---- auction-sourced orders ---------------------------------------------------------------------------
// 10 ton, start 100 000 kurus/ton: start total 1 000 000, deposit 5 % = 50 000.
async function liveAuction() {
  return createAuction(t, {
    sellerCompanyId: seller.companyId,
    categoryId,
    startPriceMinor: 100_000n,
    incrementMinor: 1_000n,
    endsInMs: 3_600_000,
    quantityBase: 10_000n,
    windowSecs: 0,
  });
}
async function expireAuction(auctionId: string) {
  await sql`update auctions set ends_at = clock_timestamp() - interval '1 second' where id = ${auctionId}`.execute(
    t.db,
  );
}
const auctionOrders = (auctionId: string) =>
  t.db.selectFrom('orders').selectAll().where('source_auction_id', '=', auctionId).execute();
const auctionStatus = (id: string) =>
  t.db
    .selectFrom('auctions')
    .select('status')
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
    .then((r) => r.status);
const depositOf = (auctionId: string, companyId: string) =>
  t.db
    .selectFrom('deposits')
    .select('status')
    .where('auction_id', '=', auctionId)
    .where('company_id', '=', companyId)
    .executeTakeFirstOrThrow()
    .then((r) => r.status);

// Winner = `buyer` at 110 000, loser = `other` at 105 000. Returns the closed auction and its order.
async function wonAuction() {
  const auctionId = await liveAuction();
  await joinAuction(admin, buyer, auctionId);
  await joinAuction(admin, other, auctionId);
  expect((await placeBid(other.c, auctionId, 105_000n)).status).toBe(201);
  expect((await placeBid(buyer.c, auctionId, 110_000n)).status).toBe(201);
  await expireAuction(auctionId);
  await closer.closeAuction(auctionId);
  const [order] = await auctionOrders(auctionId);
  return { auctionId, order: order! };
}

describe('auction-sourced order', () => {
  it('creates exactly one order at close, applies the deposit, and settles end to end', async () => {
    const [escrow0, deposit0, revenue0] = [
      await bal.escrow(),
      await bal.deposit(),
      await bal.revenue(),
    ];
    const auctionId = await liveAuction();
    await joinAuction(admin, buyer, auctionId);
    await joinAuction(admin, other, auctionId);
    expect(await bal.deposit()).toBe(deposit0 + 100_000n);
    await placeBid(other.c, auctionId, 105_000n);
    await placeBid(buyer.c, auctionId, 110_000n);
    await expireAuction(auctionId);

    // I6: the closer may run any number of times, also in parallel
    await Promise.all([closer.closeAuction(auctionId), closer.closeAuction(auctionId)]);
    await closer.closeAuction(auctionId);
    await t.client().get(`/auctions/${auctionId}`);
    const found = await auctionOrders(auctionId);
    expect(found).toHaveLength(1);
    const o = found[0]!;
    expect(await auctionStatus(auctionId)).toBe('PAYMENT_PENDING');
    expect(o.buyer_company_id).toBe(buyer.companyId);
    expect(o.seller_company_id).toBe(seller.companyId);
    expect(o.total_minor).toBe(1_100_000n); // 110 000 kurus/ton x 10 ton
    expect(o.deposit_applied_minor).toBe(50_000n);
    expect(o.amount_due_minor).toBe(1_050_000n);
    expect(o.commission_minor).toBe(22_000n);

    // I7/I8: loser refunded, winner's deposit stays held and applied; the order matches the auction result
    expect(await depositOf(auctionId, other.companyId)).toBe('refunded');
    expect(await depositOf(auctionId, buyer.companyId)).toBe('applied');
    expect(await bal.deposit()).toBe(deposit0 + 50_000n);
    const result = await t.db
      .selectFrom('auction_results')
      .select('total_minor')
      .where('auction_id', '=', auctionId)
      .executeTakeFirstOrThrow();
    expect(result.total_minor).toBe(o.total_minor);

    const view = await buyer.c.get(`/orders/${o.id}`);
    expect(view.body.amountDueMinor).toBe('1050000');
    expect(view.body.auctionId).toBe(auctionId);

    expect((await confirm(o.payment_reference, { amountMinor: '1100000' })).status).toBe(422);
    expect((await confirm(o.payment_reference, { amountMinor: '1050000' })).status).toBe(200);
    expect(await journalCount('order.payment', o.id)).toBe(1);
    const escrowIn = await t.db
      .selectFrom('ledger_entries as e')
      .innerJoin('ledger_journals as j', 'j.id', 'e.journal_id')
      .innerJoin('ledger_accounts as a', 'a.id', 'e.account_id')
      .select(sql<string>`sum(e.amount_minor)`.as('s'))
      .where('j.ref_id', '=', o.id)
      .where('j.reason', '=', 'order.payment')
      .where('a.type', '=', 'escrow')
      .executeTakeFirstOrThrow();
    expect(BigInt(escrowIn.s)).toBe(o.total_minor); // I8: ledger equals the order total
    expect(await bal.escrow()).toBe(escrow0 + 1_100_000n);
    expect(await bal.deposit()).toBe(deposit0); // the deposit moved into escrow
    expect(await auctionStatus(auctionId)).toBe('PAYMENT_PENDING');

    expect((await seller.c.post(`/orders/${o.id}/ship`, {})).status).toBe(200);
    expect((await buyer.c.post(`/orders/${o.id}/confirm-delivery`, {})).status).toBe(200);
    expect(await auctionStatus(auctionId)).toBe('SETTLED');
    expect(await bal.escrow()).toBe(escrow0);
    expect(await bal.revenue()).toBe(revenue0 + 22_000n);
    expect(await ledgerTotal(t.db)).toBe(0n);
    expect(await depositOf(auctionId, buyer.companyId)).toBe('applied');
  });

  it('an unpaid auction order fails after the deadline: auction PAYMENT_FAILED, deposit forfeited', async () => {
    const [deposit0, revenue0] = [await bal.deposit(), await bal.revenue()];
    const { auctionId, order } = await wonAuction();
    expect(await orders.sweepExpired()).toBe(0); // not due yet
    expect((await orderRow(order.id)).status).toBe('awaiting_payment');
    await sql`update orders set payment_due_at = clock_timestamp() - interval '1 minute' where id = ${order.id}`.execute(
      t.db,
    );
    expect(await orders.sweepExpired()).toBeGreaterThanOrEqual(1);
    expect((await orderRow(order.id)).status).toBe('payment_failed');
    expect(await auctionStatus(auctionId)).toBe('PAYMENT_FAILED');
    expect(await depositOf(auctionId, buyer.companyId)).toBe('forfeited');
    expect(await bal.deposit()).toBe(deposit0); // loser refunded, winner's deposit forfeited
    expect(await bal.revenue()).toBe(revenue0 + 50_000n);
    expect(await ledgerTotal(t.db)).toBe(0n);
    expect(await orders.sweepExpired()).toBe(0); // idempotent
    expect((await confirm(order.payment_reference)).status).toBe(409); // too late
    const events = await buyer.c.get(`/orders/${order.id}`);
    expect(events.body.status).toBe('payment_failed');
  });

  it('buyer cancellation forfeits the deposit, admin cancellation refunds it', async () => {
    const [deposit0, revenue0, bank0] = [
      await bal.deposit(),
      await bal.revenue(),
      await bal.bank(),
    ];
    const a = await wonAuction();
    expect((await other.c.post(`/orders/${a.order.id}/cancel`, {})).status).toBe(404);
    expect((await buyer.c.post(`/orders/${a.order.id}/cancel`, {})).status).toBe(200);
    expect(await auctionStatus(a.auctionId)).toBe('PAYMENT_FAILED');
    expect(await depositOf(a.auctionId, buyer.companyId)).toBe('forfeited');
    expect(await bal.revenue()).toBe(revenue0 + 50_000n);
    expect((await buyer.c.post(`/orders/${a.order.id}/cancel`, {})).status).toBe(409);

    const b = await wonAuction();
    const cancelled = await admin.post(`/orders/${b.order.id}/cancel`, {
      reason: 'seller request',
    });
    expect(cancelled.status).toBe(200);
    expect(await auctionStatus(b.auctionId)).toBe('PAYMENT_FAILED');
    expect(await depositOf(b.auctionId, buyer.companyId)).toBe('refunded');
    expect(await bal.revenue()).toBe(revenue0 + 50_000n); // unchanged by the refund
    expect(await bal.deposit()).toBe(deposit0);
    // deposits in (-200 000), losers refunded (+100 000), admin refund of the winner (+50 000)
    expect(await bal.bank()).toBe(bank0 - 50_000n);
    expect(await ledgerTotal(t.db)).toBe(0n);
    const audit = await admin.get(`/admin/audit?entityType=order&entityId=${b.order.id}`);
    expect(audit.body.items.map((x: { action: string }) => x.action)).toContain('order.cancelled');
  });

  it('cancelling an unpaid fixed-price order puts the stock back on sale', async () => {
    const listingId = await fixedListing(seller, { quantityBase: 2_000n, minOrderBase: 1_000n });
    const o = (await buy(buyer.c, listingId, '2000')).body;
    const sold = await t.db
      .selectFrom('listings')
      .select('status')
      .where('id', '=', listingId)
      .executeTakeFirstOrThrow();
    expect(sold.status).toBe('sold');
    expect((await buyer.c.post(`/orders/${o.id}/cancel`, {})).status).toBe(200);
    const back = await t.db
      .selectFrom('listings')
      .select(['status', 'quantity_base'])
      .where('id', '=', listingId)
      .executeTakeFirstOrThrow();
    expect(back).toEqual({ status: 'published', quantity_base: 2_000n });
    expect(await ledgerTotal(t.db)).toBe(0n);
  });
});

describe('automatic delivery confirmation', () => {
  it('confirms a shipped order after AUTO_CONFIRM_DAYS through the same ledger path (actor system)', async () => {
    const [escrow0, revenue0, payable0] = [
      await bal.escrow(),
      await bal.revenue(),
      await bal.payable(seller.companyId),
    ];
    const listingId = await fixedListing(seller);
    const o = (await buy(buyer.c, listingId, '10000')).body;
    expect((await confirm(o.paymentReference)).status).toBe(200);
    expect((await seller.c.post(`/orders/${o.id}/ship`, {})).status).toBe(200);

    // shipped just now: not due, and the buyer sees the automatic confirmation date (7 days)
    expect(await orders.sweepAutoConfirm()).toBe(0);
    const shipped = (await buyer.c.get(`/orders/${o.id}`)).body;
    expect(shipped.status).toBe('shipped');
    const due = new Date(shipped.autoConfirmAt).getTime() - new Date(shipped.shippedAt).getTime();
    expect(due).toBe(7 * 86_400_000);

    // 6 days 23 hours ago: still not due
    await sql`update orders set shipped_at = clock_timestamp() - interval '6 days 23 hours' where id = ${o.id}`.execute(
      t.db,
    );
    expect(await orders.sweepAutoConfirm()).toBe(0);
    expect((await orderRow(o.id)).status).toBe('shipped');

    await sql`update orders set shipped_at = clock_timestamp() - interval '7 days 1 minute' where id = ${o.id}`.execute(
      t.db,
    );
    expect(await orders.sweepAutoConfirm()).toBeGreaterThanOrEqual(1);
    expect((await orderRow(o.id)).status).toBe('completed');
    expect(await orders.sweepAutoConfirm()).toBe(0); // idempotent: no second release
    expect(await journalCount('order.release', o.id)).toBe(1);

    expect(await bal.escrow()).toBe(escrow0);
    expect(await bal.payable(seller.companyId)).toBe(payable0 + 24_010_000n);
    expect(await bal.revenue()).toBe(revenue0 + 490_000n);
    expect(await ledgerTotal(t.db)).toBe(0n);
    expect((await buyer.c.post(`/orders/${o.id}/confirm-delivery`, {})).status).toBe(409);

    const audit = await t.db
      .selectFrom('audit_log')
      .select(['actor_type', 'actor_id'])
      .where('entity_id', '=', o.id)
      .where('action', '=', 'order.delivered')
      .execute();
    expect(audit).toEqual([{ actor_type: 'system', actor_id: null }]);
  });

  it('does not touch orders that are not shipped', async () => {
    const listingId = await fixedListing(seller);
    const o = (await buy(buyer.c, listingId, '1000')).body;
    expect((await confirm(o.paymentReference)).status).toBe(200); // paid_escrow, not shipped
    await sql`update orders set created_at = clock_timestamp() - interval '30 days' where id = ${o.id}`.execute(
      t.db,
    );
    await orders.sweepAutoConfirm();
    expect((await orderRow(o.id)).status).toBe('paid_escrow');
  });
});
