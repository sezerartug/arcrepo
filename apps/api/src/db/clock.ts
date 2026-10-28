import { sql, type Kysely } from 'kysely';

// The only time authority (ADR-002). Inside a transaction call it after taking the row lock:
// clock_timestamp() is the real time now, while now() is frozen at transaction start.
export async function dbNow(db: Kysely<unknown>): Promise<Date> {
  const { rows } = await sql<{ now: Date }>`select clock_timestamp() as now`.execute(db);
  const now = rows[0]?.now;
  if (!now) throw new Error('clock_timestamp() returned no row');
  return now;
}
