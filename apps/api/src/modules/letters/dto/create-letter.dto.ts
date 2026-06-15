import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLetterDto {
  @IsString()
  @MinLength(50, { message: '再多写几句，让信更有分量（至少 50 字）' })
  @MaxLength(1000, { message: '一封信最多 1000 字' })
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  theme?: string;
}
