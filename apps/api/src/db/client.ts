import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './schema.js';

// int8 carries money in minor units: never let it pass through a JS number.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => BigInt(value));

export function createDb(connectionString: string): Kysely<Database> {
  const pool = new pg.Pool({ connectionString });
  // Without a listener an idle client dropped by the server (restart, failover) crashes the process.
  pool.on('error', (error) => {
    console.error('postgres idle client error:', error.message);
  });
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}
