#!/usr/bin/env node
/**
 * Ворота геометрии: DOM против spec.json, связь через data-figma-node.
 *
 *   node tools/measure.mjs design/figma/pages/home/hero/spec.json
 *   node tools/measure.mjs design/figma/pages/home/hero/spec.json --tol 1 --url /
 *
 * Как читается связь:
 *   - элемент с data-figma-node="79:106" сверяется с узлом 79:106 из спеки;
 *   - на одном элементе можно указать несколько id через пробел, если разметка
 *     схлопывает служебные фреймы (hero и hero-video — один <section>);
 *   - координаты считаются от корня секции, а не от DOM-родителя: разметка
 *     вправе отличаться от дерева Figma, пока совпадает геометрия.
 *
 * Ворота закрываются, если:
 *   1) нет элементов с id, которых нет в спеке;
 *   2) у всех узлов глубины ≤ 2 есть свой элемент (иначе часть секции не собрана);
 *   3) расхождение по x/y/w/h не больше допуска (по умолчанию 1 px).
 *
 * Код возврата 1 — ворота красные, 0 — зелёные.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const specPath = process.argv[2];
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};

if (!specPath) {
  console.error('Укажи спеку: node tools/measure.mjs design/figma/pages/home/hero/spec.json');
  process.exit(2);
}

const tol = Number(arg('--tol', 1));
const urlPath = arg('--url', '/');
const width = Number(arg('--width', 1440));

const raw = readFileSync(join(root, specPath), 'utf8');
const spec = JSON.parse(raw.slice(raw.indexOf('{')));

// --- Индекс узлов: id → узел, родитель восстанавливается по depth ----------
const byId = new Map();
const stack = [];
for (const node of spec.nodes) {
  while (stack.length && stack[stack.length - 1].depth >= node.depth) stack.pop();
  node.parentId = stack.length ? stack[stack.length - 1].id : null;
  stack.push(node);
  byId.set(node.id, node);
}

/**
 * Абсолютные координаты узла от корня секции.
 * Смещение самого корня не учитывается: в макете он стоит на странице
 * (например, pain на y=1305), а в DOM корень и есть начало координат.
 */
