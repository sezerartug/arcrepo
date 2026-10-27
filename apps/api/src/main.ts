import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

// PORT is validated by the config schema once P1-04 lands.
const app = await NestFactory.create(AppModule);
await app.listen(Number(process.env.PORT ?? 3001));
