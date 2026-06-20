import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LetterStatus, NotificationType, ReviewAction, ReviewTargetType } from '@prisma/client';
import { MbtiValue, REPLY_WINDOW_DAYS, PREVIEW_LOCK_SECONDS } from '@inkling/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { QuotaService } from '../quota/quota.service';
import { ModerationService } from '../moderation/moderation.service';
import { PenaltyService } from '../penalty/penalty.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DeliveryService } from '../delivery/delivery.service';
import { geohashDistanceKm, distanceLabel } from '../../common/geo/geohash.util';
import { scoreCandidate } from './ocean-score';
import { ReplyDto } from './dto/reply.dto';

@Injectable()
export class OceanService {
  private readonly logger = new Logger(OceanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly quota: QuotaService,
    private readonly moderation: ModerationService,
    private readonly penalty: PenaltyService,
    private readonly delivery: DeliveryService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  private async blockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.prisma.block.findMany({
      where: { OR: [{ userId }, { targetUserId: userId }] },
      select: { userId: true, targetUserId: true },
    });
    const ids = new Set<string>();
    for (const b of blocks) {
      ids.add(b.userId === userId ? b.targetUserId : b.userId);
    }
    return [...ids];
  }

  /** 打捞一封漂流信。 */
  async fish(userId: string) {
    const me = await this.prisma.userProfile.findUnique({ where: { userId } });
    const blocked = await this.blockedUserIds(userId);

    // 候选召回：在池、非自己、未被我打捞过、作者未拉黑、未隐身
    const candidates = await this.prisma.letter.findMany({
      where: {
        status: LetterStatus.FLOATING,
        authorId: { not: userId, notIn: blocked.length ? blocked : undefined },
        poolVisibleAt: { lte: new Date() },
        fishings: { none: { userId } },
        author: { profile: { invisible: false } },
      },
      include: { author: { select: { publicId: true, profile: true } }, previewSnapshot: true },
      orderBy: { poolVisibleAt: 'asc' },
      take: 50,
    });

    if (candidates.length === 0) {
      throw new NotFoundException({
        code: 'OCEAN_EMPTY',
        message: '此刻海面很平静，没有打捞到信。换个时段，也许会遇见。',
      });
    }

    // 偏好打分 + 轻随机
    const pref = me?.matchPreference ?? 0.5;
    const myTags = Array.isArray(me?.interestTags) ? (me!.interestTags as string[]) : [];
    const scored = candidates
      .map((c) => {
        const cp = c.author.profile;
        const cTags = Array.isArray(cp?.interestTags) ? (cp!.interestTags as string[]) : [];
        const score = scoreCandidate({
          myMbti: (me?.mbti ?? 'UNKNOWN') as MbtiValue,
          candidateMbti: (cp?.mbti ?? 'UNKNOWN') as MbtiValue,
          preference: pref,
          myTags,
          candidateTags: cTags,
          distanceKm: geohashDistanceKm(me?.geohash5, cp?.geohash5),
        });
        return { c, score };
      })
      .sort((a, b) => b.score - a.score);

    // 取 Top-K 轻随机，注入 serendipity
    const topK = scored.slice(0, Math.min(5, scored.length));
    const order = [...topK].sort(() => Math.random() - 0.5);

    // 扣打捞配额（确认有候选后）
    await this.quota.consume(userId, 'fish');

    const lockSeconds = this.config.get<number>('previewLockSeconds') ?? PREVIEW_LOCK_SECONDS;
    const lockUntil = new Date(Date.now() + lockSeconds * 1000);

    for (const { c } of order) {
      // CAS：FLOATING → HOOKED（预览锁，对他人隐藏）
      const res = await this.prisma.letter.updateMany({
        where: { id: c.id, status: LetterStatus.FLOATING },
        data: { status: LetterStatus.HOOKED },
      });
      if (res.count === 0) continue; // 被人抢先，试下一封
      try {
        const fishing = await this.prisma.fishingRecord.create({
          data: { userId, letterId: c.id, lockUntil },
        });
        // 去人格化弱通知：告知作者「有人拾起了你的一封信」，绝不透露打捞者身份
        try {
          await this.notifications.create(c.authorId, NotificationType.LETTER_FISHED, '有人在海面拾起了你的一封信', {
            letterPublicId: c.publicId,
          });
        } catch (e) {
          this.logger.error(`LETTER_FISHED 通知失败: ${e}`);
        }
        return this.buildPreview(fishing.id, c, me?.geohash5, lockUntil);
      } catch {
        // 唯一约束等异常：回滚锁，试下一封
        await this.prisma.letter.updateMany({ where: { id: c.id, status: LetterStatus.HOOKED }, data: { status: LetterStatus.FLOATING } });
      }
    }

    // 全部抢锁失败：退还配额
    await this.quota.refund(userId, 'fish');
    throw new BadRequestException({ code: 'OCEAN_BUSY', message: '刚要捞起的信被别人取走了，再试一次吧' });
  }

