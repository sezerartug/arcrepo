import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AuthGuard,
  CompanyGuard,
  CurrentAuth,
  CurrentCompanyAuth,
  OptionalAuth,
  OptionalAuthGuard,
  type AuthContext,
  type CompanyAuthContext,
} from '../../identity/index.js';
import { AppError, notFound, requireIdempotencyKey, validate } from '../../platform/index.js';
import { CatalogService } from '../application/catalog.service.js';
import { MAX_IMAGE_BYTES, parseMultipartFile } from '../application/images.js';

const id = (v: string): string => {
  if (!validate.isUuid(v)) throw notFound();
  return v;
};

async function readBody(req: Request, limit: number): Promise<Buffer> {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > limit) {
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > limit) throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Get('listings')
  @UseGuards(OptionalAuthGuard)
  search(@OptionalAuth() a: AuthContext | null, @Query() query: Record<string, unknown>) {
    return this.catalog.search(a, query);
  }

  @Get('seller/listings')
  @UseGuards(CompanyGuard)
  sellerListings(
    @CurrentCompanyAuth() a: CompanyAuthContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.catalog.sellerListings(a, query);
  }

  @Get('listings/:id')
  @UseGuards(OptionalAuthGuard)
  get(@OptionalAuth() a: AuthContext | null, @Param('id') listingId: string) {
    return this.catalog.get(a, id(listingId));
  }

  @Post('listings')
  @UseGuards(CompanyGuard)
  async create(
    @CurrentCompanyAuth() a: CompanyAuthContext,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.catalog.createIdempotent(a, requireIdempotencyKey(key), body);
    res.status(result.status);
    return result.body;
  }

  @Patch('listings/:id')
  @UseGuards(CompanyGuard)
  update(
    @CurrentCompanyAuth() a: CompanyAuthContext,
    @Param('id') listingId: string,
    @Body() body: unknown,
  ) {
    return this.catalog.update(a, id(listingId), body);
  }

  @Post('listings/:id/remove')
  @HttpCode(200)
  @UseGuards(CompanyGuard)
  remove(@CurrentCompanyAuth() a: CompanyAuthContext, @Param('id') listingId: string) {
    return this.catalog.remove(a, id(listingId));
  }

  @Post('listings/:id/images')
  @UseGuards(CompanyGuard)
  async addImage(
    @CurrentCompanyAuth() a: CompanyAuthContext,
    @Param('id') listingId: string,
    @Req() req: Request,
  ) {
    const lid = id(listingId);
    const raw = await readBody(req, MAX_IMAGE_BYTES + 16 * 1024);
    const file = parseMultipartFile(raw, req.headers['content-type'] ?? '');
    if (!file) throw new AppError(422, 'VALIDATION_ERROR', 'multipart field "file" is required');
    return this.catalog.addImage(a, lid, file);
  }

  @Get('uploads/:file')
  async upload(@Param('file') file: string, @Res() res: Response) {
    const { data, mime } = await this.catalog.readUpload(file);
    res
      .setHeader('Content-Type', mime)
      .setHeader('X-Content-Type-Options', 'nosniff')
      .setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      .send(data);
  }

  @Post('listings/:id/favorite')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  favorite(@CurrentAuth() a: AuthContext, @Param('id') listingId: string) {
    return this.catalog.setFavorite(a, id(listingId), true);
  }

  @Delete('listings/:id/favorite')
  @UseGuards(AuthGuard)
  unfavorite(@CurrentAuth() a: AuthContext, @Param('id') listingId: string) {
    return this.catalog.setFavorite(a, id(listingId), false);
  }

  @Get('favorites')
  @UseGuards(AuthGuard)
  favorites(@CurrentAuth() a: AuthContext) {
    return this.catalog.favorites(a);
  }
}
