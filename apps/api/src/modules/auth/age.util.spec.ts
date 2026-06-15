import { describe, it, expect } from 'vitest';
import { AgeTier } from '@prisma/client';
import { calcAge, deriveAgeDecision } from './age.util';

// 用本地时间构造，避免 toISOString/时区漂移影响 getFullYear/getMonth/getDate
const NOW = new Date(2026, 5, 15); // 2026-06-15 本地

describe('calcAge', () => {
  it('生日当天/已过 → 周岁', () => {
    expect(calcAge(new Date(2008, 5, 15), NOW)).toBe(18); // 生日当天
    expect(calcAge(new Date(2008, 5, 14), NOW)).toBe(18); // 昨天过生日
  });
  it('今年生日未到 → 减 1', () => {
    expect(calcAge(new Date(2008, 5, 16), NOW)).toBe(17); // 明天才生日
    expect(calcAge(new Date(2008, 11, 1), NOW)).toBe(17); // 年底生日
  });
  it('闰日生日不报错', () => {
    expect(calcAge(new Date(2008, 1, 29), NOW)).toBe(18);
  });
});

describe('deriveAgeDecision (hardFloor=13, guardianBelow=18)', () => {
  const decide = (birth: Date) => deriveAgeDecision(birth, 13, 18, NOW);

  it('低于硬门控（12 岁）→ CHILD + belowFloor', () => {
    const r = decide(new Date(2013, 5, 16)); // 差一天满 13，当前 12
    expect(r.age).toBe(12);
    expect(r.belowFloor).toBe(true);
    expect(r.tier).toBe(AgeTier.CHILD);
  });

  it('恰好 13 岁 → 不再 belowFloor，TEEN + 守护模式', () => {
    const r = decide(new Date(2013, 5, 15));
    expect(r.age).toBe(13);
    expect(r.belowFloor).toBe(false);
    expect(r.isMinor).toBe(true);
    expect(r.tier).toBe(AgeTier.TEEN);
  });

  it('17 岁 → TEEN（守护模式）', () => {
    const r = decide(new Date(2009, 5, 15));
    expect(r.age).toBe(17);
    expect(r.tier).toBe(AgeTier.TEEN);
    expect(r.isMinor).toBe(true);
  });

  it('18 岁 → ADULT，非未成年', () => {
    const r = decide(new Date(2008, 5, 15));
    expect(r.age).toBe(18);
    expect(r.tier).toBe(AgeTier.ADULT);
    expect(r.isMinor).toBe(false);
  });
});
