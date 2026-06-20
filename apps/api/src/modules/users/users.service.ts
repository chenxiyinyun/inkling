import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AgeTier } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { encodeGeohash, geohashDistanceKm, distanceLabel } from '../../common/geo/geohash.util';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class UsersService {
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
      ageTier: user.ageTier,
      guardianMode: p?.guardianMode ?? false,
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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: '用户不存在' });

    const data: Record<string, unknown> = {};
    if (dto.invisible !== undefined) data.invisible = dto.invisible;
    if (dto.guardianMode !== undefined) {
      // 未成年人不可关闭守护模式
      if (user.ageTier === AgeTier.TEEN && dto.guardianMode === false) {
        throw new ForbiddenException({ code: 'GUARDIAN_LOCKED', message: '未成年用户的守护模式不可关闭' });
      }
      data.guardianMode = dto.guardianMode;
    }
    await this.prisma.userProfile.update({ where: { userId }, data });
    return this.getMe(userId);
  }

  /** GDPR 数据可携：全量结构化 JSON 导出（含信件正文、笔友往来、举报与处罚）。 */
  async exportData(userId: string) {
    const [user, letters, relations, unseals, fishings, reportsMade, penalties, blocks, appeals, deletionReqs] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true, parentalConsent: true } }),
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
      ]);

    return {
      exportedAt: new Date().toISOString(),
      account: {
        publicId: user?.publicId,
        email: user?.email,
        phone: user?.phone,
        status: user?.status,
        ageTier: user?.ageTier,
        createdAt: user?.createdAt?.toISOString(),
      },
      profile: user?.profile,
      parentalConsent: user?.parentalConsent ?? null,
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
      note: '本导出为完整结构化 JSON；异步打包成文件下载（对象存储）留待 C 档。',
    };
  }

  /** GDPR 删除权：登记删除请求（异步处理）。 */
  async requestDeletion(userId: string) {
    await this.prisma.dataDeletionRequest.create({ data: { userId } });
    return { requested: true, message: '已登记注销请求，我们将在合规期限内处理。' };
  }
}
