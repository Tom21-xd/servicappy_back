import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ServiceStatus } from '@prisma/client';

export class ModerateServiceDto {
  @IsEnum(ServiceStatus)
  status: ServiceStatus;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
