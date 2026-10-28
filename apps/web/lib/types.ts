// Response shapes from docs/MVP-PLAN.md (camelCase JSON, money as minor-unit strings).
// Fields not spelled out in the contract are optional.

export type CompanyStatus = 'pending' | 'verified' | 'rejected' | 'suspended';

export type Me = {
  user: { id: string; email: string; fullName: string; isPlatformAdmin?: boolean };
  company: {
    id: string;
    legalName: string;
    status: CompanyStatus;
    memberRole: 'owner' | 'member';
  } | null;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  unit: string;
  basePerUnit: number;
  children?: Category[];
};

export type AuctionSummary = {
  id: string;
  listingId?: string;
  status: string;
  currentPriceMinor: string;
  minNextBidMinor?: string;
  bidCount?: number;
  endsAt: string;
  startsAt?: string;
  title?: string;
};

export type Listing = {
  id: string;
  title: string;
  description?: string;
  attrs?: Record<string, string | number>;
  categoryId?: string;
  categoryName?: string;
  unit?: string;
  basePerUnit?: number;
  saleType: 'fixed' | 'auction';
  unitPriceMinor: string;
  quantityBase: number | string;
  minOrderBase?: number | string | null;
  location?: string;
  deliveryTerms?: string;
  status: string;
  sellerCompanyName?: string;
  companyId?: string;
  images?: (string | { path: string })[];
  auction?: AuctionSummary | null;
  isFavorite?: boolean;
};

export type ListingPage = { items: Listing[]; total: number; page: number };

export type Bid = { seq: number; amountMinor: string; bidder: string; at: string };

export type AuctionSnapshot = {
  id: string;
  listingId: string;
  status: string;
  currentPriceMinor: string;
  minNextBidMinor: string;
  bidCount: number;
  endsAt: string;
  serverNow: string;
  depositMinor: string;
  startsAt: string;
  bids: Bid[];
  winner?: { bidder?: string; amountMinor?: string } | null;
  myState?: { eligible: boolean; depositStatus: string | null; isHighBidder: boolean };
};

export type DepositInstruction = {
  reference: string;
  amountMinor: string;
  iban: string;
  status: string;
};

export type Order = {
  id: string;
  status: string;
  listingTitle?: string;
  sourceListingId?: string;
  buyerCompanyId: string;
  sellerCompanyId: string;
  unitPriceMinor: string;
  quantityBase: number | string;
  totalMinor: string;
  commissionMinor?: string;
  paymentReference?: string | null;
  paymentDueAt?: string | null;
  iban?: string;
  createdAt?: string;
  history?: { status: string; at: string }[];
};

export type Member = { email: string; fullName: string; role: string };

export function imageSrc(img: string | { path: string }): string {
  const p = typeof img === 'string' ? img : img.path;
  if (p.startsWith('http') || p.startsWith('/api/')) return p;
  return `/api/uploads/${p.replace(/^\/?(uploads\/)?/, '')}`;
}

export function flattenCategories(tree: Category[]): Category[] {
  return tree.flatMap((c) => (c.children?.length ? flattenCategories(c.children) : [c]));
}

/** Fills unit/basePerUnit from the category tree when the API omits them. */
export function withUnits<T extends Listing>(items: T[], tree: Category[]): T[] {
  const byId = new Map(flattenCategories(tree).map((c) => [c.id, c]));
  return items.map((l) => {
    const c = l.categoryId ? byId.get(l.categoryId) : undefined;
    return {
      ...l,
      unit: l.unit ?? c?.unit,
      basePerUnit: l.basePerUnit ?? c?.basePerUnit,
      categoryName: l.categoryName ?? c?.name,
    };
  });
}
