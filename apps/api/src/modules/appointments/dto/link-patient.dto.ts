import { IsString, MinLength } from 'class-validator';

export class LinkPatientDto {
  @IsString()
  @MinLength(1)
  patientId!: string;
}
