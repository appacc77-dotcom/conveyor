#!/usr/bin/env node
/**
 * Собирает состояние проекта из артефактов и обновляет таблицу в STATUS.md.
 *
 *   node tools/status.mjs          # напечатать
 *   node tools/status.mjs --write  # переписать блок между маркерами в STATUS.md
 *
 * Числа не пересказываются в документах: они читаются из gate.json и pixel.json
 * рядом с каждой секцией. Если секция пересобрана, достаточно позвать это.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const pagesDir = join(root, 'design/figma/pages');

const rows = [];
for (const page of readdirSync(pagesDir)) {
  const dir = join(pagesDir, page);
  for (const name of readdirSync(dir)) {
    const gatePath = join(dir, name, 'gate.json');
    const pixelPath = join(dir, name, 'pixel.json');
    if (!existsSync(gatePath)) continue;

    const gate = JSON.parse(readFileSync(gatePath, 'utf8'));
    const pixel = existsSync(pixelPath) ? JSON.parse(readFileSync(pixelPath, 'utf8')) : null;
    rows.push({ page, name, gate, pixel });
  }
}

const built = rows.filter((r) => r.gate.ok);
const red = rows.filter((r) => !r.gate.ok);
const mean = built.filter((r) => r.pixel).reduce((s, r) => s + r.pixel.mean, 0) / Math.max(1, built.filter((r) => r.pixel).length);

rows.sort((a, b) => (a.page === b.page ? (b.pixel?.mean ?? 0) - (a.pixel?.mean ?? 0) : a.page.localeCompare(b.page)));

const lines = [];
lines.push(`секций собрано: **${built.length}** из ${rows.length}${red.length ? `, красных: ${red.length}` : ''}`);
lines.push('');
lines.push('| секция | геометрия | узлов | пиксель | > 16 | > 48 |');
lines.push('|---|---:|---:|---:|---:|---:|');
for (const r of rows) {
  const g = r.gate.ok ? 'зелёная' : `**${r.gate.red} красных**`;
  const p = r.pixel ? r.pixel.mean.toFixed(2) : '—';
  const o16 = r.pixel ? `${r.pixel.over16.toFixed(2)} %` : '—';
  const o48 = r.pixel ? `${r.pixel.over48.toFixed(2)} %` : '—';
  lines.push(`| ${r.page}/${r.name} | ${g} | ${r.gate.marked} | ${p} | ${o16} | ${o48} |`);
}
lines.push('');
lines.push(`средний пиксель по собранным: **${mean.toFixed(2)}**`);

const table = lines.join('\n');
console.log(table);

if (process.argv.includes('--write')) {
  const statusPath = join(root, 'STATUS.md');
  const status = readFileSync(statusPath, 'utf8');
  const start = '<!-- status:start -->';
  const end = '<!-- status:end -->';
  if (!status.includes(start) || !status.includes(end)) {
    console.error(`\nв STATUS.md нет маркеров ${start} … ${end}`);
    process.exit(1);
  }
  const next = status.replace(
    new RegExp(`${start}[\\s\\S]*?${end}`),
    `${start}\n${table}\n${end}`,
  );
  writeFileSync(statusPath, next);
  console.log('\nSTATUS.md обновлён');
}
