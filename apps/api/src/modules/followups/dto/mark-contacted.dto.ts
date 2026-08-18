import { IsIn, IsOptional, IsString } from 'class-validator';
import { CONTACT_MODES, CONTACT_RESULTS, type ContactMode, type ContactResult } from '@clinic-care/shared-types';

export class MarkContactedDto {
  @IsIn(CONTACT_MODES)
  contactMode!: ContactMode;

  @IsIn(CONTACT_RESULTS)
  contactResult!: ContactResult;

  @IsOptional()
  @IsString()
  remark?: string;
}
