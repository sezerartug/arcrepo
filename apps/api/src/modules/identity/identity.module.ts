import { Module } from '@nestjs/common';
import { AUTH_LIMITS, AuthService, defaultAuthLimits } from './application/auth.service.js';
import { CompanyAdminService } from './application/company-admin.service.js';
import { UserAdminService } from './application/user-admin.service.js';
import { AdminGuard, AuthGuard, CompanyGuard, OptionalAuthGuard } from './http/guards.js';
import { IdentityController } from './http/identity.controller.js';

@Module({
  controllers: [IdentityController],
  providers: [
    AuthService,
    CompanyAdminService,
    UserAdminService,
    { provide: AUTH_LIMITS, useFactory: () => defaultAuthLimits() },
    AuthGuard,
    OptionalAuthGuard,
    CompanyGuard,
    AdminGuard,
  ],
  exports: [
    AuthService,
    CompanyAdminService,
    UserAdminService,
    AuthGuard,
    OptionalAuthGuard,
    CompanyGuard,
    AdminGuard,
  ],
})
export class IdentityModule {}
