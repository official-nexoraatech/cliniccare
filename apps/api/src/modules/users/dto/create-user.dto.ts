import { IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
import type { RoleName } from '@clinic-care/shared-types';

// Mirrors apps/web/src/pages/settings/UsersPage.tsx createUserSchema — frontend
// and backend must independently reject the same bad input.
export class CreateUserDto {
  @IsString()
  @Matches(/^[A-Za-z ]+$/, { message: 'Name can only contain letters and spaces' })
  name!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9]+$/, { message: 'Username can only contain letters and numbers, no spaces or special characters' })
  username!: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?!(\d)\1{9}$)[6-9]\d{9}$/, { message: 'Enter a valid 10-digit mobile number' })
  mobile?: string;

  @IsString()
  @MinLength(4)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(4, 4)
  pin?: string;

  @IsString()
  @MinLength(1)
  role!: RoleName;
}
