import { IsString, IsOptional, IsNumber, IsBoolean, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProviderProfileDto {
  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  headline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  yearsOfExperience?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  serviceRadius?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  travelFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minimumBookingHours?: number;

  @IsOptional()
  @IsString()
  cancellationPolicy?: string;

  @IsOptional()
  @IsBoolean()
  instantBooking?: boolean;
}
