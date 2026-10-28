import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { startLocalPostgres } from '../../scripts/local-postgres.js';
import { createDb } from '../db/client.js';
import { migrateToLatest } from '../db/migrate.js';

declare module 'vitest' {
  export interface ProvidedContext {
    pgBaseUrl: string;
    pgTemplate: string;
  }
}

const USER = 'arc_test';
const TEMPLATE = 'arc_template';
// Reused across runs: initdb is slow on Windows (minutes on a cold disk), starting is ~1s.
const DATA_DIR = fileURLToPath(new URL('../../../../.data/pg-test', import.meta.url));

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('could not allocate a port'));
      });
    });
  });
}

async function resetDatabases(adminUrl: string): Promise<void> {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const { rows } = await admin.query<{ datname: string }>(
      `select datname from pg_database where datname like 't\\_%' or datname = $1`,
      [TEMPLATE],
    );
    for (const { datname } of rows) {
      await admin.query(`drop database "${datname}" with (force)`);
    }
    await admin.query(`create database ${TEMPLATE}`);
  } finally {
    await admin.end();
  }
}

// One server per run; migrations are applied once to a template that each test file clones
// (`createTestDb`), so files stay isolated without re-migrating.
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const server = await startLocalPostgres({
    dataDir: DATA_DIR,
    port: await freePort(),
    user: USER,
    password: USER,
    durable: false,
  });

  try {
    await resetDatabases(server.url('postgres'));
    const db = createDb(server.url(TEMPLATE));
    try {
      await migrateToLatest(db);
    } finally {
      await db.destroy();
    }
    project.provide('pgBaseUrl', server.url('').replace(/\/$/, ''));
    project.provide('pgTemplate', TEMPLATE);
  } catch (error) {
    await server.stop();
    throw error;
  }

  return () => server.stop();
}
