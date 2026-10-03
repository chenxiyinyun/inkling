import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersDeletionProcessor } from './users.deletion.processor';

@Module({
  providers: [UsersService, UsersDeletionProcessor],
  controllers: [UsersController],
})
export class UsersModule {}
