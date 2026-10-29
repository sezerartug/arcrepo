/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-non-null-assertion, @typescript-eslint/restrict-template-expressions --
   HTTP test bodies are untyped JSON. */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, registerCompany, type Client, type TestApp } from '../../test/app.js';
import { adminClient, verifiedCompany } from '../../test/auctions.js';

// Per-user suspension: sessions die at once, login is blocked, the company's other members carry on.
let t: TestApp;
let admin: Client;
let owner: Awaited<ReturnType<typeof verifiedCompany>>;
let member: Client;
let memberId: string;
const MEMBER_EMAIL = 'suspend-member@example.com';
let memberPassword: string;

beforeAll(async () => {
  t = await createTestApp();
  admin = await adminClient(t);
  owner = await verifiedCompany(t, 'susp');
  const added = await owner.c.post('/company/members', {
    email: MEMBER_EMAIL,
    fullName: 'Uye Kisi',
  });
  expect(added.status).toBe(201);
  memberPassword = added.body.tempPassword;
  member = t.client();
  expect(
    (await member.post('/auth/login', { email: MEMBER_EMAIL, password: memberPassword })).status,
  ).toBe(200);
  memberId = (await member.get('/me')).body.user.id;
}, 120_000);
afterAll(() => t.close());

describe('suspend / unsuspend', () => {
  it('rejects non-admins and bad input', async () => {
    expect(
      (await owner.c.post(`/admin/users/${memberId}/suspend`, { reason: 'deneme nedeni' })).status,
    ).toBe(403);
    expect(
      (await t.client().post(`/admin/users/${memberId}/suspend`, { reason: 'deneme nedeni' }))
        .status,
    ).toBe(401);
    expect((await owner.c.post(`/admin/users/${memberId}/send-reset`)).status).toBe(403);
    expect((await admin.post(`/admin/users/${memberId}/suspend`, {})).status).toBe(422); // reason required
    expect((await admin.post(`/admin/users/${memberId}/suspend`, { reason: 'x' })).status).toBe(
      422,
    );
    expect(
      (await admin.post('/admin/users/not-a-uuid/suspend', { reason: 'neden var' })).status,
    ).toBe(404);
    expect((await member.get('/me')).status).toBe(200); // nothing happened
  });

  it('refuses to suspend yourself', async () => {
    const me = (await admin.get('/me')).body.user.id;
    const r = await admin.post(`/admin/users/${me}/suspend`, { reason: 'kendimi askiya alayim' });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    expect((await admin.get('/me')).status).toBe(200);
  });

  it('drops sessions, blocks login, rejects the old cookie; the owner is unaffected; audited', async () => {
    const oldCookie = member.cookie;
    const second = t.client();
    await second.post('/auth/login', { email: MEMBER_EMAIL, password: memberPassword });
    const r = await admin.post(`/admin/users/${memberId}/suspend`, {
      reason: 'Kural ihlali suphesi',
    });
    expect(r.status).toBe(200);

    const sessions = await t.db
      .selectFrom('sessions')
      .select('id')
      .where('user_id', '=', memberId)
      .execute();
    expect(sessions).toHaveLength(0);
    expect((await member.get('/me')).status).toBe(401);
    expect((await second.get('/me')).status).toBe(401);
    // an old cookie that somehow survived is refused as well
    const replay = t.client();
    replay.cookie = oldCookie;
    expect((await replay.get('/me')).status).toBe(401);

    const login = await t
      .client()
      .post('/auth/login', { email: MEMBER_EMAIL, password: memberPassword });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('USER_SUSPENDED');
    expect(login.body.error.message).toContain('askıya');
    // wrong password stays a plain 401 (no state leak without the password)
    expect(
      (await t.client().post('/auth/login', { email: MEMBER_EMAIL, password: 'Wrong!2345' }))
        .status,
    ).toBe(401);

    expect((await owner.c.get('/me')).status).toBe(200);
    expect(
      (await admin.post(`/admin/users/${memberId}/suspend`, { reason: 'tekrar dene' })).status,
    ).toBe(409);

    const users = (await admin.get('/admin/users?q=suspend-member')).body.items;
    expect(users[0]).toMatchObject({ suspended: true, suspendReason: 'Kural ihlali suphesi' });
    const detail = (await admin.get(`/admin/companies/${owner.companyId}`)).body;
    expect(detail.members.find((m: { id: string }) => m.id === memberId).suspended).toBe(true);
    expect(detail.members.find((m: { id: string }) => m.id === owner.userId).suspended).toBe(false);

    const audit = await t.db
      .selectFrom('audit_log')
      .select(['actor_id', 'reason', 'entity_id', 'company_id'])
      .where('action', '=', 'admin.user.suspend')
      .where('entity_id', '=', memberId)
      .execute();
    expect(audit).toHaveLength(1);
    expect(audit[0]!.reason).toBe('Kural ihlali suphesi');
    expect(audit[0]!.company_id).toBe(owner.companyId);
  });

  it('lets the admin lift it with a reason; login works again', async () => {
    expect((await admin.post(`/admin/users/${memberId}/unsuspend`, {})).status).toBe(422);
    expect(
      (await owner.c.post(`/admin/users/${memberId}/unsuspend`, { reason: 'olmaz bu' })).status,
    ).toBe(403);
    expect(
      (await admin.post(`/admin/users/${memberId}/unsuspend`, { reason: 'Sorun giderildi' }))
        .status,
    ).toBe(200);
    expect(
      (await admin.post(`/admin/users/${memberId}/unsuspend`, { reason: 'Sorun giderildi' }))
        .status,
    ).toBe(409);
    const c = t.client();
    expect(
      (await c.post('/auth/login', { email: MEMBER_EMAIL, password: memberPassword })).status,
    ).toBe(200);
    expect((await c.get('/me')).status).toBe(200);
    const audit = await t.db
      .selectFrom('audit_log')
      .select('reason')
      .where('action', '=', 'admin.user.unsuspend')
      .where('entity_id', '=', memberId)
      .execute();
    expect(audit.map((a) => a.reason)).toEqual(['Sorun giderildi']);
  });

  it('can suspend a company owner without touching the company', async () => {
    const co = await registerCompany(t.client(), 'ownersusp');
    const r = await admin.post(`/admin/users/${co.user.id}/suspend`, {
      reason: 'Sahip askiya alindi',
    });
    expect(r.status).toBe(200);
    const company = await t.db
      .selectFrom('companies')
      .select('status')
      .where('id', '=', co.company.id)
      .executeTakeFirstOrThrow();
    expect(company.status).toBe('pending');
  });
});

describe('send reset link', () => {
  it('mails the link to the user and never returns it', async () => {
    const before = (await readdir(t.mailDir)).length;
    const r = await admin.post(`/admin/users/${memberId}/send-reset`);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain('token');
    const files = (await readdir(t.mailDir)).sort();
    expect(files.length).toBe(before + 1);
    const mail = await readFile(path.join(t.mailDir, files.at(-1)!), 'utf8');
    expect(mail).toContain(MEMBER_EMAIL);
    expect(mail).toContain('/parola-sifirla?token=');
    const audit = await t.db
      .selectFrom('audit_log')
      .select('actor_id')
      .where('action', '=', 'admin.user.send_reset')
      .where('entity_id', '=', memberId)
      .execute();
    expect(audit).toHaveLength(1);
    expect(
      (await admin.post('/admin/users/00000000-0000-4000-8000-000000000000/send-reset')).status,
    ).toBe(404);
  });
});
