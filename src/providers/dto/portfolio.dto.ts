import { IsArray, IsString, IsOptional } from 'class-validator';

export class PortfolioDto {
  @IsArray()
  @IsString({ each: true })
  images: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videos?: string[];
}
