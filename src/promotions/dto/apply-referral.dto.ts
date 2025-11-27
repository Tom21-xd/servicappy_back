import { IsString } from 'class-validator';

export class ApplyReferralDto {
  @IsString()
  referralCode: string;
}
