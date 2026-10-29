import { flattenAll, type AuctionSummary, type Category, type Listing, type Order } from './types';

export type HomeTab = { key: string; label: string; query: string };

/** Featured-listings tabs: URL `?sekme=` value, label and the GET /listings query it maps to. */
export const HOME_TABS: HomeTab[] = [
  { key: 'tumu', label: 'Tümü', query: '' },
  { key: 'sabit', label: 'Sabit fiyat', query: '&saleType=fixed' },
  { key: 'mezat', label: 'Mezat', query: '&saleType=auction' },
  { key: 'ikinci-el', label: 'İkinci el', query: '&condition=ikinci_el' },
];

export function resolveTab(sekme: string | undefined): HomeTab {
  return HOME_TABS.find((t) => t.key === sekme) ?? { key: 'tumu', label: 'Tümü', query: '' };
}

export function tabHref(t: HomeTab): string {
  return t.key === 'tumu' ? '/#featured' : `/?sekme=${t.key}#featured`;
}

type QuickTag = { label: string; categoryName?: string; q?: string; href?: string };

const QUICK_TAGS: QuickTag[] = [
  { label: 'Çelik', categoryName: 'Çelik', q: 'çelik' },
  { label: 'CNC', q: 'CNC' },
  { label: 'İş makinesi', categoryName: 'İş Makineleri', q: 'iş makinesi' },
  { label: 'Hırdavat', categoryName: 'El Aletleri ve Hırdavat', q: 'hırdavat' },
  { label: 'Hurda', categoryName: 'Hurda ve Geri Dönüşüm', q: 'hurda' },
  { label: 'İkinci el', href: '/ilanlar?condition=ikinci_el' },
];

/** Quick search tags; resolves category ids by name, falls back to a text query. */
export function quickSearchTags(tree: Category[]): { label: string; href: string }[] {
  const all = flattenAll(tree);
  return QUICK_TAGS.map((t) => {
    if (t.href) return { label: t.label, href: t.href };
    const cat = t.categoryName ? all.find((c) => c.name === t.categoryName) : undefined;
    return {
      label: t.label,
      href: cat
        ? `/ilanlar?categoryId=${encodeURIComponent(cat.id)}`
        : `/ilanlar?q=${encodeURIComponent(t.q ?? t.label)}`,
    };
  });
}

export type SellerSummary = {
  openListings: number | null;
  liveAuctions: number | null;
  pendingOrders: number | null;
  pendingPayoutMinor: string | null;
};

/** Seller dashboard figures; a failed source (null) yields null so the card shows "—". */
export function computeSellerSummary(src: {
  listings: Listing[] | null;
  liveAuctions: AuctionSummary[] | null;
  orders: Order[] | null;
  payoutBalanceMinor: string | null;
  companyId: string;
}): SellerSummary {
  const mine = new Set((src.listings ?? []).map((l) => l.id));
  return {
    openListings: src.listings ? src.listings.filter((l) => l.status === 'published').length : null,
    liveAuctions:
      src.listings && src.liveAuctions
        ? src.liveAuctions.filter((a) => a.listingId !== undefined && mine.has(a.listingId)).length
        : null,
    pendingOrders: src.orders
      ? src.orders.filter(
          (o) =>
            o.sellerCompanyId === src.companyId &&
            (o.status === 'awaiting_payment' || o.status === 'paid_escrow'),
        ).length
      : null,
    pendingPayoutMinor: src.payoutBalanceMinor,
  };
}
