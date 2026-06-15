import { mbtiAffinity, MbtiValue } from '@inkling/shared';

/**
 * 打捞推荐打分（纯函数，便于单测；见 docs/代码审计与迭代计划.md §2.B）。
 * 综合分 = 0.4·MBTI亲和 + 0.35·兴趣Jaccard + 0.25·地理就近。
 */
export const SCORE_WEIGHTS = { affinity: 0.4, interest: 0.35, geo: 0.25 } as const;
export const GEO_DECAY_KM = 150;
export const GEO_UNKNOWN_SCORE = 0.3;

/** 标签 Jaccard 相似度；任一为空返回 0。 */
export function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const inter = b.filter((x) => sa.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union ? inter / union : 0;
}

/** 地理就近分：距离未知给中性 0.3，否则按 e^(-km/150) 衰减。 */
export function geoScore(distanceKm: number | null): number {
  return distanceKm == null ? GEO_UNKNOWN_SCORE : Math.exp(-distanceKm / GEO_DECAY_KM);
}

export interface ScoreInput {
  myMbti: MbtiValue;
  candidateMbti: MbtiValue;
  /** 偏好滑杆 p∈[0,1]：0 相似 ↔ 1 互补 */
  preference: number;
  myTags: string[];
  candidateTags: string[];
  distanceKm: number | null;
}

export function scoreCandidate(input: ScoreInput): number {
  const aff = mbtiAffinity(input.myMbti, input.candidateMbti, input.preference);
  const inter = jaccard(input.myTags, input.candidateTags);
  const geo = geoScore(input.distanceKm);
  return SCORE_WEIGHTS.affinity * aff + SCORE_WEIGHTS.interest * inter + SCORE_WEIGHTS.geo * geo;
}
