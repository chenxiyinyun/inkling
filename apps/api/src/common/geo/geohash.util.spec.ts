import { describe, it, expect } from 'vitest';
import { encodeGeohash, decodeGeohash, haversineKm, geohashDistanceKm, distanceLabel } from './geohash.util';

// 已知坐标
const BEIJING = { lat: 39.9042, lon: 116.4074 };
const SHANGHAI = { lat: 31.2304, lon: 121.4737 };

describe('encodeGeohash / decodeGeohash', () => {
  it('默认 precision=5，返回 5 位', () => {
    expect(encodeGeohash(BEIJING.lat, BEIJING.lon)).toHaveLength(5);
  });

  it('编码确定性（同坐标 → 同结果）', () => {
    expect(encodeGeohash(BEIJING.lat, BEIJING.lon)).toBe(encodeGeohash(BEIJING.lat, BEIJING.lon));
  });

  it('编解码往返：解码中心点接近原坐标（precision=5 误差 < 0.05°）', () => {
    const gh = encodeGeohash(BEIJING.lat, BEIJING.lon);
    const { lat, lon } = decodeGeohash(gh);
    expect(Math.abs(lat - BEIJING.lat)).toBeLessThan(0.05);
    expect(Math.abs(lon - BEIJING.lon)).toBeLessThan(0.05);
  });

  it('北京与上海 geohash5 不同', () => {
    expect(encodeGeohash(BEIJING.lat, BEIJING.lon)).not.toBe(encodeGeohash(SHANGHAI.lat, SHANGHAI.lon));
  });
});

describe('haversineKm', () => {
  it('同点距离为 0', () => {
    expect(haversineKm(BEIJING.lat, BEIJING.lon, BEIJING.lat, BEIJING.lon)).toBe(0);
  });

  it('北京—上海 ≈ 1067km（容差 ±30km）', () => {
    const d = haversineKm(BEIJING.lat, BEIJING.lon, SHANGHAI.lat, SHANGHAI.lon);
    expect(Math.abs(d - 1067)).toBeLessThan(30);
  });
});

describe('geohashDistanceKm', () => {
  it('任一为空 → null', () => {
    expect(geohashDistanceKm(null, 'wx4g0')).toBeNull();
    expect(geohashDistanceKm('wx4g0', undefined)).toBeNull();
    expect(geohashDistanceKm(null, null)).toBeNull();
  });

  it('两地 geohash 近似距离落在合理区间（解码中心点带粒度误差）', () => {
    const a = encodeGeohash(BEIJING.lat, BEIJING.lon);
    const b = encodeGeohash(SHANGHAI.lat, SHANGHAI.lon);
    const d = geohashDistanceKm(a, b)!;
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1150);
  });
});

describe('distanceLabel', () => {
  it('各档模糊文案', () => {
    expect(distanceLabel(null)).toBe('远方');
    expect(distanceLabel(5)).toBe('近在咫尺');
    expect(distanceLabel(50)).toBe('约 50 公里外');
    expect(distanceLabel(150)).toBe('约 150 公里外');
    expect(distanceLabel(1500)).toBe('约 1500 公里外');
    expect(distanceLabel(5000)).toBe('天涯之遥');
  });
});
