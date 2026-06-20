import { pickDeliveryTier } from '@inkling/shared';

/**
 * 未知距离（任一方无 geohash5）的兜底档：按"远方"处理（→ 信鸽 36h），
 * 而非 `?? 0`（会落到徒步 4h，不符合"远方慢递"世界观）。
 */
export const UNKNOWN_DISTANCE_KM = 800;

/**
 * 按真实距离折算笔友往来书信的在途毫秒数。
 * baseHours 来自 pickDeliveryTier；scale 为加速因子（prod=1 真实 4–96h，本地/测试可设 0 即时）。
 * 纯函数：不读时钟、不读配置，便于单测距离/缩放/兜底边界。
 */
export function deliveryDelayMs(distanceKm: number | null | undefined, scale: number): number {
  const km = distanceKm ?? UNKNOWN_DISTANCE_KM;
  const hours = pickDeliveryTier(km).baseHours;
  const ms = hours * 3_600_000 * scale;
  return ms > 0 ? ms : 0; // clamp（含 NaN/负 scale）：不产生过去的 deliverAt
}

/** 距离对应的递送工具中文文案（未知距离按"远方"档）。 */
export function deliveryVehicleLabel(distanceKm: number | null | undefined): string {
  return pickDeliveryTier(distanceKm ?? UNKNOWN_DISTANCE_KM).labelZh;
}
