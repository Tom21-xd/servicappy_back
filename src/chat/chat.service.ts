import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto, QueryMessagesDto, CreateConversationDto } from './dto';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear nueva conversación entre dos usuarios
   */
  async createConversation(userId: string, dto: CreateConversationDto) {
    // Verificar que el participante existe
    const participant = await this.prisma.user.findUnique({
      where: { id: dto.participantId },
    });

    if (!participant) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (userId === dto.participantId) {
      throw new BadRequestException('No puedes crear una conversación contigo mismo');
    }

    // Verificar si ya existe una conversación entre estos usuarios
    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          {
            participants: {
              some: { userId },
            },
          },
          {
            participants: {
              some: { userId: dto.participantId },
            },
          },
        ],
        ...(dto.bookingId && { bookingId: dto.bookingId }),
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                email: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (existingConversation) {
      return existingConversation;
    }

    // Crear nueva conversación
    const conversation = await this.prisma.conversation.create({
      data: {
        bookingId: dto.bookingId,
        participants: {
          create: [
            { userId },
            { userId: dto.participantId },
          ],
        },
        ...(dto.initialMessage && {
          messages: {
            create: {
              senderId: userId,
              receiverId: dto.participantId,
              content: dto.initialMessage,
              type: 'text',
            },
          },
          lastMessage: dto.initialMessage,
        }),
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                email: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return conversation;
  }

  /**
   * Obtener o crear conversación (helper)
   */
  async getOrCreateConversation(
    userId1: string,
    userId2: string,
    bookingId?: string,
  ) {
    // Buscar conversación existente
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          {
            participants: {
              some: { userId: userId1 },
            },
          },
          {
            participants: {
              some: { userId: userId2 },
            },
          },
        ],
        ...(bookingId && { bookingId }),
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Si no existe, crear nueva
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          bookingId,
          participants: {
            create: [
              { userId: userId1 },
              { userId: userId2 },
            ],
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    }

    return conversation;
  }

  /**
   * Obtener todas las conversaciones del usuario
   */
  async getConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                avatar: true,
                email: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            content: true,
            type: true,
            createdAt: true,
            senderId: true,
            isRead: true,
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

    // Formatear respuesta con información del otro usuario y unreadCount
    return conversations.map((conv) => {
      const otherParticipant = conv.participants.find((p) => p.userId !== userId);
      const currentParticipant = conv.participants.find((p) => p.userId === userId);

      return {
        id: conv.id,
        bookingId: conv.bookingId,
        lastMessageAt: conv.lastMessageAt,
        lastMessage: conv.messages[0] || null,
        unreadCount: currentParticipant?.unreadCount || 0,
        isMuted: currentParticipant?.isMuted || false,
        isArchived: currentParticipant?.isArchived || false,
        otherUser: otherParticipant?.user || null,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      };
    });
  }

  /**
   * Obtener mensajes de una conversación con paginación
   */
  async getMessages(
    conversationId: string,
    userId: string,
    query: QueryMessagesDto,
  ) {
    // Verificar que el usuario es participante de la conversación
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
      },
    });

    if (!participant) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }

    const { page = 1, limit = 50, cursor } = query;
    const skip = cursor ? 1 : (page - 1) * limit;

    // Obtener mensajes con paginación
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        isDeleted: false,
        ...(cursor && {
          id: {
            lt: cursor, // Obtener mensajes anteriores al cursor
          },
        }),
      },
      take: limit,
      skip,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    // Contar total de mensajes
    const total = await this.prisma.message.count({
      where: {
        conversationId,
        isDeleted: false,
      },
    });

    return {
      data: messages.reverse(), // Invertir para orden cronológico
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + messages.length < total,
        nextCursor: messages.length > 0 ? messages[0].id : null,
      },
    };
  }

  /**
   * Enviar un mensaje
   */
  async sendMessage(userId: string, dto: CreateMessageDto) {
    // Verificar que el usuario es participante
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId: dto.conversationId,
        userId,
      },
    });

    if (!participant) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }

    // Obtener el receptor (otro participante)
    const otherParticipant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId: dto.conversationId,
        userId: {
          not: userId,
        },
      },
    });

    // Crear mensaje en una transacción
    const message = await this.prisma.$transaction(async (tx) => {
      // Crear mensaje
      const newMessage = await tx.message.create({
        data: {
          conversationId: dto.conversationId,
          senderId: userId,
          receiverId: otherParticipant?.userId || dto.receiverId,
          content: dto.content,
          type: dto.type || 'text',
          attachments: dto.attachments as any || undefined,
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
            },
          },
        },
      });

      // Actualizar conversación
      await tx.conversation.update({
        where: { id: dto.conversationId },
        data: {
          lastMessage: dto.content,
          lastMessageAt: new Date(),
        },
      });

      // Incrementar unreadCount del receptor
      if (otherParticipant) {
        await tx.conversationParticipant.update({
          where: { id: otherParticipant.id },
          data: {
            unreadCount: {
              increment: 1,
            },
          },
        });
      }

      return newMessage;
    });

    return message;
  }

  /**
   * Marcar mensajes como leídos
   */
  async markAsRead(conversationId: string, userId: string) {
    // Verificar que el usuario es participante
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
      },
    });

    if (!participant) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }

    // Actualizar mensajes no leídos en una transacción
    await this.prisma.$transaction(async (tx) => {
      // Marcar mensajes como leídos
      await tx.message.updateMany({
        where: {
          conversationId,
          receiverId: userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      // Resetear contador de no leídos
      await tx.conversationParticipant.update({
        where: { id: participant.id },
        data: {
          unreadCount: 0,
          lastReadAt: new Date(),
        },
      });
    });

    return { success: true };
  }

  /**
   * Verificar si un usuario es participante de una conversación
   */
  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
      },
    });

    return !!participant;
  }

  /**
   * Obtener una conversación por ID
   */
  async getConversationById(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                avatar: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    // Verificar que el usuario es participante
    const isParticipant = conversation.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }

    return conversation;
  }
}
