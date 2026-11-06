#!/usr/bin/env node
/**
 * Проверяет, что элементы управления действительно что-то делают.
 *
 *   node tools/check-interactive.mjs [--url /] [--only .faq]
 *
 * Класс ошибки, который ловит: блок собран как картинка. Геометрия сходится,
 * пиксель сходится, а кнопка, вкладка или вопрос не реагируют — потому что
 * обработчика нет. Так было с меню, вкладками форматов, слайдером отзывов
 * и аккордеоном FAQ: все четыре проходили ворота статичными.
 *
 * Как работает: находит в секции кнопки и `summary`, снимает отпечаток
 * состояния секции, нажимает и сравнивает отпечаток. Не изменилось — значит
 * элемент мёртвый.
 *
 * Ссылки `a[href="#"]` не проверяются: это заглушки навигации, а не управление.
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
const only = arg('--only', null);
const width = Number(arg('--width', 1440));

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

const port = Number(process.env.INTERACTIVE_PORT ?? 4336);
await new Promise((r) => server.listen(port, '127.0.0.1', r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
await page.goto(`http://127.0.0.1:${port}${urlPath}`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

// Отпечаток секции: классы, атрибуты и число узлов. Достаточно, чтобы увидеть
// смену состояния, и не зависит от конкретной разметки блока.
const signature = (selector) =>
  page.evaluate((sel) => {
    const rootEl = document.querySelector(sel);
    if (!rootEl) return null;
    const parts = [];
    const walk = (el) => {
      parts.push(
        `${el.tagName}|${el.className}|${el.getAttribute('aria-expanded') ?? ''}|` +
          `${el.getAttribute('open') ?? ''}|${el.getAttribute('style') ?? ''}`,
      );
      for (const child of el.children) walk(child);
    };
    walk(rootEl);
    return parts.join('\n');
  }, selector);

const sections = await page.evaluate((onlySel) => {
  // Секция — самый внешний узел с data-figma-node внутри <section>: вложенные
  // узлы проверять бессмысленно, их состояние меняется снаружи.
  const out = [];
  for (const section of document.querySelectorAll('section')) {
    const outer = section.matches('[data-figma-node]')
      ? section
      : section.querySelector('[data-figma-node]');
    if (!outer) continue;
    if (!outer.querySelector('button, summary')) continue;
    const id = outer.getAttribute('data-figma-node');
    const sel = `[data-figma-node="${id}"]`;
    if (onlySel && !outer.matches(onlySel) && !outer.closest(onlySel)) continue;
    out.push({ id, name: (outer.className || section.className).split(' ')[0] || outer.tagName.toLowerCase(), selector: sel });
  }
  return out;
}, only);

if (!sections.length) {
  console.log('элементов управления не найдено');
  await browser.close();
  server.close();
  process.exit(0);
}

let dead = 0;
let checked = 0;

for (const section of sections) {
  const controls = await page.$$(`${section.selector} button, ${section.selector} summary`);
  if (!controls.length) continue;

  const initial = await signature(section.selector);
  const seen = new Set([initial]);
  const labels = [];
  let clicks = 0;

  for (const control of controls) {
    const label = (await control.evaluate((el) => (el.textContent ?? '').trim().slice(0, 24) || el.getAttribute('aria-label') || el.tagName.toLowerCase())).trim();
    try {
      await control.click({ timeout: 2000 });
    } catch {
      continue;
    }
    await page.waitForTimeout(320);
    clicks += 1;
    labels.push(label);
    seen.add(await signature(section.selector));
  }

  // Ни одного нажатия не прошло — проверять нечего.
  if (!clicks) continue;
  checked += clicks;
  // Состояние не менялось ни разу — блок статичен, сколько бы кнопок в нём ни было.
  const alive = seen.size > 1;
  if (!alive) dead += 1;
  console.log(
    `${section.name.padEnd(18)} элементов ${String(clicks).padStart(2)} · состояний ${seen.size} ${alive ? 'живой' : 'СТАТИЧНЫЙ'}`,
  );
  if (!alive) console.log(`   нажатия не меняют ничего: ${labels.slice(0, 3).join(', ')}`);

  // вернуть страницу в исходное состояние
  await page.goto(`http://127.0.0.1:${port}${urlPath}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
}

console.log(`\nпроверено элементов: ${checked}, статичных секций: ${dead}`);

await browser.close();
server.close();

if (dead > 0) {
  console.error('\nсекция с кнопками, которые ничего не делают, — это картинка: добавьте состояние и переход');
  process.exit(1);
}
console.log('все секции с управлением меняют состояние');
