/** MBTI 16 型 + 未知（自报型号，详见 docs/匹配落地-自报MBTI.md） */
export const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const;

export type MbtiType = (typeof MBTI_TYPES)[number];
/** 自报未知 / 不确定 */
export const MBTI_UNKNOWN = 'UNKNOWN';
export type MbtiValue = MbtiType | typeof MBTI_UNKNOWN;

export const MBTI_LABELS_ZH: Record<MbtiType, string> = {
  INTJ: '建筑师', INTP: '逻辑学家', ENTJ: '指挥官', ENTP: '辩论家',
  INFJ: '提倡者', INFP: '调停者', ENFJ: '主人公', ENFP: '竞选者',
  ISTJ: '物流师', ISFJ: '守卫者', ESTJ: '总经理', ESFJ: '执政官',
  ISTP: '鉴赏家', ISFP: '探险家', ESTP: '企业家', ESFP: '表演者',
};

/**
 * 相似度：四维字母重合度（N/S 与 T/F 维度权重更高，最影响价值观与沟通风格）。
 * 返回 [0,1]。
 */
export function mbtiSimilarity(a: MbtiType, b: MbtiType): number {
  const weights = [1, 1.5, 1.5, 1]; // E/I, S/N, T/F, J/P
  let score = 0;
  let total = 0;
  for (let i = 0; i < 4; i++) {
    total += weights[i];
    if (a[i] === b[i]) score += weights[i];
  }
  return score / total;
}

/**
 * 荣格认知功能互补的"黄金互补对"（双向）。命中给高分，而非简单字母取反。
 * 详见 docs/匹配落地-自报MBTI.md。
 */
const GOLDEN_COMPLEMENT_PAIRS: ReadonlyArray<readonly [MbtiType, MbtiType]> = [
  ['INFJ', 'ENFP'], ['INTJ', 'ENTP'], ['INFP', 'ENFJ'], ['INTP', 'ENTJ'],
  ['ISFJ', 'ESFP'], ['ISTJ', 'ESTP'], ['ISFP', 'ESFJ'], ['ISTP', 'ESTJ'],
];

export function mbtiComplement(a: MbtiType, b: MbtiType): number {
  for (const [x, y] of GOLDEN_COMPLEMENT_PAIRS) {
    if ((a === x && b === y) || (a === y && b === x)) return 0.9;
  }
  // 非黄金对：用"差异度"做温和的互补分（差异越大略高，但不超过黄金对）
  return Math.min(0.6, 1 - mbtiSimilarity(a, b));
}

/**
 * 根据偏好滑杆 p ∈ [0,1] 融合相似/互补得分。
 * p=0 取相似，p=1 取互补。
 */
export function mbtiAffinity(a: MbtiValue, b: MbtiValue, p: number): number {
  if (a === MBTI_UNKNOWN || b === MBTI_UNKNOWN) return 0.5; // 未知 → 中性，匹配时该项降权
  const sim = mbtiSimilarity(a, b);
  const comp = mbtiComplement(a, b);
  return (1 - p) * sim + p * comp;
}
