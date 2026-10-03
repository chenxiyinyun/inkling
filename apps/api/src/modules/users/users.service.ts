import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DeletionStatus, LetterStatus, RelationStatus, UserStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { encodeGeohash, geohashDistanceKm, distanceLabel } from '../../common/geo/geohash.util';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: '用户不存在' });
    const p = user.profile;
    return {
      publicId: user.publicId,
      penName: p?.penName ?? '',
      mbti: p?.mbti ?? 'UNKNOWN',
      interestTags: Array.isArray(p?.interestTags) ? p!.interestTags : [],
      oneLiner: p?.oneLiner ?? undefined,
      invisible: p?.invisible ?? false,
      matchPreference: p?.matchPreference ?? 0.5,
      hasRegion: !!p?.geohash5,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Record<string, unknown> = {};
    if (dto.penName !== undefined) data.penName = dto.penName;
    if (dto.mbti !== undefined) data.mbti = dto.mbti;
    if (dto.interestTags !== undefined) data.interestTags = dto.interestTags;
    if (dto.oneLiner !== undefined) data.oneLiner = dto.oneLiner;
    if (dto.matchPreference !== undefined) data.matchPreference = dto.matchPreference;
    if (dto.lat !== undefined && dto.lng !== undefined) {
      data.geohash5 = encodeGeohash(dto.lat, dto.lng, 5); // 只存粗粒度区域
    }
    await this.prisma.userProfile.update({ where: { userId }, data });
    return this.getMe(userId);
  }

  async getPublicProfile(viewerId: string, publicId: string) {
    const target = await this.prisma.user.findUnique({ where: { publicId }, include: { profile: true } });
    if (!target) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: '找不到这个人' });

    const blocked = await this.prisma.block.findFirst({
      where: {
        OR: [
          { userId: viewerId, targetUserId: target.id },
          { userId: target.id, targetUserId: viewerId },
        ],
      },
    });
    if (blocked) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: '找不到这个人' });

    const viewer = await this.prisma.userProfile.findUnique({ where: { userId: viewerId } });
    const km = geohashDistanceKm(viewer?.geohash5, target.profile?.geohash5);

    return {
      publicId: target.publicId,
      penName: target.profile?.penName ?? '陌生人',
      mbti: target.profile?.mbti ?? 'UNKNOWN',
      interestTags: Array.isArray(target.profile?.interestTags) ? target.profile.interestTags : [],
      oneLiner: target.profile?.oneLiner ?? undefined,
      region: distanceLabel(km),
    };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const exists = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: '用户不存在' });

    const data: Record<string, unknown> = {};
    if (dto.invisible !== undefined) data.invisible = dto.invisible;
    await this.prisma.userProfile.update({ where: { userId }, data });
    return this.getMe(userId);
  }

  /** GDPR 数据可携：全量结构化 JSON 导出（含信件正文、笔友往来、举报与处罚）。 */
  async exportData(userId: string) {
    const [user, letters, relations, unseals, fishings, reportsMade, penalties, blocks, appeals, deletionReqs, notifications, dailyQuotas] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
        this.prisma.letter.findMany({ where: { authorId: userId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.penPalRelation.findMany({
          where: { OR: [{ userAId: userId }, { userBId: userId }] },
          include: { correspondences: { orderBy: { createdAt: 'asc' } } },
        }),
        this.prisma.unsealRecord.findMany({ where: { userId } }),
        this.prisma.fishingRecord.findMany({ where: { userId } }),
        this.prisma.report.findMany({ where: { reporterId: userId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.penalty.findMany({ where: { userId }, orderBy: { startsAt: 'asc' } }),
        this.prisma.block.findMany({ where: { userId }, include: { target: { select: { publicId: true } } } }),
        this.prisma.appeal.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.dataDeletionRequest.findMany({ where: { userId } }),
        this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, take: 200 }),
        this.prisma.dailyQuota.findMany({ where: { userId }, orderBy: { date: 'asc' }, take: 400 }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      account: {
        publicId: user?.publicId,
        email: user?.email,
        phone: user?.phone,
        status: user?.status,
        createdAt: user?.createdAt?.toISOString(),
      },
      profile: user?.profile,
      letters: letters.map((l) => ({
        publicId: l.publicId,
        body: l.body,
        theme: l.theme,
        status: l.status,
        createdAt: l.createdAt.toISOString(),
      })),
      penpals: relations.map((rel) => ({
        relationId: rel.publicId,
        status: rel.status,
        exchangeCount: rel.exchangeCount,
        createdAt: rel.createdAt.toISOString(),
        correspondences: rel.correspondences.map((c) => {
          const mine = c.senderId === userId;
          const delivered = !!c.deliveredAt;
          // 对方仍在途的信尚不可见，导出时也不泄露正文（与站内可见性一致）
          return mine || delivered
            ? { mine, body: c.body, createdAt: c.createdAt.toISOString(), deliveredAt: c.deliveredAt?.toISOString() }
            : { mine, inTransit: true };
        }),
      })),
      unseals: unseals.map((u) => ({
        letterId: u.letterId,
        replyDeadline: u.replyDeadline.toISOString(),
        replied: u.replied,
        recycledAt: u.recycledAt?.toISOString() ?? null,
      })),
      fishings: fishings.map((f) => ({ letterId: f.letterId, fishedAt: f.fishedAt.toISOString(), released: f.released })),
      reportsMade: reportsMade.map((r) => ({ reason: r.reason, detail: r.detail, status: r.status, createdAt: r.createdAt.toISOString() })),
      penalties: penalties.map((p) => ({
        publicId: p.publicId,
        type: p.type,
        reason: p.reason,
        startsAt: p.startsAt.toISOString(),
        endsAt: p.endsAt?.toISOString() ?? null,
      })),
      appeals: appeals.map((a) => ({
        publicId: a.publicId,
        targetType: a.targetType,
        targetId: a.targetId,
        reason: a.reason,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
      })),
      blocks: blocks.map((b) => ({ targetPublicId: b.target.publicId, createdAt: b.createdAt.toISOString() })),
      deletionRequests: deletionReqs.map((d) => ({ status: d.status, requestedAt: d.requestedAt.toISOString() })),
      notifications: notifications.map((n) => ({ type: n.type, title: n.title, ref: n.ref, read: n.read, createdAt: n.createdAt.toISOString() })),
      quotas: dailyQuotas.map((q) => ({ date: q.date, sendLeft: q.sendLeft, fishLeft: q.fishLeft, unsealLeft: q.unsealLeft })),
      note: '本导出为完整结构化 JSON；异步打包成文件下载（对象存储）留待 C 档。',
    };
  }

  /** GDPR 删除权：登记删除请求（幂等；由 UsersDeletionProcessor 定时推进执行）。 */
  async requestDeletion(userId: string) {
    const existing = await this.prisma.dataDeletionRequest.findFirst({
      where: { userId, status: { in: [DeletionStatus.PENDING, DeletionStatus.PROCESSING] } },
      select: { id: true },
    });
    if (!existing) {
      await this.prisma.dataDeletionRequest.create({ data: { userId } });
    }
    return { requested: true, message: '已登记注销请求，我们将在合规期限内处理。' };
  }

  /**
   * 删除请求执行器（由 UsersDeletionProcessor 定时调用）。
   * 采用「匿名化 + 注销」而非物理删除：多数外键为 RESTRICT，物理删除需跨 10+ 张表编排，
   * 且会连带销毁他人收件箱内容。执行内容：
   *  ① 抹除账号标识（email/phone/密码随机化）并置 DELETED（禁止登录）；
   *  ② 抹除名片 PII（笔名/一句话/兴趣/粗粒度区域），他人视角降级为「已注销的旅人」；
   *  ③ 停止其漂流中的信（在途/在池/被预览/待回信 → 归档；已结缘 PAIRED 保留）；
   *  ④ 封存笔友关系、清通知/双向拉黑，登记请求置 DONE。
   * 信件与笔友往来正文保留（收件方权益），但已与可识别身份解绑。
   */
  async processDeletionRequests(): Promise<number> {
    const pending = await this.prisma.dataDeletionRequest.findMany({
      where: { status: DeletionStatus.PENDING },
      orderBy: { requestedAt: 'asc' },
      take: 20,
    });

    let processed = 0;
    for (const req of pending) {
      // 认领（幂等防重）：仅在仍为 PENDING 时推进为 PROCESSING
      const claimed = await this.prisma.dataDeletionRequest.updateMany({
        where: { id: req.id, status: DeletionStatus.PENDING },
        data: { status: DeletionStatus.PROCESSING },
      });
      if (claimed.count !== 1) continue;

      // bcrypt 在事务外计算，避免长时间占用事务
      const randomHash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
      const now = new Date();
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.user.updateMany({
            where: { id: req.userId },
            data: { email: null, phone: null, passwordHash: randomHash, status: UserStatus.DELETED, frozenUntil: null },
          });
          await tx.userProfile.updateMany({
            where: { userId: req.userId },
            data: { penName: '已注销的旅人', mbti: 'UNKNOWN', interestTags: [], oneLiner: null, geohash5: null, invisible: true },
          });
          await tx.letter.updateMany({
            where: {
              authorId: req.userId,
              status: {
                in: [LetterStatus.DELIVERING, LetterStatus.FLOATING, LetterStatus.HOOKED, LetterStatus.SEALED_OPEN],
              },
            },
            data: { status: LetterStatus.ARCHIVED },
          });
          await tx.penPalRelation.updateMany({
            where: { OR: [{ userAId: req.userId }, { userBId: req.userId }], status: RelationStatus.ACTIVE },
            data: { status: RelationStatus.ARCHIVED },
          });
          await tx.notification.deleteMany({ where: { userId: req.userId } });
          await tx.block.deleteMany({ where: { OR: [{ userId: req.userId }, { targetUserId: req.userId }] } });
          await tx.dataDeletionRequest.update({
            where: { id: req.id },
            data: { status: DeletionStatus.DONE, processedAt: now },
          });
        });
        processed += 1;
      } catch (e) {
        this.logger.error(`删除请求执行失败 ${req.id}：${e}`);
        // 回退为 PENDING，下轮重试
        await this.prisma.dataDeletionRequest.updateMany({
          where: { id: req.id, status: DeletionStatus.PROCESSING },
          data: { status: DeletionStatus.PENDING },
        });
      }
    }
    return processed;
  }
}
