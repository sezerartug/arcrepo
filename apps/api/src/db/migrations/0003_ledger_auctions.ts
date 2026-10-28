import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // ---- Ledger (ADR: the only way money moves; double entry, journal sum = 0) -----------------------
  await sql`
    create table ledger_accounts (
      id uuid primary key default uuidv7(),
      type text not null check (type in
        ('bank_clearing', 'deposit_held', 'escrow', 'seller_payable', 'platform_revenue', 'buyer_credit')),
      company_id uuid references companies (id),
      currency char(3) not null default 'TRY' check (currency = 'TRY'),
      created_at timestamptz not null default clock_timestamp(),
      check ((type in ('seller_payable', 'buyer_credit')) = (company_id is not null)),
      unique nulls not distinct (type, company_id)
    )
  `.execute(db);
  await sql`
    insert into ledger_accounts (type) values
      ('bank_clearing'), ('deposit_held'), ('escrow'), ('platform_revenue')
  `.execute(db);

  await sql`
    create table ledger_journals (
      id uuid primary key default uuidv7(),
      reason text not null check (reason <> ''),
      ref_type text,
      ref_id uuid,
      created_at timestamptz not null default clock_timestamp(),
      check ((ref_type is null) = (ref_id is null))
    )
  `.execute(db);
  // A business event posts each journal reason at most once (double-posting guard).
  await sql`
    create unique index ledger_journals_ref_key on ledger_journals (reason, ref_type, ref_id)
    where ref_id is not null
  `.execute(db);

  await sql`
    create table ledger_entries (
      id uuid primary key default uuidv7(),
      journal_id uuid not null references ledger_journals (id),
      account_id uuid not null references ledger_accounts (id),
      amount_minor bigint not null check (amount_minor <> 0),
      created_at timestamptz not null default clock_timestamp()
    )
  `.execute(db);
  await sql`create index ledger_entries_journal_idx on ledger_entries (journal_id)`.execute(db);
  await sql`create index ledger_entries_account_idx on ledger_entries (account_id)`.execute(db);

  await sql`
    create function ledger_journal_balanced() returns trigger language plpgsql as $$
    declare s numeric;
    begin
      select coalesce(sum(amount_minor), 0) into s from ledger_entries where journal_id = new.journal_id;
      if s <> 0 then
        raise exception 'ledger journal % is unbalanced (sum %)', new.journal_id, s using errcode = '23514';
      end if;
      return null;
    end
    $$
  `.execute(db);
  await sql`
    create constraint trigger ledger_entries_balanced after insert on ledger_entries
    deferrable initially deferred for each row execute function ledger_journal_balanced()
  `.execute(db);
  await sql`
    create function ledger_immutable() returns trigger language plpgsql as $$
    begin
      raise exception 'ledger is append-only (% rejected)', tg_op;
    end
    $$
  `.execute(db);
  for (const t of ['ledger_entries', 'ledger_journals']) {
    await sql`
      create trigger ${sql.raw(t + '_immutable')} before update or delete on ${sql.table(t)}
      for each row execute function ledger_immutable()
    `.execute(db);
  }

  // ---- Auctions ------------------------------------------------------------------------------------
  await sql`
    create table auctions (
      id uuid primary key default uuidv7(),
      listing_id uuid not null unique references listings (id),
      seller_company_id uuid not null references companies (id),
      status text not null check (status in ('DRAFT', 'SCHEDULED', 'LIVE', 'PAYMENT_PENDING',
        'SETTLED', 'ENDED_NO_SALE', 'PAYMENT_FAILED', 'CANCELLED')),
      start_price_minor bigint not null check (start_price_minor > 0),
      min_increment_minor bigint not null check (min_increment_minor > 0),
      reserve_minor bigint check (reserve_minor > 0),
      quantity_base bigint not null check (quantity_base > 0),
      base_per_unit integer not null check (base_per_unit > 0),
      deposit_minor bigint not null check (deposit_minor > 0),
      starts_at timestamptz not null,
      ends_at timestamptz not null,
      original_ends_at timestamptz not null,
      hard_end_cap timestamptz not null,
      extension_window_secs integer not null default 60 check (extension_window_secs >= 0),
      extension_secs integer not null default 60 check (extension_secs > 0),
      max_extensions integer not null default 10 check (max_extensions >= 0),
      extension_count integer not null default 0,
      last_seq integer not null default 0,
      bid_count integer not null default 0,
      current_price_minor bigint,
      high_bid_id uuid,
      version integer not null default 0,
      closed_at timestamptz,
      cancel_reason text,
      created_at timestamptz not null default clock_timestamp(),
      check (ends_at > starts_at),
      check (hard_end_cap >= ends_at),
      check (extension_count <= max_extensions),
      check (last_seq = bid_count),
      check ((current_price_minor is null) = (last_seq = 0))
    )
  `.execute(db);
  await sql`create index auctions_status_ends_idx on auctions (status, ends_at)`.execute(db);
  await sql`create index auctions_status_starts_idx on auctions (status, starts_at)`.execute(db);

  await sql`
    create table bids (
      id uuid primary key default uuidv7(),
      auction_id uuid not null references auctions (id),
      seq integer not null check (seq >= 1),
      bidder_company_id uuid not null references companies (id),
      bidder_user_id uuid not null references users (id),
      amount_minor bigint not null check (amount_minor > 0),
      accepted_at timestamptz not null default clock_timestamp(),
      unique (auction_id, seq),
      unique (auction_id, amount_minor)
    )
  `.execute(db);
  await sql`create index bids_company_idx on bids (auction_id, bidder_company_id)`.execute(db);

  await sql`
    create table bid_attempts (
      id uuid primary key default uuidv7(),
      auction_id uuid not null references auctions (id),
      bidder_company_id uuid not null references companies (id),
      bidder_user_id uuid not null references users (id),
      amount_minor bigint not null,
      reason_code text not null,
      at timestamptz not null default clock_timestamp()
    )
  `.execute(db);
  await sql`create index bid_attempts_auction_idx on bid_attempts (auction_id, at)`.execute(db);

  await sql`
    create table auction_events (
      id uuid primary key default uuidv7(),
      auction_id uuid not null references auctions (id),
      seq integer not null,
      type text not null,
      payload jsonb not null default '{}'::jsonb,
      at timestamptz not null default clock_timestamp()
    )
  `.execute(db);
  await sql`create index auction_events_auction_idx on auction_events (auction_id, at)`.execute(db);

  await sql`
    create table auction_results (
      id uuid primary key default uuidv7(),
      auction_id uuid not null unique references auctions (id),
      outcome text not null check (outcome in ('sold', 'no_sale')),
      winner_company_id uuid references companies (id),
      winning_bid_id uuid references bids (id),
      final_price_minor bigint,
      total_minor bigint,
      at timestamptz not null default clock_timestamp(),
      check ((outcome = 'sold') = (winning_bid_id is not null))
    )
  `.execute(db);

  await sql`
    create table deposits (
      id uuid primary key default uuidv7(),
      auction_id uuid not null references auctions (id),
      company_id uuid not null references companies (id),
      amount_minor bigint not null check (amount_minor > 0),
      reference text not null unique,
      status text not null default 'pending'
        check (status in ('pending', 'held', 'refunded', 'applied', 'forfeited', 'cancelled')),
      created_at timestamptz not null default clock_timestamp(),
      confirmed_at timestamptz,
      settled_at timestamptz,
      unique (auction_id, company_id)
    )
  `.execute(db);
  await sql`create index deposits_status_idx on deposits (status, created_at)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of [
    'deposits',
    'auction_results',
    'auction_events',
    'bid_attempts',
    'bids',
    'auctions',
    'ledger_entries',
    'ledger_journals',
    'ledger_accounts',
  ]) {
    await sql`drop table ${sql.table(table)}`.execute(db);
  }
  await sql`drop function ledger_journal_balanced()`.execute(db);
  await sql`drop function ledger_immutable()`.execute(db);
}
