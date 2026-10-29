import { Migrator, type Kysely, type Migration, type MigrationResult } from 'kysely';
import * as m0001 from './migrations/0001_init.js';
import * as m0002 from './migrations/0002_identity_catalog.js';
import * as m0003 from './migrations/0003_ledger_auctions.js';
import * as m0004 from './migrations/0004_orders.js';
import * as m0005 from './migrations/0005_password_resets.js';
import * as m0006 from './migrations/0006_order_disputes.js';
import * as m0007 from './migrations/0007_suspend_notifications.js';
import * as m0008 from './migrations/0008_category_tree_condition.js';
import * as m0009 from './migrations/0009_user_phone.js';

// Listed explicitly so the build and the tests run the same set; append new migrations in order.
const migrations: Record<string, Migration> = {
  '0001_init': m0001,
  '0002_identity_catalog': m0002,
  '0003_ledger_auctions': m0003,
  '0004_orders': m0004,
  '0005_password_resets': m0005,
  '0006_order_disputes': m0006,
  '0007_suspend_notifications': m0007,
  '0008_category_tree_condition': m0008,
  '0009_user_phone': m0009,
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
