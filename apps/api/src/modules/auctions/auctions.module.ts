import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/index.js';
import { AuctionsService } from './application/auctions.service.js';
import { AuctionCloser } from './application/closer.js';
import { AUCTION_ORDER_PORT, NoopAuctionOrderPort } from './application/order-port.js';
import { AuctionSweeper } from './application/sweeper.js';
import { AUCTION_CONFIG, readAuctionConfig } from './application/support.js';
import { AuctionsController } from './http/auctions.controller.js';

@Module({
  imports: [IdentityModule],
  controllers: [AuctionsController],
  providers: [
    AuctionsService,
    AuctionCloser,
    AuctionSweeper,
    { provide: AUCTION_CONFIG, useFactory: () => readAuctionConfig() },
    // S4 overrides this provider with the real order creation.
    { provide: AUCTION_ORDER_PORT, useClass: NoopAuctionOrderPort },
  ],
  exports: [AuctionsService, AuctionCloser],
})
export class AuctionsModule {}
