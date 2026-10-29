export type AdminCompanyRow = {
  id: string;
  legalName: string;
  taxNo: string;
  taxOffice: string;
  status: string;
  createdAt: string;
  owner: { email: string; fullName: string } | null;
  listingCount: number;
  memberCount: number;
};
export type Paged<T> = { items: T[]; total: number; page: number };

export type AdminUserRow = {
  id: string;
  fullName: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  suspended: boolean;
  suspendedAt: string | null;
  suspendReason: string | null;
  companies: { id: string; legalName: string; status: string; role: string }[];
};

export type AdminAuditRow = {
  id: string;
  occurredAt: string;
  actorType: string;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
};

export type AdminCompanyDetail = {
  company: {
    id: string;
    legalName: string;
    taxNo: string;
    taxOffice: string;
    address: string;
    status: string;
    statusReason: string | null;
    createdAt: string;
  };
  members: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    joinedAt: string;
    lastLoginAt: string | null;
    suspended: boolean;
    suspendedAt: string | null;
    suspendReason: string | null;
  }[];
  listings: {
    id: string;
    title: string;
    status: string;
    saleType: string;
    unitPriceMinor: string;
    createdAt: string;
  }[];
  auctions: {
    id: string;
    listingId: string;
    listingTitle: string;
    status: string;
    startPriceMinor: string;
    currentPriceMinor: string | null;
    bidCount: number;
    endsAt: string;
    depositMinor: string;
    heldDeposits: number;
  }[];
  orders: {
    id: string;
    role: string;
    counterparty: string;
    status: string;
    totalMinor: string;
    createdAt: string;
  }[];
  audit: AdminAuditRow[];
};

export type AdminAuctionRow = {
  id: string;
  listingId: string;
  title: string;
  sellerCompanyId: string;
  sellerName: string;
  status: string;
  startPriceMinor: string;
  currentPriceMinor: string | null;
  bidCount: number;
  startsAt: string;
  endsAt: string;
  depositMinor: string;
  heldDepositTotalMinor: string;
};
export type AdminAuctionList = Paged<AdminAuctionRow> & { serverNow: string };

export type AdminAuctionDetail = {
  serverNow: string;
  auction: {
    id: string;
    listingId: string;
    title: string;
    sellerCompanyId: string;
    sellerName: string;
    status: string;
    startPriceMinor: string;
    minIncrementMinor: string;
    reserveMinor: string | null;
    currentPriceMinor: string | null;
    bidCount: number;
    depositMinor: string;
    startsAt: string;
    endsAt: string;
    originalEndsAt: string;
    extensionCount: number;
    closedAt: string | null;
    cancelReason: string | null;
  };
  bids: {
    seq: number;
    amountMinor: string;
    acceptedAt: string;
    companyId: string;
    companyName: string;
    userName: string;
  }[];
  attempts: {
    id: string;
    amountMinor: string;
    reasonCode: string;
    at: string;
    companyName: string;
    userName: string;
  }[];
  rejectionSummary: { reasonCode: string; count: number }[];
  deposits: {
    id: string;
    companyId: string;
    companyName: string;
    amountMinor: string;
    reference: string;
    status: string;
    createdAt: string;
    confirmedAt: string | null;
    settledAt: string | null;
  }[];
  events: { seq: number; type: string; payload: Record<string, unknown>; at: string }[];
  result: {
    outcome: 'sold' | 'no_sale';
    winnerCompanyId: string | null;
    winnerName: string | null;
    finalPriceMinor: string | null;
    totalMinor: string | null;
    at: string;
  } | null;
  order: { id: string; status: string; totalMinor: string } | null;
};

export type AdminOrderRow = {
  id: string;
  listingTitle: string;
  buyerName: string;
  sellerName: string;
  status: string;
  totalMinor: string;
  refundMinor: string;
  fromAuction: boolean;
  createdAt: string;
};

export type AdminDisputeRow = {
  id: string;
  orderId: string;
  listingTitle: string;
  buyerName: string;
  sellerName: string;
  totalMinor: string;
  orderStatus: string;
  fromAuction: boolean;
  reason: string;
  status: 'open' | 'resolved';
  resolution: 'refund' | 'rejected' | null;
  refundMinor: string | null;
  resolutionNote: string | null;
  openedAt: string;
  resolvedAt: string | null;
};

type FinanceScope = 'range' | 'now';
export type AdminFinanceSummary = {
  currency: string;
  range: { from: string | null; to: string | null };
  commission: { amountMinor: string; scope: FinanceScope; kaynak: string };
  forfeitedDeposits: { amountMinor: string; scope: FinanceScope; kaynak: string };
  escrow: { amountMinor: string; scope: FinanceScope; kaynak: string };
  pendingPayables: {
    amountMinor: string;
    scope: FinanceScope;
    kaynak: string;
    companies: { companyId: string; companyName: string; amountMinor: string }[];
  };
  depositHeld: { amountMinor: string; scope: FinanceScope; kaynak: string };
  bankClearing: { amountMinor: string; scope: FinanceScope; kaynak: string };
  completedOrders: { count: string; totalMinor: string; scope: FinanceScope; kaynak: string };
  refunds: { count: string; amountMinor: string; scope: FinanceScope; kaynak: string };
  disputes: { count: string; scope: FinanceScope; kaynak: string };
  consistency: {
    ok: boolean;
    ledgerTotalMinor: string;
    escrowMinor: string;
    openOrdersEscrowMinor: string;
    diffMinor: string;
    kaynak: string;
  };
};
