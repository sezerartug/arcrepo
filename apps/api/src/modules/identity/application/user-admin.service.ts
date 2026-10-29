import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import type { Database } from '../../../db/schema.js';
import { AppError, DB, conflict, notFound, recordAudit, validate } from '../../platform/index.js';
import { AuthService } from './auth.service.js';
import type { AuthContext } from './types.js';

// Platform-admin actions on a single user. Suspension is per user: the company's other members and
// the company's own status are untouched.
@Injectable()
export class UserAdminService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly auth: AuthService,
  ) {}

  async suspend(admin: AuthContext, userId: string, body: unknown) {
    const reason = validate.str(validate.asObject(body ?? {}), 'reason', 3, 500);
    if (userId === admin.userId)
      throw new AppError(400, 'CANNOT_SUSPEND_SELF', 'Kendi hesabınızı askıya alamazsınız.');
    return this.db.transaction().execute(async (trx) => {
      const u = await trx
        .selectFrom('users')
        .select(['id', 'suspended_at'])
        .where('id', '=', userId)
        .forUpdate()
        .executeTakeFirst();
      if (!u) throw notFound('User not found');
      if (u.suspended_at) throw conflict('ALREADY_SUSPENDED', 'Kullanıcı zaten askıda.');
      await trx
        .updateTable('users')
        .set({ suspended_at: sql<Date>`clock_timestamp()`, suspend_reason: reason })
        .where('id', '=', userId)
        .execute();
      const dropped = await trx.deleteFrom('sessions').where('user_id', '=', userId).execute();
      await this.audit(trx, admin, userId, 'admin.user.suspend', reason, {
        sessionsDropped: dropped.reduce((n, r) => n + Number(r.numDeletedRows), 0),
      });
      return { id: userId, suspended: true as const };
    });
  }

  async unsuspend(admin: AuthContext, userId: string, body: unknown) {
    const reason = validate.str(validate.asObject(body ?? {}), 'reason', 3, 500);
    return this.db.transaction().execute(async (trx) => {
      const u = await trx
        .selectFrom('users')
        .select(['id', 'suspended_at'])
        .where('id', '=', userId)
        .forUpdate()
        .executeTakeFirst();
      if (!u) throw notFound('User not found');
      if (!u.suspended_at) throw conflict('NOT_SUSPENDED', 'Kullanıcı askıda değil.');
      await trx
        .updateTable('users')
        .set({ suspended_at: null, suspend_reason: null })
        .where('id', '=', userId)
        .execute();
      await this.audit(trx, admin, userId, 'admin.user.unsuspend', reason, {});
      return { id: userId, suspended: false as const };
    });
  }

  // The link goes to the user's e-mail only; the admin never sees it.
  async sendReset(admin: AuthContext, userId: string) {
    const u = await this.db
      .selectFrom('users')
      .select(['id', 'email'])
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!u) throw notFound('User not found');
    await this.auth.issueReset(u.id, u.email, { actorType: 'admin', actorId: admin.userId });
    return { id: userId, sent: true as const };
  }

  private async audit(
    trx: Kysely<Database>,
    admin: AuthContext,
    userId: string,
    action: string,
    reason: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const m = await trx
      .selectFrom('company_members')
      .select('company_id')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    await recordAudit(trx, {
      actorType: 'admin',
      actorId: admin.userId,
      companyId: m?.company_id,
      action,
      entityType: 'user',
      entityId: userId,
      reason,
      data,
    });
  }
}
