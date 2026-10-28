import type { ColumnType, Generated, RawBuilder } from 'kysely';

// Kysely table types. Each migration that changes a table updates its interface here.

export type ActorType = 'user' | 'admin' | 'system';

export interface AuditLogTable {
  id: Generated<string>;
  occurred_at: ColumnType<Date, never, never>;
  actor_type: ActorType;
  actor_id: string | null;
  company_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  correlation_id: string | null;
  data: ColumnType<Record<string, unknown>, string, never>;
}

// Timestamps with a DB default are never written by the application.
type CreatedAt = ColumnType<Date, never, never>;

export type CompanyStatus = 'pending' | 'verified' | 'rejected' | 'suspended';
export type MemberRole = 'owner' | 'member';
export type SaleType = 'fixed' | 'auction';
export type ListingStatus = 'pending_review' | 'published' | 'rejected' | 'sold' | 'removed';
export type Unit = 'ton' | 'torba' | 'm3' | 'adet' | 'palet';

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  full_name: string;
  is_platform_admin: Generated<boolean>;
  created_at: CreatedAt;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  created_at: CreatedAt;
  expires_at: ColumnType<Date, Date | RawBuilder<Date>, never>;
}

export interface PasswordResetsTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  created_at: CreatedAt;
  expires_at: ColumnType<Date, RawBuilder<Date>, never>;
  used_at: ColumnType<Date | null, never, RawBuilder<Date>>;
}

export interface CompaniesTable {
  id: Generated<string>;
  legal_name: string;
  tax_no: string;
  tax_office: string;
  address: string;
  status: Generated<CompanyStatus>;
  status_reason: string | null;
  created_at: CreatedAt;
}

export interface CompanyMembersTable {
  company_id: string;
  user_id: string;
  role: MemberRole;
  created_at: CreatedAt;
}

export interface CategoriesTable {
  id: Generated<string>;
  parent_id: string | null;
  name: string;
  slug: string;
  unit: Unit;
  base_per_unit: number;
  sort_order: Generated<number>;
}

export interface ListingsTable {
  id: Generated<string>;
  company_id: string;
  category_id: string;
  title: string;
  description: string;
  attrs: ColumnType<Record<string, unknown>, string, string>;
  sale_type: SaleType;
  currency: Generated<string>;
  unit_price_minor: ColumnType<bigint, bigint, bigint>;
  quantity_base: ColumnType<bigint, bigint, bigint>;
  min_order_base: ColumnType<bigint, bigint, bigint>;
  location: string;
  delivery_terms: string;
  auction_draft: ColumnType<Record<string, string> | null, string | null, string | null>;
  status: Generated<ListingStatus>;
  review_reason: string | null;
  created_at: CreatedAt;
  updated_at: ColumnType<Date, never, RawBuilder<Date>>;
}

export interface ListingImagesTable {
  id: Generated<string>;
  listing_id: string;
  file_name: string;
  position: Generated<number>;
  created_at: CreatedAt;
}

export interface FavoritesTable {
  user_id: string;
  listing_id: string;
  created_at: CreatedAt;
}

export interface IdempotencyKeysTable {
  user_id: string;
  key: string;
  request_hash: string;
  response_status: number | null;
  response_body: ColumnType<unknown, string | null, string | null>;
  created_at: CreatedAt;
}

type Ts = ColumnType<Date, Date | RawBuilder<Date>, Date | RawBuilder<Date>>;

export type LedgerAccountType =
  | 'bank_clearing'
  | 'deposit_held'
  | 'escrow'
  | 'seller_payable'
  | 'platform_revenue'
  | 'buyer_credit';

export interface LedgerAccountsTable {
  id: Generated<string>;
  type: LedgerAccountType;
  company_id: string | null;
  currency: Generated<string>;
  created_at: CreatedAt;
}

export interface LedgerJournalsTable {
  id: Generated<string>;
  reason: string;
  ref_type: string | null;
  ref_id: string | null;
  created_at: CreatedAt;
}

export interface LedgerEntriesTable {
  id: Generated<string>;
  journal_id: string;
  account_id: string;
  amount_minor: bigint;
  created_at: CreatedAt;
}

export type AuctionStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'LIVE'
  | 'PAYMENT_PENDING'
  | 'SETTLED'
  | 'ENDED_NO_SALE'
  | 'PAYMENT_FAILED'
  | 'CANCELLED';

