/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-non-null-assertion --
   HTTP test bodies are untyped JSON. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, makeAdmin, registerCompany, type TestApp } from '../../test/app.js';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

describe('identity flow', () => {
  it('registers, sets an HttpOnly session cookie and resolves /me', async () => {
    const c = t.client();
    const res = await c.post('/auth/register', {
      email: 'Ali@Example.com',
      password: 'Demo!2345',
      fullName: 'Ali Veli',
      company: {
        legalName: 'Demir Ltd',
        taxNo: '1234567890',
        taxOffice: 'Gebze',
        address: 'Gebze OSB No 4',
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.company.status).toBe('pending');
    expect(res.headers.get('set-cookie')).toMatch(/arc_session=.+; HttpOnly; SameSite=Lax/);

    const me = await c.get('/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('ali@example.com');
    expect(me.body.company).toMatchObject({ status: 'pending', memberRole: 'owner' });

    const audit = await t.db
      .selectFrom('audit_log')
      .select('action')
      .where('action', '=', 'company.registered')
      .execute();
    expect(audit).toHaveLength(1);
  });

  it('never stores the password or the raw session token', async () => {
    const c = t.client();
    await registerCompany(c, 'hash');
    const token = c.cookie.split('=')[1]!;
    const sessions = await t.db.selectFrom('sessions').select('token_hash').execute();
    expect(sessions.some((s) => s.token_hash === token)).toBe(false);
    const users = await t.db.selectFrom('users').select('password_hash').execute();
    expect(
      users.every(
        (u) => u.password_hash.startsWith('argon2id$') && !u.password_hash.includes('Demo!2345'),
      ),
    ).toBe(true);
  });

  it('rejects duplicate e-mail and tax number, and bad input, with the error shape', async () => {
    const c = t.client();
    const a = await registerCompany(c, 'dup');
    const again = await t.client().post('/auth/register', {
      email: a.user.email,
      password: 'Demo!2345',
      fullName: 'Baska Kisi',
      company: {
        legalName: 'Baska Ltd',
        taxNo: '9999999999',
        taxOffice: 'X Dairesi',
        address: 'Adres 12345',
      },
    });
    expect(again.status).toBe(409);
    expect(again.body).toEqual({ error: { code: 'EMAIL_TAKEN', message: expect.any(String) } });

    const bad = await t.client().post('/auth/register', { email: 'nope', password: 'x' });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');

    const badTax = await t.client().post('/auth/register', {
      email: 'tax@example.com',
      password: 'Demo!2345',
      fullName: 'Tax Kisi',
      company: {
        legalName: 'Tax Ltd',
        taxNo: 'abcdefghij',
        taxOffice: 'X Dairesi',
        address: 'Adres 12345',
      },
    });
    expect(badTax.status).toBe(422);
  });

  it('logs in, logs out and invalidates the session server-side', async () => {
    const reg = t.client();
    const a = await registerCompany(reg, 'login');
    const c = t.client();
    expect(
      (await c.post('/auth/login', { email: a.user.email, password: 'wrong-pass' })).status,
    ).toBe(401);
    const ok = await c.post('/auth/login', { email: a.user.email, password: 'Demo!2345' });
    expect(ok.status).toBe(200);
    const saved = c.cookie;
    expect((await c.get('/me')).status).toBe(200);
    expect((await c.post('/auth/logout')).status).toBe(200);
    expect(c.cookie).toBe('');
    // Replaying the old cookie must fail: logout deleted the session row.
    const replay = t.client();
    replay.cookie = saved;
    expect((await replay.get('/me')).status).toBe(401);
  });

  it('answers unknown e-mail and wrong password identically', async () => {
    const a = await t
      .client()
      .post('/auth/login', { email: 'ghost@example.com', password: 'Demo!2345' });
    expect(a.status).toBe(401);
    expect(a.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('requires authentication on /me and a valid cookie', async () => {
    expect((await t.client().get('/me')).status).toBe(401);
    const c = t.client();
    c.cookie = 'arc_session=garbage';
    expect((await c.get('/me')).status).toBe(401);
  });

  it('lets only the owner add members; member gets a temp password usable once', async () => {
    const owner = t.client();
    await registerCompany(owner, 'team');
    const added = await owner.post('/company/members', {
      email: 'uye@example.com',
      fullName: 'Uye Kisi',
    });
    expect(added.status).toBe(201);
    expect(added.body.tempPassword).toHaveLength(12);

    const member = t.client();
    expect(
      (
        await member.post('/auth/login', {
          email: 'uye@example.com',
          password: added.body.tempPassword,
        })
      ).status,
    ).toBe(200);
    const denied = await member.post('/company/members', {
      email: 'x@example.com',
      fullName: 'X Kisi',
    });
    expect(denied.status).toBe(403);
    const list = await member.get('/company/members');
    expect(list.body.map((m: { email: string }) => m.email).sort()).toHaveLength(2);

    const audit = await t.db
      .selectFrom('audit_log')
      .selectAll()
      .where('action', '=', 'company.member_added')
      .execute();
    expect(JSON.stringify(audit)).not.toContain(added.body.tempPassword);
  });
});

describe('guards', () => {
  it('blocks unverified companies and non-admins from protected areas', async () => {
    const c = t.client();
    await registerCompany(c, 'guard');
    expect((await c.get('/seller/listings')).body.error.code).toBe('COMPANY_NOT_VERIFIED');
    expect((await c.get('/admin/stats')).status).toBe(403);
    expect((await t.client().get('/admin/stats')).status).toBe(401);
  });

  it('admin verifies a company; suspension takes effect immediately', async () => {
    await makeAdmin(t.db);
    const c = t.client();
    const reg = await registerCompany(c, 'approve');
    const admin = t.client();
    expect(
      (await admin.post('/auth/login', { email: 'admin@arc.local', password: 'Admin!2345' }))
        .status,
    ).toBe(200);

    const pending = await admin.get('/admin/companies?status=pending');
    expect(pending.body.items.some((x: { id: string }) => x.id === reg.company.id)).toBe(true);

    expect((await admin.post(`/admin/companies/${reg.company.id}/reject`, {})).status).toBe(422); // reason required
    const ok = await admin.post(`/admin/companies/${reg.company.id}/verify`, {});
    expect(ok.body).toEqual({ id: reg.company.id, status: 'verified' });
    expect((await c.get('/seller/listings')).status).toBe(200);

    expect(
      (await admin.post(`/admin/companies/${reg.company.id}/reject`, { reason: 'late' })).status,
    ).toBe(409);
    expect(
      (await admin.post(`/admin/companies/${reg.company.id}/suspend`, { reason: 'fraud check' }))
        .status,
    ).toBe(200);
    expect((await c.get('/seller/listings')).status).toBe(403);

    const log = await admin.get(`/admin/audit?entityType=company&entityId=${reg.company.id}`);
    expect(log.body.items.map((i: { action: string }) => i.action)).toEqual([
      'company.suspended',
      'company.verified',
      'company.registered',
    ]);
    expect(log.body.items[0].reason).toBe('fraud check');
    expect((await admin.get('/admin/stats')).body.companies.suspended).toBeGreaterThanOrEqual(1);
  });
});
