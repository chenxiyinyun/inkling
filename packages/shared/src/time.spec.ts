import { describe, it, expect } from 'vitest';
import { timeBand } from './time';

const NOW = new Date('2026-06-20T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe('timeBand 粗档时间文案', () => {
  it('一分钟内 → 刚刚', () => {
    expect(timeBand(NOW, NOW)).toBe('刚刚');
    expect(timeBand(ago(59_000), NOW)).toBe('刚刚');
  });

  it('分钟档', () => {
    expect(timeBand(ago(60_000), NOW)).toBe('1分钟前');
    expect(timeBand(ago(59 * 60_000), NOW)).toBe('59分钟前');
  });

  it('小时档', () => {
    expect(timeBand(ago(60 * 60_000), NOW)).toBe('1小时前');
    expect(timeBand(ago(23 * 3_600_000), NOW)).toBe('23小时前');
  });

  it('天档', () => {
    expect(timeBand(ago(24 * 3_600_000), NOW)).toBe('1天前');
    expect(timeBand(ago(29 * 86_400_000), NOW)).toBe('29天前');
  });

  it('月档与很久前', () => {
    expect(timeBand(ago(30 * 86_400_000), NOW)).toBe('1个月前');
    expect(timeBand(ago(365 * 86_400_000), NOW)).toBe('很久前');
  });

  it('未来时间（时钟漂移）归为刚刚，而非负数', () => {
    expect(timeBand(new Date(NOW.getTime() + 5000), NOW)).toBe('刚刚');
  });

  it('接受 ISO 字符串与时间戳；非法值兜底', () => {
    expect(timeBand(ago(2 * 3_600_000).toISOString(), NOW)).toBe('2小时前');
    expect(timeBand(ago(3 * 60_000).getTime(), NOW)).toBe('3分钟前');
    expect(timeBand('not-a-date', NOW)).toBe('很久前');
  });
});
