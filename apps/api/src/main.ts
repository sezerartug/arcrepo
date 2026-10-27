import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnvFileIfExists, parseEnv } from './modules/platform/index.js';

// Local development reads the repo-root .env shared with compose.yaml; deployments inject variables.
if (process.env.NODE_ENV !== 'production') {
  loadEnvFileIfExists(new URL('../../../.env', import.meta.url));
}
const env = parseEnv(process.env);

const app = await NestFactory.create(AppModule);
await app.listen(env.port);
