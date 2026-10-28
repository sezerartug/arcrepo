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
import { CatalogService } from '../catalog/index.js';
import {
  AdminGuard,
  CompanyAdminService,
  CurrentAuth,
  type AuthContext,
  type CompanyAction,
} from '../identity/index.js';
import { DB, listAudit, notFound, validate } from '../platform/index.js';

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
    return this.catalog.moderate(a, uuid(id), decision, body);
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
