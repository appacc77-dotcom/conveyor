#!/usr/bin/env node
/**
 * Снимок элемента собранного сайта для сверки с кропом из Figma.
 *
 *   node tools/shot.mjs .hero .screens/hero.png 1440 [--url /structure.html]
 *
 * Поднимает dist/ на локальном порту, ждёт шрифты и картинки, снимает элемент.
 * Требует npm run build и установленный chromium.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, dirname, isAbsolute } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const dist = join(root, 'dist');
const port = Number(process.env.SHOT_PORT ?? 4330);
const base = `http://127.0.0.1:${port}`;

const selector = process.argv[2] ?? '.hero';
const urlArg = (() => {
  const i = process.argv.indexOf('--url');
  return i > 0 ? process.argv[i + 1] : '/';
})();
const out = process.argv[3] ?? '.screens/shot.png';
const width = Number(process.argv[4] ?? 1440);

if (!existsSync(dist)) {
  console.error('Нет dist/. Сначала: npm run build');
  process.exit(1);
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', base);
  let path = decodeURIComponent(url.pathname);
  if (path === '/') path = '/index.html';
  const file = normalize(join(dist, path));
  if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(port, '127.0.0.1', r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
// networkidle на странице с десятками картинок не наступает — ждём load,
// а изображения добираем явно.
await page.goto(base + urlArg, { waitUntil: 'load', timeout: 60000 });
// Ждём картинки, но не бесконечно: битая ссылка не должна вешать съёмку.
await page.evaluate(async () => {
  const pending = [...document.images].filter((i) => !i.complete);
  await Promise.race([
    Promise.all(pending.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))),
    new Promise((r) => setTimeout(r, 8000)),
  ]);
});
await page.evaluate(() => document.fonts.ready);
// Ждём картинки, но не бесконечно: битая ссылка не должна вешать съёмку.
await page.evaluate(async () => {
  const pending = [...document.images].filter((i) => !i.complete);
  await Promise.race([
    Promise.all(pending.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))),
    new Promise((r) => setTimeout(r, 8000)),
  ]);
});

const el = await page.$(selector);
if (!el) {
  console.error(`Не найден селектор ${selector}`);
  await browser.close();
  server.close();
  process.exit(1);
}

// Шапка и подобные слои лежат поверх секций. При съёмке секции их прячем,
// иначе в кадр попадает чужой блок и сравнение с кропом врёт.
// Прячем оверлеи только когда снимаем секцию: если цель сама их содержит
// (страница целиком), они часть кадра и скрывать их нельзя.
const isOverlayTarget = await el.evaluate(
  (node) => !!node.closest('[data-overlay]') || !!node.querySelector('[data-overlay]'),
);
if (!isOverlayTarget) {
  await page.evaluate(() => {
    for (const node of document.querySelectorAll('[data-overlay]')) node.style.visibility = 'hidden';
  });
}

const box = await el.boundingBox();
// Абсолютный путь берём как есть: join(root, '/tmp/x') склеил бы корень.
const target = isAbsolute(out) ? out : join(root, out);
mkdirSync(dirname(target), { recursive: true });
await el.screenshot({ path: target });

console.log(JSON.stringify({ selector, out, width, height: Math.round(box.height), w: Math.round(box.width) }));

await browser.close();
server.close();
