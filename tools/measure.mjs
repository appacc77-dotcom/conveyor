#!/usr/bin/env node
/**
 * Замер DOM против чисел из Figma.
 *
 *   node tools/measure.mjs design/figma/sections/hero/measure.json
 *
 * Спека — плоский список { selector, figma: {x, y, w, h}, name }.
 * Печатает таблицу «эталон / факт / Δ» и код возврата 1, если Δ > 1 px.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const dist = join(root, 'dist');
const specPath = process.argv[2];
if (!specPath) {
  console.error('Укажи спеку: node tools/measure.mjs design/figma/sections/hero/measure.json');
  process.exit(2);
}

const raw = readFileSync(join(root, specPath), 'utf8');
const spec = JSON.parse(raw.slice(raw.indexOf('{')));
const port = Number(process.env.SHOT_PORT ?? 4331);
const base = `http://127.0.0.1:${port}`;
const TOL = Number(process.env.TOLERANCE ?? 1);

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', base);
  let path = decodeURIComponent(url.pathname);
  if (path === '/') path = '/index.html';
  const file = normalize(join(dist, path));
  if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

const rows = [];
let failed = 0;

for (const item of spec.items) {
  const box = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const p = el.parentElement?.getBoundingClientRect();
    return { x: r.x - (p?.x ?? 0), y: r.y - (p?.y ?? 0), w: r.width, h: r.height };
  }, item.selector);

  if (!box) {
    rows.push({ name: item.name, note: 'НЕ НАЙДЕН', ok: false });
    failed++;
    continue;
  }

  const d = ['x', 'y', 'w', 'h'].map((k) => Math.abs(box[k] - item.figma[k]));
  const worst = Math.max(...d);
  const ok = worst <= TOL;
  if (!ok) failed++;
  rows.push({ name: item.name, figma: item.figma, fact: box, worst: +worst.toFixed(2), ok });
}

const pad = (v) => String(v).padStart(6);
console.log('узел                       эталон (x,y,w,h)        факт (x,y,w,h)         Δ max');
for (const r of rows) {
  if (r.note) { console.log(`${r.name.padEnd(26)} ${r.note}`); continue; }
  const f = `${r.figma.x},${r.figma.y},${r.figma.w},${r.figma.h}`;
  const a = `${Math.round(r.fact.x)},${Math.round(r.fact.y)},${Math.round(r.fact.w)},${Math.round(r.fact.h)}`;
  console.log(`${(r.ok ? '  ' : '! ') + r.name.padEnd(24)} ${f.padEnd(22)} ${a.padEnd(22)} ${pad(r.worst)}`);
}

console.log(`\nдопуск ${TOL} px · нарушений: ${failed}`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
