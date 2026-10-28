import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, parseCookie } from '../application/auth.service.js';
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  type AuthContext,
  type CompanyAuthContext,
} from '../application/types.js';
import { AuthGuard, CurrentAuth, CurrentCompanyAuth } from './guards.js';

function setSession(res: Response, token: string): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const maxAge = String(SESSION_DAYS * 86400);
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`,
  );
}

@Controller()
export class IdentityController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/register')
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { token, user, company } = await this.auth.register(body);
    setSession(res, token);
    return { user, company };
  }

  @Post('auth/login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { token, me } = await this.auth.login(body);
    setSession(res, token);
    return me;
  }

  @Post('auth/logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(parseCookie(req.headers.cookie, SESSION_COOKIE));
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentAuth() a: AuthContext) {
    return this.auth.toMe(a);
  }

  @Post('company/members')
  @UseGuards(AuthGuard)
  addMember(@CurrentCompanyAuth() a: CompanyAuthContext, @Body() body: unknown) {
    return this.auth.addMember(a, body);
  }

  @Get('company/members')
  @UseGuards(AuthGuard)
  members(@CurrentCompanyAuth() a: CompanyAuthContext) {
    return this.auth.listMembers(a);
  }
}
