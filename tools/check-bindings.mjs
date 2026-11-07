#!/usr/bin/env node
/**
 * Проверяет, что цвета в спеках совпадают со значениями переменных в файле.
 *
 *   node tools/check-bindings.mjs
 *
 * Класс ошибки, который ловит: в спеке записано хранимое значение (цвет краски),
 * а действует значение переменной. Так 164 узла с полупрозрачной заливкой
 * оказались непрозрачными: карточка отзыва должна была просвечивать (0.35).
 *
 * Читает все спеки, собирает узлы с привязкой к переменной и одним вызовом
 * моста сверяет цвета. Возвращает exit 1 при расхождении.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { runFigma } from './figma/cli.mjs';

const root = process.cwd();
const pagesRoot = join(root, 'design/figma/pages');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry === 'spec.json') out.push(full);
  }
  return out;
}

if (!existsSync(pagesRoot)) {
  console.error('нет design/figma/pages — проверять нечего');
  process.exit(2);
}

const items = [];
const specs = walk(pagesRoot);

for (const specPath of specs) {
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  for (const node of spec.nodes) {
    const bound = node.bound || {};
    for (const kind of ['fills', 'strokes']) {
      const aliases = bound[kind] || [];
      const paints = node[kind] || [];
      for (let index = 0; index < aliases.length; index += 1) {
        const paint = paints[index];
        if (!paint || !paint.color) continue;
        items.push({ id: node.id, kind, index, expected: paint.color });
      }
    }
  }
}

if (!items.length) {
  console.log('привязок к переменным в спеках нет');
  process.exit(0);
}

const template = readFileSync(join(root, 'tools/figma/check-bindings.template.js'), 'utf8');

// Пачки: у плагина жёсткий бюджет на вызов, а привязок больше тысячи. Пачка
// из 30 узлов рвёт транспорт плагина («outcome-unknown»), из 10 проходит.
const CHUNK = 10;
let checked = 0;
const mismatches = [];

/**
 * Одна пачка. Если плагин не выдержал (транспорт рвётся на большом вызове),
 * пачка делится пополам и повторяется — вплоть до одного узла. Так размер
 * пачки не магическое число: он подстраивается под файл.
 */
function checkChunk(chunk) {
  const source = template.replace('__PAYLOAD__', JSON.stringify(chunk));
  const tmp = join(tmpdir(), `check-bindings-${process.pid}-${chunk[0]?.id?.replace(':', '-') ?? 'x'}.js`);
  writeFileSync(tmp, source);

  try {
    const reply = runFigma(['exec-js', tmp, '--timeout', '180000']);
    const part = reply.result ?? { checked: 0, mismatches: [] };
    checked += part.checked ?? 0;
    mismatches.push(...(part.mismatches ?? []));
    return true;
  } catch (error) {
    if (chunk.length === 1) {
      console.error(`сверка не выполнена на узле ${chunk[0].id}: ${String(error.message).slice(0, 160)}`);
      return false;
    }
    const half = Math.ceil(chunk.length / 2);
    return checkChunk(chunk.slice(0, half)) && checkChunk(chunk.slice(half));
  }
}

for (let start = 0; start < items.length; start += CHUNK) {
  if (!checkChunk(items.slice(start, start + CHUNK))) process.exit(2);
}

console.log(`спек: ${specs.length} · привязок проверено: ${checked}`);

if (!mismatches.length) {
  console.log('цвета в спеках совпадают со значениями переменных');
  process.exit(0);
}

console.error(`\nрасхождений: ${mismatches.length}`);
for (const item of mismatches.slice(0, 20)) {
  if (item.error) {
    console.error(`  ${item.id} ${item.kind}[${item.index}] — ${item.error}`);
  } else {
    console.error(
      `  ${item.id} ${item.kind}[${item.index}] ${item.variable}: ` +
        `в спеке ${item.expected.hex}@${item.expected.a}, в файле ${item.actual.hex}@${item.actual.a}`,
    );
  }
}
console.error('\nперевыгрузить секции: npm run export -- <nodeId> --name <slug>');
process.exit(1);
