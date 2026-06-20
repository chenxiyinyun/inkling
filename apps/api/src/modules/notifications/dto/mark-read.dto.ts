import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class MarkReadDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];

  @IsOptional()
  @IsBoolean()
  all?: boolean;
}
