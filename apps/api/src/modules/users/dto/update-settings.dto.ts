import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  /** 闭关 / 隐身 */
  @IsOptional()
  @IsBoolean()
  invisible?: boolean;
}
