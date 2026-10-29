import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { DB, jsonSafe, notFound, recordAudit, validate } from '../platform/index.js';
import type { AuthContext } from '../identity/index.js';

const PAGE_SIZE = 20;

/** Read model for the admin panel: company detail and user directory. Never selects secrets. */
@Injectable()
export class AdminDirectoryService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  async companyDetail(admin: AuthContext, id: string) {
    const c = await this.db
      .selectFrom('companies')
      .select([
        'id',
        'legal_name',
        'tax_no',
        'tax_office',
        'address',
        'status',
        'status_reason',
        'created_at',
      ])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!c) throw notFound('Company not found');

    // Viewing personal data is itself audited; the entry carries identifiers only.
    await recordAudit(this.db, {
      actorType: 'admin',
      actorId: admin.userId,
      companyId: id,
      action: 'admin.company.view',
      entityType: 'company',
      entityId: id,
    });

    const [members, listings, auctions, orders, audit] = await Promise.all([
      this.db
        .selectFrom('company_members as m')
        .innerJoin('users as u', 'u.id', 'm.user_id')
        .select((eb) => [
          'u.id',
          'u.full_name',
          'u.email',
          'm.role',
          'm.created_at as joined_at',
          eb
            .selectFrom('sessions as s')
            .select((e) => e.fn.max('s.created_at').as('t'))
            .whereRef('s.user_id', '=', 'u.id')
            .as('last_login_at'),
        ])
        .where('m.company_id', '=', id)
        .orderBy('m.created_at')
        .execute(),
      this.db
        .selectFrom('listings')
        .select([
          'id',
          'title',
          'status',
          'sale_type',
          'unit_price_minor',
          'currency',
          'created_at',
        ])
        .where('company_id', '=', id)
        .orderBy('created_at', 'desc')
        .limit(200)
        .execute(),
      this.db
        .selectFrom('auctions as a')
        .innerJoin('listings as l', 'l.id', 'a.listing_id')
        .select((eb) => [
          'a.id',
          'a.listing_id',
          'l.title as listing_title',
          'a.status',
          'a.start_price_minor',
          'a.current_price_minor',
          'a.bid_count',
          'a.ends_at',
          'a.deposit_minor',
          eb
            .selectFrom('deposits as d')
            .select(eb.fn.countAll<string>().as('n'))
            .whereRef('d.auction_id', '=', 'a.id')
            .where('d.status', '=', 'held')
            .as('held_deposits'),
        ])
        .where('a.seller_company_id', '=', id)
        .orderBy('a.created_at', 'desc')
        .limit(200)
        .execute(),
      this.db
        .selectFrom('orders as o')
        .innerJoin('companies as b', 'b.id', 'o.buyer_company_id')
        .innerJoin('companies as s', 's.id', 'o.seller_company_id')
        .select([
          'o.id',
          'o.buyer_company_id',
          'o.seller_company_id',
          'b.legal_name as buyer_name',
          's.legal_name as seller_name',
          'o.status',
          'o.total_minor',
          'o.created_at',
        ])
        .where((eb) =>
          eb.or([eb('o.buyer_company_id', '=', id), eb('o.seller_company_id', '=', id)]),
        )
        .orderBy('o.created_at', 'desc')
        .limit(200)
        .execute(),
      this.db
        .selectFrom('audit_log')
        .select(['id', 'occurred_at', 'actor_type', 'action', 'entity_type', 'entity_id', 'reason'])
        .where((eb) =>
          eb.or([
            eb('company_id', '=', id),
            eb.and([eb('entity_type', '=', 'company'), eb('entity_id', '=', id)]),
          ]),
        )
        .orderBy('occurred_at', 'desc')
        .orderBy('id', 'desc')
        .limit(20)
        .execute(),
    ]);

    return jsonSafe({
      company: {
        id: c.id,
        legalName: c.legal_name,
        taxNo: c.tax_no,
        taxOffice: c.tax_office,
        address: c.address,
        status: c.status,
        statusReason: c.status_reason,
        createdAt: c.created_at,
      },
      members: members.map((m) => ({
        id: m.id,
        fullName: m.full_name,
        email: m.email,
        role: m.role,
        joinedAt: m.joined_at,
        lastLoginAt: m.last_login_at,
      })),
      listings: listings.map((l) => ({
        id: l.id,
        title: l.title,
        status: l.status,
        saleType: l.sale_type,
        unitPriceMinor: l.unit_price_minor,
        currency: l.currency,
        createdAt: l.created_at,
      })),
      auctions: auctions.map((a) => ({
        id: a.id,
        listingId: a.listing_id,
        listingTitle: a.listing_title,
        status: a.status,
        startPriceMinor: a.start_price_minor,
        currentPriceMinor: a.current_price_minor,
        bidCount: a.bid_count,
        endsAt: a.ends_at,
        depositMinor: a.deposit_minor,
        heldDeposits: Number(a.held_deposits ?? 0),
      })),
      orders: orders.map((o) => ({
        id: o.id,
        role: o.buyer_company_id === id ? 'buyer' : 'seller',
        counterparty: o.buyer_company_id === id ? o.seller_name : o.buyer_name,
        status: o.status,
        totalMinor: o.total_minor,
        createdAt: o.created_at,
      })),
      audit: audit.map((a) => ({
        id: a.id,
        occurredAt: a.occurred_at,
        actorType: a.actor_type,
        action: a.action,
        entityType: a.entity_type,
        entityId: a.entity_id,
        reason: a.reason,
      })),
    });
  }

  async listUsers(params: { q?: unknown; page?: unknown }) {
    const page = validate.pageParam(params.page);
    const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const base = this.db
      .selectFrom('users as u')
      .$if(q !== '', (qb) =>
        qb.where((eb) =>
          eb.or([eb('u.full_name', 'ilike', pattern), eb('u.email', 'ilike', pattern)]),
        ),
      );
    const total = await base
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    const users = await base
      .select(['u.id', 'u.full_name', 'u.email', 'u.is_platform_admin', 'u.created_at'])
      .orderBy('u.created_at', 'desc')
      .orderBy('u.id')
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute();
    const ids = users.map((u) => u.id);
    const memberships = ids.length
      ? await this.db
          .selectFrom('company_members as m')
          .innerJoin('companies as c', 'c.id', 'm.company_id')
          .select(['m.user_id', 'm.role', 'c.id as company_id', 'c.legal_name', 'c.status'])
          .where('m.user_id', 'in', ids)
          .execute()
      : [];
    return {
      page,
      total: Number(total.n),
      items: users.map((u) => ({
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        isAdmin: u.is_platform_admin,
        createdAt: u.created_at,
        companies: memberships
          .filter((m) => m.user_id === u.id)
          .map((m) => ({
            id: m.company_id,
            legalName: m.legal_name,
            status: m.status,
            role: m.role,
          })),
      })),
    };
  }
}
