import { describe, it, expect } from 'vitest';
import { deliveryDelayMs, deliveryVehicleLabel, UNKNOWN_DISTANCE_KM } from './delivery.timing';

const H = 3_600_000;

describe('deliveryDelayMs 按距离 baseHours 精算', () => {
  it('各档 baseHours × scale=1（FOOT4 / CARRIAGE18 / PIGEON36 / FAST_HORSE60 / ALBATROSS96 小时）', () => {
    expect(deliveryDelayMs(10, 1)).toBe(4 * H);
    expect(deliveryDelayMs(100, 1)).toBe(18 * H);
    expect(deliveryDelayMs(500, 1)).toBe(36 * H);
    expect(deliveryDelayMs(1500, 1)).toBe(60 * H);
    expect(deliveryDelayMs(5000, 1)).toBe(96 * H);
  });

  it('档位边界（maxKm 为闭区间上界）', () => {
    expect(deliveryDelayMs(20, 1)).toBe(4 * H); // FOOT 上界
    expect(deliveryDelayMs(20.0001, 1)).toBe(18 * H); // 进入 CARRIAGE
    expect(deliveryDelayMs(2000, 1)).toBe(60 * H); // FAST_HORSE 上界
    expect(deliveryDelayMs(2000.1, 1)).toBe(96 * H); // 进入 ALBATROSS
  });

  it('scale 缩放：0 → 即时；小数 → 按比例', () => {
    expect(deliveryDelayMs(500, 0)).toBe(0);
    expect(deliveryDelayMs(500, 0.5)).toBe(18 * H);
  });

  it('未知距离（null/undefined）按"远方"兜底档（PIGEON 36h），而非徒步 4h', () => {
    expect(deliveryDelayMs(null, 1)).toBe(36 * H);
    expect(deliveryDelayMs(undefined, 1)).toBe(36 * H);
    expect(UNKNOWN_DISTANCE_KM).toBe(800);
  });

  it('clamp：负 scale / NaN 不产生过去的 deliverAt', () => {
    expect(deliveryDelayMs(500, -1)).toBe(0);
    expect(deliveryDelayMs(500, NaN)).toBe(0);
  });
});

describe('deliveryVehicleLabel', () => {
  it('按距离给中文载具文案；未知距离按远方档', () => {
    expect(deliveryVehicleLabel(10)).toBe('徒步信使');
    expect(deliveryVehicleLabel(500)).toBe('信鸽');
    expect(deliveryVehicleLabel(5000)).toBe('天涯专递');
    expect(deliveryVehicleLabel(null)).toBe('信鸽'); // 远方兜底 = 800km = PIGEON
  });
});
