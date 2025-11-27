import { IsString, MinLength } from 'class-validator';

export class ProviderResponseDto {
  @IsString()
  @MinLength(5)
  response: string;
}
