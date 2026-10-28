import { Module } from '@nestjs/common';
import { AuctionsModule } from '../auctions/index.js';
import { CatalogModule } from '../catalog/index.js';
import { IdentityModule } from '../identity/index.js';
import { OrdersModule } from '../orders/index.js';
import { AdminController } from './admin.controller.js';

@Module({
  imports: [IdentityModule, CatalogModule, AuctionsModule, OrdersModule],
  controllers: [AdminController],
})
export class AdminModule {}
