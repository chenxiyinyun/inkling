import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user.userId);
  }

  @Patch('me/profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.userId, dto);
  }

  /** 新手引导提交资料（等同更新资料） */
  @Post('onboarding/profile')
  onboarding(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.userId, dto);
  }

  @Patch('me/settings')
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.users.updateSettings(user.userId, dto);
  }

  @Get('profiles/:publicId')
  publicProfile(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.users.getPublicProfile(user.userId, publicId);
  }

  @Post('me/export')
  exportData(@CurrentUser() user: AuthUser) {
    return this.users.exportData(user.userId);
  }

  @Delete('me')
  requestDeletion(@CurrentUser() user: AuthUser) {
    return this.users.requestDeletion(user.userId);
  }
}
