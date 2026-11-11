#!/usr/bin/env node
/**
 * Генератор вёрстки из спеки — пилот на двух секциях.
 *
 *   node tools/gen.mjs plan   [page/section]
 *   node tools/gen.mjs emit   [page/section | --all]
 *   node tools/gen.mjs report
 *
 * Что делает: читает `design/figma/pages/<page>/<section>/spec.json` и пишет
 * `src/components/_gen/<Section>.astro` — абсолютную раскладку по координатам
 * спеки. Ничего не перезаписывает вне `_gen/`: ручные компоненты остаются как
 * есть, пилот живёт на своей странице `/gen.html`.
 *
 * Чего НЕ делает и почему это честно:
 *   - не воспроизводит auto-layout: в спеке нет полей раскладки, только
 *     координаты и `sizing`. Пока это абсолютная вёрстка;
 *   - векторные иконки и инстансы без детей уходят в overrides: их нельзя
 *     нарисовать из чисел, нужен SVG;
 *   - поведение (состояния, дополнения) не генерируется вообще.
 *
 * Overrides — `design/gen/overrides/<section>.json`: узел, причина, решение.
 * Ворота `gen-overrides` не дают появиться записи без причины, как реестр
 * изобретённого.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

const root = process.cwd();
const [command, ...rest] = process.argv.slice(2);

const GEN_DIR = join(root, 'src/components/_gen');
const OVERRIDES_DIR = join(root, 'design/gen/overrides');
const TARGETS = join(root, 'design/gen/targets.json');

const readJson = (path, fallback = null) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback);

/** Цели пилота: какие секции генератор вообще берётся собирать. */
function targets() {
  const file = readJson(TARGETS, { sections: [] });
  return file.sections ?? [];
}

function specOf(unit) {
  const path = join(root, 'design/figma/pages', unit, 'spec.json');
  if (!existsSync(path)) {
    console.error(`нет спеки: ${unit}`);
    process.exit(2);
  }
  return { unit, spec: JSON.parse(readFileSync(path, 'utf8')) };
}

