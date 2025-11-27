import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class ValidatePromotionDto {
  @IsString()
  code: string;

  @IsString()
  serviceId: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  orderAmount?: number;
}
