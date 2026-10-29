import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql, type Transaction } from 'kysely';
import type { Database, ListingCondition, ListingStatus, SaleType } from '../../../db/schema.js';
import type { AuthContext, CompanyAuthContext } from '../../identity/index.js';
import {
  AppError,
  DB,
  conflict,
  forbidden,
  invalid,
  notFound,
  recordAudit,
  validate,
  withIdempotency,
} from '../../platform/index.js';
import { MAX_IMAGE_BYTES, MIME_BY_EXT, detectImage } from './images.js';
import { LISTING_STATUSES, canTransition } from './listing-status.js';

export interface ApprovedListing {
  readonly id: string;
  readonly companyId: string;
  readonly quantityBase: bigint;
  readonly basePerUnit: number;
  readonly auctionDraft: Record<string, string> | null;
}
export type OnListingApproved = (trx: Kysely<Database>, listing: ApprovedListing) => Promise<void>;

const PAGE_SIZE = 20;
const MAX_IMAGES = 8;
const SORTS = ['newest', 'price_asc', 'price_desc', 'ending'] as const;
const CONDITIONS = ['yeni', 'ikinci_el', 'hurda'] as const satisfies readonly ListingCondition[];

const listingSelect = (db: Kysely<Database>) =>
  db
    .selectFrom('listings as l')
    .innerJoin('companies as c', 'c.id', 'l.company_id')
    .innerJoin('categories as k', 'k.id', 'l.category_id')
    .selectAll('l')
    .select([
      'c.legal_name',
      'c.status as company_status',
      'k.unit',
      'k.base_per_unit',
      'k.name as category_name',
    ]);
type Row = Awaited<ReturnType<ReturnType<typeof listingSelect>['executeTakeFirstOrThrow']>>;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

type Actor = AuthContext | null | undefined;

// Create validates every required field up front; this narrows the optional parse result.
function need<T>(v: T | undefined): T {
  if (v === undefined) throw invalid('required field missing');
  return v;
}

