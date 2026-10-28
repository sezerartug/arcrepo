import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Search (ARCHITECTURE §7).
  await sql`create extension if not exists unaccent`.execute(db);
  await sql`create extension if not exists pg_trgm`.execute(db);

  // Audit log (P1-09): append-only, stamped by the DB clock. Personal data and secrets stay out of `data`.
  await sql`
    create table audit_log (
      id uuid primary key default uuidv7(),
      occurred_at timestamptz not null default clock_timestamp(),
      actor_type text not null constraint audit_log_actor_type_check
        check (actor_type in ('user', 'admin', 'system')),
      actor_id uuid,
      company_id uuid,
      action text not null check (action <> ''),
      entity_type text not null check (entity_type <> ''),
      entity_id uuid,
      reason text,
      correlation_id text,
      data jsonb not null default '{}'::jsonb,
      check (actor_type = 'system' or actor_id is not null)
    )
  `.execute(db);
  await sql`create index audit_log_entity_idx on audit_log (entity_type, entity_id, occurred_at)`.execute(
    db,
  );
  await sql`
    create function audit_log_append_only() returns trigger language plpgsql as $$
    begin
      raise exception 'audit_log is append-only (% rejected)', tg_op;
    end
    $$
  `.execute(db);
  await sql`
    create trigger audit_log_no_change before update or delete on audit_log
    for each row execute function audit_log_append_only()
  `.execute(db);
  await sql`
    create trigger audit_log_no_truncate before truncate on audit_log
    for each statement execute function audit_log_append_only()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table audit_log`.execute(db);
  await sql`drop function audit_log_append_only()`.execute(db);
}
