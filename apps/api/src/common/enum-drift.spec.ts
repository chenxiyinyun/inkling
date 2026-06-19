import { describe, expect, it } from 'vitest';
import * as Prisma from '@prisma/client';
import * as Shared from '@inkling/shared';

/**
 * 防漂移：packages/shared 的枚举与 Prisma schema 的同名枚举，成员集合必须完全一致。
 * 任一处手工改了枚举忘了同步另一处，这条用例立刻变红（零 DB，纯逻辑）。
 */
const MIRRORED = [
  'LetterStatus',
  'AgeTier',
  'RiskLevel',
  'ReviewAction',
  'PenaltyType',
  'DeliveryVehicle',
  'RelationStatus',
  'ReportReason',
] as const;

describe('shared 枚举 ↔ Prisma 枚举 一致性', () => {
  for (const name of MIRRORED) {
    it(`${name} 成员集合一致`, () => {
      const shared = (Shared as Record<string, unknown>)[name];
      const prisma = (Prisma as Record<string, unknown>)[name];
      expect(shared, `@inkling/shared 缺少枚举 ${name}`).toBeTruthy();
      expect(prisma, `@prisma/client 缺少枚举 ${name}`).toBeTruthy();
      const sharedMembers = Object.values(shared as Record<string, string>).sort();
      const prismaMembers = Object.values(prisma as Record<string, string>).sort();
      expect(sharedMembers).toEqual(prismaMembers);
    });
  }
});
