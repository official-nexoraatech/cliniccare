import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@clinic-care/shared-types';

export class UploadDocumentDto {
  @IsString()
  @MinLength(1)
  patientId!: string;

  @IsOptional()
  @IsString()
  visitId?: string;

  @IsOptional()
  @IsIn(DOCUMENT_CATEGORIES)
  category?: DocumentCategory;

  @IsOptional()
  @IsString()
  description?: string;
}
