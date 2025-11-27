import { IsString, IsObject } from 'class-validator';

export class SetConfigDto {
  @IsString()
  key: string;

  @IsObject()
  value: Record<string, any>;
}
