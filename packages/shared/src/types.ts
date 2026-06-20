import type { AgeTier, LetterStatus, NotificationType, RelationStatus } from './enums';
import type { MbtiValue } from './mbti';

/** 统一 API 响应结构 */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/** 对外公开的用户名片（永不含真人照片、精确位置） */
export interface PublicProfile {
  publicId: string;
  penName: string;
  mbti: MbtiValue;
  interestTags: string[];
  oneLiner?: string;
  region?: string; // 仅粗粒度（如"约 200 公里外 / 远方"）
}

/** 当前登录用户（含敏感于自己的字段） */
export interface MeProfile extends PublicProfile {
  ageTier: AgeTier;
  guardianMode: boolean;
  invisible: boolean;
  matchPreference: number; // 0..1
}

/** 打捞预览卡（半张名片 + 信件前几行） */
export interface LetterPreview {
  fishingId: string;
  lockUntil: string; // ISO，预览锁到期
  penName: string;
  mbti: MbtiValue;
  partialTags: string[]; // 仅露出部分标签
  bodyExcerpt: string; // 前 N 字
  theme?: string; // 今日信笺主题
  distanceLabel: string; // "约 1200 公里外"
  vehicleLabel: string; // "由信鸽送达"
}

/** 拆封后的完整信件 */
export interface LetterFull {
  letterId: string;
  author: PublicProfile;
  body: string;
  theme?: string;
  replyDeadline: string; // ISO，7 天窗口
}

/** 我寄出的信（去人格化展示） */
export interface MyLetter {
  letterId: string;
  status: LetterStatus;
  bodyExcerpt: string;
  driftLabel: string; // "在途中 / 已漂泊 N 天 / 已结缘"
  createdAt: string;
}

/** 笔友关系摘要 */
export interface PenPalSummary {
  relationId: string;
  partner: PublicProfile;
  status: RelationStatus;
  exchangeCount: number;
  lastLetterAt?: string;
}

/** 每日配额 */
export interface QuotaToday {
  send: number;
  fish: number;
  unseal: number;
  resetsAt: string; // ISO
}

/**
 * 系统通知条目（去人格化弱通知）。ref 仅含公开 id，绝不含对方身份。
 * 字段与 docs/API设计.md §2.12 对齐（codebase 统一用 camelCase）。
 */
export interface NotificationItem {
  publicId: string;
  type: NotificationType;
  title: string;
  ref: Record<string, unknown>; // { letterPublicId } / { relationPublicId, previewExcerpt } / { unsealId, daysLeft } ...
  createdAt: string; // ISO
  createdBand: string; // 粗档时间文案（"刚刚 / 1天前"），维持"慢"世界观
  read: boolean; // 仅本人对系统通知的已读态（红点），与"信件已读"无关
}

/** 通知列表（游标分页） */
export interface NotificationPage {
  items: NotificationItem[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}
