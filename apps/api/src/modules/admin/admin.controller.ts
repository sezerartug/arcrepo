import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import {
  AuctionsService,
  DEPOSIT_REF_PREFIX,
  createAuctionFromListing,
} from '../auctions/index.js';
import { CatalogService } from '../catalog/index.js';
import {
  AdminGuard,
  CompanyAdminService,
  CurrentAuth,
  type AuthContext,
  type CompanyAction,
  UserAdminService,
} from '../identity/index.js';
import { ORDER_REF_PREFIX, OrdersService } from '../orders/index.js';
import { AdminDirectoryService } from './admin-directory.service.js';
import { AdminFinanceService } from './admin-finance.service.js';
import {
  DB,
  invalid,
  listAudit,
  notFound,
  requireIdempotencyKey,
  validate,
} from '../platform/index.js';

const uuid = (v: string): string => {
  if (!validate.isUuid(v)) throw notFound();
  return v;
};
const COMPANY_ACTIONS = ['verify', 'reject', 'suspend'] as const;

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly companies: CompanyAdminService,
    private readonly catalog: CatalogService,
    private readonly auctions: AuctionsService,
    private readonly orders: OrdersService,
    private readonly directory: AdminDirectoryService,
    private readonly finance: AdminFinanceService,
    private readonly users: UserAdminService,
    @Inject(DB) private readonly db: Kysely<Database>,
  ) {}

  @Get('pending-counts')
  pendingCounts() {
    return this.directory.pendingCounts();
  }

  @Get('companies')
  listCompanies(@Query() q: Record<string, unknown>) {
    return this.companies.list(q);
  }

  @Get('companies/:id')
  companyDetail(@CurrentAuth() a: AuthContext, @Param('id') id: string) {
    return this.directory.companyDetail(a, uuid(id));
  }

  @Get('users')
  listUsers(@Query() q: Record<string, unknown>) {
    return this.directory.listUsers(q);
  }

  @Post('users/:id/suspend')
  @HttpCode(200)
  suspendUser(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() body: unknown) {
    return this.users.suspend(a, uuid(id), body);
  }

  @Post('users/:id/unsuspend')
  @HttpCode(200)
  unsuspendUser(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() body: unknown) {
    return this.users.unsuspend(a, uuid(id), body);
  }

  @Post('users/:id/send-reset')
  @HttpCode(200)
  sendReset(@CurrentAuth() a: AuthContext, @Param('id') id: string) {
    return this.users.sendReset(a, uuid(id));
  }

  @Post('companies/:id/:action')
  @HttpCode(200)
  changeCompany(
    @CurrentAuth() a: AuthContext,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: unknown,
  ) {
    if (!(COMPANY_ACTIONS as readonly string[]).includes(action)) throw notFound();
    return this.companies.change(a, uuid(id), action as CompanyAction, body);
  }

  @Get('listings')
  listListings(@Query('status') status: unknown) {
    return this.catalog.adminList(status);
  }

  // Admin creates a listing (and its auction, if any) on behalf of a verified company; published directly.
  @Post('listings')
  async createListing(
    @CurrentAuth() a: AuthContext,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.catalog.adminCreateIdempotent(
      a,
      requireIdempotencyKey(key),
      body,
      async (trx, l) => {
        if (!l.auctionDraft) return;
        await createAuctionFromListing(trx, {
          listingId: l.id,
          companyId: l.companyId,
          quantityBase: l.quantityBase,
          basePerUnit: l.basePerUnit,
          draft: l.auctionDraft,
        });
      },
    );
    res.status(result.status);
    return result.body;
  }

  @Post('listings/:id/remove')
  @HttpCode(200)
  removeListing(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() body: unknown) {
    return this.catalog.adminRemove(a, uuid(id), body);
  }

  @Post('listings/:id/:decision')
  @HttpCode(200)
  moderate(
    @CurrentAuth() a: AuthContext,
    @Param('id') id: string,
    @Param('decision') decision: string,
    @Body() body: unknown,
  ) {
    if (decision !== 'approve' && decision !== 'reject') throw notFound();
    return this.catalog.moderate(a, uuid(id), decision, body, async (trx, l) => {
      if (!l.auctionDraft) return;
      await createAuctionFromListing(trx, {
        listingId: l.id,
        companyId: l.companyId,
        quantityBase: l.quantityBase,
        basePerUnit: l.basePerUnit,
        draft: l.auctionDraft,
      });
    });
  }

  // Pending bank transfers awaiting reconciliation: auction deposits and order payments.
  @Get('payments')
  async payments(@Query('status') status: unknown) {
    if (status !== undefined && status !== 'pending') throw invalid('status must be pending');
    const [deposits, orders] = await Promise.all([
      this.auctions.pendingDeposits(),
      this.orders.pendingPayments(),
    ]);
    return { items: [...deposits, ...orders] };
  }

  // Fake bank reconciliation by payment reference. Dispatches on the reference prefix.
  // Body: { reference, amountMinor? }; an amount that differs from the order's amount due is rejected.
  @Post('payments/confirm')
  @HttpCode(200)
  confirmPayment(@CurrentAuth() a: AuthContext, @Body() body: unknown) {
    const o = validate.asObject(body);
    const reference = validate.str(o, 'reference', 4, 40);
    if (reference.startsWith(DEPOSIT_REF_PREFIX)) {
      return this.auctions.confirmDepositPayment(a, reference);
    }
    if (reference.startsWith(ORDER_REF_PREFIX)) {
      return this.orders.confirmPayment(a, reference, validate.optBigint(o, 'amountMinor'));
    }
    throw notFound('Unknown payment reference');
  }

  @Get('auctions')
  listAuctions(@Query() q: Record<string, unknown>) {
    return this.directory.listAuctions(q);
  }

  @Get('auctions/:id')
  auctionDetail(
    @CurrentAuth() a: AuthContext,
    @Param('id') id: string,
    @Query('poll') poll: unknown,
  ) {
    // poll=1: live-refresh of an already audited page view; skips the duplicate audit entry.
    return this.directory.auctionDetail(a, uuid(id), poll === '1');
  }

  @Patch('listings/:id')
  updateListing(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() body: unknown) {
    return this.catalog.adminUpdate(a, uuid(id), body);
  }

  @Post('auctions/:id/cancel')
  @HttpCode(200)
  cancelAuction(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() body: unknown) {
    return this.auctions.adminCancel(a, uuid(id), body);
  }

  // Read-only finance report (ledger + orders). Date range is UTC and resolved on the database clock.
  @Get('finance/summary')
  async financeSummary(@Query() q: Record<string, unknown>) {
    return this.finance.summary(await this.finance.parseRange(q));
  }

  @Get('finance/orders.csv')
  async financeOrdersCsv(
    @CurrentAuth() a: AuthContext,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.finance.ordersCsv(a, await this.finance.parseRange(q));
    return this.sendCsv(res, 'siparisler.csv', csv);
  }

  @Get('finance/payouts.csv')
  async financePayoutsCsv(
    @CurrentAuth() a: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.sendCsv(res, 'hakedisler.csv', await this.finance.payoutsCsv(a));
  }

  private sendCsv(res: Response, filename: string, csv: string): string {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return csv;
  }

  @Get('audit') async audit(@Query() q: Record<string, unknown>) {
    const entityId = typeof q.entityId === 'string' && q.entityId !== '' ? q.entityId : undefined;
    if (entityId && !validate.isUuid(entityId)) throw notFound();
    const entityType =
      typeof q.entityType === 'string' && q.entityType !== '' ? q.entityType : undefined;
    const items = await listAudit(this.db, {
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
    });
    return { items };
  }

  @Get('stats')
  async stats() {
    const [c, listings, orders] = await Promise.all([
      this.companies.stats(),
      this.catalog.stats(),
      this.orders.stats(),
    ]);
    return { ...c, listings, orders };
  }
}
