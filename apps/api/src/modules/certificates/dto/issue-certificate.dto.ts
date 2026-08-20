import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { CERTIFICATE_TYPES, type CertificateType } from '@clinic-care/shared-types';

export class IssueCertificateDto {
  @IsString()
  @MinLength(1)
  patientId!: string;

  @IsOptional()
  @IsString()
  visitId?: string;

  @IsIn(CERTIFICATE_TYPES)
  type!: CertificateType;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsString()
  @MinLength(1)
  bodyText!: string;
}
