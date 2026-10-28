import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/index.js';
import { IdentityModule } from '../identity/index.js';
import { AdminController } from './admin.controller.js';

@Module({ imports: [IdentityModule, CatalogModule], controllers: [AdminController] })
export class AdminModule {}
