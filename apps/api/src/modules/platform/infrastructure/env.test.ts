import { describe, expect, it } from 'vitest';
import { EnvError, loadEnvFileIfExists, parseEnv } from './env.js';

describe('parseEnv', () => {
  it('applies development defaults', () => {
    expect(parseEnv({})).toEqual({
      nodeEnv: 'development',
      port: 3001,
      databaseUrl: 'postgres://arc:arc_dev@127.0.0.1:5432/arc',
    });
  });

  it('accepts explicit values', () => {
    const databaseUrl = 'postgresql://app:pw@db.internal:5432/arc';
    expect(parseEnv({ NODE_ENV: 'production', PORT: '8080', DATABASE_URL: databaseUrl })).toEqual({
      nodeEnv: 'production',
      port: 8080,
      databaseUrl,
    });
  });

  it.each(['', 'abc', '0', '65536', '3e3', '-1'])('rejects PORT=%j', (port) => {
    expect(() => parseEnv({ PORT: port })).toThrow(EnvError);
  });

  it('requires DATABASE_URL in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL is required/);
  });

  it.each(['not a url', 'mysql://u:p@h/db'])('rejects DATABASE_URL=%j', (url) => {
    expect(() => parseEnv({ DATABASE_URL: url })).toThrow(/DATABASE_URL must be a postgres/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => parseEnv({ NODE_ENV: 'prod' })).toThrow(/NODE_ENV/);
  });

  it('reports every invalid variable by name without echoing values', () => {
    const run = () =>
      parseEnv({ NODE_ENV: 'leaked-value-1', PORT: 'leaked-value-2', DATABASE_URL: 'leaked-value-3' });

    expect(run).toThrow(/NODE_ENV.*PORT.*DATABASE_URL/);
    expect(run).not.toThrow(/leaked-value/);
  });
});

describe('loadEnvFileIfExists', () => {
  it('ignores a missing file', () => {
    expect(() => {
      loadEnvFileIfExists(new URL('./does-not-exist.env', import.meta.url));
    }).not.toThrow();
  });
});
