import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../test/db.js';
import { dbNow } from './clock.js';

// The pattern every critical write follows (ADR-002/003): lock the row, then read the DB clock.
const db = await createTestDb();
afterAll(() => db.destroy());

beforeAll(async () => {
  await sql`create table counter (id int primary key, value int not null)`.execute(db);
  await sql`insert into counter values (1, 0)`.execute(db);
});

describe('SELECT ... FOR UPDATE + clock_timestamp()', () => {
  it('serialises concurrent read-modify-write and orders DB timestamps by lock acquisition', async () => {
    const writers = 20;

    const results = await Promise.all(
      Array.from({ length: writers }, () =>
        db.transaction().execute(async (trx) => {
          const { rows } = await sql<{ value: number }>`
            select value from counter where id = 1 for update
          `.execute(trx);
          const next = (rows[0]?.value ?? 0) + 1;
          const at = await dbNow(trx);
          await sql`update counter set value = ${next} where id = 1`.execute(trx);
          return { next, at };
        }),
      ),
    );

    const { rows } = await sql<{ value: number }>`select value from counter where id = 1`.execute(
      db,
    );
    expect(rows[0]?.value).toBe(writers);

    // Each writer saw a distinct value, and the DB clock read after the lock grows with it.
    const ordered = [...results].sort((a, b) => a.next - b.next);
    expect(ordered.map((r) => r.next)).toEqual(Array.from({ length: writers }, (_, i) => i + 1));
    for (let i = 1; i < ordered.length; i++) {
      const [prev, cur] = [ordered[i - 1]?.at.getTime() ?? 0, ordered[i]?.at.getTime() ?? -1];
      expect(cur).toBeGreaterThanOrEqual(prev);
    }
  });
});
