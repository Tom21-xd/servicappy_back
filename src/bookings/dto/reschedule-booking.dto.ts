import { IsDateString, IsString, IsOptional } from 'class-validator';

export class RescheduleBookingDto {
  @IsDateString()
  newDate: string;

  @IsString()
  newTime: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
