import type { Kysely } from 'kysely';
import type { ActorType, Database } from '../../../db/schema.js';

export interface AuditEntry {
  readonly actorType: ActorType;
  readonly actorId?: string;
  readonly companyId?: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId?: string;
  readonly reason?: string;
  readonly correlationId?: string;
  // Identifiers and amounts only: no personal data, secrets or card data (CLAUDE.md).
  readonly data?: Readonly<Record<string, unknown>>;
}

// Pass the business transaction so the entry commits or rolls back with the action it records.
export async function recordAudit(db: Kysely<Database>, entry: AuditEntry): Promise<string> {
  const row = await db
    .insertInto('audit_log')
    .values({
      actor_type: entry.actorType,
      actor_id: entry.actorId ?? null,
      company_id: entry.companyId ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      reason: entry.reason ?? null,
      correlation_id: entry.correlationId ?? null,
      data: JSON.stringify(entry.data ?? {}),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}