  private buildPreview(fishingId: string, letter: any, myGeohash: string | null | undefined, lockUntil: Date) {
    const cp = letter.author.profile;
    const km = geohashDistanceKm(myGeohash, cp?.geohash5);
    const tags = Array.isArray(letter.previewSnapshot?.partialTags) ? letter.previewSnapshot.partialTags : [];
    return {
      fishingId,
      lockUntil: lockUntil.toISOString(),
      penName: cp?.penName ?? '陌生人',
      mbti: cp?.mbti ?? 'UNKNOWN',
      partialTags: tags,
      bodyExcerpt: letter.previewSnapshot?.bodyExcerpt ?? '',
      theme: letter.theme ?? undefined,
      distanceLabel: distanceLabel(km),
      vehicleLabel: `由${this.delivery.vehicleLabel(km)}送达`,
    };
  }

  /** 预览（锁内重看）。 */
  async preview(userId: string, fishingId: string) {
    const fishing = await this.prisma.fishingRecord.findUnique({ where: { id: fishingId } });
    if (!fishing || fishing.userId !== userId) throw new NotFoundException({ code: 'FISHING_NOT_FOUND', message: '找不到这次打捞' });
    const letter = await this.prisma.letter.findUnique({
      where: { id: fishing.letterId },
      include: { author: { select: { publicId: true, profile: true } }, previewSnapshot: true },
    });
    if (!letter) throw new NotFoundException({ code: 'LETTER_NOT_FOUND', message: '这封信已不在' });
    const me = await this.prisma.userProfile.findUnique({ where: { userId } });
    return this.buildPreview(fishing.id, letter, me?.geohash5, fishing.lockUntil);
  }

  /** 放回海面（不退打捞次数）。 */
  async release(userId: string, fishingId: string) {
    const fishing = await this.prisma.fishingRecord.findUnique({ where: { id: fishingId } });
    if (!fishing || fishing.userId !== userId) throw new NotFoundException({ code: 'FISHING_NOT_FOUND', message: '找不到这次打捞' });
    await this.prisma.$transaction([
      this.prisma.letter.updateMany({ where: { id: fishing.letterId, status: LetterStatus.HOOKED }, data: { status: LetterStatus.FLOATING } }),
      this.prisma.fishingRecord.update({ where: { id: fishing.id }, data: { released: true } }),
    ]);
    return { released: true };
  }

  /** 拆开火漆：HOOKED → SEALED_OPEN，启动 7 天回信窗口。 */
  async unseal(userId: string, fishingId: string) {
    const fishing = await this.prisma.fishingRecord.findUnique({ where: { id: fishingId } });
    if (!fishing || fishing.userId !== userId) throw new NotFoundException({ code: 'FISHING_NOT_FOUND', message: '找不到这次打捞' });
    if (fishing.released) throw new BadRequestException({ code: 'ALREADY_RELEASED', message: '这封信已放回海面' });

    await this.quota.consume(userId, 'unseal');

    const lockKey = `unseal:${fishing.letterId}`;
    const token = await this.redis.acquireLock(lockKey, 10);
    if (!token) {
      await this.quota.refund(userId, 'unseal');
      throw new BadRequestException({ code: 'UNSEAL_BUSY', message: '这封信正被处理，稍候再试' });
    }
    try {
      // CAS：HOOKED → SEALED_OPEN。并发互斥真正靠 `where: { status: HOOKED }`（只有一个请求能命中）；
      // version 自增仅作变更审计，Redis 锁是第二道闸。双拆封由这三者共同杜绝。
      const res = await this.prisma.letter.updateMany({
        where: { id: fishing.letterId, status: LetterStatus.HOOKED },
        data: { status: LetterStatus.SEALED_OPEN, version: { increment: 1 } },
      });
      if (res.count === 0) {
        await this.quota.refund(userId, 'unseal');
        throw new BadRequestException({ code: 'UNSEAL_FAILED', message: '这封信刚被取走了，再打捞看看' });
      }

      const replyDeadline = new Date(Date.now() + (this.config.get<number>('replyWindowDays') ?? REPLY_WINDOW_DAYS) * 86400000);
      const unsealRec = await this.prisma.unsealRecord.create({ data: { userId, letterId: fishing.letterId, replyDeadline } });

      const letter = await this.prisma.letter.findUnique({
        where: { id: fishing.letterId },
        include: { author: { select: { publicId: true, profile: true } } },
      });
      const cp = letter!.author.profile;
      return {
        unsealId: unsealRec.id,
        letterId: letter!.publicId,
        author: {
          publicId: letter!.author.publicId,
          penName: cp?.penName ?? '陌生人',
          mbti: cp?.mbti ?? 'UNKNOWN',
          interestTags: Array.isArray(cp?.interestTags) ? cp!.interestTags : [],
          oneLiner: cp?.oneLiner ?? undefined,
        },
        body: letter!.body,
        theme: letter!.theme ?? undefined,
        replyDeadline: replyDeadline.toISOString(),
      };
    } finally {
      await this.redis.releaseLock(lockKey, token);
    }
  }

