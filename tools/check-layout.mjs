#!/usr/bin/env node
/**
 * Проверяет, что страница не шире экрана на ширине макета.
 *
 *   node tools/check-layout.mjs [--url /] [--widths 1440]
 *
 * Класс ошибки: блок шире кадра — появляется горизонтальная прокрутка.
 *
 * **Мобильной вёрстки нет.** В файле только кадр 1440; макетов 390 и 768
 * дизайнер не делал. Поэтому по умолчанию проверяется одна ширина — 1440.
 * Другие ширины можно передать руками, но это не приёмка: сверять не с чем.
 * Адаптив не «сжимается по месту» — он появится, когда появятся макеты.
 *
 * Что считается дефектом:
 *   - `scrollWidth` больше ширины окна — появилась горизонтальная прокрутка;
 *   - элемент с `data-figma-node` выходит за правый или левый край.
 *
 * Тап-таргеты не проверяются: текстовые ссылки законно ниже 44 px, а правило
 * про 44 касается управляющих элементов — это отдельное решение, не ворота.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const dist = join(root, 'dist');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const urlPath = arg('--url', '/');
const widths = arg('--widths', '1440')
  .split(',')
  .map((w) => Number(w.trim()))
  .filter(Boolean);

if (!existsSync(join(dist, 'index.html'))) {
  console.error('нет dist/ — сначала npm run build');
  process.exit(2);
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') path = '/index.html';
  const file = normalize(join(dist, path));
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});

const port = Number(process.env.LAYOUT_PORT ?? 4338);
await new Promise((r) => server.listen(port, '127.0.0.1', r));

const browser = await chromium.launch();
let failed = false;

for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}${urlPath}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);

  const result = await page.evaluate((viewportWidth) => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - viewportWidth;
    const offenders = [];

    // Элемент за краем — не дефект, если его подрезает предок с overflow.
    // Так устроена лента слайдера: она шире экрана намеренно.
    const clipped = (el) => {
      let node = el.parentElement;
      while (node) {
        const style = getComputedStyle(node);
        if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX)) return true;
        node = node.parentElement;
      }
      return false;
    };

    for (const el of document.querySelectorAll('[data-figma-node]')) {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (rect.right > viewportWidth + 1 || rect.left < -1) {
        if (clipped(el)) continue;
        offenders.push({
          id: el.getAttribute('data-figma-node'),
          cls: (el.className || '').toString().split(' ')[0],
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        });
      }
    }
    return { overflow, offenders };
  }, width);

  const ok = result.overflow <= 1 && !result.offenders.length;
  if (!ok) failed = true;
  console.log(`${width}px: ${ok ? 'ок' : 'ПЕРЕПОЛНЕНИЕ'} · запас по ширине ${-result.overflow}px · вылезло ${result.offenders.length}`);
  for (const item of result.offenders.slice(0, 6)) {
    console.log(`   ${item.cls || '—'} [${item.id}] ${item.left}…${item.right}`);
  }

  await page.close();
}

await browser.close();
server.close();

console.log('');
console.log('390 и 768 не проверяются: макетов нет, адаптива нет — это не дефект, а отсутствие исходника.');

if (failed) {
  console.error('страница шире экрана — горизонтальная прокрутка на этой ширине');
  process.exit(1);
}
console.log('на ширине макета раскладка держится');
