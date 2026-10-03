import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UsersService } from './users.service';

/** GDPR 删除请求执行器：每 10 分钟推进一次 PENDING 请求（幂等，失败下轮重试）。 */
@Injectable()
export class UsersDeletionProcessor {
  private readonly logger = new Logger(UsersDeletionProcessor.name);

  constructor(private readonly users: UsersService) {}

  @Cron('*/10 * * * *')
  async handle() {
    try {
      const processed = await this.users.processDeletionRequests();
      if (processed > 0) this.logger.log(`已处理 ${processed} 条注销请求`);
    } catch (e) {
      this.logger.error(e);
    }
  }
}
