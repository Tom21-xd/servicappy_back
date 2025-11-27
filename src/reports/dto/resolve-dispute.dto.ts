import { IsString, IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { DisputeStatus } from '@prisma/client';

export class ResolveDisputeDto {
  @IsEnum(DisputeStatus)
  status: DisputeStatus;

  @IsString()
  @IsOptional()
  resolution?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  refundAmount?: number;
}
