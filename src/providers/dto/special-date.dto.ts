import { IsDateString, IsBoolean, IsOptional, IsString } from 'class-validator';

export class SpecialDateDto {
  @IsDateString()
  date: string;

  @IsBoolean()
  isAvailable: boolean;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
