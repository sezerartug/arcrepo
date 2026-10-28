import { sql } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../test/db.js';
import { migrateToLatest } from './migrate.js';

const db = await createTestDb();
afterAll(() => db.destroy());

describe('migrateToLatest', () => {
  it('is a no-op on an already migrated database', async () => {
    expect(await migrateToLatest(db)).toEqual([]);
  });

  it('installs the search extensions', async () => {
    const { rows } = await sql<{ extname: string }>`
      select extname from pg_extension where extname in ('unaccent', 'pg_trgm') order by extname
    `.execute(db);
    expect(rows.map((r) => r.extname)).toEqual(['pg_trgm', 'unaccent']);
  });

  it('runs the server in UTC', async () => {
    const { rows } = await sql<{ tz: string }>`select current_setting('TimeZone') as tz`.execute(
      db,
    );
    expect(rows[0]?.tz).toBe('UTC');
  });
});
