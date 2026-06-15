import { describe, it, expect } from 'vitest';
import { jaccard, geoScore, scoreCandidate, SCORE_WEIGHTS } from './ocean-score';

describe('jaccard', () => {
  it('任一为空 → 0', () => {
    expect(jaccard([], ['a'])).toBe(0);
    expect(jaccard(['a'], [])).toBe(0);
  });
  it('完全相同 → 1', () => {
    expect(jaccard(['a', 'b'], ['a', 'b'])).toBe(1);
  });
  it('部分重合 → 交/并', () => {
    // 交 {b} = 1，并 {a,b,c} = 3
    expect(jaccard(['a', 'b'], ['b', 'c'])).toBeCloseTo(1 / 3, 10);
  });
  it('完全不相交 → 0', () => {
    expect(jaccard(['a'], ['b'])).toBe(0);
  });
});

describe('geoScore', () => {
  it('距离未知 → 中性 0.3', () => {
    expect(geoScore(null)).toBe(0.3);
  });
  it('距离 0 → 1（最近）', () => {
    expect(geoScore(0)).toBe(1);
  });
  it('随距离单调递减、趋零', () => {
    expect(geoScore(150)).toBeGreaterThan(geoScore(1500));
    expect(geoScore(100000)).toBeLessThan(0.001);
  });
});

describe('scoreCandidate', () => {
  it('三项均满分 → 权重和 = 1', () => {
    const s = scoreCandidate({
      myMbti: 'INTJ',
      candidateMbti: 'INTJ', // p=0 → 相似=1
      preference: 0,
      myTags: ['书', '茶'],
      candidateTags: ['书', '茶'], // jaccard=1
      distanceKm: 0, // geo=1
    });
    expect(s).toBeCloseTo(1, 10);
    expect(SCORE_WEIGHTS.affinity + SCORE_WEIGHTS.interest + SCORE_WEIGHTS.geo).toBeCloseTo(1, 10);
  });

  it('UNKNOWN + 无共同标签 + 距离未知 → 0.4·0.5 + 0 + 0.25·0.3', () => {
    const s = scoreCandidate({
      myMbti: 'UNKNOWN',
      candidateMbti: 'INTJ',
      preference: 0.5,
      myTags: [],
      candidateTags: ['书'],
      distanceKm: null,
    });
    expect(s).toBeCloseTo(0.4 * 0.5 + 0 + 0.25 * 0.3, 10);
  });

  it('得分落在 [0,1]', () => {
    const s = scoreCandidate({
      myMbti: 'ENFP',
      candidateMbti: 'ISTJ',
      preference: 1,
      myTags: ['电影'],
      candidateTags: ['徒步'],
      distanceKm: 500,
    });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});
