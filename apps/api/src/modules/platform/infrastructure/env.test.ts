import { describe, expect, it } from 'vitest';
import { EnvError, loadEnvFileIfExists, parseEnv } from './env.js';

describe('parseEnv', () => {
  it('applies development defaults', () => {
    expect(parseEnv({})).toEqual({ nodeEnv: 'development', port: 3001 });
  });

  it('accepts explicit values', () => {
    expect(parseEnv({ NODE_ENV: 'production', PORT: '8080' })).toEqual({
      nodeEnv: 'production',
      port: 8080,
    });
  });

  it.each(['', 'abc', '0', '65536', '3e3', '-1'])('rejects PORT=%j', (port) => {
    expect(() => parseEnv({ PORT: port })).toThrow(EnvError);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => parseEnv({ NODE_ENV: 'prod' })).toThrow(/NODE_ENV/);
  });

  it('reports every invalid variable by name without echoing values', () => {
    const run = () => parseEnv({ NODE_ENV: 'leaked-value-1', PORT: 'leaked-value-2' });

    expect(run).toThrow(/NODE_ENV.*PORT/);
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
