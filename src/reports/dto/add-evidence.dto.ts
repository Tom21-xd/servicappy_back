import { IsString, IsArray } from 'class-validator';

export class AddEvidenceDto {
  @IsArray()
  @IsString({ each: true })
  evidence: string[];
}
