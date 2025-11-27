import { IsNotEmpty, IsString, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AttachmentDto {
  @IsString()
  url: string;

  @IsString()
  type: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  size?: number;
}

export class CreateMessageDto {
  @IsNotEmpty()
  @IsString()
  conversationId: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsEnum(['text', 'image', 'file', 'system'])
  @IsOptional()
  type?: string = 'text';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @IsOptional()
  attachments?: AttachmentDto[];

  @IsString()
  @IsOptional()
  receiverId?: string;
}
