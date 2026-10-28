import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import pg from 'pg';
import { inject } from 'vitest';
import { createDb } from '../db/client.js';
import type { Database } from '../db/schema.js';

// A fresh, fully migrated database cloned from the template prepared in global-setup.
export async function createTestDb(): Promise<Kysely<Database>> {
  const baseUrl = inject('pgBaseUrl');
  const name = `t_${randomUUID().replaceAll('-', '')}`;

  const admin = new pg.Client({ connectionString: `${baseUrl}/postgres` });
  await admin.connect();
  try {
    await admin.query(`create database ${name} template ${inject('pgTemplate')}`);
  } finally {
    await admin.end();
  }
  return createDb(`${baseUrl}/${name}`);
}
