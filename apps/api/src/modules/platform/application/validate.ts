import { invalid } from './errors.js';

// Hand-rolled input validation: every reader names the offending field and never echoes values.
export type Obj = Record<string, unknown>;

export function asObject(value: unknown, what = 'body'): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalid(`${what} must be an object`);
  }
  return value as Obj;
}

export function str(o: Obj, key: string, min: number, max: number): string {
  const v = o[key];
  if (typeof v !== 'string') throw invalid(`${key} must be a string`);
  const t = v.trim();
  if (t.length < min || t.length > max) {
    throw invalid(`${key} must be ${String(min)}-${String(max)} characters`);
  }
  return t;
}

export function optStr(o: Obj, key: string, max: number): string | undefined {
  if (o[key] === undefined || o[key] === null) return undefined;
  return str(o, key, 0, max);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function email(o: Obj, key = 'email'): string {
  const v = str(o, key, 3, 254).toLowerCase();
  if (!EMAIL.test(v)) throw invalid(`${key} is not a valid e-mail address`);
  return v;
}

const MAX_MINOR = 10n ** 15n;
// Accepts a digit string (the JSON form of money) or a safe integer.
export function bigintField(o: Obj, key: string, { allowZero = false } = {}): bigint {
  const v = o[key];
  let n: bigint;
  if (typeof v === 'string' && /^\d{1,16}$/.test(v)) n = BigInt(v);
  else if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) n = BigInt(v);
  else throw invalid(`${key} must be a non-negative integer`);
  if ((!allowZero && n === 0n) || n > MAX_MINOR) throw invalid(`${key} is out of range`);
  return n;
}

export function optBigint(o: Obj, key: string): bigint | undefined {
  return o[key] === undefined || o[key] === null ? undefined : bigintField(o, key);
}

export function oneOf<T extends string>(o: Obj, key: string, allowed: readonly T[]): T {
  const v = o[key];
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throw invalid(`${key} must be one of: ${allowed.join(', ')}`);
  }
  return v as T;
}

export function isoDate(o: Obj, key: string): Date {
  const v = o[key];
  const d = typeof v === 'string' ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) throw invalid(`${key} must be an ISO date`);
  return d;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

export function uuidField(o: Obj, key: string): string {
  const v = o[key];
  if (!isUuid(v)) throw invalid(`${key} must be a UUID`);
  return v;
}

export function pageParam(v: unknown): number {
  const n = typeof v === 'string' && /^\d{1,6}$/.test(v) ? Number(v) : 1;
  return Math.max(1, n);
}
