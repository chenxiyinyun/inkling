import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  /** 守护模式（未成年人不可关闭） */
  @IsOptional()
  @IsBoolean()
  guardianMode?: boolean;

  /** 闭关 / 隐身 */
  @IsOptional()
  @IsBoolean()
  invisible?: boolean;
}
