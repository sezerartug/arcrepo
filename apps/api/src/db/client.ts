import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './schema.js';

// int8 carries money in minor units: never let it pass through a JS number.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => BigInt(value));

export function createDb(connectionString: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString }) }),
  });
}
