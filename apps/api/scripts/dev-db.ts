import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { startLocalPostgres, stopLocalPostgres } from './local-postgres.js';

// `pnpm db:start` / `pnpm db:stop`: the local development database (Docker-free alternative to
// compose.yaml). Uses the same POSTGRES_* variables and defaults as compose.yaml / .env.example.

const root = new URL('../../../', import.meta.url);
const dataDir = fileURLToPath(new URL('.data/pg', root));

if (process.argv[2] === 'stop') {
  await stopLocalPostgres(dataDir);
  console.log('PostgreSQL stopped.');
} else {
  try {
    process.loadEnvFile(new URL('.env', root));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const env = process.env;
  const database = env.POSTGRES_DB ?? 'arc';
  const server = await startLocalPostgres({
    dataDir,
    port: Number(env.POSTGRES_PORT ?? 5432),
    user: env.POSTGRES_USER ?? 'arc',
    password: env.POSTGRES_PASSWORD ?? 'arc_dev',
    durable: true,
  });

  const admin = new pg.Client({ connectionString: server.url('postgres') });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [
      database,
    ]);
    if (rowCount === 0) await admin.query(`create database "${database.replaceAll('"', '""')}"`);
  } finally {
    await admin.end();
  }
  console.log(`PostgreSQL running at ${server.url(database).replace(/:[^:@/]+@/, ':***@')}`);
  console.log('Stop it with: pnpm db:stop');
}
