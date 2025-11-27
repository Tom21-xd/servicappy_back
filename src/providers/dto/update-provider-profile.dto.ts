import { PartialType } from '@nestjs/mapped-types';
import { CreateProviderProfileDto } from './create-provider-profile.dto';

export class UpdateProviderProfileDto extends PartialType(CreateProviderProfileDto) {}
