import { IsString, IsEnum } from 'class-validator';

export enum FavoriteType {
  SERVICE = 'SERVICE',
  PROVIDER = 'PROVIDER',
}

export class ToggleFavoriteDto {
  @IsString()
  targetId: string;

  @IsEnum(FavoriteType)
  type: FavoriteType;
}
