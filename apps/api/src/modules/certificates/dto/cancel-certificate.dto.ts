import { IsString, MinLength } from 'class-validator';

export class CancelCertificateDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
