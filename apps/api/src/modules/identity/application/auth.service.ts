import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { Kysely, sql } from 'kysely';
import type { Database } from '../../../db/schema.js';
import {
  AppError,
  DB,
  HitLimiter,
  LockoutLimiter,
  MAIL_PORT,
  conflict,
  forbidden,
  invalid,
  recordAudit,
  validate,
  type MailPort,
} from '../../platform/index.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  type AuthContext,
  type CompanyAuthContext,
} from './types.js';

export const AUTH_LIMITS = Symbol('AUTH_LIMITS');

export interface AuthLimits {
  readonly login: LockoutLimiter; // 5 failures per e-mail + IP -> 15 min lock
  readonly register: HitLimiter; // per IP
  readonly reset: HitLimiter; // per IP (forgot / reset requests)
}

export function defaultAuthLimits(env: NodeJS.ProcessEnv = process.env): AuthLimits {
  const num = (v: string | undefined, d: number) => (Number(v) > 0 ? Math.floor(Number(v)) : d);
  return {
    login: new LockoutLimiter(5, 15 * 60_000),
    register: new HitLimiter(num(env.REGISTER_RATE_MAX, 20), 60 * 60_000),
    reset: new HitLimiter(num(env.RESET_RATE_MAX, 10), 60 * 60_000),
  };
}

const RESET_TTL_HOURS = 1;
const rateLimited = (ms: number) =>
  new AppError(429, 'RATE_LIMITED', 'Too many attempts, try again later', {
    retryAfterSeconds: Math.max(1, Math.ceil(ms / 1000)),
  });

export const clientIp = (req: Request): string => req.ip ?? req.socket.remoteAddress ?? 'unknown';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function uniqueViolation(e: unknown): string | undefined {
  const err = e as { code?: string; constraint?: string };
  return err.code === '23505' ? (err.constraint ?? '') : undefined;
}

export function parseCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

