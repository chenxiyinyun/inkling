import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RelationStatus, ReviewAction, ReviewTargetType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { DeliveryService } from '../delivery/delivery.service';
import { geohashDistanceKm } from '../../common/geo/geohash.util';
import { SendCorrespondenceDto } from './dto/send-correspondence.dto';

@Injectable()
export class PenpalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly delivery: DeliveryService,
  ) {}

  private partnerOf(relation: any, userId: string) {
    const isA = relation.userAId === userId;
    const u = isA ? relation.userB : relation.userA;
    return {
      publicId: u.publicId,
      penName: u.profile?.penName ?? '笔友',
      mbti: u.profile?.mbti ?? 'UNKNOWN',
      interestTags: Array.isArray(u.profile?.interestTags) ? u.profile.interestTags : [],
      oneLiner: u.profile?.oneLiner ?? undefined,
    };
  }

  private async isBlockedBetween(aId: string, bId: string): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: { OR: [{ userId: aId, targetUserId: bId }, { userId: bId, targetUserId: aId }] },
      select: { id: true },
    });
    return !!block;
  }

  private async loadRelation(userId: string, publicId: string) {
    const rel = await this.prisma.penPalRelation.findUnique({
      where: { publicId },
      include: {
        userA: { select: { id: true, publicId: true, profile: true } },
        userB: { select: { id: true, publicId: true, profile: true } },
      },
    });
    if (!rel || (rel.userAId !== userId && rel.userBId !== userId)) {
      throw new NotFoundException({ code: 'RELATION_NOT_FOUND', message: '找不到这段信缘' });
    }
    return rel;
  }

  async list(userId: string) {
    const rels = await this.prisma.penPalRelation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }], status: { not: RelationStatus.BLOCKED } },
      include: {
        userA: { select: { publicId: true, profile: true } },
        userB: { select: { publicId: true, profile: true } },
      },
      orderBy: { lastLetterAt: 'desc' },
    });
    return rels.map((rel) => ({
      relationId: rel.publicId,
      partner: this.partnerOf(rel, userId),
      status: rel.status,
      exchangeCount: rel.exchangeCount,
      lastLetterAt: rel.lastLetterAt?.toISOString(),
    }));
  }

  async getOne(userId: string, publicId: string) {
    const rel = await this.loadRelation(userId, publicId);
    return {
      relationId: rel.publicId,
      partner: this.partnerOf(rel, userId),
      status: rel.status,
      exchangeCount: rel.exchangeCount,
      lastLetterAt: rel.lastLetterAt?.toISOString(),
    };
  }

  async correspondences(userId: string, publicId: string) {
    const rel = await this.loadRelation(userId, publicId);
    const list = await this.prisma.correspondence.findMany({
      where: { relationId: rel.id },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    const now = new Date();
    return list
      .map((c) => {
        const mine = c.senderId === userId;
        const delivered = !!c.deliveredAt && c.deliveredAt <= now;
        // 对方寄来但仍在途的信，收信人尚不可见正文
        if (!mine && !delivered) return { id: c.id, mine, inTransit: true } as any;
        return {
          id: c.id,
          mine,
          inTransit: mine && !delivered,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          deliveredAt: c.deliveredAt?.toISOString(),
        };
      })
      .filter(Boolean);
  }

  async send(userId: string, publicId: string, dto: SendCorrespondenceDto) {
    const rel = await this.loadRelation(userId, publicId);
    if (rel.status === RelationStatus.ARCHIVED || rel.status === RelationStatus.BLOCKED) {
      throw new ForbiddenException({ code: 'RELATION_CLOSED', message: '这段信缘已封存' });
    }

    // 双向拉黑则不得再发信（关系状态可能尚未同步为 BLOCKED，直接查 Block 表兜底）
    const partnerId = rel.userAId === userId ? rel.userBId : rel.userAId;
    if (await this.isBlockedBetween(userId, partnerId)) {
      throw new ForbiddenException({ code: 'RELATION_BLOCKED', message: '你与对方之间已无法通信' });
    }

    const result = this.moderation.review(dto.body);
    await this.moderation.logReview(ReviewTargetType.CORRESPONDENCE, rel.id, result);
    if (result.action !== ReviewAction.PASS) {
      throw new BadRequestException({ code: 'CONTENT_BLOCKED', message: '信里似乎有联系方式或不友善的内容，修改后再寄出' });
    }

    const aProf = rel.userA.profile;
    const bProf = rel.userB.profile;
    const km = geohashDistanceKm(aProf?.geohash5, bProf?.geohash5);
    const { deliverAt, vehicleLabel } = this.delivery.correspondenceDelivery(km);

    await this.prisma.$transaction([
      this.prisma.correspondence.create({
        data: { relationId: rel.id, senderId: userId, body: dto.body, reviewStatus: result.action, deliverAt },
      }),
      this.prisma.penPalRelation.update({
        where: { id: rel.id },
        data: { exchangeCount: { increment: 1 }, lastLetterAt: new Date(), status: RelationStatus.ACTIVE },
      }),
    ]);

    return { sent: true, vehicleLabel, deliverAt: deliverAt.toISOString() };
  }

  async archive(userId: string, publicId: string) {
    const rel = await this.loadRelation(userId, publicId);
    await this.prisma.penPalRelation.update({ where: { id: rel.id }, data: { status: RelationStatus.ARCHIVED } });
    return { archived: true };
  }
}
