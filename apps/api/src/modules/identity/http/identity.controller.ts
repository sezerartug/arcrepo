import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, clientIp, parseCookie } from '../application/auth.service.js';
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
  async register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user, company } = await this.auth.register(body, clientIp(req));
    setSession(res, token);
    return { user, company };
  }

  @Post('auth/login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, me } = await this.auth.login(body, clientIp(req));
    setSession(res, token);
    return me;
  }

  @Post('auth/forgot-password')
  @HttpCode(202)
  async forgotPassword(@Body() body: unknown, @Req() req: Request) {
    await this.auth.forgotPassword(body, clientIp(req));
    return { ok: true };
  }

  @Post('auth/reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: unknown, @Req() req: Request) {
    await this.auth.resetPassword(body, clientIp(req));
    return { ok: true };
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

  @Patch('me')
  @UseGuards(AuthGuard)
  updateProfile(@CurrentAuth() a: AuthContext, @Body() body: unknown) {
    return this.auth.updateProfile(a, body);
  }

  @Post('me/password')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  changePassword(@CurrentAuth() a: AuthContext, @Body() body: unknown) {
    return this.auth.changePassword(a, body);
  }

  @Get('me/sessions')
  @UseGuards(AuthGuard)
  sessions(@CurrentAuth() a: AuthContext) {
    return this.auth.listSessions(a);
  }

  @Post('me/sessions/revoke-others')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  revokeOthers(@CurrentAuth() a: AuthContext) {
    return this.auth.revokeOtherSessions(a);
  }

  @Delete('me/sessions/:id')
  @UseGuards(AuthGuard)
  revokeSession(@CurrentAuth() a: AuthContext, @Param('id') id: string) {
    return this.auth.revokeSession(a, id);
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
