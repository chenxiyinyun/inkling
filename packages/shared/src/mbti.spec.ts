import { describe, it, expect } from 'vitest';
import { mbtiSimilarity, mbtiComplement, mbtiAffinity } from './mbti';

describe('mbtiSimilarity', () => {
  it('相同型号相似度为 1', () => {
    expect(mbtiSimilarity('INTJ', 'INTJ')).toBe(1);
  });

  it('仅首维(E/I, 权重1)不同 → 4/5 = 0.8', () => {
    // INTJ vs ENTJ：I≠E(1) 错，N=N(1.5) T=T(1.5) J=J(1) 中 → (1.5+1.5+1)/5
    expect(mbtiSimilarity('INTJ', 'ENTJ')).toBe(0.8);
  });

  it('四维全异 → 0', () => {
    expect(mbtiSimilarity('INTJ', 'ESFP')).toBe(0);
  });

  it('权重：N/S 与 T/F 比 E/I、J/P 更重', () => {
    // 仅 T/F(权重1.5)不同 → (1+1.5+1)/5 = 0.7；仅 J/P(权重1)不同 → (1+1.5+1.5)/5 = 0.8
    expect(mbtiSimilarity('INTJ', 'INFJ')).toBe(0.7);
    expect(mbtiSimilarity('INTJ', 'INTP')).toBe(0.8);
  });
});

describe('mbtiComplement', () => {
  it('荣格黄金互补对得 0.9，且双向对称', () => {
    expect(mbtiComplement('INFJ', 'ENFP')).toBe(0.9);
    expect(mbtiComplement('ENFP', 'INFJ')).toBe(0.9);
    expect(mbtiComplement('INTP', 'ENTJ')).toBe(0.9);
  });

  it('非黄金对：温和互补分，封顶 0.6', () => {
    // 相同型号 sim=1 → 1-1=0 → min(0.6,0)=0
    expect(mbtiComplement('INTJ', 'INTJ')).toBe(0);
    // 全异 sim=0 → 1-0=1 → 封顶 0.6
    expect(mbtiComplement('INTJ', 'ESFP')).toBe(0.6);
  });
});

describe('mbtiAffinity', () => {
  it('任一方 UNKNOWN → 中性 0.5（该项匹配时降权）', () => {
    expect(mbtiAffinity('UNKNOWN', 'INTJ', 0.5)).toBe(0.5);
    expect(mbtiAffinity('INTJ', 'UNKNOWN', 0)).toBe(0.5);
    expect(mbtiAffinity('UNKNOWN', 'UNKNOWN', 1)).toBe(0.5);
  });

  it('p=0 取相似、p=1 取互补、p=0.5 取均值', () => {
    // INFJ/ENFP：sim=0.6（I/E、J/P 异），comp=0.9（黄金对）
    expect(mbtiAffinity('INFJ', 'ENFP', 0)).toBeCloseTo(0.6, 10);
    expect(mbtiAffinity('INFJ', 'ENFP', 1)).toBeCloseTo(0.9, 10);
    expect(mbtiAffinity('INFJ', 'ENFP', 0.5)).toBeCloseTo(0.75, 10);
  });
});
