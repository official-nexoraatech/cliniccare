import { IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';

export class UpdateCounterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/^[A-Za-z]{1,10}$/, { message: 'Prefix must be 1-10 letters only' })
  prefix?: string;

  // Setting this below the highest number already issued will let the next
  // generated ID collide with an existing record — the admin screen warns about
  // this, but the API trusts the caller (same as any other admin-only config edit).
  @IsOptional()
  @IsInt()
  @Min(0)
  currentValue?: number;
}
