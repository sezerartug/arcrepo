import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Single-use password reset tokens; only the sha256 of the token is stored.
  await sql`
    create table password_resets (
      id uuid primary key default uuidv7(),
      user_id uuid not null references users (id) on delete cascade,
      token_hash text not null unique,
      created_at timestamptz not null default clock_timestamp(),
      expires_at timestamptz not null,
      used_at timestamptz
    )
  `.execute(db);
  await sql`create index password_resets_user_idx on password_resets (user_id)`.execute(db);
}
