import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService], // Exportar para usar en otros módulos (bookings, chat, reviews, etc)
})
export class NotificationsModule {}
