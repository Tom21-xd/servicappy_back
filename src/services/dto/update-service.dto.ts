import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceDto } from './create-service.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ServiceStatus } from '@prisma/client';

export class UpdateServiceDto extends PartialType(CreateServiceDto) {
  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;
}
