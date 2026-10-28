import { Migrator, type Kysely, type Migration, type MigrationResult } from 'kysely';
import * as m0001 from './migrations/0001_init.js';

// Listed explicitly so the build and the tests run the same set; append new migrations in order.
const migrations: Record<string, Migration> = {
  '0001_init': m0001,
};

// Kysely holds a lock table while migrating, so concurrent API boots are safe.
export async function migrateToLatest(db: Kysely<unknown>): Promise<MigrationResult[]> {
  const migrator = new Migrator({ db, provider: { getMigrations: () => Promise.resolve(migrations) } });
  const { error, results = [] } = await migrator.migrateToLatest();
  if (error) throw error;
  return results;
}
