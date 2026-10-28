import {
  Injectable,
  createParamDecorator,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { forbidden, unauthorized } from '../../platform/index.js';
import { AuthService } from '../application/auth.service.js';
import type { AuthContext, CompanyAuthContext } from '../application/types.js';

export type AuthedRequest = Request & { auth?: AuthContext | null };

async function resolve(auth: AuthService, req: AuthedRequest): Promise<AuthContext | null> {
  req.auth ??= await auth.authenticate(req.headers.cookie);
  return req.auth;
}

// Public endpoints that behave differently for a signed-in user (e.g. listing visibility).
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    await resolve(this.auth, ctx.switchToHttp().getRequest<AuthedRequest>());
    return true;
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!(await resolve(this.auth, ctx.switchToHttp().getRequest<AuthedRequest>()))) {
      throw unauthorized();
    }
    return true;
  }
}

// Signed in AND a member of a verified company.
@Injectable()
export class CompanyGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const a = await resolve(this.auth, ctx.switchToHttp().getRequest<AuthedRequest>());
    if (!a) throw unauthorized();
    if (a.company?.status !== 'verified') {
      throw forbidden('COMPANY_NOT_VERIFIED', 'A verified company is required');
    }
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const a = await resolve(this.auth, ctx.switchToHttp().getRequest<AuthedRequest>());
    if (!a) throw unauthorized();
    if (!a.isAdmin) throw forbidden('NOT_ADMIN', 'Platform admin required');
    return true;
  }
}

const requestAuth = (ctx: ExecutionContext): AuthContext | null =>
  ctx.switchToHttp().getRequest<AuthedRequest>().auth ?? null;

// Behind AuthGuard / AdminGuard: the context always exists.
export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const a = requestAuth(ctx);
    if (!a) throw unauthorized();
    return a;
  },
);

// Behind CompanyGuard (or for users with a company): the context always has a company.
export const CurrentCompanyAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CompanyAuthContext => {
    const a = requestAuth(ctx);
    if (!a) throw unauthorized();
    if (!a.company) throw forbidden('NO_COMPANY', 'No company');
    return { ...a, company: a.company };
  },
);

// Behind OptionalAuthGuard: null for anonymous callers.
export const OptionalAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext | null => requestAuth(ctx),
);
