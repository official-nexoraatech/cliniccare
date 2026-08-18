import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class RescheduleAppointmentDto {
  @IsISO8601()
  newDate!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  newTimeSlot?: string;

  @IsISO8601()
  expectedUpdatedAt!: string;
}
