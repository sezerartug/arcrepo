import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentAuth, type AuthContext } from '../../identity/index.js';
import { notFound, validate } from '../../platform/index.js';
import { NotificationsService } from '../application/notifications.service.js';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@CurrentAuth() a: AuthContext, @Query() q: Record<string, unknown>) {
    return this.svc.list(a.userId, q);
  }

  // Declared before ':id/read' routes; the paths differ in shape so there is no clash.
  @Get('unread-count')
  unreadCount(@CurrentAuth() a: AuthContext) {
    return this.svc.unreadCount(a.userId);
  }

  @Post('read-all')
  @HttpCode(200)
  readAll(@CurrentAuth() a: AuthContext) {
    return this.svc.readAll(a.userId);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(@CurrentAuth() a: AuthContext, @Param('id') id: string) {
    if (!validate.isUuid(id)) throw notFound('Notification not found');
    return this.svc.markRead(a.userId, id);
  }
}
