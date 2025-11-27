import { IsString, IsEnum, IsOptional, IsArray } from 'class-validator';

export enum DisputeReason {
  SERVICE_NOT_PROVIDED = 'SERVICE_NOT_PROVIDED',
  POOR_QUALITY = 'POOR_QUALITY',
  WRONG_SERVICE = 'WRONG_SERVICE',
  OVERCHARGED = 'OVERCHARGED',
  PROVIDER_NO_SHOW = 'PROVIDER_NO_SHOW',
  CLIENT_NO_SHOW = 'CLIENT_NO_SHOW',
  OTHER = 'OTHER',
}

export class CreateDisputeDto {
  @IsString()
  bookingId: string;

  @IsEnum(DisputeReason)
  reason: DisputeReason;

  @IsString()
  description: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  evidence?: string[];
}
