import { IsString, IsOptional, IsBoolean, IsNumber, IsDateString, Min } from 'class-validator';

export class CreateBannerDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  subtitle?: string;

  @IsString()
  imageUrl: string;

  @IsString()
  @IsOptional()
  linkUrl?: string;

  @IsString()
  @IsOptional()
  linkType?: string; // "service", "category", "external", "promotion"

  @IsString()
  @IsOptional()
  linkRefId?: string;

  @IsString()
  @IsOptional()
  position?: string; // "home", "category", "search"

  @IsNumber()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @IsDateString()
  @IsOptional()
  endsAt?: string;
}
