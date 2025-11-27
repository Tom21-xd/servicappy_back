import { IsString, IsDateString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  serviceId: string;

  @IsOptional()
  @IsString()
  packageId?: string;

  @IsDateString()
  scheduledDate: string;

  @IsString()
  scheduledStartTime: string;

  @IsOptional()
  @IsString()
  scheduledEndTime?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  addressNotes?: string;

  @IsOptional()
  @IsString()
  clientNotes?: string;

  @IsOptional()
  @IsString()
  promotionCode?: string;
}
