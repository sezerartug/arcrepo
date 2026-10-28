import { sql } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../../../test/db.js';
import { recordAudit } from './audit.js';

const db = await createTestDb();
afterAll(() => db.destroy());

const entry = {
  actorType: 'user',
  actorId: '01a18159-a029-758d-99cd-3b478b442ac9',
  action: 'bid.placed',
  entityType: 'auction',
  entityId: '01a18159-a029-758d-99cd-3b478b442aca',
  correlationId: 'req-1',
  data: { amountMinor: '125000' },
} as const;

describe('recordAudit', () => {
  it('appends an entry stamped by the DB clock', async () => {
    const before = Date.now();
    const id = await recordAudit(db, entry);

    const row = await db
      .selectFrom('audit_log')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    expect(row).toMatchObject({
      actor_type: 'user',
      action: 'bid.placed',
      entity_type: 'auction',
      correlation_id: 'req-1',
      data: { amountMinor: '125000' },
    });
    expect(row.occurred_at.getTime()).toBeGreaterThanOrEqual(before - 5_000);
  });

  it.each([
    ['update', sql`update audit_log set action = 'tampered'`],
    ['delete', sql`delete from audit_log`],
    ['truncate', sql`truncate audit_log`],
  ])('rejects %s: the log is append-only', async (_, statement) => {
    await recordAudit(db, entry);
    await expect(statement.execute(db)).rejects.toThrow(/append-only/);
  });

  it('rejects an unknown actor type at the database level', async () => {
    await expect(
      recordAudit(db, { ...entry, actorType: 'robot' as unknown as 'user' }),
    ).rejects.toThrow(/audit_log_actor_type_check/);
  });
});
