#!/usr/bin/env node
/**
 * Пиксельная сверка снимка с кропом из Figma. Без внешних зависимостей.
 *
 *   node tools/compare.mjs design/figma/pages/home/hero/crop.png .screens/hero.png
 *
 * Печатает размеры, среднюю разницу, долю пикселей > 16 и худшие полосы.
 * Пиксель — сигнал регрессии, не ворота приёмки: текст растеризуется по-разному,
 * фон и заливки совпадают. Код возврата всегда 0, если файлы прочитаны.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Минимальный декодер PNG: 8 бит, RGB или RGBA, без интерлейса. */
function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIG)) throw new Error('не PNG');
  let pos = 8;
  let width = 0, height = 0, colorType = 0, bitDepth = 0;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); pos += 4;
    const type = buf.toString('ascii', pos, pos + 4); pos += 4;
    const data = buf.subarray(pos, pos + len); pos += len + 4; // + CRC
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG не поддержан');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
  }

  if (bitDepth !== 8) throw new Error(`bitDepth ${bitDepth} не поддержан`);
  if (colorType !== 2 && colorType !== 6) throw new Error(`colorType ${colorType} не поддержан`);

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * bpp);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const at = y * (stride + 1);
    const filter = raw[at];
    const cur = Buffer.from(raw.subarray(at + 1, at + 1 + stride));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      if (filter === 1) cur[x] = (cur[x] + a) & 255;
      else if (filter === 2) cur[x] = (cur[x] + b) & 255;
      else if (filter === 3) cur[x] = (cur[x] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        cur[x] = (cur[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      } else if (filter !== 0) {
        throw new Error(`фильтр ${filter} не поддержан`);
      }
    }
    cur.copy(out, y * stride);
    prev = cur;
  }

  return { width, height, bpp, data: out };
}

const [refPath, curPath] = process.argv.slice(2);
if (!refPath || !curPath) {
  console.error('Укажи два файла: node tools/compare.mjs <эталон.png> <снимок.png>');
  process.exit(2);
}

const ref = decodePng(readFileSync(refPath));
const cur = decodePng(readFileSync(curPath));

console.log(`эталон: ${refPath}  ${ref.width}x${ref.height}`);
console.log(`снимок: ${curPath}  ${cur.width}x${cur.height}`);

const w = Math.min(ref.width, cur.width);
const h = Math.min(ref.height, cur.height);
if (ref.width !== cur.width || ref.height !== cur.height) {
  console.log(`ВНИМАНИЕ: размеры не совпали, сравниваю ${w}x${h} из левого верхнего угла`);
}

let sum = 0;
let over16 = 0;
let over48 = 0;
const bandStep = Math.max(1, Math.floor(h / 8));
const bands = new Map();

for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const ri = (y * ref.width + x) * ref.bpp;
    const ci = (y * cur.width + x) * cur.bpp;
    const dr = Math.abs(ref.data[ri] - cur.data[ci]);
    const dg = Math.abs(ref.data[ri + 1] - cur.data[ci + 1]);
    const db = Math.abs(ref.data[ri + 2] - cur.data[ci + 2]);
    const d = Math.max(dr, dg, db);
    sum += dr + dg + db;
    if (d > 16) over16++;
    if (d > 48) over48++;
    const band = Math.floor(y / bandStep);
    const b = bands.get(band) ?? { sum: 0, over: 0, n: 0 };
    b.sum += d;
    if (d > 16) b.over++;
    b.n++;
    bands.set(band, b);
  }
}

const total = w * h;
console.log(`средняя разница: ${(sum / (total * 3)).toFixed(2)}`);
console.log(`пикселей > 16:   ${((over16 / total) * 100).toFixed(2)} %`);
console.log(`пикселей > 48:   ${((over48 / total) * 100).toFixed(2)} %`);

const worst = [...bands.entries()]
  .map(([i, b]) => ({ y: i * bandStep, mean: b.sum / b.n, over: (b.over / b.n) * 100 }))
  .sort((a, b) => b.mean - a.mean)
  .slice(0, 3);

// Числа рядом с кропом — их читает страница структуры.
const pixel = {
  at: new Date().toISOString(),
  reference: refPath,
  shot: curPath,
  width: w,
  height: h,
  mean: +(sum / (total * 3)).toFixed(2),
  over16: +((over16 / total) * 100).toFixed(2),
  over48: +((over48 / total) * 100).toFixed(2),
};
writeFileSync(join(dirname(join(process.cwd(), refPath)), 'pixel.json'), JSON.stringify(pixel, null, 2) + '\n');

console.log('худшие полосы (средняя, y, % > 16):');
for (const b of worst) {
  console.log(`   y=${String(b.y).padEnd(5)} ${b.mean.toFixed(2).padStart(6)}   ${b.over.toFixed(1).padStart(5)} %`);
}