  /** 在 7 天内回信 → 结缘成笔友。 */
  async reply(userId: string, unsealId: string, dto: ReplyDto) {
    const unseal = await this.prisma.unsealRecord.findUnique({ where: { id: unsealId }, include: { letter: true } });
    if (!unseal || unseal.userId !== userId) throw new NotFoundException({ code: 'UNSEAL_NOT_FOUND', message: '找不到这封待回的信' });
    if (unseal.replied) throw new BadRequestException({ code: 'ALREADY_REPLIED', message: '你已经回过这封信了' });
    if (unseal.replyDeadline < new Date()) throw new BadRequestException({ code: 'WINDOW_CLOSED', message: '回信潮汐已过，信重新漂回了海面' });
    if (unseal.letter.status !== LetterStatus.SEALED_OPEN) {
      throw new BadRequestException({ code: 'LETTER_NOT_OPEN', message: '这封信的状态已改变' });
    }

    const result = await this.moderation.review(dto.body);
    const reviewId = await this.moderation.logReview(ReviewTargetType.CORRESPONDENCE, unseal.id, result);
    if (result.action !== ReviewAction.PASS) {
      if (result.action === ReviewAction.BLOCK) await this.penalty.recordContentBlock(userId, reviewId);
      throw new BadRequestException({ code: 'CONTENT_BLOCKED', message: '回信里似乎有联系方式或不友善的内容，修改后再寄出' });
    }

    const authorId = unseal.letter.authorId;
    // 双向拉黑则不得结缘
    const blocked = await this.blockedUserIds(userId);
    if (blocked.includes(authorId)) {
      throw new ForbiddenException({ code: 'BLOCKED', message: '你与对方之间已无法建立联系' });
    }

    // 距离 → 笔友往来递送
    const [aProf, bProf] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId: authorId } }),
      this.prisma.userProfile.findUnique({ where: { userId } }),
    ]);
    const km = geohashDistanceKm(aProf?.geohash5, bProf?.geohash5);
    const { deliverAt } = this.delivery.correspondenceDelivery(km);

    const relation = await this.prisma.$transaction(async (tx) => {
      // 条件更新 + count 校验：与 scheduler 的 7 天回收存在竞态，
      // 若信已被回池/归档（不再 SEALED_OPEN），这里 count===0 → 抛错回滚整个事务，
      // 杜绝"已回池的信被回信复活成 PAIRED"。见 docs/代码审计与迭代计划.md §1。
      const paired = await tx.letter.updateMany({
        where: { id: unseal.letterId, status: LetterStatus.SEALED_OPEN },
        data: { status: LetterStatus.PAIRED },
      });
      if (paired.count === 0) {
        throw new BadRequestException({ code: 'WINDOW_CLOSED', message: '回信潮汐已过，信重新漂回了海面' });
      }
      const rel = await tx.penPalRelation.upsert({
        where: { userAId_userBId: { userAId: authorId, userBId: userId } },
        create: { userAId: authorId, userBId: userId, sourceLetterId: unseal.letterId, exchangeCount: 1, lastLetterAt: new Date() },
        update: { exchangeCount: { increment: 1 }, lastLetterAt: new Date() },
      });
      await tx.correspondence.create({
        data: { relationId: rel.id, senderId: userId, body: dto.body, reviewStatus: result.action, deliverAt },
      });
      await tx.unsealRecord.update({ where: { id: unseal.id }, data: { replied: true } });
      return rel;
    });

    return { relationId: relation.publicId, status: relation.status, message: '你们结缘了，成为彼此的笔友' };
  }
}
