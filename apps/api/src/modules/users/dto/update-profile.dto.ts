import { IsArray, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MBTI_TYPES, MBTI_UNKNOWN } from '@inkling/shared';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  penName?: string;

  @IsOptional()
  @IsIn([...MBTI_TYPES, MBTI_UNKNOWN], { message: 'MBTI 型号不合法' })
  mbti?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interestTags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  oneLiner?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  matchPreference?: number;

  /** 定位经纬度（仅用于换算 GeoHash 前 5 位，绝不落库原始坐标）。 */
  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}
