import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*', // Configurar según tu frontend
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('ChatGateway');
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Chat WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractTokenFromSocket(client);

      if (!token) {
        this.logger.warn(`Client ${client.id} - No token provided`);
        client.disconnect();
        return;
      }

      // Verificar token JWT
      const payload = await this.verifyToken(token);

      // Guardar información del usuario en el socket
      client.data.userId = payload.sub;
      client.data.email = payload.email;
      client.data.role = payload.role;

      // Registrar socket del usuario
      this.registerUserSocket(payload.sub, client.id);

      // Unirse a room personal del usuario
      client.join(`user:${payload.sub}`);

      this.logger.log(
        `Client connected: ${client.id} - User: ${payload.email} (${payload.sub})`,
      );

      // Emitir evento de conexión exitosa
      client.emit('connected', {
        message: 'Conectado al chat',
        userId: payload.sub,
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.emit('error', { message: 'Autenticación fallida' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (userId) {
      this.unregisterUserSocket(userId, client.id);
      this.logger.log(`Client disconnected: ${client.id} - User: ${userId}`);
    } else {
      this.logger.log(`Client disconnected: ${client.id}`);
    }
  }

  /**
   * Enviar mensaje
   */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        throw new UnauthorizedException('No autenticado');
      }

      // Crear mensaje usando el servicio
      const message = await this.chatService.sendMessage(userId, data);

      // Obtener conversación para notificar a participantes
      const conversation = await this.chatService.getConversationById(
        data.conversationId,
        userId,
      );

      // Emitir mensaje a todos los participantes de la conversación
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('newMessage', message);

      // Notificar al receptor en su room personal (para actualizar lista de conversaciones)
      const receiverId = message.receiverId;
      if (receiverId) {
        this.server.to(`user:${receiverId}`).emit('conversationUpdated', {
          conversationId: data.conversationId,
          lastMessage: message,
        });
      }

      // Confirmar al emisor
      client.emit('messageSent', message);

      return { success: true, message };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      client.emit('error', {
        event: 'sendMessage',
        message: error.message || 'Error al enviar mensaje',
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Unirse a una conversación (room)
   */
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      const { conversationId } = data;

      if (!userId) {
        throw new UnauthorizedException('No autenticado');
      }

      // Verificar que el usuario es participante
      const isParticipant = await this.chatService.isParticipant(
        conversationId,
        userId,
      );

      if (!isParticipant) {
        throw new UnauthorizedException('No eres participante de esta conversación');
      }

      // Unirse al room de la conversación
      client.join(`conversation:${conversationId}`);

      this.logger.log(
        `User ${userId} joined room: conversation:${conversationId}`,
      );

      client.emit('joinedRoom', { conversationId });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error joining room: ${error.message}`);
      client.emit('error', {
        event: 'joinRoom',
        message: error.message || 'Error al unirse a la conversación',
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Salir de una conversación (room)
   */
  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { conversationId } = data;

      // Salir del room
      client.leave(`conversation:${conversationId}`);

      this.logger.log(
        `User ${client.data.userId} left room: conversation:${conversationId}`,
      );

      client.emit('leftRoom', { conversationId });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error leaving room: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Usuario está escribiendo
   */
  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() data: { conversationId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      const { conversationId, isTyping } = data;

      // Emitir a otros participantes (excluir al emisor)
      client.to(`conversation:${conversationId}`).emit('userTyping', {
        conversationId,
        userId,
        isTyping,
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error handling typing: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Marcar mensajes como leídos
   */
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      const { conversationId } = data;

      if (!userId) {
        throw new UnauthorizedException('No autenticado');
      }

      await this.chatService.markAsRead(conversationId, userId);

      // Notificar al otro usuario que los mensajes fueron leídos
      client.to(`conversation:${conversationId}`).emit('messagesRead', {
        conversationId,
        userId,
        readAt: new Date(),
      });

      client.emit('markedAsRead', { conversationId });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking as read: ${error.message}`);
      client.emit('error', {
        event: 'markAsRead',
        message: error.message || 'Error al marcar como leído',
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Extraer token del socket
   */
  private extractTokenFromSocket(client: Socket): string | null {
    // Intentar obtener token de diferentes fuentes
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Desde query params
    const tokenFromQuery = client.handshake.auth?.token || client.handshake.query?.token;
    if (tokenFromQuery) {
      return Array.isArray(tokenFromQuery) ? tokenFromQuery[0] : tokenFromQuery;
    }

    return null;
  }

  /**
   * Verificar token JWT
   */
  private async verifyToken(token: string): Promise<any> {
    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      return this.jwtService.verify(token, { secret });
    } catch (error) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  /**
   * Registrar socket de usuario
   */
  private registerUserSocket(userId: string, socketId: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socketId);
  }

  /**
   * Desregistrar socket de usuario
   */
  private unregisterUserSocket(userId: string, socketId: string) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  /**
   * Verificar si un usuario está online
   */
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }

  /**
   * Obtener sockets de un usuario
   */
  getUserSockets(userId: string): Set<string> | undefined {
    return this.userSockets.get(userId);
  }
}
