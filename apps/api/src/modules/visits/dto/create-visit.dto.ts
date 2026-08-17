import { IsIn, IsOptional, IsString } from 'class-validator';
import { VISIT_TYPES, type VisitType } from '@clinic-care/shared-types';

export class CreateVisitDto {
  @IsString()
  patientId!: string;

  @IsOptional()
  @IsIn(VISIT_TYPES)
  visitType?: VisitType;
}
