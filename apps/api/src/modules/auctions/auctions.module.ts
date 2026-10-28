import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/index.js';
import { AuctionsService } from './application/auctions.service.js';
import { AuctionCloser } from './application/closer.js';
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
    // AUCTION_ORDER_PORT comes from the global OrdersModule.
  ],
  exports: [AuctionsService, AuctionCloser],
})
export class AuctionsModule {}
