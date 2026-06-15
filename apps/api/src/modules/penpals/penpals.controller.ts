import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { PenpalsService } from './penpals.service';
import { SendCorrespondenceDto } from './dto/send-correspondence.dto';

@Controller('penpals')
export class PenpalsController {
  constructor(private readonly penpals: PenpalsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.penpals.list(user.userId);
  }

  @Get(':publicId')
  getOne(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.penpals.getOne(user.userId, publicId);
  }

  @Get(':publicId/letters')
  letters(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.penpals.correspondences(user.userId, publicId);
  }

  @Post(':publicId/letters')
  send(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string, @Body() dto: SendCorrespondenceDto) {
    return this.penpals.send(user.userId, publicId, dto);
  }

  @Post(':publicId/archive')
  archive(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.penpals.archive(user.userId, publicId);
  }
}
