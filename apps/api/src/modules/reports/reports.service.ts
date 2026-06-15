import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveUserId(publicId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({ where: { publicId }, select: { id: true } });
    if (!u) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: '找不到这个人' });
    return u.id;
  }

  async createReport(reporterId: string, dto: CreateReportDto) {
    const targetUserId = await this.resolveUserId(dto.targetPublicId);
    await this.prisma.report.create({
      data: { reporterId, targetUserId, reason: dto.reason, detail: dto.detail },
    });
    return { reported: true, message: '已收到你的投诉，邮局会认真核查。' };
  }

  async block(userId: string, targetPublicId: string) {
    const targetUserId = await this.resolveUserId(targetPublicId);
    if (targetUserId === userId) throw new BadRequestException({ code: 'CANNOT_BLOCK_SELF', message: '不能拉黑自己' });
    await this.prisma.block.upsert({
      where: { userId_targetUserId: { userId, targetUserId } },
      create: { userId, targetUserId },
      update: {},
    });
    return { blocked: true };
  }

  async unblock(userId: string, targetPublicId: string) {
    const targetUserId = await this.resolveUserId(targetPublicId);
    await this.prisma.block.deleteMany({ where: { userId, targetUserId } });
    return { unblocked: true };
  }

  async listBlocks(userId: string) {
    const blocks = await this.prisma.block.findMany({
      where: { userId },
      include: { target: { select: { publicId: true, profile: { select: { penName: true } } } } },
    });
    return blocks.map((b) => ({ publicId: b.target.publicId, penName: b.target.profile?.penName ?? '某人', createdAt: b.createdAt.toISOString() }));
  }

  async appeal(userId: string, detail: string) {
    // MVP 占位：申诉进入人工复核队列（生产期落表 + SLA + 独立复核岗）
    return { received: true, message: '申诉已提交，我们会人工复核。' };
  }

  async myPenalties(userId: string) {
    const list = await this.prisma.penalty.findMany({ where: { userId }, orderBy: { startsAt: 'desc' } });
    return list.map((p) => ({ type: p.type, reason: p.reason, startsAt: p.startsAt.toISOString(), endsAt: p.endsAt?.toISOString() }));
  }
}
