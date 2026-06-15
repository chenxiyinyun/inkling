import { IsDateString, IsEmail, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(72)
  password!: string;

  /** 出生日期（仅用于年龄保护）。ISO: YYYY-MM-DD */
  @IsDateString()
  birthDate!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(24)
  penName!: string;
}
