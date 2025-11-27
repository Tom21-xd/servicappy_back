import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto, QueryNotificationsDto, UpdateSettingsDto } from './dto';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear una notificación
   */
  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        data: dto.data,
        imageUrl: dto.imageUrl,
      },
    });
  }

  /**
   * Helper para crear notificación de forma simplificada
   */
  async createForUser(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, any>,
    imageUrl?: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        data,
        imageUrl,
      },
    });

    // Intentar enviar push notification si el usuario tiene habilitado
    await this.sendPushNotification(userId, title, body, data);

    return notification;
  }

  /**
   * Listar notificaciones del usuario con paginación
   */
  async findAll(userId: string, query: QueryNotificationsDto) {
    const { page = 1, limit = 10, isRead } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Marcar una notificación como leída
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta notificación');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      message: 'Todas las notificaciones marcadas como leídas',
      count: result.count,
    };
  }

  /**
   * Obtener cantidad de notificaciones no leídas
   */
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { count };
  }

  /**
   * Eliminar una notificación
   */
  async delete(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta notificación');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { message: 'Notificación eliminada correctamente' };
  }

  /**
   * Actualizar preferencias de notificaciones del usuario
   */
  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        notifyEmail: dto.notifyEmail,
        notifyPush: dto.notifyPush,
        notifySms: dto.notifySms,
        notifyPromotions: dto.notifyPromotions,
        pushToken: dto.pushToken,
      },
      select: {
        id: true,
        notifyEmail: true,
        notifyPush: true,
        notifySms: true,
        notifyPromotions: true,
        pushToken: true,
      },
    });
  }

  /**
   * Obtener preferencias de notificaciones del usuario
   */
  async getSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        notifyEmail: true,
        notifyPush: true,
        notifySms: true,
        notifyPromotions: true,
        pushToken: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  /**
   * Enviar notificación push (Placeholder para integración con Expo/Firebase)
   */
  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          notifyPush: true,
          pushToken: true,
        },
      });

      if (!user || !user.notifyPush || !user.pushToken) {
        // Usuario no tiene push habilitado o no tiene token
        return;
      }

      // TODO: Integrar con Expo Push Notifications o Firebase Cloud Messaging
      console.log('[PUSH NOTIFICATION]', {
        to: user.pushToken,
        title,
        body,
        data,
        timestamp: new Date().toISOString(),
      });

      // Ejemplo de integración con Expo (descomentar cuando se integre):
      /*
      const message = {
        to: user.pushToken,
        sound: 'default',
        title,
        body,
        data,
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
      */
    } catch (error) {
      // No queremos que falle la creación de notificación si falla el push
      console.error('Error enviando push notification:', error);
    }
  }

  // ============================================================
  // MÉTODOS HELPER PARA NOTIFICACIONES ESPECÍFICAS
  // ============================================================

  /**
   * Notificar al proveedor cuando se crea una nueva reserva
   */
  async notifyBookingCreated(booking: any) {
    const service = await this.prisma.service.findUnique({
      where: { id: booking.serviceId },
      select: { title: true },
    });

    const client = await this.prisma.user.findUnique({
      where: { id: booking.clientId },
      select: { firstName: true, lastName: true },
    });

    await this.createForUser(
      booking.providerId,
      NotificationType.BOOKING_REQUEST,
      'Nueva solicitud de reserva',
      `${client.firstName} ${client.lastName} ha solicitado tu servicio "${service.title}"`,
      {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        serviceId: booking.serviceId,
        clientId: booking.clientId,
        action: 'VIEW_BOOKING',
      },
    );
  }

  /**
   * Notificar al cliente cuando su reserva es confirmada
   */
  async notifyBookingConfirmed(booking: any) {
    const service = await this.prisma.service.findUnique({
      where: { id: booking.serviceId },
      select: { title: true },
    });

    const provider = await this.prisma.user.findUnique({
      where: { id: booking.providerId },
      select: { firstName: true, lastName: true },
    });

    await this.createForUser(
      booking.clientId,
      NotificationType.BOOKING_CONFIRMED,
      'Reserva confirmada',
      `${provider.firstName} ${provider.lastName} ha confirmado tu reserva de "${service.title}"`,
      {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        serviceId: booking.serviceId,
        providerId: booking.providerId,
        action: 'VIEW_BOOKING',
      },
    );
  }

  /**
   * Notificar cuando una reserva es cancelada
   */
  async notifyBookingCancelled(booking: any, cancelledBy: 'client' | 'provider') {
    const service = await this.prisma.service.findUnique({
      where: { id: booking.serviceId },
      select: { title: true },
    });

    const client = await this.prisma.user.findUnique({
      where: { id: booking.clientId },
      select: { firstName: true, lastName: true },
    });

    const provider = await this.prisma.user.findUnique({
      where: { id: booking.providerId },
      select: { firstName: true, lastName: true },
    });

    // Notificar a la otra parte
    if (cancelledBy === 'client') {
      // Notificar al proveedor
      await this.createForUser(
        booking.providerId,
        NotificationType.BOOKING_CANCELLED,
        'Reserva cancelada',
        `${client.firstName} ${client.lastName} ha cancelado la reserva de "${service.title}"`,
        {
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          serviceId: booking.serviceId,
          cancelledBy: 'client',
          action: 'VIEW_BOOKING',
        },
      );
    } else {
      // Notificar al cliente
      await this.createForUser(
        booking.clientId,
        NotificationType.BOOKING_CANCELLED,
        'Reserva cancelada',
        `${provider.firstName} ${provider.lastName} ha cancelado tu reserva de "${service.title}"`,
        {
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          serviceId: booking.serviceId,
          cancelledBy: 'provider',
          action: 'VIEW_BOOKING',
        },
      );
    }
  }

  /**
   * Notificar cuando se recibe un nuevo mensaje
   */
  async notifyNewMessage(message: any) {
    const sender = await this.prisma.user.findUnique({
      where: { id: message.senderId },
      select: { firstName: true, lastName: true, avatar: true },
    });

    // Notificar al receptor
    await this.createForUser(
      message.receiverId,
      NotificationType.NEW_MESSAGE,
      'Nuevo mensaje',
      `${sender.firstName} ${sender.lastName}: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`,
      {
        messageId: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderName: `${sender.firstName} ${sender.lastName}`,
        senderAvatar: sender.avatar,
        action: 'VIEW_CONVERSATION',
      },
    );
  }

  /**
   * Notificar al proveedor cuando recibe una nueva reseña
   */
  async notifyNewReview(review: any) {
    const service = await this.prisma.service.findUnique({
      where: { id: review.serviceId },
      select: { title: true },
    });

    const author = await this.prisma.user.findUnique({
      where: { id: review.authorId },
      select: { firstName: true, lastName: true },
    });

    const stars = '⭐'.repeat(review.overallRating);

    await this.createForUser(
      review.targetId,
      NotificationType.NEW_REVIEW,
      'Nueva reseña recibida',
      `${author.firstName} ${author.lastName} te ha dejado una reseña de ${review.overallRating} estrellas ${stars} en "${service.title}"`,
      {
        reviewId: review.id,
        serviceId: review.serviceId,
        bookingId: review.bookingId,
        authorId: review.authorId,
        rating: review.overallRating,
        action: 'VIEW_REVIEW',
      },
    );
  }

  /**
   * Notificar cuando el proveedor responde a una reseña
   */
  async notifyReviewResponse(review: any) {
    const service = await this.prisma.service.findUnique({
      where: { id: review.serviceId },
      select: { title: true },
    });

    const provider = await this.prisma.user.findUnique({
      where: { id: review.targetId },
      select: { firstName: true, lastName: true, displayName: true },
    });

    const providerName = provider.displayName || `${provider.firstName} ${provider.lastName}`;

    await this.createForUser(
      review.authorId,
      NotificationType.REVIEW_RESPONSE,
      'Respuesta a tu reseña',
      `${providerName} ha respondido a tu reseña de "${service.title}"`,
      {
        reviewId: review.id,
        serviceId: review.serviceId,
        targetId: review.targetId,
        action: 'VIEW_REVIEW',
      },
    );
  }

  /**
   * Notificar recordatorio de reserva próxima
   */
  async notifyBookingReminder(booking: any) {
    const service = await this.prisma.service.findUnique({
      where: { id: booking.serviceId },
      select: { title: true },
    });

    // Notificar al cliente
    await this.createForUser(
      booking.clientId,
      NotificationType.BOOKING_REMINDER,
      'Recordatorio de reserva',
      `Tu reserva de "${service.title}" está programada para mañana a las ${booking.scheduledStartTime}`,
      {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        serviceId: booking.serviceId,
        scheduledDate: booking.scheduledDate,
        scheduledStartTime: booking.scheduledStartTime,
        action: 'VIEW_BOOKING',
      },
    );

    // También notificar al proveedor
    await this.createForUser(
      booking.providerId,
      NotificationType.BOOKING_REMINDER,
      'Recordatorio de servicio',
      `Tienes un servicio programado mañana a las ${booking.scheduledStartTime}: "${service.title}"`,
      {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        serviceId: booking.serviceId,
        scheduledDate: booking.scheduledDate,
        scheduledStartTime: booking.scheduledStartTime,
        action: 'VIEW_BOOKING',
      },
    );
  }

  /**
   * Notificar cuando se completa una reserva
   */
  async notifyBookingCompleted(booking: any) {
    const service = await this.prisma.service.findUnique({
      where: { id: booking.serviceId },
      select: { title: true },
    });

    const provider = await this.prisma.user.findUnique({
      where: { id: booking.providerId },
      select: { firstName: true, lastName: true },
    });

    // Notificar al cliente
    await this.createForUser(
      booking.clientId,
      NotificationType.BOOKING_COMPLETED,
      'Servicio completado',
      `Tu servicio "${service.title}" con ${provider.firstName} ${provider.lastName} ha sido completado. ¡No olvides dejar una reseña!`,
      {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        serviceId: booking.serviceId,
        providerId: booking.providerId,
        action: 'LEAVE_REVIEW',
      },
    );
  }

  /**
   * Notificar pago recibido
   */
  async notifyPaymentReceived(payment: any, booking: any) {
    const service = await this.prisma.service.findUnique({
      where: { id: booking.serviceId },
      select: { title: true },
    });

    await this.createForUser(
      booking.providerId,
      NotificationType.PAYMENT_RECEIVED,
      'Pago recibido',
      `Has recibido un pago de $${payment.providerAmount.toLocaleString()} por "${service.title}"`,
      {
        paymentId: payment.id,
        bookingId: booking.id,
        amount: payment.providerAmount,
        action: 'VIEW_PAYMENT',
      },
    );
  }

  /**
   * Notificar pago enviado
   */
  async notifyPaymentSent(payment: any, booking: any) {
    const service = await this.prisma.service.findUnique({
      where: { id: booking.serviceId },
      select: { title: true },
    });

    await this.createForUser(
      booking.clientId,
      NotificationType.PAYMENT_SENT,
      'Pago confirmado',
      `Tu pago de $${payment.amount.toLocaleString()} por "${service.title}" ha sido confirmado`,
      {
        paymentId: payment.id,
        bookingId: booking.id,
        amount: payment.amount,
        action: 'VIEW_PAYMENT',
      },
    );
  }
}
