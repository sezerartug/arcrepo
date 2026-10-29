import { Global, Module } from '@nestjs/common';
import { AUCTION_ORDER_PORT } from '../auctions/index.js';
import { IdentityModule } from '../identity/index.js';
import { DisputesService } from './application/disputes.service.js';
import { OrdersService } from './application/orders.service.js';
import { OrderSweeper } from './application/sweeper.js';
import { ORDER_CONFIG, readOrderConfig } from './application/support.js';
import { OrdersController } from './http/orders.controller.js';

// Global: it provides AUCTION_ORDER_PORT to the auction closer without the auctions module importing
// orders (orders depends on auctions, never the other way round).
@Global()
@Module({
  imports: [IdentityModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    DisputesService,
    OrderSweeper,
    { provide: ORDER_CONFIG, useFactory: () => readOrderConfig() },
    { provide: AUCTION_ORDER_PORT, useExisting: OrdersService },
  ],
  exports: [OrdersService, DisputesService, AUCTION_ORDER_PORT],
})
export class OrdersModule {}
