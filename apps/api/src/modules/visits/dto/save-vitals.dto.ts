import { IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class SaveVitalsDto {
  @IsOptional()
  @Matches(/^\d{2,3}\/\d{2,3}$/, { message: 'BP must be in the form systolic/diastolic, e.g. 120/80' })
  bp?: string;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(250)
  pulse?: number;

  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(45)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  weight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(250)
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  spo2?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  respiratoryRate?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  sugarRandom?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
