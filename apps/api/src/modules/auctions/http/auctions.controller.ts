import { Controller, Get, Headers, Param, Post, Body, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import {
  CompanyGuard,
  CurrentCompanyAuth,
  OptionalAuth,
  OptionalAuthGuard,
  type AuthContext,
  type CompanyAuthContext,
} from '../../identity/index.js';
import { notFound, requireIdempotencyKey, validate } from '../../platform/index.js';
import { AuctionsService } from '../application/auctions.service.js';

const id = (v: string): string => {
  if (!validate.isUuid(v)) throw notFound();
  return v;
};

@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctions: AuctionsService) {}

  @Get()
  list(@Query('status') status: unknown) {
    return this.auctions.list(status);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  get(@OptionalAuth() a: AuthContext | null, @Param('id') auctionId: string) {
    return this.auctions.snapshot(a, id(auctionId));
  }

  @Post(':id/deposit')
  @UseGuards(CompanyGuard)
  async deposit(
    @CurrentCompanyAuth() a: CompanyAuthContext,
    @Param('id') auctionId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.auctions.deposit(a, id(auctionId), requireIdempotencyKey(key));
    res.status(r.status);
    return r.body;
  }

  @Post(':id/bids')
  @UseGuards(CompanyGuard)
  async bid(
    @CurrentCompanyAuth() a: CompanyAuthContext,
    @Param('id') auctionId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.auctions.placeBid(a, id(auctionId), requireIdempotencyKey(key), body);
    res.status(r.status);
    return r.body;
  }
}
