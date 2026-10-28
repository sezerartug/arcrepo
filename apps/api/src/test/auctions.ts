/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment --
   HTTP test bodies are untyped JSON. */
import { sql } from 'kysely';
import { createAuctionFromListing } from '../modules/auctions/index.js';
import { idem, makeAdmin, registerCompany, type Client, type TestApp } from './app.js';

// Test fixtures for the auction slice. Auctions are created through the production code path
// (createAuctionFromListing) so tests exercise the same rows the admin approval creates.

export async function verifiedCompany(t: TestApp, tag: string) {
  const c = t.client();
  const reg = await registerCompany(c, tag);
  await t.db
    .updateTable('companies')
    .set({ status: 'verified' })
    .where('id', '=', reg.company.id)
    .execute();
  return { c, companyId: reg.company.id, userId: reg.user.id };
}

export async function adminClient(t: TestApp): Promise<Client> {
  const email = await makeAdmin(t.db);
  const c = t.client();
  const r = await c.post('/auth/login', { email, password: 'Admin!2345' });
  if (r.status !== 200) throw new Error(`admin login failed: ${JSON.stringify(r.body)}`);
  return c;
}

export interface AuctionOptions {
  sellerCompanyId: string;
  categoryId: string;
  startPriceMinor?: bigint;
  incrementMinor?: bigint;
  reserveMinor?: bigint;
  startsInMs?: number; // negative = already started
  endsInMs: number;
  quantityBase?: bigint;
  windowSecs?: number;
  maxExtensions?: number;
}

let n = 0;
export async function createAuction(t: TestApp, o: AuctionOptions): Promise<string> {
  const now = Date.now();
  const startPrice = o.startPriceMinor ?? 100_000n;
  const draft: Record<string, string> = {
    startPriceMinor: startPrice.toString(),
    minIncrementMinor: (o.incrementMinor ?? 1000n).toString(),
    startsAt: new Date(now + (o.startsInMs ?? -3_600_000)).toISOString(),
    endsAt: new Date(now + o.endsInMs).toISOString(),
    ...(o.reserveMinor ? { reserveMinor: o.reserveMinor.toString() } : {}),
  };
  const quantity = o.quantityBase ?? 10_000n;
  const listing = await t.db
    .insertInto('listings')
    .values({
      company_id: o.sellerCompanyId,
      category_id: o.categoryId,
      title: `Mezat ilani ${String(++n)}`,
      description: 'test',
      attrs: '{}',
      sale_type: 'auction',
      unit_price_minor: startPrice,
      quantity_base: quantity,
      min_order_base: 1n,
      location: 'Gebze',
      delivery_terms: '',
      auction_draft: JSON.stringify(draft),
      status: 'published',
      review_reason: null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const { id } = await createAuctionFromListing(t.db, {
    listingId: listing.id,
    companyId: o.sellerCompanyId,
    quantityBase: quantity,
    basePerUnit: 1000,
    draft,
  });
  if (o.windowSecs !== undefined || o.maxExtensions !== undefined) {
    await sql`
      update auctions set extension_window_secs = ${o.windowSecs ?? 60}, max_extensions = ${o.maxExtensions ?? 10}
      where id = ${id}
    `.execute(t.db);
  }
  return id;
}

// Deposit request + (fake) bank confirmation by the admin.
export async function joinAuction(admin: Client, bidder: { c: Client }, auctionId: string) {
  const dep = await bidder.c.post(`/auctions/${auctionId}/deposit`, {}, idem());
  if (dep.status !== 201) throw new Error(`deposit failed: ${JSON.stringify(dep.body)}`);
  const ok = await admin.post('/admin/payments/confirm', { reference: dep.body.reference });
  if (ok.status !== 200) throw new Error(`confirm failed: ${JSON.stringify(ok.body)}`);
  return dep.body as { reference: string; amountMinor: string };
}

export const placeBid = (
  c: Client,
  auctionId: string,
  amount: bigint,
  headers: Record<string, string> = idem(),
) => c.post(`/auctions/${auctionId}/bids`, { amountMinor: amount.toString() }, headers);
