import { Module } from '@nestjs/common';
import { AuctionsModule } from '../auctions/index.js';
import { CatalogModule } from '../catalog/index.js';
import { IdentityModule } from '../identity/index.js';
import { AdminController } from './admin.controller.js';

@Module({
  imports: [IdentityModule, CatalogModule, AuctionsModule],
  controllers: [AdminController],
})
export class AdminModule {}
