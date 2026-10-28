import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/index.js';
import { CatalogService } from './application/catalog.service.js';
import { CatalogController } from './http/catalog.controller.js';

@Module({
  imports: [IdentityModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
