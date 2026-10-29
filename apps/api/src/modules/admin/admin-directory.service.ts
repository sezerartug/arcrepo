import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import type { Database } from '../../db/schema.js';
import type { AuctionStatus } from '../../db/schema.js';
import { dbNow } from '../../db/clock.js';
import { DB, invalid, jsonSafe, notFound, recordAudit, validate } from '../platform/index.js';
import type { AuthContext } from '../identity/index.js';

const PAGE_SIZE = 20;
const AUCTION_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'LIVE',
  'PAYMENT_PENDING',
  'SETTLED',
  'ENDED_NO_SALE',
  'PAYMENT_FAILED',
  'CANCELLED',
] as const;

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
          'u.suspended_at',
          'u.suspend_reason',
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
        suspended: m.suspended_at !== null,
        suspendedAt: m.suspended_at,
        suspendReason: m.suspend_reason,
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
      .select([
        'u.id',
        'u.full_name',
        'u.email',
        'u.is_platform_admin',
        'u.created_at',
        'u.suspended_at',
        'u.suspend_reason',
      ])
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
        suspended: u.suspended_at !== null,
        suspendedAt: u.suspended_at,
        suspendReason: u.suspend_reason,
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

  // Auction monitoring list. Real company names are shown here only (the public API stays anonymous).
  async listAuctions(params: { status?: unknown; q?: unknown; page?: unknown }) {
    const page = validate.pageParam(params.page);
    const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const rawStatus =
      typeof params.status === 'string' && params.status !== '' ? params.status : undefined;
    if (rawStatus !== undefined && !(AUCTION_STATUSES as readonly string[]).includes(rawStatus)) {
      throw invalid('unknown status');
    }
    const status = rawStatus as AuctionStatus | undefined;
    const base = this.db
      .selectFrom('auctions as a')
      .innerJoin('listings as l', 'l.id', 'a.listing_id')
      .innerJoin('companies as s', 's.id', 'a.seller_company_id')
      .$if(status !== undefined, (qb) => qb.where('a.status', '=', status as AuctionStatus))
      .$if(q !== '', (qb) =>
        qb.where((eb) =>
          eb.or([eb('l.title', 'ilike', pattern), eb('s.legal_name', 'ilike', pattern)]),
        ),
      );
    const total = await base
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    const rows = await base
      .select((eb) => [
        'a.id',
        'a.listing_id',
        'l.title',
        's.legal_name as seller_name',
        'a.seller_company_id',
        'a.status',
        'a.start_price_minor',
        'a.current_price_minor',
        'a.bid_count',
        'a.starts_at',
        'a.ends_at',
        'a.deposit_minor',
        eb
          .selectFrom('deposits as d')
          .select((e) => e.fn.coalesce(e.fn.sum<string>('d.amount_minor'), sql<string>`0`).as('t'))
          .whereRef('d.auction_id', '=', 'a.id')
          .where('d.status', '=', 'held')
          .as('held_total'),
      ])
      .orderBy('a.created_at', 'desc')
      .orderBy('a.id')
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute();
    return jsonSafe({
      page,
      total: Number(total.n),
      serverNow: await dbNow(this.db),
      items: rows.map((r) => ({
        id: r.id,
        listingId: r.listing_id,
        title: r.title,
        sellerCompanyId: r.seller_company_id,
        sellerName: r.seller_name,
        status: r.status,
        startPriceMinor: r.start_price_minor,
        currentPriceMinor: r.current_price_minor,
        bidCount: r.bid_count,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        depositMinor: r.deposit_minor,
        heldDepositTotalMinor: r.held_total ?? '0',
      })),
    });
  }

  // Full auction record with real identities. Viewing is audited (identifiers only, no personal data).
  async auctionDetail(admin: AuthContext, id: string, isPoll = false) {
    const a = await this.db
      .selectFrom('auctions as a')
      .innerJoin('listings as l', 'l.id', 'a.listing_id')
      .innerJoin('companies as s', 's.id', 'a.seller_company_id')
      .selectAll('a')
      .select(['l.title', 's.legal_name as seller_name'])
      .where('a.id', '=', id)
      .executeTakeFirst();
    if (!a) throw notFound('Auction not found');
    if (!isPoll) {
      await recordAudit(this.db, {
        actorType: 'admin',
        actorId: admin.userId,
        companyId: a.seller_company_id,
        action: 'admin.auction.view',
        entityType: 'auction',
        entityId: id,
      });
    }
    const [serverNow, bids, attempts, deposits, events, result, order] = await Promise.all([
      dbNow(this.db),
      this.db
        .selectFrom('bids as b')
        .innerJoin('companies as c', 'c.id', 'b.bidder_company_id')
        .innerJoin('users as u', 'u.id', 'b.bidder_user_id')
        .select([
          'b.seq',
          'b.amount_minor',
          'b.accepted_at',
          'b.bidder_company_id',
          'c.legal_name as company_name',
          'u.full_name as user_name',
        ])
        .where('b.auction_id', '=', id)
        .orderBy('b.seq')
        .execute(),
      this.db
        .selectFrom('bid_attempts as t')
        .innerJoin('companies as c', 'c.id', 't.bidder_company_id')
        .innerJoin('users as u', 'u.id', 't.bidder_user_id')
        .select([
          't.id',
          't.amount_minor',
          't.reason_code',
          't.at',
          'c.legal_name as company_name',
          'u.full_name as user_name',
        ])
        .where('t.auction_id', '=', id)
        .orderBy('t.at', 'desc')
        .limit(500)
        .execute(),
      this.db
        .selectFrom('deposits as d')
        .innerJoin('companies as c', 'c.id', 'd.company_id')
        .select([
          'd.id',
          'd.company_id',
          'c.legal_name as company_name',
          'd.amount_minor',
          'd.reference',
          'd.status',
          'd.created_at',
          'd.confirmed_at',
          'd.settled_at',
        ])
        .where('d.auction_id', '=', id)
        .orderBy('d.created_at')
        .execute(),
      this.db
        .selectFrom('auction_events')
        .select(['seq', 'type', 'payload', 'at'])
        .where('auction_id', '=', id)
        .orderBy('seq')
        .orderBy('at')
        .limit(500)
        .execute(),
      this.db
        .selectFrom('auction_results as r')
        .leftJoin('companies as c', 'c.id', 'r.winner_company_id')
        .select([
          'r.outcome',
          'r.winner_company_id',
          'c.legal_name as winner_name',
          'r.final_price_minor',
          'r.total_minor',
          'r.at',
        ])
        .where('r.auction_id', '=', id)
        .executeTakeFirst(),
      this.db
        .selectFrom('orders')
        .select(['id', 'status', 'total_minor'])
        .where('source_auction_id', '=', id)
        .executeTakeFirst(),
    ]);
    const reasonCounts = new Map<string, number>();
    for (const t of attempts)
      reasonCounts.set(t.reason_code, (reasonCounts.get(t.reason_code) ?? 0) + 1);

    return jsonSafe({
      serverNow,
      auction: {
        id: a.id,
        listingId: a.listing_id,
        title: a.title,
        sellerCompanyId: a.seller_company_id,
        sellerName: a.seller_name,
        status: a.status,
        startPriceMinor: a.start_price_minor,
        minIncrementMinor: a.min_increment_minor,
        reserveMinor: a.reserve_minor,
        currentPriceMinor: a.current_price_minor,
        bidCount: a.bid_count,
        depositMinor: a.deposit_minor,
        startsAt: a.starts_at,
        endsAt: a.ends_at,
        originalEndsAt: a.original_ends_at,
        extensionCount: a.extension_count,
        closedAt: a.closed_at,
        cancelReason: a.cancel_reason,
      },
      bids: bids.map((b) => ({
        seq: b.seq,
        amountMinor: b.amount_minor,
        acceptedAt: b.accepted_at,
        companyId: b.bidder_company_id,
        companyName: b.company_name,
        userName: b.user_name,
      })),
      attempts: attempts.map((t) => ({
        id: t.id,
        amountMinor: t.amount_minor,
        reasonCode: t.reason_code,
        at: t.at,
        companyName: t.company_name,
        userName: t.user_name,
      })),
      rejectionSummary: [...reasonCounts].map(([reasonCode, count]) => ({ reasonCode, count })),
      deposits: deposits.map((d) => ({
        id: d.id,
        companyId: d.company_id,
        companyName: d.company_name,
        amountMinor: d.amount_minor,
        reference: d.reference,
        status: d.status,
        createdAt: d.created_at,
        confirmedAt: d.confirmed_at,
        settledAt: d.settled_at,
      })),
      events: events.map((e) => ({ seq: e.seq, type: e.type, payload: e.payload, at: e.at })),
      result: result
        ? {
            outcome: result.outcome,
            winnerCompanyId: result.winner_company_id,
            winnerName: result.winner_name,
            finalPriceMinor: result.final_price_minor,
            totalMinor: result.total_minor,
            at: result.at,
          }
        : null,
      order: order ? { id: order.id, status: order.status, totalMinor: order.total_minor } : null,
    });
  }
}
