import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { OceanService } from './ocean.service';
import { ReplyDto } from './dto/reply.dto';

@Controller()
export class OceanController {
  constructor(private readonly ocean: OceanService) {}

  /** 打捞一封漂流信 */
  @Post('ocean/fish')
  fish(@CurrentUser() user: AuthUser) {
    return this.ocean.fish(user.userId);
  }

  @Get('fishing/:fishingId/preview')
  preview(@CurrentUser() user: AuthUser, @Param('fishingId') fishingId: string) {
    return this.ocean.preview(user.userId, fishingId);
  }

  @Post('fishing/:fishingId/release')
  release(@CurrentUser() user: AuthUser, @Param('fishingId') fishingId: string) {
    return this.ocean.release(user.userId, fishingId);
  }

  /** 拆开火漆，读全文 */
  @Post('fishing/:fishingId/unseal')
  unseal(@CurrentUser() user: AuthUser, @Param('fishingId') fishingId: string) {
    return this.ocean.unseal(user.userId, fishingId);
  }

  /** 7 天内回信结缘 */
  @Post('unseals/:unsealId/reply')
  reply(@CurrentUser() user: AuthUser, @Param('unsealId') unsealId: string, @Body() dto: ReplyDto) {
    return this.ocean.reply(user.userId, unsealId, dto);
  }
}
