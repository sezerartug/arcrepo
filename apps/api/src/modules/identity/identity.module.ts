import { Module } from '@nestjs/common';
import { AuthService } from './application/auth.service.js';
import { CompanyAdminService } from './application/company-admin.service.js';
import { AdminGuard, AuthGuard, CompanyGuard, OptionalAuthGuard } from './http/guards.js';
import { IdentityController } from './http/identity.controller.js';

@Module({
  controllers: [IdentityController],
  providers: [
    AuthService,
    CompanyAdminService,
    AuthGuard,
    OptionalAuthGuard,
    CompanyGuard,
    AdminGuard,
  ],
  exports: [
    AuthService,
    CompanyAdminService,
    AuthGuard,
    OptionalAuthGuard,
    CompanyGuard,
    AdminGuard,
  ],
})
export class IdentityModule {}
