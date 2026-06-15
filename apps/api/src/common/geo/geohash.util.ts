/**
 * 轻量 GeoHash 工具：仅存粗粒度区域、计算近似距离。
 * 隐私：永不持久化精确经纬度；profile 只存 geohash 前 5 位（±2.4km）。
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(lat: number, lon: number, precision = 5): string {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const lonMid = (lonMin + lonMax) / 2;
      if (lon >= lonMid) {
        idx = idx * 2 + 1;
        lonMin = lonMid;
      } else {
        idx = idx * 2;
        lonMax = lonMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat >= latMid) {
        idx = idx * 2 + 1;
        latMin = latMid;
      } else {
        idx = idx * 2;
        latMax = latMid;
      }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      geohash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return geohash;
}

/** 解码到中心点经纬度。 */
export function decodeGeohash(geohash: string): { lat: number; lon: number } {
  let evenBit = true;
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  for (const ch of geohash.toLowerCase()) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) continue;
    for (let n = 4; n >= 0; n--) {
      const bitN = (idx >> n) & 1;
      if (evenBit) {
        const lonMid = (lonMin + lonMax) / 2;
        if (bitN === 1) lonMin = lonMid;
        else lonMax = lonMid;
      } else {
        const latMid = (latMin + latMax) / 2;
        if (bitN === 1) latMin = latMid;
        else latMax = latMid;
      }
      evenBit = !evenBit;
    }
  }
  return { lat: (latMin + latMax) / 2, lon: (lonMin + lonMax) / 2 };
}

/** Haversine 距离（公里）。 */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** 两个 geohash 之间的近似距离（公里）。任一缺失返回 null。 */
export function geohashDistanceKm(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const pa = decodeGeohash(a);
  const pb = decodeGeohash(b);
  return haversineKm(pa.lat, pa.lon, pb.lat, pb.lon);
}

/** 距离 → 模糊文案（去人格化，不暴露精确位置）。 */
export function distanceLabel(km: number | null): string {
  if (km == null) return '远方';
  if (km < 20) return '近在咫尺';
  if (km < 200) return `约 ${Math.round(km / 10) * 10} 公里外`;
  if (km < 2000) return `约 ${Math.round(km / 100) * 100} 公里外`;
  return '天涯之遥';
}
