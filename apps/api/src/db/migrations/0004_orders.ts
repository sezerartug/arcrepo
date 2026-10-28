import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // A fixed-price listing can be sold out: stock 0 (status 'sold') and a remainder below the minimum
  // order are valid states from now on.
  // The checks were created unnamed (Postgres generated the names), so they are found by definition.
  await sql`
    do $$
    declare c record;
    begin
      for c in
        select conname from pg_constraint
        where conrelid = 'listings'::regclass and contype = 'c'
          and pg_get_constraintdef(oid) ~ '(quantity_base > 0|min_order_base <= quantity_base)'
      loop
        execute format('alter table listings drop constraint %I', c.conname);
      end loop;
    end
    $$
  `.execute(db);
  await sql`alter table listings add constraint listings_quantity_nonneg check (quantity_base >= 0)`.execute(
    db,
  );
  await sql`alter table listings add constraint listings_min_order_positive check (min_order_base > 0)`.execute(
    db,
  );

  await sql`
    create table orders (
      id uuid primary key default uuidv7(),
      source_listing_id uuid not null references listings (id),
      source_auction_id uuid references auctions (id),
      buyer_company_id uuid not null references companies (id),
      seller_company_id uuid not null references companies (id),
      unit_price_minor bigint not null check (unit_price_minor > 0),
      quantity_base bigint not null check (quantity_base > 0),
      base_per_unit integer not null check (base_per_unit > 0),
      total_minor bigint not null check (total_minor > 0),
      commission_minor bigint not null check (commission_minor >= 0 and commission_minor <= total_minor),
      deposit_applied_minor bigint not null default 0 check (deposit_applied_minor >= 0),
      amount_due_minor bigint not null check (amount_due_minor >= 0),
      status text not null check (status in ('awaiting_payment', 'paid_escrow', 'shipped',
        'delivered', 'completed', 'cancelled', 'payment_failed')),
      payment_reference text not null unique,
      payment_due_at timestamptz not null,
      tracking_note text,
      cancel_reason text,
      created_at timestamptz not null default clock_timestamp(),
      paid_at timestamptz,
      shipped_at timestamptz,
      delivered_at timestamptz,
      completed_at timestamptz,
      cancelled_at timestamptz,
      check (buyer_company_id <> seller_company_id),
      check (amount_due_minor = total_minor - deposit_applied_minor)
    )
  `.execute(db);
  // I6: at most one order per auction win.
  await sql`
    create unique index orders_source_auction_key on orders (source_auction_id)
    where source_auction_id is not null
  `.execute(db);
  await sql`create index orders_buyer_idx on orders (buyer_company_id, created_at desc)`.execute(
    db,
  );
  await sql`create index orders_seller_idx on orders (seller_company_id, created_at desc)`.execute(
    db,
  );
  await sql`create index orders_due_idx on orders (payment_due_at) where status = 'awaiting_payment'`.execute(
    db,
  );

  await sql`
    create table order_events (
      id uuid primary key default uuidv7(),
      order_id uuid not null references orders (id),
      type text not null,
      from_status text,
      to_status text,
      data jsonb not null default '{}'::jsonb,
      at timestamptz not null default clock_timestamp()
    )
  `.execute(db);
  await sql`create index order_events_order_idx on order_events (order_id, at)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table order_events`.execute(db);
  await sql`drop table orders`.execute(db);
}
