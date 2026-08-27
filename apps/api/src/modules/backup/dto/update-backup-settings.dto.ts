import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateBackupSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  /** Omitted = leave the stored connection string unchanged; '' = clear it. */
  @IsOptional()
  @IsString()
  atlasConnectionString?: string;
}