function absolute(node, rootId) {
  let x = 0;
  let y = 0;
  let cur = node;
  while (cur && cur.id !== rootId) {
    x += cur.x;
    y += cur.y;
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  return { x, y };
}

const dist = join(root, 'dist');
if (!existsSync(dist)) {
  console.error('Нет dist/. Сначала: npm run build');
  process.exit(2);
}

const port = Number(process.env.SHOT_PORT ?? 4332);
const base = `http://127.0.0.1:${port}`;
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
const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
await page.goto(base + urlPath, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

// --- DOM: элементы с data-figma-node --------------------------------------
const rootId = spec.section.id;
const measured = await page.evaluate((rootNodeId) => {
  const rootEl = document.querySelector(`[data-figma-node~="${rootNodeId}"]`);
  if (!rootEl) return { error: 'root-not-found' };
  const origin = rootEl.getBoundingClientRect();
  const out = [];
  // сам корень тоже меряем: он должен совпасть с (0,0,w,h)
  const roots = [rootEl, ...rootEl.querySelectorAll('[data-figma-node]')];
  for (const el of roots) {
    const ids = (el.getAttribute('data-figma-node') ?? '').trim().split(/\s+/).filter(Boolean);
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    out.push({
      ids,
      x: +(r.x - origin.x).toFixed(2),
      y: +(r.y - origin.y).toFixed(2),
      w: +r.width.toFixed(2),
      h: +r.height.toFixed(2),
      hidden: style.display === 'none' || style.visibility === 'hidden',
      tag: el.tagName.toLowerCase(),
      cls: String(el.className ?? '').slice(0, 40),
    });
  }
  return { origin: { x: origin.x, y: origin.y, w: origin.width, h: origin.height }, elements: out };
}, rootId);

await browser.close();
server.close();

if (measured.error) {
  console.error(`Нет элемента с data-figma-node="${rootId}" — корень секции не размечен.`);
  process.exit(1);
}

// --- Сверка ---------------------------------------------------------------
const rows = [];
const seen = new Set();
let unknown = 0;
let red = 0;

for (const el of measured.elements) {
  for (const id of el.ids) {
    const node = byId.get(id);
    if (!node) {
      unknown++;
      rows.push({ id, name: '—', status: 'НЕТ В СПЕКЕ', el });
      continue;
    }
    seen.add(id);
    if (el.hidden) {
      rows.push({ id, name: node.name, status: 'СКРЫТ', el });
      continue;
    }
    const abs = absolute(node, rootId);
    // Ширину текста сверяем: блоки ограничены max-width из спеки, поэтому
    // совпадает и ширина, и точки переноса. Если у блока ширины нет — он
    // растянется на колонку и ворота это покажут.
    const worst = Math.max(
      Math.abs(el.x - abs.x),
      Math.abs(el.y - abs.y),
      Math.abs(el.w - node.w),
      Math.abs(el.h - node.h),
    );
    const ok = worst <= tol;
    if (!ok) red++;
    rows.push({
      id,
      name: node.name,
      figma: { ...abs, w: node.w, h: node.h },
      dom: el,
      worst,
      ok,
      status: ok ? 'ok' : 'РАСХОЖДЕНИЕ',
    });
  }
}

// Узлы глубины ≤ 2 обязаны иметь элемент: иначе секция собрана не целиком.
const required = spec.nodes.filter((n) => n.depth > 0 && n.depth <= 2 && n.visible);
const missing = required.filter((n) => !seen.has(n.id));
const coverage = required.length ? ((required.length - missing.length) / required.length) * 100 : 100;

// --- Печать ---------------------------------------------------------------
const pad = (v, n) => String(v).padStart(n);
console.log(`секция: ${spec.section.name}  ${spec.section.w}×${spec.section.h}  (${rootId})`);
console.log(`допуск: ${tol} px · ширина: ${width}\n`);
console.log('узел                        эталон (x,y,w,h)      DOM (x,y,w,h)         Δ max  статус');

const depthOf = (id) => byId.get(id)?.depth ?? 99;
for (const r of rows.sort((a, b) => depthOf(a.id) - depthOf(b.id))) {
  if (r.status === 'НЕТ В СПЕКЕ') {
    console.log(`${r.id.padEnd(26)}  ${'—'.padEnd(20)}  ${`${r.el.x},${r.el.y},${r.el.w},${r.el.h}`.padEnd(20)}  ${'—'.padStart(5)}  ${r.status}`);
    continue;
  }
  if (r.status === 'СКРЫТ') {
    console.log(`${r.id.padEnd(26)}  ${'скрыт'.padEnd(20)}  ${''.padEnd(20)}  ${'—'.padStart(5)}  ${r.status}`);
    continue;
  }
  const f = `${r.figma.x},${r.figma.y},${r.figma.w},${r.figma.h}`;
  const a = `${r.dom.x},${r.dom.y},${r.dom.w},${r.dom.h}`;
  console.log(
    `${(r.ok ? '  ' : '! ') + r.id.padEnd(24)}  ${f.padEnd(20)}  ${a.padEnd(20)}  ${pad(r.worst.toFixed(2), 5)}  ${r.status}`,
  );
}

console.log(`\nразмечено узлов: ${seen.size} из ${spec.nodes.length}`);
console.log(`обязательных (глубина ≤ 2): ${required.length}, покрыто ${coverage.toFixed(0)} %`);
if (missing.length) {
  console.log('не размечены:');
  for (const n of missing) console.log(`   ${n.id}  ${n.name}  ${n.w}×${n.h} (глубина ${n.depth})`);
}
if (unknown) console.log(`\nВНИМАНИЕ: ${unknown} атрибут(ов) ссылаются на узлы, которых нет в спеке.`);

const failed = red > 0 || unknown > 0 || missing.length > 0;

// Числа остаются на диске: страница структуры читает их, а не пересказ.
const gate = {
  at: new Date().toISOString(),
  section: spec.section,
  ok: !failed,
  red,
  unknown,
  missing: missing.map((n) => ({ id: n.id, name: n.name })),
  marked: seen.size,
  nodes: spec.nodes.length,
  coverage: +coverage.toFixed(1),
  tolerance: tol,
  worstDelta: rows.reduce((m, r) => (r.worst > m ? r.worst : m), 0),
};
writeFileSync(join(dirname(join(root, specPath)), 'gate.json'), JSON.stringify(gate, null, 2) + '\n');

console.log(
  `\nвердикт: ${failed ? 'КРАСНЫЕ' : 'зелёные'} · расхождений ${red}, вне спеки ${unknown}, не размечено ${missing.length}`,
);
process.exit(failed ? 1 : 0);
