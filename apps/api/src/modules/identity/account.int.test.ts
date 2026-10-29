/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-non-null-assertion --
   HTTP test bodies are untyped JSON. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, registerCompany, type Client, type TestApp } from '../../test/app.js';
import { adminClient } from '../../test/auctions.js';

// Account page backend: password change, profile, own sessions, admin pending counts.
let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
}, 120_000);
afterAll(() => t.close());

// A registered user with `extra` additional logins (separate sessions).
async function user(tag: string, extra = 0) {
  const c = t.client();
  const reg = await registerCompany(c, tag);
  const email = reg.user.email;
  const others: Client[] = [];
  for (let i = 0; i < extra; i++) {
    const o = t.client();
    expect((await o.post('/auth/login', { email, password: 'Demo!2345' })).status).toBe(200);
    others.push(o);
  }
  return { c, email, id: reg.user.id, others };
}

describe('POST /me/password', () => {
  it('changes the password, drops other sessions, keeps the current one, audits without secrets', async () => {
    const u = await user('pw', 2);
    const r = await u.c.post('/me/password', {
      currentPassword: 'Demo!2345',
      newPassword: 'Yeni!Parola9',
    });
    expect(r.status).toBe(200);
    expect((await u.c.get('/me')).status).toBe(200);
    for (const o of u.others) expect((await o.get('/me')).status).toBe(401);
    const fresh = t.client();
    expect(
      (await fresh.post('/auth/login', { email: u.email, password: 'Demo!2345' })).status,
    ).toBe(401);
    expect(
      (await fresh.post('/auth/login', { email: u.email, password: 'Yeni!Parola9' })).status,
    ).toBe(200);
    const audit = await t.db
      .selectFrom('audit_log')
      .selectAll()
      .where('action', '=', 'user.password.change')
      .where('entity_id', '=', u.id)
      .execute();
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit[0])).not.toContain('Yeni!Parola9');
  });

  it('rejects a wrong current password (422) without touching sessions, and validates input', async () => {
    const u = await user('pwbad', 1);
    const r = await u.c.post('/me/password', {
      currentPassword: 'Yanlis!123',
      newPassword: 'Yeni!Parola9',
    });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    expect((await u.others[0]!.get('/me')).status).toBe(200);
    const short = await u.c.post('/me/password', {
      currentPassword: 'Demo!2345',
      newPassword: 'kisa',
    });
    expect(short.status).toBe(422);
    expect(short.body.error.code).toBe('VALIDATION_ERROR');
    expect((await t.client().post('/me/password', {})).status).toBe(401);
  });

  it('locks after 5 wrong attempts, even for the right password', async () => {
    const u = await user('pwlock');
    for (let i = 0; i < 5; i++) {
      const r = await u.c.post('/me/password', {
        currentPassword: 'Yanlis!123',
        newPassword: 'Yeni!Parola9',
      });
      expect(r.status).toBe(422);
    }
    const locked = await u.c.post('/me/password', {
      currentPassword: 'Demo!2345',
      newPassword: 'Yeni!Parola9',
    });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('PATCH /me', () => {
  it('updates name and phone, exposes them with createdAt, clears phone, validates', async () => {
    const u = await user('prof');
    const before = await u.c.get('/me');
    expect(before.body.user.phone).toBeNull();
    expect(typeof before.body.user.createdAt).toBe('string');
    const r = await u.c.patch('/me', { fullName: 'Yeni Ad Soyad', phone: '+90 532 111 22 33' });
    expect(r.status).toBe(200);
    expect(r.body.user.fullName).toBe('Yeni Ad Soyad');
    const me = await u.c.get('/me');
    expect(me.body.user.phone).toBe('+90 532 111 22 33');
    expect(me.body.user.fullName).toBe('Yeni Ad Soyad');
    // phone absent = unchanged
    await u.c.patch('/me', { fullName: 'Baska Ad' });
    expect((await u.c.get('/me')).body.user.phone).toBe('+90 532 111 22 33');
    // empty = cleared
    await u.c.patch('/me', { fullName: 'Baska Ad', phone: '' });
    expect((await u.c.get('/me')).body.user.phone).toBeNull();
    for (const bad of [
      { fullName: 'A' },
      { fullName: 'Gecerli Ad', phone: '12ab567' },
      { fullName: 'Gecerli Ad', phone: '123' },
      {},
    ]) {
      expect((await u.c.patch('/me', bad)).status).toBe(422);
    }
    expect((await t.client().patch('/me', { fullName: 'Gecerli Ad' })).status).toBe(401);
    // personal data never reaches the audit trail
    const audit = await t.db
      .selectFrom('audit_log')
      .selectAll()
      .where('action', '=', 'user.profile.update')
      .where('entity_id', '=', u.id)
      .execute();
    expect(audit.length).toBeGreaterThan(0);
    expect(JSON.stringify(audit)).not.toContain('532');
  });
});

describe('sessions', () => {
  it('lists own sessions without token material and marks the current one', async () => {
    const u = await user('sess', 1);
    const r = await u.c.get('/me/sessions');
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(2);
    expect(r.body.items.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
    for (const s of r.body.items as object[]) {
      expect(Object.keys(s).sort()).toEqual(['createdAt', 'current', 'expiresAt', 'id']);
    }
    const text = JSON.stringify(r.body);
    expect(text).not.toContain(u.c.cookie.split('=')[1]!);
    expect(text).not.toContain('token');
    expect((await t.client().get('/me/sessions')).status).toBe(401);
  });

  it("someone else's session is 404 and stays alive; own session can be revoked", async () => {
    const a = await user('sessa', 1);
    const b = await user('sessb');
    const aSessions = (await a.c.get('/me/sessions')).body.items as {
      id: string;
      current: boolean;
    }[];
    const target = aSessions.find((s) => !s.current)!;
    expect((await b.c.del(`/me/sessions/${target.id}`)).status).toBe(404);
    expect((await a.others[0]!.get('/me')).status).toBe(200);
    expect((await b.c.del('/me/sessions/not-a-uuid')).status).toBe(404);
    expect((await a.c.del(`/me/sessions/${target.id}`)).status).toBe(200);
    expect((await a.others[0]!.get('/me')).status).toBe(401);
    expect((await a.c.del(`/me/sessions/${target.id}`)).status).toBe(404);
    expect((await a.c.get('/me')).status).toBe(200);
  });

  it('revoke-others keeps only the current session', async () => {
    const u = await user('revoke', 2);
    const r = await u.c.post('/me/sessions/revoke-others');
    expect(r.status).toBe(200);
    expect(r.body.revoked).toBe(2);
    expect((await u.c.get('/me')).status).toBe(200);
    for (const o of u.others) expect((await o.get('/me')).status).toBe(401);
    expect((await u.c.get('/me/sessions')).body.items).toHaveLength(1);
  });
});

describe('GET /admin/pending-counts', () => {
  it('is admin-only and counts the work queues', async () => {
    const u = await user('pend');
    expect((await u.c.get('/admin/pending-counts')).status).toBe(403);
    expect((await t.client().get('/admin/pending-counts')).status).toBe(401);
    const admin = await adminClient(t);
    const r = await admin.get('/admin/pending-counts');
    expect(r.status).toBe(200);
    expect(Object.keys(r.body as object).sort()).toEqual([
      'companies',
      'disputes',
      'listings',
      'payments',
    ]);
    expect(r.body.companies).toBeGreaterThanOrEqual(1); // the freshly registered, unverified company
    for (const v of Object.values(r.body as object)) expect(typeof v).toBe('number');
  });
});
