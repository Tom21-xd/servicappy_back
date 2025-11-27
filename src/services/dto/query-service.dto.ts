import { IsOptional, IsString, IsNumber, Min, IsEnum, IsBoolean, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PriceType, ServiceStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryServiceDto extends PaginationDto {
  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  providerId?: string;

  @IsEnum(PriceType)
  @IsOptional()
  priceType?: PriceType;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

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
  radius?: number;

  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isFeatured?: boolean;

  @IsString()
  @IsOptional()
  @IsIn(['price', 'rating', 'newest', 'popular'])
  sortBy?: string;
}
