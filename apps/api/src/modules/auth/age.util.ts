import { AgeTier } from '@prisma/client';

/**
 * 周岁（精确到年/月/日）；now 可注入便于测试。
 */
export function calcAge(birthDate: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

export interface AgeDecision {
  age: number;
  tier: AgeTier;
  /** 13–17：进入守护模式 */
  isMinor: boolean;
  /** 低于硬门控：调用方应婉拒注册 */
  belowFloor: boolean;
}

/**
 * 据生日与门控阈值派生年龄分级（纯函数，未成年人保护核心判定，见 docs/安全与未成年人保护.md）。
 * belowFloor → CHILD（婉拒）；[hardFloor, guardianBelow) → TEEN（守护模式）；>=guardianBelow → ADULT。
 */
export function deriveAgeDecision(
  birthDate: Date,
  hardFloor: number,
  guardianBelow: number,
  now: Date = new Date(),
): AgeDecision {
  const age = calcAge(birthDate, now);
  const belowFloor = age < hardFloor;
  const isMinor = age < guardianBelow;
  const tier: AgeTier = belowFloor ? AgeTier.CHILD : isMinor ? AgeTier.TEEN : AgeTier.ADULT;
  return { age, tier, isMinor, belowFloor };
}
