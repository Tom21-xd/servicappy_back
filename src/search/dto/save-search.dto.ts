import { IsString, IsOptional, IsInt, IsObject, Min } from 'class-validator';

export class SaveSearchDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;

  @IsOptional()
  @IsInt()
  @Min(0)
  resultsCount?: number;
}
