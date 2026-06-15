import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LetterStatus, ReviewAction, ReviewTargetType } from '@prisma/client';
import { PREVIEW_BODY_CHARS, MBTI_LABELS_ZH } from '@inkling/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { QuotaService } from '../quota/quota.service';
import { DeliveryService } from '../delivery/delivery.service';
import { CreateLetterDto } from './dto/create-letter.dto';

const DRIFT_LABELS: Record<LetterStatus, string> = {
  DRAFT: '草稿',
  REVIEWING: '邮局分拣中',
  DELIVERING: '信鸽在途',
  FLOATING: '漂泊在海上',
  HOOKED: '有人正在端详',
  SEALED_OPEN: '已被拆封',
  PAIRED: '已结缘',
  RECYCLED: '重新漂流',
  DIMMED: '静静漂着',
  ARCHIVED: '已归档',
  FROZEN: '已封存',
};

@Injectable()
export class LettersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly quota: QuotaService,
    private readonly delivery: DeliveryService,
  ) {}

  private excerpt(body: string): string {
    const firstStop = body.search(/[。！？!?\n]/);
    if (firstStop > 0 && firstStop <= PREVIEW_BODY_CHARS) return body.slice(0, firstStop + 1);
    return body.length > PREVIEW_BODY_CHARS ? body.slice(0, PREVIEW_BODY_CHARS) + '…' : body;
  }

  async createDraft(userId: string, dto: CreateLetterDto) {
    const letter = await this.prisma.letter.create({
      data: { authorId: userId, body: dto.body, theme: dto.theme, status: LetterStatus.DRAFT },
    });
    return { letterId: letter.publicId, status: letter.status };
  }

  /** 提交投递：审核 → 扣配额 → 在途 → 入池快照。 */
  async submit(userId: string, publicId: string) {
    const letter = await this.prisma.letter.findUnique({ where: { publicId } });
    if (!letter) throw new NotFoundException({ code: 'LETTER_NOT_FOUND', message: '找不到这封信' });
    if (letter.authorId !== userId) throw new ForbiddenException({ code: 'NOT_AUTHOR', message: '这不是你的信' });
    if (letter.status !== LetterStatus.DRAFT && letter.status !== LetterStatus.REVIEWING) {
      throw new BadRequestException({ code: 'ALREADY_SUBMITTED', message: '这封信已经寄出了' });
    }

    // 1) 审核（高危秒级先行拦截）
    const result = this.moderation.review(letter.body);
    await this.moderation.logReview(ReviewTargetType.LETTER, letter.id, result);
    if (result.action === ReviewAction.BLOCK) {
      throw new BadRequestException({
        code: 'CONTENT_BLOCKED',
        message: '这封信里似乎有联系方式或不友善的内容，修改后可以重新寄出',
      });
    }

    // 2) 扣投递配额（失败则信件保持草稿）
    await this.quota.consume(userId, 'send');

    // 3) 取作者粗粒度区域 + 构建预览快照
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const tags = Array.isArray(profile?.interestTags) ? (profile!.interestTags as string[]) : [];
    const mbti = profile?.mbti && profile.mbti !== 'UNKNOWN' ? [MBTI_LABELS_ZH[profile.mbti as keyof typeof MBTI_LABELS_ZH] ?? profile.mbti] : [];
    const partialTags = [...mbti, ...tags.slice(0, 2)];

    await this.prisma.$transaction([
      this.prisma.letter.update({
        where: { id: letter.id },
        data: {
          status: LetterStatus.DELIVERING,
          geohash5: profile?.geohash5 ?? null,
          poolVisibleAt: this.delivery.poolVisibleAt(),
          expireAt: this.delivery.expireAt(),
        },
      }),
      this.prisma.previewSnapshot.upsert({
        where: { letterId: letter.id },
        create: { letterId: letter.id, partialTags, bodyExcerpt: this.excerpt(letter.body) },
        update: { partialTags, bodyExcerpt: this.excerpt(letter.body) },
      }),
    ]);

    return { letterId: letter.publicId, status: LetterStatus.DELIVERING };
  }

  async compose(userId: string, dto: CreateLetterDto) {
    const draft = await this.createDraft(userId, dto);
    return this.submit(userId, draft.letterId);
  }

  async listMine(userId: string) {
    const letters = await this.prisma.letter.findMany({
      where: { authorId: userId, status: { not: LetterStatus.DRAFT } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return letters.map((l) => ({
      letterId: l.publicId,
      status: l.status,
      bodyExcerpt: this.excerpt(l.body),
      driftLabel: DRIFT_LABELS[l.status],
      createdAt: l.createdAt.toISOString(),
    }));
  }

  async getOne(userId: string, publicId: string) {
    const l = await this.prisma.letter.findUnique({ where: { publicId } });
    if (!l || l.authorId !== userId) throw new NotFoundException({ code: 'LETTER_NOT_FOUND', message: '找不到这封信' });
    return {
      letterId: l.publicId,
      status: l.status,
      driftLabel: DRIFT_LABELS[l.status],
      body: l.body,
      theme: l.theme,
      createdAt: l.createdAt.toISOString(),
    };
  }
}
