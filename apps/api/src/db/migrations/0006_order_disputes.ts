import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // New order states: disputed (buyer objection while shipped) and refunded (full refund).
  // The status check was created unnamed, so it is found by definition.
  await sql`
    do $$
    declare c record;
    begin
      for c in
        select conname from pg_constraint
        where conrelid = 'orders'::regclass and contype = 'c'
          and pg_get_constraintdef(oid) ~ 'awaiting_payment'
      loop
        execute format('alter table orders drop constraint %I', c.conname);
      end loop;
    end
    $$
  `.execute(db);
  await sql`
    alter table orders add constraint orders_status_check check (status in ('awaiting_payment',
      'paid_escrow', 'shipped', 'delivered', 'completed', 'cancelled', 'payment_failed',
      'disputed', 'refunded'))
  `.execute(db);
  // Amount returned to the buyer by a dispute resolution (0 = none; = total_minor for a full refund).
  await sql`alter table orders add column refund_minor bigint not null default 0`.execute(db);
  await sql`
    alter table orders add constraint orders_refund_range
    check (refund_minor >= 0 and refund_minor <= total_minor)
  `.execute(db);

  await sql`
    create table order_disputes (
      id uuid primary key default uuidv7(),
      order_id uuid not null references orders (id),
      opened_by_user_id uuid not null references users (id),
      reason text not null check (char_length(reason) between 10 and 2000),
      status text not null default 'open' check (status in ('open', 'resolved')),
      resolution text check (resolution in ('refund', 'rejected')),
      refund_minor bigint check (refund_minor > 0),
      resolution_note text,
      resolved_by_user_id uuid references users (id),
      opened_at timestamptz not null default clock_timestamp(),
      resolved_at timestamptz,
      check ((status = 'open') = (resolution is null)),
      check ((resolution = 'refund') = (refund_minor is not null)),
      check ((status = 'resolved') = (resolved_at is not null and resolved_by_user_id is not null
        and resolution_note is not null))
    )
  `.execute(db);
  // At most one open dispute per order.
  await sql`
    create unique index order_disputes_open_key on order_disputes (order_id) where status = 'open'
  `.execute(db);
  await sql`create index order_disputes_status_idx on order_disputes (status, opened_at desc)`.execute(
    db,
  );
  await sql`create index order_disputes_order_idx on order_disputes (order_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table order_disputes`.execute(db);
  await sql`alter table orders drop constraint orders_refund_range`.execute(db);
  await sql`alter table orders drop column refund_minor`.execute(db);
  await sql`alter table orders drop constraint orders_status_check`.execute(db);
  await sql`
    alter table orders add constraint orders_status_check check (status in ('awaiting_payment',
      'paid_escrow', 'shipped', 'delivered', 'completed', 'cancelled', 'payment_failed'))
  `.execute(db);
}
