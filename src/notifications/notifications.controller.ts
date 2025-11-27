import { Controller, Get, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto, UpdateSettingsDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Listar notificaciones del usuario
   * GET /notifications
   */
  @Get()
  findAll(@CurrentUser('id') userId: string, @Query() query: QueryNotificationsDto) {
    return this.notificationsService.findAll(userId, query);
  }

  /**
   * Obtener cantidad de notificaciones no leídas
   * GET /notifications/unread-count
   */
  @Get('unread-count')
  getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  /**
   * Obtener configuración de notificaciones
   * GET /notifications/settings
   */
  @Get('settings')
  getSettings(@CurrentUser('id') userId: string) {
    return this.notificationsService.getSettings(userId);
  }

  /**
   * Marcar todas las notificaciones como leídas
   * PUT /notifications/read-all
   */
  @Put('read-all')
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  /**
   * Marcar una notificación como leída
   * PUT /notifications/:id/read
   */
  @Put(':id/read')
  markAsRead(@Param('id') notificationId: string, @CurrentUser('id') userId: string) {
    return this.notificationsService.markAsRead(notificationId, userId);
  }

  /**
   * Actualizar configuración de notificaciones
   * PUT /notifications/settings
   */
  @Put('settings')
  updateSettings(@CurrentUser('id') userId: string, @Body() dto: UpdateSettingsDto) {
    return this.notificationsService.updateSettings(userId, dto);
  }

  /**
   * Eliminar una notificación
   * DELETE /notifications/:id
   */
  @Delete(':id')
  delete(@Param('id') notificationId: string, @CurrentUser('id') userId: string) {
    return this.notificationsService.delete(notificationId, userId);
  }
}
