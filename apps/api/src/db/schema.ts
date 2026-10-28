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

export interface Database {
  audit_log: AuditLogTable;
  users: UsersTable;
  sessions: SessionsTable;
  companies: CompaniesTable;
  company_members: CompanyMembersTable;
  categories: CategoriesTable;
  listings: ListingsTable;
  listing_images: ListingImagesTable;
  favorites: FavoritesTable;
  idempotency_keys: IdempotencyKeysTable;
}
