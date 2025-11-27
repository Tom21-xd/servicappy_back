import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