export interface AuctionsTable {
  id: Generated<string>;
  listing_id: string;
  seller_company_id: string;
  status: ColumnType<AuctionStatus, AuctionStatus, AuctionStatus>;
  start_price_minor: bigint;
  min_increment_minor: bigint;
  reserve_minor: bigint | null;
  quantity_base: bigint;
  base_per_unit: number;
  deposit_minor: bigint;
  starts_at: Ts;
  ends_at: Ts;
  original_ends_at: ColumnType<Date, Date, never>;
  hard_end_cap: ColumnType<Date, Date, never>;
  extension_window_secs: Generated<number>;
  extension_secs: Generated<number>;
  max_extensions: Generated<number>;
  extension_count: Generated<number>;
  last_seq: Generated<number>;
  bid_count: Generated<number>;
  current_price_minor: ColumnType<bigint | null, bigint | null | undefined, bigint | null>;
  high_bid_id: ColumnType<string | null, string | null | undefined, string | null>;
  version: Generated<number>;
  closed_at: ColumnType<Date | null, never, Date | RawBuilder<Date> | null>;
  cancel_reason: ColumnType<string | null, never, string | null>;
  created_at: CreatedAt;
}

export interface BidsTable {
  id: Generated<string>;
  auction_id: string;
  seq: number;
  bidder_company_id: string;
  bidder_user_id: string;
  amount_minor: bigint;
  accepted_at: Generated<Date>;
}

export interface BidAttemptsTable {
  id: Generated<string>;
  auction_id: string;
  bidder_company_id: string;
  bidder_user_id: string;
  amount_minor: bigint;
  reason_code: string;
  at: CreatedAt;
}

export interface AuctionEventsTable {
  id: Generated<string>;
  auction_id: string;
  seq: number;
  type: string;
  payload: ColumnType<Record<string, unknown>, string, never>;
  at: CreatedAt;
}

export interface AuctionResultsTable {
  id: Generated<string>;
  auction_id: string;
  outcome: 'sold' | 'no_sale';
  winner_company_id: string | null;
  winning_bid_id: string | null;
  final_price_minor: bigint | null;
  total_minor: bigint | null;
  at: CreatedAt;
}

export type DepositStatus = 'pending' | 'held' | 'refunded' | 'applied' | 'forfeited' | 'cancelled';

export interface DepositsTable {
  id: Generated<string>;
  auction_id: string;
  company_id: string;
  amount_minor: bigint;
  reference: string;
  status: ColumnType<DepositStatus, DepositStatus | undefined, DepositStatus>;
  created_at: CreatedAt;
  confirmed_at: ColumnType<Date | null, never, RawBuilder<Date> | null>;
  settled_at: ColumnType<Date | null, never, RawBuilder<Date> | null>;
}

export type OrderStatus =
  | 'awaiting_payment'
  | 'paid_escrow'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'payment_failed';

export interface OrdersTable {
  id: Generated<string>;
  source_listing_id: string;
  source_auction_id: string | null;
  buyer_company_id: string;
  seller_company_id: string;
  unit_price_minor: bigint;
  quantity_base: bigint;
  base_per_unit: number;
  total_minor: bigint;
  commission_minor: bigint;
  deposit_applied_minor: ColumnType<bigint, bigint | undefined, never>;
  amount_due_minor: bigint;
  status: ColumnType<OrderStatus, OrderStatus, OrderStatus>;
  payment_reference: string;
  payment_due_at: ColumnType<Date, Date | RawBuilder<Date>, never>;
  tracking_note: ColumnType<string | null, never, string | null>;
  cancel_reason: ColumnType<string | null, never, string | null>;
  created_at: CreatedAt;
  paid_at: ColumnType<Date | null, never, RawBuilder<Date>>;
  shipped_at: ColumnType<Date | null, never, RawBuilder<Date>>;
  delivered_at: ColumnType<Date | null, never, RawBuilder<Date>>;
  completed_at: ColumnType<Date | null, never, RawBuilder<Date>>;
  cancelled_at: ColumnType<Date | null, never, RawBuilder<Date>>;
}

export interface OrderEventsTable {
  id: Generated<string>;
  order_id: string;
  type: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus | null;
  data: ColumnType<Record<string, unknown>, string, never>;
  at: CreatedAt;
}

export interface Database {
  orders: OrdersTable;
  order_events: OrderEventsTable;
  audit_log: AuditLogTable;
  users: UsersTable;
  sessions: SessionsTable;
  password_resets: PasswordResetsTable;
  companies: CompaniesTable;
  company_members: CompanyMembersTable;
  categories: CategoriesTable;
  listings: ListingsTable;
  listing_images: ListingImagesTable;
  favorites: FavoritesTable;
  idempotency_keys: IdempotencyKeysTable;
  ledger_accounts: LedgerAccountsTable;
  ledger_journals: LedgerJournalsTable;
  ledger_entries: LedgerEntriesTable;
  auctions: AuctionsTable;
  bids: BidsTable;
  bid_attempts: BidAttemptsTable;
  auction_events: AuctionEventsTable;
  auction_results: AuctionResultsTable;
  deposits: DepositsTable;
}
