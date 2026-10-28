import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Turkish-aware folding for search: dotted/dotless I and diacritics collapse to ASCII, lower-cased.
  // Declared immutable (unaccent itself is only stable) so it can back a generated column and indexes.
  await sql`
    create function arc_fold(t text) returns text language sql immutable parallel safe as
    $$ select lower(public.unaccent('public.unaccent'::regdictionary, translate(coalesce(t, ''), 'İIı', 'iii'))) $$
  `.execute(db);

  await sql`
    create table users (
      id uuid primary key default uuidv7(),
      email text not null check (email = lower(email) and char_length(email) <= 254),
      password_hash text not null,
      full_name text not null check (char_length(full_name) between 2 and 120),
      is_platform_admin boolean not null default false,
      created_at timestamptz not null default clock_timestamp()
    )
  `.execute(db);
  await sql`create unique index users_email_key on users (email)`.execute(db);

  await sql`
    create table sessions (
      id uuid primary key default uuidv7(),
      user_id uuid not null references users (id) on delete cascade,
      token_hash text not null unique,
      created_at timestamptz not null default clock_timestamp(),
      expires_at timestamptz not null
    )
  `.execute(db);
  await sql`create index sessions_user_idx on sessions (user_id)`.execute(db);

  await sql`
    create table companies (
      id uuid primary key default uuidv7(),
      legal_name text not null check (char_length(legal_name) between 2 and 200),
      tax_no text not null unique check (tax_no ~ '^[0-9]{10}$'),
      tax_office text not null,
      address text not null,
      status text not null default 'pending'
        check (status in ('pending', 'verified', 'rejected', 'suspended')),
      status_reason text,
      created_at timestamptz not null default clock_timestamp()
    )
  `.execute(db);
  await sql`create index companies_status_idx on companies (status, created_at)`.execute(db);

  // One company per user in the MVP.
  await sql`
    create table company_members (
      company_id uuid not null references companies (id),
      user_id uuid not null primary key references users (id),
      role text not null check (role in ('owner', 'member')),
      created_at timestamptz not null default clock_timestamp()
    )
  `.execute(db);
  await sql`create index company_members_company_idx on company_members (company_id)`.execute(db);

  await sql`
    create table categories (
      id uuid primary key default uuidv7(),
      parent_id uuid references categories (id),
      name text not null,
      slug text not null unique,
      unit text not null check (unit in ('ton', 'torba', 'm3', 'adet', 'palet')),
      base_per_unit integer not null check (base_per_unit > 0),
      sort_order integer not null default 0
    )
  `.execute(db);

  await sql`
    create table listings (
      id uuid primary key default uuidv7(),
      company_id uuid not null references companies (id),
      category_id uuid not null references categories (id),
      title text not null check (char_length(title) between 5 and 140),
      description text not null default '',
      attrs jsonb not null default '{}'::jsonb,
      sale_type text not null check (sale_type in ('fixed', 'auction')),
      currency char(3) not null default 'TRY',
      unit_price_minor bigint not null check (unit_price_minor > 0),
      quantity_base bigint not null check (quantity_base > 0),
      min_order_base bigint not null default 1 check (min_order_base > 0 and min_order_base <= quantity_base),
      location text not null,
      delivery_terms text not null default '',
      -- Auction parameters supplied at creation; the auction row itself is created in the auction slice.
      auction_draft jsonb,
      status text not null default 'pending_review'
        check (status in ('pending_review', 'published', 'rejected', 'sold', 'removed')),
      review_reason text,
      created_at timestamptz not null default clock_timestamp(),
      updated_at timestamptz not null default clock_timestamp(),
      search tsvector generated always as (
        to_tsvector('turkish', arc_fold(title || ' ' || description || ' ' || location))
        || to_tsvector('simple', arc_fold(title || ' ' || description || ' ' || location))
      ) stored,
      check ((sale_type = 'auction') = (auction_draft is not null))
    )
  `.execute(db);
  await sql`create index listings_search_idx on listings using gin (search)`.execute(db);
  await sql`create index listings_title_trgm_idx on listings using gin (arc_fold(title) gin_trgm_ops)`.execute(
    db,
  );
  await sql`create index listings_status_created_idx on listings (status, created_at desc)`.execute(
    db,
  );
  await sql`create index listings_company_idx on listings (company_id, created_at desc)`.execute(
    db,
  );
  await sql`create index listings_category_idx on listings (category_id)`.execute(db);

  await sql`
    create table listing_images (
      id uuid primary key default uuidv7(),
      listing_id uuid not null references listings (id) on delete cascade,
      file_name text not null unique,
      position integer not null default 0,
      created_at timestamptz not null default clock_timestamp()
    )
  `.execute(db);
  await sql`create index listing_images_listing_idx on listing_images (listing_id, position)`.execute(
    db,
  );

  await sql`
    create table favorites (
      user_id uuid not null references users (id) on delete cascade,
      listing_id uuid not null references listings (id) on delete cascade,
      created_at timestamptz not null default clock_timestamp(),
      primary key (user_id, listing_id)
    )
  `.execute(db);

  await sql`
    create table idempotency_keys (
      user_id uuid not null references users (id),
      key text not null,
      request_hash text not null,
      response_status integer,
      response_body jsonb,
      created_at timestamptz not null default clock_timestamp(),
      primary key (user_id, key)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of [
    'idempotency_keys',
    'favorites',
    'listing_images',
    'listings',
    'categories',
    'company_members',
    'companies',
    'sessions',
    'users',
  ]) {
    await sql`drop table ${sql.table(table)}`.execute(db);
  }
  await sql`drop function arc_fold(text)`.execute(db);
}
