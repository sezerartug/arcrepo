import { Module } from '@nestjs/common';
import { AdminModule } from './modules/admin/index.js';
import { AuctionsModule } from './modules/auctions/index.js';
import { CatalogModule } from './modules/catalog/index.js';
import { IdentityModule } from './modules/identity/index.js';
import { NotificationsModule } from './modules/notifications/index.js';
import { OrdersModule } from './modules/orders/index.js';
import { PlatformModule } from './modules/platform/index.js';

@Module({
  imports: [
    PlatformModule,
    IdentityModule,
    CatalogModule,
    AuctionsModule,
    OrdersModule,
    NotificationsModule,
    AdminModule,
  ],
})
export class AppModule {}
