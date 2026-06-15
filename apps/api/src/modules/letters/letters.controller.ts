import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { LettersService } from './letters.service';
import { CreateLetterDto } from './dto/create-letter.dto';

@Controller('letters')
export class LettersController {
  constructor(private readonly letters: LettersService) {}

  /** MVP 便捷：草稿 + 投递一步完成 */
  @Post('compose')
  compose(@CurrentUser() user: AuthUser, @Body() dto: CreateLetterDto) {
    return this.letters.compose(user.userId, dto);
  }

  @Post('draft')
  draft(@CurrentUser() user: AuthUser, @Body() dto: CreateLetterDto) {
    return this.letters.createDraft(user.userId, dto);
  }

  @Post(':publicId/submit')
  submit(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.letters.submit(user.userId, publicId);
  }

  /** 我寄出的信 */
  @Get()
  listMine(@CurrentUser() user: AuthUser) {
    return this.letters.listMine(user.userId);
  }

  @Get(':publicId')
  getOne(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.letters.getOne(user.userId, publicId);
  }
}
