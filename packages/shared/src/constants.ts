import { DeliveryVehicle } from './enums';

/** 慢社交节奏默认参数（可被后端 env 覆盖；详见 docs/产品设计文档.md） */
export const QUOTA_DEFAULTS = {
  dailySend: 1,
  dailyFish: 3,
  dailyUnseal: 1,
} as const;

/** 预览决策锁 10 分钟 */
export const PREVIEW_LOCK_SECONDS = 600;

/** 回信窗口 7 天（自送达拆封者起算；回信在途不计入对方窗口） */
export const REPLY_WINDOW_DAYS = 7;

/** 信件漂流上限与最大回池次数 */
export const LETTER_MAX_DRIFT_DAYS = 30;
export const LETTER_MAX_RECYCLE = 3;

/** 写信字数下限/上限（下限防灌水） */
export const LETTER_MIN_CHARS = 50;
export const LETTER_MAX_CHARS = 1000;

/** 打捞预览露出的正文字数 */
export const PREVIEW_BODY_CHARS = 60;

/** 年龄门控（各地法定最低见 docs/合规与本地化-海外.md） */
export const MIN_AGE_HARD_FLOOR = 13;
export const GUARDIAN_MODE_BELOW_AGE = 18;

/**
 * 真实地理距离 → 递送工具与基准时长（小时）。
 * MVP 用粗档；生产期按 docs/产品设计文档.md §2.6 公式精算。
 */
export interface DeliveryTier {
  vehicle: DeliveryVehicle;
  maxKm: number;
  baseHours: number;
  labelZh: string;
}

export const DELIVERY_TIERS: DeliveryTier[] = [
  { vehicle: DeliveryVehicle.FOOT, maxKm: 20, baseHours: 4, labelZh: '徒步信使' },
  { vehicle: DeliveryVehicle.CARRIAGE, maxKm: 200, baseHours: 18, labelZh: '马车' },
  { vehicle: DeliveryVehicle.PIGEON, maxKm: 800, baseHours: 36, labelZh: '信鸽' },
  { vehicle: DeliveryVehicle.FAST_HORSE, maxKm: 2000, baseHours: 60, labelZh: '加急驿马' },
  { vehicle: DeliveryVehicle.ALBATROSS, maxKm: Infinity, baseHours: 96, labelZh: '天涯专递' },
];

export function pickDeliveryTier(distanceKm: number): DeliveryTier {
  return DELIVERY_TIERS.find((t) => distanceKm <= t.maxKm) ?? DELIVERY_TIERS[DELIVERY_TIERS.length - 1];
}
