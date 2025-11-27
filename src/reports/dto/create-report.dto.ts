import { IsString, IsEnum, IsOptional, IsArray } from 'class-validator';
import { ReportReason } from '@prisma/client';

export class CreateReportDto {
  @IsString()
  targetType: string; // 'user', 'service', 'review', 'message'

  @IsString()
  targetRefId: string; // ID del objeto reportado

  @IsString()
  @IsOptional()
  targetId?: string; // ID del usuario objetivo (si aplica)

  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  evidence?: string[];
}
