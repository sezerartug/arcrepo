import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
} from '../identity/index.js';
import { DB, invalid, listAudit, notFound, validate } from '../platform/index.js';

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
    @Inject(DB) private readonly db: Kysely<Database>,
  ) {}

  @Get('companies')
  async listCompanies(@Query('status') status: unknown) {
    return { items: await this.companies.list(status) };
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

  // Pending bank transfers awaiting reconciliation. S3: auction deposits; S4 adds order payments.
  @Get('payments')
  async payments(@Query('status') status: unknown) {
    if (status !== undefined && status !== 'pending') throw invalid('status must be pending');
    return { items: await this.auctions.pendingDeposits() };
  }

  // Fake bank reconciliation by payment reference. Dispatches on the reference prefix.
  @Post('payments/confirm')
  @HttpCode(200)
  confirmPayment(@CurrentAuth() a: AuthContext, @Body() body: unknown) {
    const reference = validate.str(validate.asObject(body), 'reference', 4, 40);
    if (reference.startsWith(DEPOSIT_REF_PREFIX)) {
      return this.auctions.confirmDepositPayment(a, reference);
    }
    throw notFound('Unknown payment reference');
  }

  @Post('auctions/:id/cancel')
  @HttpCode(200)
  cancelAuction(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() body: unknown) {
    return this.auctions.adminCancel(a, uuid(id), body);
  }

  @Get('audit')
  async audit(@Query() q: Record<string, unknown>) {
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
    const [c, listings] = await Promise.all([this.companies.stats(), this.catalog.stats()]);
    return { ...c, listings };
  }
}
