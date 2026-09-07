import { IsString, MinLength } from 'class-validator';

/** Reused for both cancelling and waiving a single bill item. */
export class RemoveBillItemDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
