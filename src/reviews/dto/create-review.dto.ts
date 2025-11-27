import { IsString, IsNumber, IsOptional, IsArray, Min, Max, MinLength } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  bookingId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  overallRating: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  qualityRating?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  punctualityRating?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  communicationRating?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  valueRating?: number;

  @IsString()
  @MinLength(10)
  comment: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
