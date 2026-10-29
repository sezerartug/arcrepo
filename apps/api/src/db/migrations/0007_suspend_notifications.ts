import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Per-user suspension (the company's other members are unaffected).
  await sql`alter table users add column suspended_at timestamptz`.execute(db);
  await sql`alter table users add column suspend_reason text`.execute(db);

  // In-app notifications, fanned out per member: one row per recipient user, so read state is a column.
  await sql`
    create table notifications (
      id uuid primary key default uuidv7(),
      user_id uuid not null references users (id) on delete cascade,
      company_id uuid not null references companies (id),
      type text not null,
      title text not null,
      body text not null,
      link text,
      created_at timestamptz not null default clock_timestamp(),
      read_at timestamptz
    )
  `.execute(db);
  await sql`create index notifications_user_idx on notifications (user_id, created_at desc, id desc)`.execute(
    db,
  );
  await sql`create index notifications_unread_idx on notifications (user_id) where read_at is null`.execute(
    db,
  );
}
