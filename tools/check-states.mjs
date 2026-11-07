#!/usr/bin/env node
/**
 * Проверяет, что контент из всех состояний секции действительно есть на странице.
 *
 *   node tools/check-states.mjs [--url /]
 *
 * Класс ошибки: секция живёт в файле в нескольких состояниях, и в них разный
 * контент. Собран один вариант — остальной контент молча теряется. Так было
 * с голосами: в секции три карточки, а в одиннадцати других состояниях ещё
 * девять отзывов. Замер и пиксель этого не видят: видимое окно совпадает
 * с макетом, а остальные девять просто не существуют.
 *
 * Как работает: берёт `states.json` каждой собранной секции, оставляет
 * состояния с той же страницы (варианты одного блока), собирает из них тексты
 * и ищет каждый в отрендеренной секции. Не нашёлся — контент не собран.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname, normalize, relative } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const dist = join(root, 'dist');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const urlPath = arg('--url', '/');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('нет dist/ — сначала npm run build');
  process.exit(2);
}

// --- 1. Где какая секция живёт ---------------------------------------------
const structure = JSON.parse(readFileSync(join(root, 'design/figma/live/structure.json'), 'utf8'));
const pageOf = new Map();
for (const page of structure.pages ?? []) {
  const walk = (node) => {
    if (node.id) pageOf.set(node.id, page.name);
    for (const child of node.children ?? []) walk(child);
  };
  for (const frame of page.frames ?? []) walk(frame);
}

// --- 2. Секции, у которых есть состояния и замер ---------------------------
const pagesRoot = join(root, 'design/figma/pages');
const sections = [];
for (const page of readdirSync(pagesRoot)) {
  const pageDir = join(pagesRoot, page);
  if (!statSync(pageDir).isDirectory()) continue;
  for (const name of readdirSync(pageDir)) {
    const dir = join(pageDir, name);
    const statesPath = join(dir, 'states.json');
    const gatePath = join(dir, 'gate.json');
    const specPath = join(dir, 'spec.json');
    if (!existsSync(statesPath) || !existsSync(gatePath) || !existsSync(specPath)) continue;
    sections.push({ page, name, dir, statesPath, specPath });
  }
}

if (!sections.length) {
  console.log('нет собранных секций с состояниями');
  process.exit(0);
}

// --- 3. Тексты из состояний той же страницы --------------------------------
const clean = (text) =>
  String(text ?? '')
    .replace(/[\u2028\u2029]/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Сжатая форма без пробелов. В Figma перенос строки — это U+2028, а в вёрстке
 * он же становится <br>, и textContent склеивает слова без пробела. Сверять
 * только по «чистой» строке значит ловить ложное «контента нет».
 */
const squash = (text) => clean(text).replace(/\s+/g, '');

const MIN_LENGTH = 4;
// Регистр не сравниваем: «личная встреча» в разметке и «ЛИЧНАЯ ВСТРЕЧА» на
// экране — это одно и то же, капс делает CSS.

const expected = new Map(); // имя секции → Set текстов
for (const section of sections) {
  const states = JSON.parse(readFileSync(section.statesPath, 'utf8'));
  const spec = JSON.parse(readFileSync(section.specPath, 'utf8'));
  const sectionPage = pageOf.get(spec.section?.id) ?? section.page;

  // Состояния можно исключить данными: `exclude` в states.json с причиной.
  // Так отдельные экраны (результат теста) не выдаются за состояния блока.
  const excluded = new Set((states.exclude ?? []).flatMap((group) => group.ids ?? []));
  // Тексты, которые макет сам себе противоречит: не проверяем, но и не молчим.
  const ignored = new Set((states.ignoreTexts ?? []).map((item) => clean(item.text).toLowerCase()));
  if (excluded.size) {
    console.log(`  ${section.page}/${section.name}: исключено состояний ${excluded.size} — ${states.exclude[0].reason.slice(0, 60)}…`);
  }

  const texts = new Set();
  for (const node of spec.nodes ?? []) {
    const t = clean(node.text);
    if (t.length >= MIN_LENGTH) texts.add(t);
  }
  for (const state of states.states ?? []) {
    if (excluded.has(state.id)) continue;
    // Варианты одного блока: только та же страница. У подвала состояния
    // приходят с других страниц, и требовать их на главной нельзя.
    if (pageOf.get(state.id) !== sectionPage) continue;
    for (const item of [...(state.texts ?? [])]) {
      for (const value of [item.from, item.to]) {
        const t = clean(value);
        if (t.length >= MIN_LENGTH) texts.add(t);
      }
    }
  }
  for (const t of ignored) texts.delete([...texts].find((x) => x.toLowerCase() === t) ?? '');
  if (texts.size) expected.set(`${section.page}/${section.name}`, { section, texts });
}