@Injectable()
export class AuthService {
  // Verified against when the e-mail is unknown, so response time does not reveal which e-mails exist.
  private dummyHash?: Promise<string>;

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    @Inject(AUTH_LIMITS) private readonly limits: AuthLimits,
    @Inject(MAIL_PORT) private readonly mail: MailPort,
  ) {}

  private async newSession(trx: Kysely<Database>, userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await trx
      .insertInto('sessions')
      .values({
        user_id: userId,
        token_hash: sha256(token),
        expires_at: sql<Date>`clock_timestamp() + ${sql.lit(SESSION_DAYS)} * interval '1 day'`,
      })
      .execute();
    return token;
  }

  async register(
    input: unknown,
    ip: string,
  ): Promise<{ token: string; user: object; company: object }> {
    if (!this.limits.register.allow(ip)) throw rateLimited(60 * 60_000);
    const o = validate.asObject(input);
    const email = validate.email(o);
    const password = validate.str(o, 'password', 8, 128);
    const fullName = validate.str(o, 'fullName', 2, 120);
    const c = validate.asObject(o.company, 'company');
    const legalName = validate.str(c, 'legalName', 2, 200);
    const taxNo = validate.str(c, 'taxNo', 10, 10);
    if (!/^\d{10}$/.test(taxNo)) throw invalid('taxNo must be 10 digits');
    const taxOffice = validate.str(c, 'taxOffice', 2, 120);
    const address = validate.str(c, 'address', 5, 500);
    const passwordHash = await hashPassword(password);

    try {
      return await this.db.transaction().execute(async (trx) => {
        const company = await trx
          .insertInto('companies')
          .values({
            legal_name: legalName,
            tax_no: taxNo,
            tax_office: taxOffice,
            address,
            status_reason: null,
          })
          .returning(['id', 'legal_name', 'status'])
          .executeTakeFirstOrThrow();
        const user = await trx
          .insertInto('users')
          .values({ email, password_hash: passwordHash, full_name: fullName })
          .returning(['id', 'email', 'full_name'])
          .executeTakeFirstOrThrow();
        await trx
          .insertInto('company_members')
          .values({ company_id: company.id, user_id: user.id, role: 'owner' })
          .execute();
        await recordAudit(trx, {
          actorType: 'user',
          actorId: user.id,
          companyId: company.id,
          action: 'company.registered',
          entityType: 'company',
          entityId: company.id,
        });
        const token = await this.newSession(trx, user.id);
        return {
          token,
          user: { id: user.id, email: user.email, fullName: user.full_name, isAdmin: false },
          company: { id: company.id, legalName: company.legal_name, status: company.status },
        };
      });
    } catch (e) {
      const constraint = uniqueViolation(e);
      if (constraint === 'users_email_key') {
        throw conflict('EMAIL_TAKEN', 'E-mail is already registered');
      }
      if (constraint === 'companies_tax_no_key') {
        throw conflict('TAX_NO_TAKEN', 'Tax number is already registered');
      }
      throw e;
    }
  }

  async login(input: unknown, ip: string): Promise<{ token: string; me: object }> {
    const o = validate.asObject(input);
    const email = validate.email(o);
    const password = validate.str(o, 'password', 1, 128);
    const key = `${email}|${ip}`;
    const locked = this.limits.login.lockedForMs(key);
    if (locked > 0) throw rateLimited(locked);
    const user = await this.db
      .selectFrom('users')
      .select(['id', 'password_hash'])
      .where('email', '=', email)
      .executeTakeFirst();
    this.dummyHash ??= hashPassword('dummy-password-for-timing');
    const ok = await verifyPassword(password, user?.password_hash ?? (await this.dummyHash));
    if (!user || !ok) {
      this.limits.login.fail(key);
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid e-mail or password');
    }
    this.limits.login.reset(key);
    const token = await this.newSession(this.db, user.id);
    const ctx = await this.byToken(token);
    if (!ctx) throw new AppError(500, 'INTERNAL', 'Session could not be created');
    return { token, me: this.toMe(ctx) };
  }

  // Always succeeds from the caller's view (no account enumeration). The link goes out via MailPort.
  async forgotPassword(input: unknown, ip: string): Promise<void> {
    const o = validate.asObject(input);
    const email = validate.email(o);
    if (!this.limits.reset.allow(ip)) throw rateLimited(60 * 60_000);
    const user = await this.db
      .selectFrom('users')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirst();
    if (!user) return;
    const token = randomBytes(32).toString('base64url');
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('password_resets')
        .values({
          user_id: user.id,
          token_hash: sha256(token),
          expires_at: sql<Date>`clock_timestamp() + ${sql.lit(RESET_TTL_HOURS)} * interval '1 hour'`,
        })
        .execute();
      await recordAudit(trx, {
        actorType: 'user',
        actorId: user.id,
        action: 'user.password_reset_requested',
        entityType: 'user',
        entityId: user.id,
      });
    });
    const base = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
    await this.mail.send({
      to: email,
      subject: 'ARC Global parola sıfırlama',
      text: `Parolanızı sıfırlamak için bağlantıyı açın (1 saat geçerli, tek kullanımlık):\n${base}/parola-sifirla?token=${token}`,
    });
  }

  // Single use: the guarded UPDATE claims the token atomically. Every session of the user is dropped.
  async resetPassword(input: unknown, ip: string): Promise<void> {
    const o = validate.asObject(input);
    const token = validate.str(o, 'token', 20, 200);
    const password = validate.str(o, 'password', 8, 128);
    if (!this.limits.reset.allow(ip)) throw rateLimited(60 * 60_000);
    const passwordHash = await hashPassword(password);
    await this.db.transaction().execute(async (trx) => {
      const claimed = await trx
        .updateTable('password_resets')
        .set({ used_at: sql<Date>`clock_timestamp()` })
        .where('token_hash', '=', sha256(token))
        .where('used_at', 'is', null)
        .where('expires_at', '>', sql<Date>`clock_timestamp()`)
        .returning('user_id')
        .executeTakeFirst();
      if (!claimed) {
        throw new AppError(400, 'INVALID_RESET_TOKEN', 'Reset link is invalid or expired');
      }
      // Other outstanding links of this user die with it.
      await trx
        .updateTable('password_resets')
        .set({ used_at: sql<Date>`clock_timestamp()` })
        .where('user_id', '=', claimed.user_id)
        .where('used_at', 'is', null)
        .execute();
      await trx
        .updateTable('users')
        .set({ password_hash: passwordHash })
        .where('id', '=', claimed.user_id)
        .execute();
      await trx.deleteFrom('sessions').where('user_id', '=', claimed.user_id).execute();
      await recordAudit(trx, {
        actorType: 'user',
        actorId: claimed.user_id,
        action: 'user.password_reset',
        entityType: 'user',
        entityId: claimed.user_id,
      });
    });
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.db.deleteFrom('sessions').where('token_hash', '=', sha256(token)).execute();
  }

  private async byToken(token: string): Promise<AuthContext | null> {
    const r = await this.db
      .selectFrom('sessions as s')
      .innerJoin('users as u', 'u.id', 's.user_id')
      .leftJoin('company_members as m', 'm.user_id', 'u.id')
      .leftJoin('companies as c', 'c.id', 'm.company_id')
      .select([
        'u.id as user_id',
        'u.email',
        'u.full_name',
        'u.is_platform_admin',
        'c.id as company_id',
        'c.legal_name',
        'c.status',
        'm.role',
      ])
      .where('s.token_hash', '=', sha256(token))
      .where('s.expires_at', '>', sql<Date>`clock_timestamp()`)
      .executeTakeFirst();
    if (!r) return null;
    return {
      userId: r.user_id,
      email: r.email,
      fullName: r.full_name,
      isAdmin: r.is_platform_admin,
      company:
        r.company_id && r.legal_name && r.status && r.role
          ? { id: r.company_id, legalName: r.legal_name, status: r.status, memberRole: r.role }
          : null,
    };
  }

  async authenticate(cookieHeader: string | undefined): Promise<AuthContext | null> {
    const token = parseCookie(cookieHeader, SESSION_COOKIE);
    return token ? this.byToken(token) : null;
  }

  toMe(ctx: AuthContext) {
    return {
      user: { id: ctx.userId, email: ctx.email, fullName: ctx.fullName, isAdmin: ctx.isAdmin },
      company: ctx.company
        ? {
            id: ctx.company.id,
            legalName: ctx.company.legalName,
            status: ctx.company.status,
            memberRole: ctx.company.memberRole,
          }
        : null,
    };
  }

  async addMember(
    ctx: CompanyAuthContext,
    input: unknown,
  ): Promise<{ email: string; tempPassword: string }> {
    if (ctx.company.memberRole !== 'owner') {
      throw forbidden('NOT_COMPANY_OWNER', 'Only the company owner can add members');
    }
    const o = validate.asObject(input);
    const email = validate.email(o);
    const fullName = validate.str(o, 'fullName', 2, 120);
    const tempPassword = randomBytes(9).toString('base64url');
    const passwordHash = await hashPassword(tempPassword);
    const companyId = ctx.company.id;
    try {
      await this.db.transaction().execute(async (trx) => {
        const user = await trx
          .insertInto('users')
          .values({ email, password_hash: passwordHash, full_name: fullName })
          .returning('id')
          .executeTakeFirstOrThrow();
        await trx
          .insertInto('company_members')
          .values({ company_id: companyId, user_id: user.id, role: 'member' })
          .execute();
        await recordAudit(trx, {
          actorType: 'user',
          actorId: ctx.userId,
          companyId,
          action: 'company.member_added',
          entityType: 'user',
          entityId: user.id,
        });
      });
    } catch (e) {
      if (uniqueViolation(e) === 'users_email_key') {
        throw conflict('EMAIL_TAKEN', 'E-mail is already registered');
      }
      throw e;
    }
    return { email, tempPassword };
  }

  async listMembers(ctx: CompanyAuthContext) {
    const rows = await this.db
      .selectFrom('company_members as m')
      .innerJoin('users as u', 'u.id', 'm.user_id')
      .select(['u.id', 'u.email', 'u.full_name', 'm.role'])
      .where('m.company_id', '=', ctx.company.id)
      .orderBy('m.created_at')
      .execute();
    return rows.map((r) => ({ id: r.id, email: r.email, fullName: r.full_name, role: r.role }));
  }
}
