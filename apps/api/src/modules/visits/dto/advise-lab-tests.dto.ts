import { ArrayMinSize, IsArray, IsString, MinLength } from 'class-validator';

export class AdviseLabTestsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  testNames!: string[];
}
