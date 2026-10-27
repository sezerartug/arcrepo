import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';

describe('AppModule', () => {
  it('boots an HTTP application and shuts it down', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();

    await app.init();
    expect(app.getHttpAdapter().getType()).toBe('express');
    await app.close();
  });
});
