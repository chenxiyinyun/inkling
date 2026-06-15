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

  /** GDPR 数据可携：导出（MVP 精简）。 */
  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    const [letters, relations] = await Promise.all([
      this.prisma.letter.count({ where: { authorId: userId } }),
      this.prisma.penPalRelation.count({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
    ]);
    return {
      account: { publicId: user?.publicId, email: user?.email, phone: user?.phone, createdAt: user?.createdAt },
      profile: user?.profile,
      stats: { letters, relations },
      note: '完整导出（含全部信件内容）在生产期提供异步打包下载。',
    };
  }

  /** GDPR 删除权：登记删除请求（异步处理）。 */
  async requestDeletion(userId: string) {
    await this.prisma.dataDeletionRequest.create({ data: { userId } });
    return { requested: true, message: '已登记注销请求，我们将在合规期限内处理。' };
  }
}
