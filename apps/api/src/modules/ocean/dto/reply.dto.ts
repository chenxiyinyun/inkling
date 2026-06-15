import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReplyDto {
  @IsString()
  @MinLength(50, { message: '回信也多写几句吧（至少 50 字）' })
  @MaxLength(1000)
  body!: string;
}
