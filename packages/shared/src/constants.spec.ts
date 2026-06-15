import { describe, it, expect } from 'vitest';
import { pickDeliveryTier, DELIVERY_TIERS, QUOTA_DEFAULTS } from './constants';
import { DeliveryVehicle } from './enums';

describe('pickDeliveryTier', () => {
  it('按距离归档（含各档边界值，maxKm 为闭区间上界）', () => {
    expect(pickDeliveryTier(0).vehicle).toBe(DeliveryVehicle.FOOT);
    expect(pickDeliveryTier(20).vehicle).toBe(DeliveryVehicle.FOOT);
    expect(pickDeliveryTier(20.0001).vehicle).toBe(DeliveryVehicle.CARRIAGE);
    expect(pickDeliveryTier(200).vehicle).toBe(DeliveryVehicle.CARRIAGE);
    expect(pickDeliveryTier(800).vehicle).toBe(DeliveryVehicle.PIGEON);
    expect(pickDeliveryTier(2000).vehicle).toBe(DeliveryVehicle.FAST_HORSE);
    expect(pickDeliveryTier(2000.1).vehicle).toBe(DeliveryVehicle.ALBATROSS);
    expect(pickDeliveryTier(Infinity).vehicle).toBe(DeliveryVehicle.ALBATROSS);
  });

  it('负距离归入最近一档（FOOT）', () => {
    expect(pickDeliveryTier(-5).vehicle).toBe(DeliveryVehicle.FOOT);
  });

  it('NaN 不满足任何 <= 比较 → 兜底到最后一档（已知行为，调用方应保证传入有效距离）', () => {
    expect(pickDeliveryTier(NaN).vehicle).toBe(DeliveryVehicle.ALBATROSS);
  });
});

describe('常量真值锚点（防回归）', () => {
  it('每日配额默认 1 投 / 3 捞 / 1 拆', () => {
    expect(QUOTA_DEFAULTS).toEqual({ dailySend: 1, dailyFish: 3, dailyUnseal: 1 });
  });

  it('五档载具按 maxKm 升序、最后一档为无限', () => {
    expect(DELIVERY_TIERS).toHaveLength(5);
    const maxKms = DELIVERY_TIERS.map((t) => t.maxKm);
    expect(maxKms).toEqual([...maxKms].sort((a, b) => a - b));
    expect(DELIVERY_TIERS[DELIVERY_TIERS.length - 1].maxKm).toBe(Infinity);
  });
});