// --- 4. Рендер -------------------------------------------------------------
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

const port = Number(process.env.STATES_PORT ?? 4339);
await new Promise((r) => server.listen(port, '127.0.0.1', r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://127.0.0.1:${port}${urlPath}`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

let total = 0;
let missing = 0;
const report = [];

// Секции живут на разных страницах: перед каждой переходим на свою.
const projectCfg = JSON.parse(readFileSync(join(process.cwd(), 'design/figma/project.json'), 'utf8'));
const routes = projectCfg.routes ?? {};
// Общие секции размечены id канонического компонента, а не инстанса страницы.
const sharedNodes = projectCfg.shared ?? {};
let currentUrl = null;

for (const [unit, { section, texts }] of expected) {
  const pageUrl = routes[unit.split('/')[0]] ?? '/';
  if (pageUrl !== currentUrl) {
    await page.goto(`http://127.0.0.1:${port}${pageUrl}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    currentUrl = pageUrl;
  }
  const spec = JSON.parse(readFileSync(section.specPath, 'utf8'));
  const id = sharedNodes[section.name] ?? spec.section?.id;
  const rendered = await page.evaluate((nodeId) => {
    const el = document.querySelector(`[data-figma-node="${nodeId}"]`);
    if (!el) return null;
    // textContent берёт и скрытые узлы: закрытый ответ аккордеона — тоже
    // контент, он просто не показан.
    // Плейсхолдер и aria-label пользователь видит, хотя это не textContent.
    const extra = [...el.querySelectorAll('input, textarea, [aria-label]')]
      .map((node) => `${node.getAttribute('placeholder') ?? ''} ${node.getAttribute('aria-label') ?? ''}`)
      .join(' ');
    return `${el.textContent ?? ''} ${extra}`;
  }, id);

  if (rendered === null) {
    report.push({ unit, reason: 'секции нет на странице', items: [] });
    missing += texts.size;
    total += texts.size;
    continue;
  }

  // Регистр не сравниваем: «личная встреча» в разметке и «ЛИЧНАЯ ВСТРЕЧА»
  // на экране — одно и то же, капс делает CSS.
  const haystack = clean(rendered).toLowerCase();
  const haystackFlat = squash(rendered).toLowerCase();
  const absent = [...texts].filter(
    (t) => !haystack.includes(t.toLowerCase()) && !haystackFlat.includes(squash(t).toLowerCase()),
  );
  total += texts.size;
  missing += absent.length;
  if (absent.length) report.push({ unit, reason: 'контент не собран', items: absent });
}

await browser.close();
server.close();

console.log(`секций с состояниями: ${expected.size} · текстов проверено: ${total}`);

if (!missing) {
  console.log('весь контент из состояний есть на странице');
  process.exit(0);
}

console.error(`\nне найдено на странице: ${missing}`);
for (const item of report) {
  console.error(`\n  ${item.unit} — ${item.reason}`);
  for (const text of item.items.slice(0, 4)) console.error(`     «${text.slice(0, 70)}…»`);
  if (item.items.length > 4) console.error(`     … ещё ${item.items.length - 4}`);
}
console.error('\nсостояние в файле есть, а в вёрстке нет: соберите контент всех вариантов');
process.exit(1);
