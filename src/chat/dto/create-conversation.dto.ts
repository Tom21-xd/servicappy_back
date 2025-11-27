import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateConversationDto {
  @IsNotEmpty()
  @IsString()
  participantId: string;

  @IsString()
  @IsOptional()
  bookingId?: string;

  @IsString()
  @IsOptional()
  initialMessage?: string;
}
