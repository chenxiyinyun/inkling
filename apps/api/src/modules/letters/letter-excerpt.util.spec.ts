import { describe, it, expect } from 'vitest';
import { excerpt } from './letter-excerpt.util';

describe('excerpt', () => {
  it('遇到 60 字内的首个句末标点 → 截到该标点（含标点）', () => {
    expect(excerpt('你好。今天天气不错，我想和你聊聊。')).toBe('你好。');
  });

  it('换行符也算句末标点', () => {
    expect(excerpt('第一行\n第二行')).toBe('第一行\n');
  });

  it('短文本且无标点 → 原样返回', () => {
    expect(excerpt('你好啊')).toBe('你好啊');
  });

  it('超长且 60 字内无标点 → 截 60 字加省略号', () => {
    const out = excerpt('a'.repeat(70));
    expect(out).toHaveLength(61); // 60 + '…'
    expect(out.endsWith('…')).toBe(true);
  });

  it('标点出现在 60 字之后 → 按超长截断处理（不截到远处标点）', () => {
    const out = excerpt('a'.repeat(65) + '。尾巴');
    expect(out).toHaveLength(61);
    expect(out.endsWith('…')).toBe(true);
  });
});
