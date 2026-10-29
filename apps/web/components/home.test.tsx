import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { computeSellerSummary, quickSearchTags, resolveTab } from '@/lib/home';
import type { AuctionSummary, Listing, Order } from '@/lib/types';
import { AuctionCard } from './auction-card';
import { HomeSearch } from './home-search';
import { HomeTabs } from './home-tabs';
import { ListingCard } from './listing-card';
import { SellerSummaryCards } from './seller-summary';
import { TRUST_ITEMS, TrustCenter } from './trust-center';

const tree = [
  { id: 'k1', name: 'Hurda ve Geri Dönüşüm', slug: 'hurda', unit: 'ton', basePerUnit: 1 },
  {
    id: 'k2',
    name: 'İnşaat Malzemeleri',
    slug: 'insaat',
    unit: 'ton',
    basePerUnit: 1,
    children: [{ id: 'k3', name: 'Çelik', slug: 'celik', unit: 'ton', basePerUnit: 1 }],
  },
];

const listing = (over: Partial<Listing> = {}): Listing => ({
  id: 'l1',
  title: 'Demir',
  saleType: 'fixed',
  unitPriceMinor: '100',
  quantityBase: 1,
  status: 'published',
  ...over,
});

describe('HomeSearch', () => {
  const html = renderToStaticMarkup(<HomeSearch categories={tree} />);
  it('submits GET to /ilanlar with a labelled q field', () => {
    expect(html).toContain('action="/ilanlar"');
    expect(html).toContain('method="get"');
    expect(html).toContain('name="q"');
    expect(html).toMatch(/<label for="home-q"/);
  });
  it('resolves category ids by name and falls back to q', () => {
    const tags = quickSearchTags(tree);
    expect(tags).toHaveLength(6);
    expect(tags.find((t) => t.label === 'Çelik')?.href).toBe('/ilanlar?categoryId=k3');
    expect(tags.find((t) => t.label === 'Hurda')?.href).toBe('/ilanlar?categoryId=k1');
    expect(tags.find((t) => t.label === 'CNC')?.href).toBe('/ilanlar?q=CNC');
    expect(tags.find((t) => t.label === 'Hırdavat')?.href).toContain('?q=');
  });
});

describe('HomeTabs', () => {
  it('marks only the active tab with aria-current', () => {
    const html = renderToStaticMarkup(<HomeTabs active="mezat" />);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/\?sekme=mezat#featured"/);
  });
  it('maps unknown tab keys to Tümü and tabs to listing queries', () => {
    expect(resolveTab('nope').key).toBe('tumu');
    expect(resolveTab('mezat').query).toBe('&saleType=auction');
    expect(resolveTab('ikinci-el').query).toBe('&condition=ikinci_el');
  });
});

describe('TrustCenter', () => {
  it('renders five cards', () => {
    const html = renderToStaticMarkup(<TrustCenter />);
    expect(TRUST_ITEMS).toHaveLength(5);
    expect(html.match(/<li /g)).toHaveLength(5);
  });
});

describe('badges', () => {
  it('shows the verified-company badge only on published listings', () => {
    expect(renderToStaticMarkup(<ListingCard listing={listing()} />)).toContain(
      'Doğrulanmış şirket',
    );
    expect(
      renderToStaticMarkup(<ListingCard listing={listing({ status: 'draft' })} />),
    ).not.toContain('Doğrulanmış şirket');
  });
  it('shows %5 teminatlı and the live indicator only for auctions', () => {
    const fixed = renderToStaticMarkup(<ListingCard listing={listing()} />);
    expect(fixed).not.toContain('teminatlı');
    expect(fixed).not.toContain('Kalan süre');
    const auction = renderToStaticMarkup(
      <ListingCard
        listing={listing({
          saleType: 'auction',
          auction: { startPriceMinor: '1', startsAt: '2026-01-01', endsAt: '2099-01-01' },
        })}
      />,
    );
    expect(auction).toContain('%5 teminatlı');
    expect(auction).toContain('Kalan süre');
    expect(auction).toContain('motion-safe:animate-ping');
  });
  it('auction card: live gets dot + Kalan süre, non-live does not', () => {
    const a: AuctionSummary = {
      id: 'a1',
      status: 'LIVE',
      startPriceMinor: '1',
      currentPriceMinor: null,
      endsAt: '2099-01-01',
    };
    const live = renderToStaticMarkup(<AuctionCard auction={a} />);
    expect(live).toContain('Kalan süre');
    expect(live).toContain('%5 teminatlı');
    const done = renderToStaticMarkup(<AuctionCard auction={{ ...a, status: 'CLOSED' }} />);
    expect(done).not.toContain('Kalan süre');
    expect(done).not.toContain('animate-ping');
  });
});

describe('computeSellerSummary', () => {
  const order = (status: string, seller: string): Order => ({
    id: status + seller,
    status,
    buyerCompanyId: 'b',
    sellerCompanyId: seller,
    unitPriceMinor: '1',
    quantityBase: 1,
    totalMinor: '1',
  });
  const auction = (listingId: string): AuctionSummary => ({
    id: 'a' + listingId,
    listingId,
    status: 'LIVE',
    startPriceMinor: '1',
    currentPriceMinor: null,
    endsAt: '2099-01-01',
  });
  it('counts open listings, own live auctions and pending orders', () => {
    const s = computeSellerSummary({
      listings: [listing({ id: 'l1' }), listing({ id: 'l2', status: 'removed' })],
      liveAuctions: [auction('l1'), auction('zzz')],
      orders: [
        order('awaiting_payment', 'me'),
        order('paid_escrow', 'me'),
        order('shipped', 'me'),
        order('paid_escrow', 'other'),
      ],
      payoutBalanceMinor: '12345',
      companyId: 'me',
    });
    expect(s).toEqual({
      openListings: 1,
      liveAuctions: 1,
      pendingOrders: 2,
      pendingPayoutMinor: '12345',
    });
  });
  it('returns null for failed sources and renders an em dash', () => {
    const s = computeSellerSummary({
      listings: null,
      liveAuctions: null,
      orders: null,
      payoutBalanceMinor: null,
      companyId: 'me',
    });
    expect(Object.values(s).every((v) => v === null)).toBe(true);
    const html = renderToStaticMarkup(<SellerSummaryCards summary={s} />);
    expect(html.match(/—/g)).toHaveLength(4);
    expect(html).toContain('href="/siparisler"');
  });
});
