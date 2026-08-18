import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class RescheduleFollowUpDto {
  @IsISO8601()
  newDate!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
