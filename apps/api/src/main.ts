import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createDb } from './db/client.js';
import { migrateToLatest } from './db/migrate.js';
import { AppModule } from './app.module.js';
import { loadEnvFileIfExists, parseEnv } from './modules/platform/index.js';

// Local development reads the repo-root .env shared with compose.yaml; deployments inject variables.
if (process.env.NODE_ENV !== 'production') {
  loadEnvFileIfExists(new URL('../../../.env', import.meta.url));
}
const env = parseEnv(process.env);

// Apply pending migrations before serving (Kysely locks, so concurrent boots are safe).
const migrationDb = createDb(env.databaseUrl);
try {
  await migrateToLatest(migrationDb);
} finally {
  await migrationDb.destroy();
}

// No global prefix: the web app rewrites /api/* to this server.
const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
await app.listen(env.port);
