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
