import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  AdminGuard,
  AuthGuard,
  CompanyGuard,
  CurrentAuth,
  CurrentCompanyAuth,
  type AuthContext,
  type CompanyAuthContext,
} from '../../identity/index.js';
import { notFound, requireIdempotencyKey, validate } from '../../platform/index.js';
import { OrdersService } from '../application/orders.service.js';

const id = (v: string): string => {
  if (!validate.isUuid(v)) throw notFound();
  return v;
};

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('listings/:id/buy')
  @UseGuards(CompanyGuard)
  async buy(
    @CurrentCompanyAuth() a: CompanyAuthContext,
    @Param('id') listingId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.orders.buy(a, id(listingId), requireIdempotencyKey(key), body);
    res.status(r.status);
    return r.body;
  }

  @Get('orders')
  @UseGuards(CompanyGuard)
  list(@CurrentCompanyAuth() a: CompanyAuthContext, @Query('status') status: unknown) {
    return this.orders.list(a, status);
  }

  @Get('orders/:id')
  @UseGuards(CompanyGuard)
  get(@CurrentCompanyAuth() a: CompanyAuthContext, @Param('id') orderId: string) {
    return this.orders.get(a, id(orderId));
  }

  @Post('orders/:id/ship')
  @HttpCode(200)
  @UseGuards(CompanyGuard)
  ship(
    @CurrentCompanyAuth() a: CompanyAuthContext,
    @Param('id') orderId: string,
    @Body() body: unknown,
  ) {
    return this.orders.ship(a, id(orderId), body);
  }

  @Post('orders/:id/confirm-delivery')
  @HttpCode(200)
  @UseGuards(CompanyGuard)
  confirmDelivery(@CurrentCompanyAuth() a: CompanyAuthContext, @Param('id') orderId: string) {
    return this.orders.confirmDelivery(a, id(orderId));
  }

  // Buyer (breach) or platform admin (refund); the service decides by role.
  @Post('orders/:id/cancel')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  cancel(@CurrentAuth() a: AuthContext, @Param('id') orderId: string, @Body() body: unknown) {
    return this.orders.cancel(a, id(orderId), body);
  }

  @Get('seller/payouts')
  @UseGuards(CompanyGuard)
  payouts(@CurrentCompanyAuth() a: CompanyAuthContext) {
    return this.orders.sellerPayouts(a);
  }

  @Post('admin/payouts/:companyId/transfer')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  transfer(@CurrentAuth() a: AuthContext, @Param('companyId') companyId: string) {
    return this.orders.transferPayout(a, id(companyId));
  }
}
