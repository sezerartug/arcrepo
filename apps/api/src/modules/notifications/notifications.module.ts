import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/index.js';
import { NotificationsService } from './application/notifications.service.js';
import { NotificationsController } from './http/notifications.controller.js';

@Module({
  imports: [IdentityModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
