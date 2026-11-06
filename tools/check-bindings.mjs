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
const source = template.replace('__PAYLOAD__', JSON.stringify(items));
const tmp = join(tmpdir(), `check-bindings-${process.pid}.js`);
writeFileSync(tmp, source);

let reply;
try {
  reply = runFigma(['exec-js', tmp, '--timeout', '180000']);
} catch (error) {
  console.error(`сверка не выполнена: ${String(error.message).slice(0, 200)}`);
  process.exit(2);
}

const { checked, mismatches } = reply.result ?? { checked: 0, mismatches: [] };
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
