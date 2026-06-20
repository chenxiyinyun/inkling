import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAppealDto {
  /** 申诉对象类别：penalty / rejected / age_gate 等（自由文本）。 */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  targetType?: string;

  /** 被申诉对象的公开 id（如 penalty.publicId）。 */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  targetId?: string;

  @IsString()
  @MaxLength(500)
  reason!: string;
}
