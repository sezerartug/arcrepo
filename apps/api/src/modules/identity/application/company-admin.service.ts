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
const PAGE_SIZE = 20;
const STATUSES: readonly CompanyStatus[] = ['pending', 'verified', 'rejected', 'suspended'];

@Injectable()
export class CompanyAdminService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  async list(params: { status?: unknown; q?: unknown; page?: unknown; perPage?: unknown }) {
    const { status } = params;
    const page = validate.pageParam(params.page);
    const perPage = params.perPage === '100' ? 100 : PAGE_SIZE;
    const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    let st: CompanyStatus | undefined;
    if (typeof status === 'string' && status !== '') {
      if (!(STATUSES as readonly string[]).includes(status)) throw invalid('status is not valid');
      st = status as CompanyStatus;
    }
    const base = this.db
      .selectFrom('companies as c')
      .$if(st !== undefined, (qb) => qb.where('c.status', '=', st as CompanyStatus))
      .$if(q !== '', (qb) =>
        qb.where((eb) =>
          eb.or([eb('c.legal_name', 'ilike', pattern), eb('c.tax_no', 'ilike', pattern)]),
        ),
      );
    const total = await base
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    const rows = await base
      .leftJoin('company_members as m', (j) =>
        j.onRef('m.company_id', '=', 'c.id').on('m.role', '=', 'owner'),
      )
      .leftJoin('users as u', 'u.id', 'm.user_id')
      .select((eb) => [
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
        eb
          .selectFrom('listings as l')
          .select(eb.fn.countAll<string>().as('n'))
          .whereRef('l.company_id', '=', 'c.id')
          .as('listing_count'),
        eb
          .selectFrom('company_members as cm')
          .select(eb.fn.countAll<string>().as('n'))
          .whereRef('cm.company_id', '=', 'c.id')
          .as('member_count'),
      ])
      .orderBy('c.created_at', 'desc')
      .orderBy('c.id')
      .limit(perPage)
      .offset((page - 1) * perPage)
      .execute();
    return {
      page,
      total: Number(total.n),
      items: rows.map((r) => ({
        id: r.id,
        legalName: r.legal_name,
        taxNo: r.tax_no,
        taxOffice: r.tax_office,
        address: r.address,
        status: r.status,
        statusReason: r.status_reason,
        createdAt: r.created_at,
        owner: r.owner_email ? { email: r.owner_email, fullName: r.owner_name } : null,
        listingCount: Number(r.listing_count ?? 0),
        memberCount: Number(r.member_count ?? 0),
      })),
    };
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
