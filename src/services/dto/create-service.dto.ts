import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsEnum,
  IsNumber,
  Min,
  IsOptional,
  MaxLength,
  IsArray,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PriceType } from '@prisma/client';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  description: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  shortDescription?: string;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsEnum(PriceType)
  priceType: PriceType;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  priceMax?: number;

  @IsString()
  @IsOptional()
  currency?: string = 'COP';

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  durationMinutes?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  @IsIn(['Domicilio', 'En local', 'Ambos'])
  serviceArea?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  serviceRadius?: number;

  @IsBoolean()
  @IsOptional()
  instantBooking?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresDeposit?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  depositAmount?: number;
}
