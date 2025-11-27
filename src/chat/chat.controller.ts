import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { ChatService } from './chat.service';
import { CreateMessageDto, QueryMessagesDto, CreateConversationDto } from './dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * GET /chat/conversations
   * Obtener todas las conversaciones del usuario
   */
  @Get('conversations')
  async getConversations(@Request() req) {
    const userId = req.user.id;
    return this.chatService.getConversations(userId);
  }

  /**
   * GET /chat/conversations/:id
   * Obtener una conversación específica
   */
  @Get('conversations/:id')
  async getConversation(@Param('id') conversationId: string, @Request() req) {
    const userId = req.user.id;
    return this.chatService.getConversationById(conversationId, userId);
  }

  /**
   * GET /chat/conversations/:id/messages
   * Obtener mensajes de una conversación con paginación
   */
  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') conversationId: string,
    @Query() query: QueryMessagesDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.chatService.getMessages(conversationId, userId, query);
  }

  /**
   * POST /chat/conversations
   * Crear nueva conversación
   */
  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  async createConversation(@Body() dto: CreateConversationDto, @Request() req) {
    const userId = req.user.id;
    return this.chatService.createConversation(userId, dto);
  }

  /**
   * POST /chat/conversations/:id/messages
   * Enviar mensaje (HTTP fallback)
   */
  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Param('id') conversationId: string,
    @Body() dto: CreateMessageDto,
    @Request() req,
  ) {
    const userId = req.user.id;

    // Asegurar que el conversationId del parámetro coincide
    dto.conversationId = conversationId;

    return this.chatService.sendMessage(userId, dto);
  }

  /**
   * PUT /chat/conversations/:id/read
   * Marcar mensajes como leídos
   */
  @Put('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(@Param('id') conversationId: string, @Request() req) {
    const userId = req.user.id;
    return this.chatService.markAsRead(conversationId, userId);
  }
}