/** Токен по цвету: если hex совпал со значением переменной, пишем var(). */
function tokenOf(hex) {
  const css = existsSync(join(root, 'src/styles/tokens.css'))
    ? readFileSync(join(root, 'src/styles/tokens.css'), 'utf8')
    : '';
  const needle = String(hex).toLowerCase();
  for (const line of css.split('\n')) {
    const m = line.match(/^\s*(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/);
    if (m && m[2].toLowerCase() === needle) return `var(${m[1]})`;
  }
  return hex;
}

/** Угол линейного градиента из матрицы Figma. */
function gradientAngle(transform) {
  if (!Array.isArray(transform) || !transform.length) return '180deg';
  const [a, b] = transform[0];
  // В Figma ось градиента лежит в первой строке матрицы.
  const deg = (Math.atan2(b, a) * 180) / Math.PI + 90;
  return `${Math.round(((deg % 360) + 360) % 360)}deg`;
}

function fillToCss(fill) {
  if (!fill || fill.visible === false) return null;
  if (fill.type === 'SOLID') return tokenOf(fill.color?.hex ?? '#000000');
  if (String(fill.type).startsWith('GRADIENT')) {
    const stops = (fill.gradientStops ?? [])
      .map((s) => `${tokenOf(s.color?.hex ?? '#000')} ${Math.round((s.position ?? 0) * 100)}%`)
      .join(', ');
    const kind = fill.type === 'GRADIENT_LINEAR' ? 'linear-gradient' : 'radial-gradient';
    return kind === 'linear-gradient' ? `linear-gradient(${gradientAngle(fill.gradientTransform)}, ${stops})` : `radial-gradient(circle, ${stops})`;
  }
  return null;
}

const FAMILY = {
  'Golos Text': "'Golos Text'",
  Literata: 'Literata',
  Lora: 'Lora',
  'Great Vibes': "'Great Vibes'",
  Hurricane: 'Hurricane',
  'Cormorant Garamond': "'Cormorant Garamond'",
};
const WEIGHT = { Regular: 400, Light: 300, Medium: 500, Semibold: 600, Bold: 700, Black: 900 };

/** Узлы, из которых складывается разметка. */
function planOf(spec, unit) {
  const nodes = spec.nodes ?? [];
  const overrides = [];
  const emit = [];

  // Абсолютные координаты: в спеке x/y относительны родителю, а разметка
  // плоская — складываем по цепочке, иначе вложенное уезжает к левому краю.
  const stack = [];
  for (const node of nodes) {
    while (stack.length && stack[stack.length - 1].depth >= node.depth) stack.pop();
    const parent = stack[stack.length - 1] ?? null;
    node._ax = node.depth === 0 ? 0 : node.x + (parent?._ax ?? 0);
    node._ay = node.depth === 0 ? 0 : node.y + (parent?._ay ?? 0);
    stack.push(node);
  }

  for (const node of nodes) {
    if (node.depth === 0) continue;
    const hasText = Boolean((node.text ?? '').trim());
    const fills = (node.fills ?? []).filter((f) => f.visible !== false);
    const image = fills.find((f) => f.type === 'IMAGE');
    const vector = node.type === 'VECTOR' && !hasText;

    // Иконки и вектор — не числа, а SVG: остаются рукам.
    if (vector) {
      overrides.push({ node: node.id, reason: 'вектор: нужен SVG, из чисел не рисуется', decision: 386 });
      continue;
    }
    // Инстанс без детей в спеке: это либо иконка, либо готовый компонент.
    if (node.type === 'INSTANCE' && !nodes.some((n) => n.depth === node.depth + 1)) {
      overrides.push({ node: node.id, reason: 'инстанс без детей: берётся из ручного компонента', decision: 386 });
      continue;
    }
    emit.push({ node, hasText, fills, image });
  }

  return { unit, emit, overrides };
}

function renderNode({ node, hasText, fills, image }) {
  const style = [`left:${node._ax}px`, `top:${node._ay}px`, `width:${node.w}px`, `height:${node.h}px`];

  const solid = fills.find((f) => f.type === 'SOLID');
  const gradient = fills.find((f) => String(f.type).startsWith('GRADIENT'));
  if (gradient) style.push(`background:${fillToCss(gradient)}`);
  else if (solid && !hasText) style.push(`background:${fillToCss(solid)}`);

  if (node.radius) style.push(`border-radius:${Math.round(node.radius)}px`);

  if (hasText) {
    const family = FAMILY[node.fontFamily] ?? "'Golos Text'";
    const weight = WEIGHT[node.fontStyle] ?? 400;
    style.push(`font-family:${family}`, `font-weight:${weight}`, `font-size:${node.fontSize ?? 16}px`);
    if (solid) style.push(`color:${fillToCss(solid)}`);
    const lh = node.lineHeight?.value;
    if (lh) style.push(`line-height:${node.lineHeight.unit === 'PERCENT' ? (lh / 100).toFixed(2) : `${lh}px`}`);
    const ls = node.letterSpacing?.value;
    if (ls) style.push(`letter-spacing:${node.letterSpacing.unit === 'PERCENT' ? `${(ls / 100).toFixed(3)}em` : `${ls}px`}`);
    if (node.textAlign === 'CENTER') style.push('text-align:center');
    else if (node.textAlign === 'RIGHT') style.push('text-align:right');
  } else if (image?.imageHash) {
    // Кроп из Figma: imageTransform переводит картинку в коробку. Обратная
    // величина даёт размер в процентах, а смещение — положение. Формула
    // сверена с ручными значениями секции process: 0.7348 → 136.10 %,
    // смещение 0.2658 → 100 %.
    const t = image.imageTransform;
    const url = imageUrl(image.imageHash);
    style.push(`background-image:url('${url}')`, 'background-repeat:no-repeat');
    if (t) {
      const a = t[0][0];
      const tx = t[0][2] ?? 0;
      const d = t[1][1];
      const ty = t[1][2] ?? 0;
      const sizeX = (100 / a).toFixed(2);
      const sizeY = (100 / d).toFixed(2);
      const posX = Math.abs(1 - a) < 1e-6 ? 0 : (tx / (1 - a)) * 100;
      const posY = Math.abs(1 - d) < 1e-6 ? 0 : (ty / (1 - d)) * 100;
      style.push(`background-size:${sizeX}% ${sizeY}%`, `background-position:${posX.toFixed(2)}% ${posY.toFixed(2)}%`);
    } else {
      style.push('background-size:cover', 'background-position:center');
    }
  }

  const text = hasText ? node.text.replace(/&/g, '&amp;').replace(/</g, '&lt;') : '';
  return `  <div class="n" data-figma-node="${node.id}" style="${style.join(';')}">${text}</div>`;
}

function componentSource(unit, plan, spec) {
  const name = unit.split('/')[1];
  const rows = plan.emit.map(renderNode).join('\n');

  return `---
/**
 * ${name} — сгенерировано tools/gen.mjs из design/figma/pages/${unit}/spec.json.
 * Руками не правится: перезапишется. Правки — в design/gen/overrides/${name}.json.
 *
 * Абсолютная раскладка по координатам спеки: ${plan.emit.length} узлов,
 * в overrides ${plan.overrides.length}. Auto-layout не воспроизводится —
 * в спеке нет полей раскладки, только координаты.
 */
---

<section class="gen" data-figma-node="${spec.section.id}">
  <div class="gen__inner">
${rows}
  </div>
</section>

<style>
  .gen {
    position: relative;
    width: ${spec.section.w}px;
    height: ${spec.section.h}px;
    overflow: hidden;
    background: ${fillToCss((spec.nodes.find((n) => n.depth === 0)?.fills ?? [])[0]) ?? 'transparent'};
  }

  .gen__inner {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .gen .n {
    position: absolute;
    overflow: visible;
    white-space: pre-wrap;
  }
</style>
`;
}

function imageUrl(hash) {
  // В спеке хеш полный (40 символов), а файлы в assets/img названы первыми
  // 12 — пробуем оба варианта, иначе картинка молча не находится.
  const candidates = [hash, hash.slice(0, 12)];
  for (const name of candidates) for (const ext of ['jpg', 'png', 'webp']) {
    const rel = `design/figma/assets/img/${name}.${ext}`;
    if (existsSync(join(root, rel))) {
      // В public/ копируем коротким именем: так же названы файлы в assets,
      // и одинаковое имя не зависит от того, полный хеш в спеке или нет.
      const short = hash.slice(0, 12);
      const publicDir = join(root, 'public/img');
      mkdirSync(publicDir, { recursive: true });
      const target = join(publicDir, `${short}.${ext}`);
      if (!existsSync(target)) writeFileSync(target, readFileSync(join(root, rel)));
      return `/img/${short}.${ext}`;
    }
  }
  return '';
}

// --- Команды ---------------------------------------------------------------

if (!command || !['plan', 'emit', 'report'].includes(command)) {
  console.error('Использование: node tools/gen.mjs <plan|emit|report> [page/section | --all]');
  process.exit(2);
}

const units = rest.includes('--all') || !rest[0] ? targets() : [rest[0]].flat();
if (!units.length) {
  console.error('нет целей: заполните design/gen/targets.json');
  process.exit(2);
}

if (command === 'plan') {
  for (const unit of units) {
    const { spec } = specOf(unit);
    const plan = planOf(spec, unit);
    console.log(`${unit}: узлов ${(spec.nodes ?? []).length - 1} · генерируется ${plan.emit.length} · overrides ${plan.overrides.length}`);
    for (const o of plan.overrides) console.log(`  override ${o.node}: ${o.reason}`);
  }
  process.exit(0);
}

if (command === 'emit') {
  mkdirSync(GEN_DIR, { recursive: true });
  mkdirSync(OVERRIDES_DIR, { recursive: true });
  for (const unit of units) {
    const { spec } = specOf(unit);
    const plan = planOf(spec, unit);
    const source = componentSource(unit, plan, spec);
    const name = unit.split('/')[1];
    const file = join(GEN_DIR, `${name.charAt(0).toUpperCase()}${name.slice(1)}.astro`);
    writeFileSync(file, source);
    writeFileSync(join(OVERRIDES_DIR, `${name}.json`), JSON.stringify({ section: unit, overrides: plan.overrides }, null, 2) + '\n');
    console.log(`${unit}: ${plan.emit.length} узлов · overrides ${plan.overrides.length} · ${file.replace(root + '/', '')}`);
  }
  process.exit(0);
}

if (command === 'report') {
  let total = 0;
  let generated = 0;
  let overrides = 0;
  const rows = [];
  for (const unit of units) {
    const { spec } = specOf(unit);
    const plan = planOf(spec, unit);
    const nodes = (spec.nodes ?? []).length - 1;
    total += nodes;
    generated += plan.emit.length;
    overrides += plan.overrides.length;
    const name = unit.split('/')[1];
    const file = join(GEN_DIR, `${name.charAt(0).toUpperCase()}${name.slice(1)}.astro`);
    const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
    const drift = current !== componentSource(unit, plan, spec);
    rows.push({ unit, nodes, generated: plan.emit.length, overrides: plan.overrides.length, drift });
  }
  for (const r of rows) {
    console.log(`${r.unit}: узлов ${r.nodes} · сгенерено ${r.generated} · overrides ${r.overrides} · ${r.drift ? 'РАСХОДИТСЯ с файлом' : 'файл совпадает'}`);
  }
  const coverage = total ? generated / total : 0;
  console.log(`\nпокрытие: ${generated} из ${total} узлов (${Math.round(coverage * 100)} %) · overrides ${overrides}`);
  const threshold = readJson(join(root, 'design/figma/project.json'), { gates: {} }).gates?.genCoverage ?? 0.9;
  if (rows.some((r) => r.drift)) process.exit(1);
  if (coverage < threshold) process.exit(1);
  process.exit(0);
}
