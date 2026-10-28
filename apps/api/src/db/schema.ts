import type { ColumnType, Generated } from 'kysely';

// Kysely table types. Each migration that changes a table updates its interface here.

export type ActorType = 'user' | 'admin' | 'system';

export interface AuditLogTable {
  id: Generated<string>;
  occurred_at: ColumnType<Date, never, never>;
  actor_type: ActorType;
  actor_id: string | null;
  company_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  correlation_id: string | null;
  data: ColumnType<Record<string, unknown>, string, never>;
}

export interface Database {
  audit_log: AuditLogTable;
}
