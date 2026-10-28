import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { createDb } from '../../db/client.js';
import { DB } from './db.token.js';
import { parseEnv } from './infrastructure/env.js';
import { ErrorFilter } from './http/error.filter.js';
import { HealthController } from './http/health.controller.js';
import { JsonSafeInterceptor } from './http/json-safe.interceptor.js';

// The pool connects lazily; tests replace DB with `overrideProvider(DB)`.
@Global()
@Module({
  controllers: [HealthController],
  providers: [
    { provide: DB, useFactory: () => createDb(parseEnv(process.env).databaseUrl) },
    { provide: APP_FILTER, useClass: ErrorFilter },
    { provide: APP_INTERCEPTOR, useClass: JsonSafeInterceptor },
  ],
  exports: [DB],
})
export class PlatformModule {}
