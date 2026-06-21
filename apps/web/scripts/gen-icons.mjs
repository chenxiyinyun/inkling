// 离线生成 PWA 位图图标（无图像库依赖，纯 Node：zlib 编码 PNG + 超采样抗锯齿）。
// 设计同 public/icon.svg：奶油底 + 信封 + 火漆封缄；maskable 安全区内、背景满铺。
// 用法：node apps/web/scripts/gen-icons.mjs  → 写出 apple-touch-icon.png / pwa-192.png / pwa-512.png
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public');

const C = {
  cream: [0xfa, 0xf6, 0xee],
  paper: [0xf3, 0xe8, 0xd2],
  ink: [0x5b, 0x4b, 0x3a],
  wax: [0xc2, 0x70, 0x3d],
  waxEdge: [0x9c, 0x59, 0x2e],
};

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(size, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (1 + size * 4));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      raw[p++] = rgb[i];
      raw[p++] = rgb[i + 1];
      raw[p++] = rgb[i + 2];
      raw[p++] = 255;
    }
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - bx, py - by);
  const t = c1 / c2;
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}
function roundRectSDF(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - (hw - r);
  const dy = Math.abs(py - cy) - (hh - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}

function render(size) {
  const ss = 4;
  const W = size * ss;
  const hi = new Uint8Array(W * W * 3);
  const cx = W / 2, cy = W / 2;
  const envHW = 0.3 * W, envHH = 0.21 * W, envR = 0.055 * W, border = 0.02 * W;
  const top = cy - envHH, left = cx - envHW, right = cx + envHW;
  const flapApexY = top + 0.62 * (2 * envHH);
  const sealX = cx, sealY = flapApexY, sealR = 0.082 * W;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const fx = x + 0.5, fy = y + 0.5;
      let col = C.cream;
      const sdf = roundRectSDF(fx, fy, cx, cy, envHW, envHH, envR);
      if (sdf < 0) col = C.paper;
      if (Math.abs(sdf) < border / 2) col = C.ink;
      if (
        sdf < 0 &&
        (segDist(fx, fy, left + border, top + border, sealX, flapApexY) < border / 2 ||
          segDist(fx, fy, right - border, top + border, sealX, flapApexY) < border / 2)
      ) {
        col = C.ink;
      }
      const dSeal = Math.hypot(fx - sealX, fy - sealY);
      if (dSeal < sealR) col = C.wax;
      if (dSeal < sealR && dSeal > sealR - border) col = C.waxEdge;
      if (dSeal < sealR * 0.34) col = C.cream;
      const i = (y * W + x) * 3;
      hi[i] = col[0];
      hi[i + 1] = col[1];
      hi[i + 2] = col[2];
    }
  }
  const out = new Uint8Array(size * size * 3);
  const n = ss * ss;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let oy = 0; oy < ss; oy++) {
        for (let ox = 0; ox < ss; ox++) {
          const i = ((y * ss + oy) * W + (x * ss + ox)) * 3;
          r += hi[i];
          g += hi[i + 1];
          b += hi[i + 2];
        }
      }
      const j = (y * size + x) * 3;
      out[j] = Math.round(r / n);
      out[j + 1] = Math.round(g / n);
      out[j + 2] = Math.round(b / n);
    }
  }
  return encodePNG(size, out);
}

for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
]) {
  writeFileSync(resolve(outDir, name), render(size));
  console.log('wrote', name, `${size}x${size}`);
}
