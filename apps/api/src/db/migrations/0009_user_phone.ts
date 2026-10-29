import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Optional contact phone (stored only, not verified).
  await sql`alter table users add column phone text`.execute(db);
}
