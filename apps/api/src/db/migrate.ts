import { Migrator, type Kysely, type Migration, type MigrationResult } from 'kysely';
import * as m0001 from './migrations/0001_init.js';
import * as m0002 from './migrations/0002_identity_catalog.js';

// Listed explicitly so the build and the tests run the same set; append new migrations in order.
const migrations: Record<string, Migration> = {
  '0001_init': m0001,
  '0002_identity_catalog': m0002,
};

// Kysely holds a lock table while migrating, so concurrent API boots are safe.
// Kysely<any>: the migrator is schema-agnostic and Kysely<Database> is not assignable to Kysely<unknown>.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function migrateToLatest(db: Kysely<any>): Promise<MigrationResult[]> {
  const migrator = new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
  });
  const { error, results = [] } = await migrator.migrateToLatest();
  if (error) throw error as Error;
  return results;
}
