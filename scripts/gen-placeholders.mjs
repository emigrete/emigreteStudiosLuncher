// gen-placeholders.mjs
// Genera la ÚNICA textura procedural que usa la UI:
//   - src/renderer/src/assets/stone.png -> grano gris neutro tileable (128x128)
//
// Se usa con `background-blend-mode: overlay` sobre los gradientes de paneles y
// botones: añade textura de piedra sin alterar el color base.
//
// El resto del arte es real y vive versionado en src/renderer/src/assets/:
//   hero.jpg · title_netherite.png · banner_teammafia.png · emigrete_logo.png
//   y build/icon.png (ícono de la app).

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rendererAssets = join(root, 'src/renderer/src/assets');
mkdirSync(rendererAssets, { recursive: true });

/* ----------------------------- PNG encoder ----------------------------- */
const crcTable = (() => {
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
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
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
function encodePNG({ w, h, data }) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* --------------------------- Textura de piedra ------------------------- */
function drawStone() {
  const S = 128;
  const data = Buffer.alloc(S * S * 4);
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return ((seed >>> 8) & 0xffff) / 0xffff;
  };
  const clamp = (v) => (v < 40 ? 40 : v > 210 ? 210 : v);
  for (let y = 0; y < S; y += 2) {
    for (let x = 0; x < S; x += 2) {
      const base = 122 + (rnd() * 2 - 1) * 30;
      const crack = rnd() < 0.05 ? -46 : rnd() < 0.05 ? 34 : 0;
      const v = clamp(base + crack) | 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const i = ((y + dy) * S + (x + dx)) * 4;
          data[i] = v;
          data[i + 1] = v;
          data[i + 2] = Math.min(215, v + 4);
          data[i + 3] = 255;
        }
      }
    }
  }
  return { w: S, h: S, data };
}

writeFileSync(join(rendererAssets, 'stone.png'), encodePNG(drawStone()));
console.log('✓ textura generada: stone.png');