@Injectable()
export class CatalogService {
  private readonly uploadDir =
    process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), '../../.data/uploads');

  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  // ---- categories -------------------------------------------------------------------------------

  async categories() {
    const rows = await this.db
      .selectFrom('categories')
      .selectAll()
      .orderBy('sort_order')
      .orderBy('name')
      .execute();
    type Node = {
      id: string;
      name: string;
      slug: string;
      unit: string;
      basePerUnit: number;
      children: Node[];
    };
    const nodes = new Map<string, Node>(
      rows.map((r) => [
        r.id,
        {
          id: r.id,
          name: r.name,
          slug: r.slug,
          unit: r.unit,
          basePerUnit: r.base_per_unit,
          children: [],
        },
      ]),
    );
    const roots: Node[] = [];
    for (const r of rows) {
      const node = nodes.get(r.id);
      if (!node) continue;
      const parent = r.parent_id ? nodes.get(r.parent_id) : undefined;
      (parent ? parent.children : roots).push(node);
    }
    return roots;
  }

  // ---- DTO ----------------------------------------------------------------------------------------

  private canSeeAll(a: Actor, companyId: string): boolean {
    return !!a && (a.isAdmin || a.company?.id === companyId);
  }

  private async toDtos(rows: Row[], actor: Actor) {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const images = await this.db
      .selectFrom('listing_images')
      .select(['id', 'listing_id', 'file_name'])
      .where('listing_id', 'in', ids)
      .orderBy('position')
      .orderBy('id')
      .execute();
    const favs = actor
      ? new Set(
          (
            await this.db
              .selectFrom('favorites')
              .select('listing_id')
              .where('user_id', '=', actor.userId)
              .where('listing_id', 'in', ids)
              .execute()
          ).map((f) => f.listing_id),
        )
      : new Set<string>();
    return rows.map((r) => {
      const priv = this.canSeeAll(actor, r.company_id);
      const publicDraft: Record<string, string> = { ...r.auction_draft };
      delete publicDraft.reserveMinor;
      return {
        id: r.id,
        companyId: r.company_id,
        sellerName: r.legal_name,
        categoryId: r.category_id,
        categoryName: r.category_name,
        unit: r.unit,
        basePerUnit: r.base_per_unit,
        title: r.title,
        description: r.description,
        attrs: r.attrs,
        saleType: r.sale_type,
        condition: r.condition,
        currency: r.currency,
        unitPriceMinor: r.unit_price_minor,
        quantityBase: r.quantity_base,
        minOrderBase: r.min_order_base,
        location: r.location,
        deliveryTerms: r.delivery_terms,
        status: r.status,
        ...(priv ? { reviewReason: r.review_reason } : {}),
        auction: r.auction_draft ? (priv ? r.auction_draft : publicDraft) : null,
        images: images
          .filter((i) => i.listing_id === r.id)
          .map((i) => ({ id: i.id, url: `/uploads/${i.file_name}` })),
        isFavorite: favs.has(r.id),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  private async toDto(row: Row, actor: Actor) {
    const [dto] = await this.toDtos([row], actor);
    if (!dto) throw notFound('Listing not found');
    return dto;
  }

  private async loadOrThrow(db: Kysely<Database>, id: string): Promise<Row> {
    const row = await this.loadRow(db, id);
    if (!row) throw notFound('Listing not found');
    return row;
  }

  private async loadRow(db: Kysely<Database>, id: string): Promise<Row | undefined> {
    return listingSelect(db).where('l.id', '=', id).executeTakeFirst();
  }

  // ---- reads ----------------------------------------------------------------------------------------

  async search(actor: Actor, query: Record<string, unknown>) {
    const page = validate.pageParam(query.page);
    let q = listingSelect(this.db)
      .select(sql<string>`count(*) over()`.as('total'))
      .where('l.status', '=', 'published')
      .where('c.status', '=', 'verified');

    const text = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
    if (text) {
      q = q.where(
        sql<boolean>`(
          l.search @@ plainto_tsquery('turkish', arc_fold(${text}))
          or l.search @@ plainto_tsquery('simple', arc_fold(${text}))
          or arc_fold(l.title) like '%' || arc_fold(${escapeLike(text)}) || '%'
        )`,
      );
    }
    if (typeof query.categoryId === 'string' && query.categoryId !== '') {
      if (!validate.isUuid(query.categoryId)) throw invalid('categoryId must be a UUID');
      const cat = query.categoryId;
      // A parent category also matches listings in any descendant (the tree is up to 3 levels deep).
      q = q.where(
        sql<boolean>`l.category_id in (
          with recursive sub as (
            select id from categories where id = ${cat}
            union all
            select c2.id from categories c2 join sub on c2.parent_id = sub.id
          ) select id from sub)`,
      );
    }
    if (query.condition !== undefined && query.condition !== '') {
      q = q.where('l.condition', '=', validate.oneOf(query, 'condition', CONDITIONS));
    }
    if (query.saleType !== undefined && query.saleType !== '') {
      const saleType = validate.oneOf(query, 'saleType', ['fixed', 'auction'] as const);
      q = q.where('l.sale_type', '=', saleType);
    }
    for (const [key, op] of [
      ['minPrice', '>='],
      ['maxPrice', '<='],
    ] as const) {
      if (query[key] !== undefined && query[key] !== '') {
        q = q.where(
          'l.unit_price_minor',
          op,
          validate.bigintField(query, key, { allowZero: true }),
        );
      }
    }
    if (typeof query.location === 'string' && query.location.trim() !== '') {
      q = q.where(
        sql<boolean>`arc_fold(l.location) like '%' || arc_fold(${escapeLike(query.location.trim())}) || '%'`,
      );
    }
    const sort =
      query.sort === undefined || query.sort === ''
        ? 'newest'
        : validate.oneOf(query, 'sort', SORTS);
    if (sort === 'price_asc') q = q.orderBy('l.unit_price_minor', 'asc');
    else if (sort === 'price_desc') q = q.orderBy('l.unit_price_minor', 'desc');
    else if (sort === 'ending')
      q = q.orderBy(sql`(l.auction_draft->>'endsAt')::timestamptz`, (ob) => ob.asc().nullsLast());
    q = q.orderBy('l.created_at', 'desc').orderBy('l.id', 'desc');

    const rows = await q
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute();
    return {
      items: await this.toDtos(rows, actor),
      total: rows[0] ? Number(rows[0].total) : 0,
      page,
    };
  }

  async get(actor: Actor, id: string) {
    const row = await this.loadRow(this.db, id);
    const visible =
      row &&
      ((row.status === 'published' && row.company_status === 'verified') ||
        this.canSeeAll(actor, row.company_id));
    if (!row || !visible) throw notFound('Listing not found');
    return this.toDto(row, actor);
  }

  async sellerListings(actor: CompanyAuthContext, query: Record<string, unknown>) {
    const page = validate.pageParam(query.page);
    const rows = await listingSelect(this.db)
      .where('l.company_id', '=', actor.company.id)
      .orderBy('l.created_at', 'desc')
      .orderBy('l.id', 'desc')
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute();
    return { items: await this.toDtos(rows, actor), page };
  }

  // ---- writes ---------------------------------------------------------------------------------------

  private parseCommon(o: validate.Obj, partial: boolean) {
    const out: {
      categoryId?: string;
      condition?: ListingCondition;
      title?: string;
      description?: string;
      attrs?: Record<string, unknown>;
      unitPriceMinor?: bigint;
      quantityBase?: bigint;
      minOrderBase?: bigint;
      location?: string;
      deliveryTerms?: string;
    } = {};
    const has = (k: string) => o[k] !== undefined;
    if (!partial || has('categoryId')) out.categoryId = validate.uuidField(o, 'categoryId');
    if (has('condition')) out.condition = validate.oneOf(o, 'condition', CONDITIONS);
    if (!partial || has('title')) out.title = validate.str(o, 'title', 5, 140);
    if (has('description')) out.description = validate.str(o, 'description', 0, 4000);
    else if (!partial) out.description = '';
    if (has('attrs')) {
      const attrs = validate.asObject(o.attrs, 'attrs');
      if (JSON.stringify(attrs).length > 4000) throw invalid('attrs is too large');
      out.attrs = attrs;
    }
    if (!partial || has('unitPriceMinor'))
      out.unitPriceMinor = validate.bigintField(o, 'unitPriceMinor');
    if (!partial || has('quantityBase')) out.quantityBase = validate.bigintField(o, 'quantityBase');
    if (has('minOrderBase')) out.minOrderBase = validate.bigintField(o, 'minOrderBase');
    if (!partial || has('location')) out.location = validate.str(o, 'location', 2, 100);
    if (has('deliveryTerms')) out.deliveryTerms = validate.str(o, 'deliveryTerms', 0, 500);
    return out;
  }

  createIdempotent(actor: CompanyAuthContext, key: string, body: unknown) {
    return withIdempotency(
      this.db,
      { userId: actor.userId, key, scope: 'POST /listings', body },
      async (trx) => ({ status: 201, body: await this.create(trx, actor, body) }),
    );
  }

  // Platform admin creates a listing on behalf of a verified company; it is published directly (no
  // moderation) and onPublished runs in the same transaction (e.g. to create the auction row).
  adminCreateIdempotent(
    admin: AuthContext,
    key: string,
    body: unknown,
    onPublished?: OnListingApproved,
  ) {
    return withIdempotency(
      this.db,
      { userId: admin.userId, key, scope: 'POST /admin/listings', body },
      async (trx) => {
        const o = validate.asObject(body);
        const companyId = validate.uuidField(o, 'companyId');
        const company = await trx
          .selectFrom('companies')
          .select(['id', 'status'])
          .where('id', '=', companyId)
          .executeTakeFirst();
        if (!company) throw notFound('Company not found');
        if (company.status !== 'verified') {
          throw conflict(
            'COMPANY_NOT_VERIFIED',
            'Listings can only be created for verified companies',
          );
        }
        return { status: 201, body: await this.create(trx, admin, o, { companyId, onPublished }) };
      },
    );
  }

  private async create(
    trx: Kysely<Database>,
    actor: AuthContext,
    input: unknown,
    admin?: { companyId: string; onPublished: OnListingApproved | undefined },
  ) {
    const companyId = admin ? admin.companyId : actor.company?.id;
    if (!companyId) throw forbidden('NO_COMPANY', 'No company');
    const o = validate.asObject(input);
    const c = this.parseCommon(o, false);
    const saleType: SaleType = validate.oneOf(o, 'saleType', ['fixed', 'auction'] as const);
    let draft: Record<string, string> | null = null;
    if (saleType === 'auction') {
      const a = validate.asObject(o.auction, 'auction');
      const startsAt = validate.isoDate(a, 'startsAt');
      const endsAt = validate.isoDate(a, 'endsAt');
      if (endsAt <= startsAt) throw invalid('auction.endsAt must be after startsAt');
      draft = {
        startPriceMinor: validate.bigintField(a, 'startPriceMinor').toString(),
        minIncrementMinor: validate.bigintField(a, 'minIncrementMinor').toString(),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      };
      const reserve = validate.optBigint(a, 'reserveMinor');
      if (reserve !== undefined) draft.reserveMinor = reserve.toString();
    } else if (o.auction !== undefined && o.auction !== null) {
      throw invalid('auction is only allowed for saleType auction');
    }
    const minOrder = c.minOrderBase ?? 1n;
    if (minOrder > need(c.quantityBase)) throw invalid('minOrderBase cannot exceed quantityBase');
    const category = await trx
      .selectFrom('categories')
      .select('id')
      .where('id', '=', need(c.categoryId))
      .executeTakeFirst();
    if (!category) throw invalid('categoryId does not exist');

    const created = await trx
      .insertInto('listings')
      .values({
        company_id: companyId,
        ...(admin && { status: 'published' as const }),
        category_id: need(c.categoryId),
        condition: c.condition ?? 'yeni',
        title: need(c.title),
        description: c.description ?? '',
        attrs: JSON.stringify(c.attrs ?? {}),
        sale_type: saleType,
        unit_price_minor: need(c.unitPriceMinor),
        quantity_base: need(c.quantityBase),
        min_order_base: minOrder,
        location: need(c.location),
        delivery_terms: c.deliveryTerms ?? '',
        auction_draft: draft ? JSON.stringify(draft) : null,
        review_reason: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await recordAudit(trx, {
      actorType: admin ? 'admin' : 'user',
      actorId: actor.userId,
      companyId,
      action: admin ? 'admin.listing.create' : 'listing.created',
      entityType: 'listing',
      entityId: created.id,
      data: {
        saleType,
        unitPriceMinor: need(c.unitPriceMinor).toString(),
        ...(admin && { companyId, onBehalfOfCompany: true }),
      },
    });
    if (admin?.onPublished) {
      await admin.onPublished(trx, {
        id: created.id,
        companyId,
        quantityBase: need(c.quantityBase),
        basePerUnit: (
          await trx
            .selectFrom('categories')
            .select('base_per_unit')
            .where('id', '=', need(c.categoryId))
            .executeTakeFirstOrThrow()
        ).base_per_unit,
        auctionDraft: draft,
      });
    }
    return this.toDto(await this.loadOrThrow(trx, created.id), actor);
  }

  // Locks the row and enforces ownership (BOLA): a listing the actor cannot see is a 404, a visible
  // listing of another company is a 403.
  private async lockOwned(trx: Kysely<Database>, actor: CompanyAuthContext, id: string) {
    const row = await trx
      .selectFrom('listings')
      .select(['id', 'company_id', 'status', 'sale_type'])
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!row) throw notFound('Listing not found');
    if (row.company_id !== actor.company.id) {
      if (row.status === 'published')
        throw forbidden('NOT_LISTING_OWNER', 'Listing belongs to another company');
      throw notFound('Listing not found');
    }
    return row;
  }

  async update(actor: CompanyAuthContext, id: string, input: unknown) {
    const o = validate.asObject(input);
    const c = this.parseCommon(o, true);
    if (Object.keys(c).length === 0) throw invalid('no updatable field supplied');
    return this.db.transaction().execute(async (trx) => {
      const row = await this.lockOwned(trx, actor, id);
      if (!canTransition(row.status, 'pending_review') && row.status !== 'pending_review') {
        throw conflict('INVALID_TRANSITION', `A ${row.status} listing cannot be edited`);
      }
      // The auction row exists from approval on; sending it back to review would clash with it.
      if (row.sale_type === 'auction' && row.status === 'published') {
        throw conflict('AUCTION_LISTING_LOCKED', 'A published auction listing cannot be edited');
      }
      if (c.categoryId) {
        const cat = await trx
          .selectFrom('categories')
          .select('id')
          .where('id', '=', c.categoryId)
          .executeTakeFirst();
        if (!cat) throw invalid('categoryId does not exist');
      }
      const patch = {
        ...(c.categoryId !== undefined && { category_id: c.categoryId }),
        ...(c.condition !== undefined && { condition: c.condition }),
        ...(c.title !== undefined && { title: c.title }),
        ...(c.description !== undefined && { description: c.description }),
        ...(c.attrs !== undefined && { attrs: JSON.stringify(c.attrs) }),
        ...(c.unitPriceMinor !== undefined && { unit_price_minor: c.unitPriceMinor }),
        ...(c.quantityBase !== undefined && { quantity_base: c.quantityBase }),
        ...(c.minOrderBase !== undefined && { min_order_base: c.minOrderBase }),
        ...(c.location !== undefined && { location: c.location }),
        ...(c.deliveryTerms !== undefined && { delivery_terms: c.deliveryTerms }),
      };
      await trx
        .updateTable('listings')
        .set({
          ...patch,
          status: 'pending_review',
          review_reason: null,
          updated_at: sql<Date>`clock_timestamp()`,
        })
        .where('id', '=', id)
        .execute();
      await recordAudit(trx, {
        actorType: 'user',
        actorId: actor.userId,
        companyId: actor.company.id,
        action: 'listing.updated',
        entityType: 'listing',
        entityId: id,
        data: { fields: Object.keys(c), from: row.status },
      });
      return this.toDto(await this.loadOrThrow(trx, id), actor);
    });
  }

  async remove(actor: CompanyAuthContext, id: string) {
    return this.db.transaction().execute(async (trx) => {
      const row = await this.lockOwned(trx, actor, id);
      if (!canTransition(row.status, 'removed')) {
        throw conflict('INVALID_TRANSITION', `A ${row.status} listing cannot be removed`);
      }
      await trx
        .updateTable('listings')
        .set({ status: 'removed', updated_at: sql<Date>`clock_timestamp()` })
        .where('id', '=', id)
        .execute();
      await recordAudit(trx, {
        actorType: 'user',
        actorId: actor.userId,
        companyId: actor.company.id,
        action: 'listing.removed',
        entityType: 'listing',
        entityId: id,
        data: { from: row.status },
      });
      return { id, status: 'removed' as const };
    });
  }

  // Admin field edit (reason required). Unlike the owner's edit it keeps the status: the admin is
  // already the moderator. A published auction listing stays locked (its auction row mirrors the
  // quantity and price terms).
  async adminUpdate(admin: AuthContext, id: string, body: unknown) {
    const o = validate.asObject(body);
    const reason = validate.str(o, 'reason', 3, 500);
    const c = this.parseCommon(o, true);
    if (Object.keys(c).length === 0) throw invalid('no updatable field supplied');
    return this.db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom('listings')
        .select(['id', 'company_id', 'status', 'sale_type'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!row) throw notFound('Listing not found');
      if (row.status === 'removed' || row.status === 'sold') {
        throw conflict('INVALID_TRANSITION', `A ${row.status} listing cannot be edited`);
      }
      if (row.sale_type === 'auction' && row.status === 'published') {
        throw conflict('AUCTION_LISTING_LOCKED', 'A published auction listing cannot be edited');
      }
      if (c.categoryId) {
        const cat = await trx
          .selectFrom('categories')
          .select('id')
          .where('id', '=', c.categoryId)
          .executeTakeFirst();
        if (!cat) throw invalid('categoryId does not exist');
      }
      await trx
        .updateTable('listings')
        .set({
          ...(c.categoryId !== undefined && { category_id: c.categoryId }),
          ...(c.condition !== undefined && { condition: c.condition }),
          ...(c.title !== undefined && { title: c.title }),
          ...(c.description !== undefined && { description: c.description }),
          ...(c.attrs !== undefined && { attrs: JSON.stringify(c.attrs) }),
          ...(c.unitPriceMinor !== undefined && { unit_price_minor: c.unitPriceMinor }),
          ...(c.quantityBase !== undefined && { quantity_base: c.quantityBase }),
          ...(c.minOrderBase !== undefined && { min_order_base: c.minOrderBase }),
          ...(c.location !== undefined && { location: c.location }),
          ...(c.deliveryTerms !== undefined && { delivery_terms: c.deliveryTerms }),
          updated_at: sql<Date>`clock_timestamp()`,
        })
        .where('id', '=', id)
        .execute();
      await recordAudit(trx, {
        actorType: 'admin',
        actorId: admin.userId,
        companyId: row.company_id,
        action: 'admin.listing.update',
        entityType: 'listing',
        entityId: id,
        reason,
        data: { fields: Object.keys(c), status: row.status },
      });
      return this.toDto(await this.loadOrThrow(trx, id), admin);
    });
  }

  // Admin takedown of any listing; refuses while an auction on it is still running or unsettled.
  async adminRemove(admin: AuthContext, id: string, body: unknown) {
    const reason = validate.str(validate.asObject(body ?? {}), 'reason', 3, 500);
    return this.db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom('listings')
        .select(['id', 'company_id', 'status'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!row) throw notFound('Listing not found');
      if (!canTransition(row.status, 'removed')) {
        throw conflict('INVALID_TRANSITION', `A ${row.status} listing cannot be removed`);
      }
      const active = await trx
        .selectFrom('auctions')
        .select('id')
        .where('listing_id', '=', id)
        .where('status', 'in', ['SCHEDULED', 'LIVE', 'PAYMENT_PENDING'])
        .executeTakeFirst();
      if (active) {
        throw conflict('AUCTION_ACTIVE', 'Cancel the listing auction before removing it');
      }
      await trx
        .updateTable('listings')
        .set({ status: 'removed', updated_at: sql<Date>`clock_timestamp()` })
        .where('id', '=', id)
        .execute();
      await recordAudit(trx, {
        actorType: 'admin',
        actorId: admin.userId,
        companyId: row.company_id,
        action: 'listing.removed',
        entityType: 'listing',
        entityId: id,
        reason,
        data: { from: row.status, by: 'admin' },
      });
      return { id, status: 'removed' as const };
    });
  }

  // ---- images ---------------------------------------------------------------------------------------

  // Owner (verified company) or platform admin. Same BOLA semantics as lockOwned for non-admins.
  private async lockForImages(trx: Kysely<Database>, actor: AuthContext, id: string) {
    if (actor.isAdmin) {
      const row = await trx
        .selectFrom('listings')
        .select(['id', 'company_id', 'status', 'sale_type'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!row) throw notFound('Listing not found');
      return row;
    }
    if (actor.company?.status !== 'verified') {
      throw forbidden('COMPANY_NOT_VERIFIED', 'A verified company is required');
    }
    return this.lockOwned(trx, { ...actor, company: actor.company }, id);
  }

  async removeImage(actor: AuthContext, id: string, imageId: string) {
    const fileName = await this.db.transaction().execute(async (trx) => {
      const row = await this.lockForImages(trx, actor, id);
      if (row.status === 'removed' || row.status === 'sold') {
        throw conflict('INVALID_TRANSITION', `A ${row.status} listing cannot be changed`);
      }
      const img = await trx
        .deleteFrom('listing_images')
        .where('id', '=', imageId)
        .where('listing_id', '=', id)
        .returning('file_name')
        .executeTakeFirst();
      if (!img) throw notFound('Image not found');
      await recordAudit(trx, {
        actorType: actor.isAdmin ? 'admin' : 'user',
        actorId: actor.userId,
        companyId: row.company_id,
        action: 'listing.image.removed',
        entityType: 'listing',
        entityId: id,
        data: { imageId },
      });
      return img.file_name;
    });
    await unlink(path.join(this.uploadDir, fileName)).catch(() => undefined);
    return { id: imageId, deleted: true as const };
  }

  async addImage(actor: AuthContext, id: string, file: Buffer) {
    if (file.length === 0) throw invalid('file is empty');
    if (file.length > MAX_IMAGE_BYTES) {
      throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Image must be at most 2 MB');
    }
    const type = detectImage(file);
    if (!type)
      throw new AppError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'Only jpeg, png or webp images are accepted',
      );
    return this.db.transaction().execute(async (trx: Transaction<Database>) => {
      const row = await this.lockForImages(trx, actor, id);
      if (row.status === 'removed' || row.status === 'sold') {
        throw conflict('INVALID_TRANSITION', `A ${row.status} listing cannot be changed`);
      }
      const count = await trx
        .selectFrom('listing_images')
        .select((eb) => eb.fn.countAll<string>().as('n'))
        .where('listing_id', '=', id)
        .executeTakeFirstOrThrow();
      if (Number(count.n) >= MAX_IMAGES)
        throw conflict('TOO_MANY_IMAGES', `At most ${String(MAX_IMAGES)} images`);
      const fileName = `${randomUUID()}.${type.ext}`;
      const image = await trx
        .insertInto('listing_images')
        .values({ listing_id: id, file_name: fileName, position: Number(count.n) })
        .returning('id')
        .executeTakeFirstOrThrow();
      await mkdir(this.uploadDir, { recursive: true });
      await writeFile(path.join(this.uploadDir, fileName), file, { flag: 'wx' });
      return { id: image.id, url: `/uploads/${fileName}` };
    });
  }

  async readUpload(fileName: string): Promise<{ data: Buffer; mime: string }> {
    const m = /^[0-9a-f-]{36}\.(jpg|png|webp)$/.exec(fileName);
    if (!m) throw notFound();
    try {
      return {
        data: await readFile(path.join(this.uploadDir, fileName)),
        mime: MIME_BY_EXT[m[1] ?? ''] ?? 'application/octet-stream',
      };
    } catch {
      throw notFound();
    }
  }

  // ---- favorites ------------------------------------------------------------------------------------

  async setFavorite(actor: AuthContext, listingId: string, on: boolean) {
    const row = await this.loadRow(this.db, listingId);
    if (!row || row.status !== 'published' || row.company_status !== 'verified') {
      if (on) throw notFound('Listing not found');
    }
    if (on) {
      await this.db
        .insertInto('favorites')
        .values({ user_id: actor.userId, listing_id: listingId })
        .onConflict((oc) => oc.doNothing())
        .execute();
    } else {
      await this.db
        .deleteFrom('favorites')
        .where('user_id', '=', actor.userId)
        .where('listing_id', '=', listingId)
        .execute();
    }
    return { favorite: on };
  }

  async favorites(actor: AuthContext) {
    const rows = await listingSelect(this.db)
      .innerJoin('favorites as f', 'f.listing_id', 'l.id')
      .where('f.user_id', '=', actor.userId)
      .where('l.status', '=', 'published')
      .where('c.status', '=', 'verified')
      .orderBy('f.created_at', 'desc')
      .limit(200)
      .execute();
    return { items: await this.toDtos(rows, actor) };
  }

  // ---- admin moderation -----------------------------------------------------------------------------

  async adminList(status: unknown) {
    let q = listingSelect(this.db).orderBy('l.created_at', 'asc').limit(200);
    if (typeof status === 'string' && status !== '') {
      if (!(LISTING_STATUSES as string[]).includes(status)) throw invalid('status is not valid');
      q = q.where('l.status', '=', status as ListingStatus);
    }
    return { items: await this.toDtos(await q.execute(), { isAdmin: true } as AuthContext) };
  }

  // onApproved runs inside the moderation transaction (e.g. the auctions module creates the auction
  // row), so listing approval and auction creation commit or roll back together.
  async moderate(
    admin: AuthContext,
    id: string,
    decision: 'approve' | 'reject',
    body: unknown,
    onApproved?: OnListingApproved,
  ) {
    const o = validate.asObject(body ?? {});
    const reason =
      decision === 'reject' ? validate.str(o, 'reason', 3, 500) : validate.optStr(o, 'reason', 500);
    const to: ListingStatus = decision === 'approve' ? 'published' : 'rejected';
    return this.db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom('listings')
        .select(['id', 'company_id', 'status', 'category_id', 'quantity_base', 'auction_draft'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!row) throw notFound('Listing not found');
      if (row.status !== 'pending_review' || !canTransition(row.status, to)) {
        throw conflict('INVALID_TRANSITION', `Cannot ${decision} a ${row.status} listing`);
      }
      await trx
        .updateTable('listings')
        .set({
          status: to,
          review_reason: reason ?? null,
          updated_at: sql<Date>`clock_timestamp()`,
        })
        .where('id', '=', id)
        .execute();
      await recordAudit(trx, {
        actorType: 'admin',
        actorId: admin.userId,
        companyId: row.company_id,
        action: `listing.${decision === 'approve' ? 'approved' : 'rejected'}`,
        entityType: 'listing',
        entityId: id,
        ...(reason ? { reason } : {}),
        data: { from: row.status, to },
      });
      if (decision === 'approve' && onApproved) {
        const cat = await trx
          .selectFrom('categories')
          .select('base_per_unit')
          .where('id', '=', row.category_id)
          .executeTakeFirstOrThrow();
        await onApproved(trx, {
          id,
          companyId: row.company_id,
          quantityBase: row.quantity_base,
          basePerUnit: cat.base_per_unit,
          auctionDraft: row.auction_draft,
        });
      }
      return { id, status: to };
    });
  }

  async stats() {
    const rows = await this.db
      .selectFrom('listings')
      .select(['status', (eb) => eb.fn.countAll<string>().as('n')])
      .groupBy('status')
      .execute();
    return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  }
}
