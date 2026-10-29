/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/restrict-template-expressions --
   HTTP test bodies are untyped JSON. */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Kysely } from 'kysely';
import { AppModule } from '../app.module.js';
import type { Database } from '../db/schema.js';
import { hashPassword } from '../modules/identity/index.js';
import { DB } from '../modules/platform/index.js';
import { createTestDb } from './db.js';

export interface Reply {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  headers: Headers;
}

// One client = one cookie jar (one browser session).
export class Client {
  cookie = '';
  constructor(private readonly base: string) {}

  async req(
    method: string,
    url: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<Reply> {
    const init: RequestInit = { method, headers: { ...headers } };
    const h = init.headers as Record<string, string>;
    if (this.cookie) h.cookie = this.cookie;
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) {
      h['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${this.base}${url}`, init);
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.startsWith('arc_session=;') ? '' : set.split(';')[0]!;
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body (e.g. images) */
    }
    return { status: res.status, body: parsed, headers: res.headers };
  }
  get = (url: string) => this.req('GET', url);
  post = (url: string, body?: unknown, headers?: Record<string, string>) =>
    this.req('POST', url, body ?? {}, headers);
  patch = (url: string, body?: unknown) => this.req('PATCH', url, body ?? {});
  del = (url: string) => this.req('DELETE', url);
}

export interface TestApp {
  app: INestApplication;
  db: Kysely<Database>;
  mailDir: string;
  client: () => Client;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  process.env.UPLOAD_DIR = await mkdtemp(path.join(tmpdir(), 'arc-uploads-'));
  const mailDir = await mkdtemp(path.join(tmpdir(), 'arc-mail-'));
  process.env.MAIL_DIR = mailDir;
  // Tests register many companies from one IP; the limit itself is tested with its own value.
  process.env.REGISTER_RATE_MAX ??= '100000';
  const db = await createTestDb();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DB)
    .useValue(db)
    .compile();
  const app = moduleRef.createNestApplication();
  await app.listen(0, '127.0.0.1');
  const base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  return {
    app,
    db,
    mailDir,
    client: () => new Client(base),
    close: async () => {
      await app.close();
      await db.destroy();
    },
  };
}

let n = 0;
export const uniqueTaxNo = () =>
  String(1_000_000_000 + ++n * 7919 + Math.floor(Math.random() * 1000));

export async function registerCompany(c: Client, tag: string) {
  const r = await c.post('/auth/register', {
    email: `${tag}-${++n}@example.com`,
    password: 'Demo!2345',
    fullName: `Owner ${tag}`,
    company: {
      legalName: `${tag} Çelik A.Ş.`,
      taxNo: uniqueTaxNo(),
      taxOffice: 'Kadıköy',
      address: 'Organize Sanayi Bölgesi 1. Cadde No:5 İstanbul',
    },
  });
  if (r.status !== 201) throw new Error(`register failed: ${JSON.stringify(r.body)}`);
  return r.body as { user: { id: string; email: string }; company: { id: string } };
}

export async function makeAdmin(db: Kysely<Database>, email = 'admin@arc.local') {
  const hash = await hashPassword('Admin!2345');
  await db
    .insertInto('users')
    .values({ email, password_hash: hash, full_name: 'Platform Admin', is_platform_admin: true })
    .onConflict((oc) => oc.doNothing())
    .execute();
  return email;
}

export async function seedCategory(db: Kysely<Database>, slug = 'test-demir') {
  const parent = await db
    .insertInto('categories')
    .values({
      name: 'Çelik',
      slug: `celik-${slug}`,
      unit: 'ton',
      base_per_unit: 1000,
      parent_id: null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return db
    .insertInto('categories')
    .values({ name: 'İnşaat demiri', slug, unit: 'ton', base_per_unit: 1000, parent_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow()
    .then((r) => ({ parentId: parent.id, id: r.id }));
}

export function listingBody(categoryId: string, over: Record<string, unknown> = {}) {
  return {
    categoryId,
    title: 'B500C Ø12 nervürlü inşaat demiri',
    description: 'Kardemir çıkışlı, TS 708 uygun.',
    attrs: { diameter: 12 },
    saleType: 'fixed',
    unitPriceMinor: '2450000',
    quantityBase: '50000',
    minOrderBase: '1000',
    location: 'Gebze, Kocaeli',
    deliveryTerms: 'Fabrika teslim',
    ...over,
  };
}

let k = 0;
export const idem = () => ({ 'idempotency-key': `test-key-${Date.now()}-${++k}-abcdef` });
