import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import type { CompanyStatus, Database } from '../../../db/schema.js';
import { DB, conflict, invalid, notFound, recordAudit, validate } from '../../platform/index.js';
import type { AuthContext } from './types.js';

export type CompanyAction = 'verify' | 'reject' | 'suspend';

const TRANSITIONS: Record<CompanyAction, { from: readonly CompanyStatus[]; to: CompanyStatus }> = {
  verify: { from: ['pending', 'rejected', 'suspended'], to: 'verified' },
  reject: { from: ['pending'], to: 'rejected' },
  suspend: { from: ['verified'], to: 'suspended' },
};
const STATUSES: readonly CompanyStatus[] = ['pending', 'verified', 'rejected', 'suspended'];

@Injectable()
export class CompanyAdminService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  async list(status: unknown) {
    let q = this.db
      .selectFrom('companies as c')
      .leftJoin('company_members as m', (j) =>
        j.onRef('m.company_id', '=', 'c.id').on('m.role', '=', 'owner'),
      )
      .leftJoin('users as u', 'u.id', 'm.user_id')
      .select([
        'c.id',
        'c.legal_name',
        'c.tax_no',
        'c.tax_office',
        'c.address',
        'c.status',
        'c.status_reason',
        'c.created_at',
        'u.email as owner_email',
        'u.full_name as owner_name',
      ])
      .orderBy('c.created_at', 'desc')
      .limit(200);
    if (typeof status === 'string' && status !== '') {
      if (!(STATUSES as readonly string[]).includes(status)) throw invalid('status is not valid');
      q = q.where('c.status', '=', status as CompanyStatus);
    }
    return (await q.execute()).map((r) => ({
      id: r.id,
      legalName: r.legal_name,
      taxNo: r.tax_no,
      taxOffice: r.tax_office,
      address: r.address,
      status: r.status,
      statusReason: r.status_reason,
      createdAt: r.created_at,
      owner: r.owner_email ? { email: r.owner_email, fullName: r.owner_name } : null,
    }));
  }

  async change(actor: AuthContext, companyId: string, action: CompanyAction, body: unknown) {
    const o = validate.asObject(body ?? {});
    const reason =
      action === 'verify' ? validate.optStr(o, 'reason', 500) : validate.str(o, 'reason', 3, 500);
    const rule = TRANSITIONS[action];
    return this.db.transaction().execute(async (trx) => {
      const company = await trx
        .selectFrom('companies')
        .select(['id', 'status'])
        .where('id', '=', companyId)
        .forUpdate()
        .executeTakeFirst();
      if (!company) throw notFound('Company not found');
      if (!rule.from.includes(company.status)) {
        throw conflict('INVALID_TRANSITION', `Cannot ${action} a ${company.status} company`);
      }
      await trx
        .updateTable('companies')
        .set({ status: rule.to, status_reason: reason ?? null })
        .where('id', '=', companyId)
        .execute();
      await recordAudit(trx, {
        actorType: 'admin',
        actorId: actor.userId,
        companyId,
        action: `company.${rule.to}`,
        entityType: 'company',
        entityId: companyId,
        ...(reason ? { reason } : {}),
        data: { from: company.status, to: rule.to },
      });
      return { id: companyId, status: rule.to };
    });
  }

  async stats() {
    const rows = await this.db
      .selectFrom('companies')
      .select(['status', (eb) => eb.fn.countAll<string>().as('n')])
      .groupBy('status')
      .execute();
    const users = await this.db
      .selectFrom('users')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    return {
      users: Number(users.n),
      companies: Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])),
    };
  }
}
