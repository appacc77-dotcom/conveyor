#!/usr/bin/env node
/**
 * Выгружает все секции живого файла, у которых ещё нет спеки.
 *
 *   node tools/export-all.mjs [--force]
 *
 * Идёт по design/figma/structure.json (его собирает tools/structure.mjs),
 * для каждой секции зовёт tools/export-section.mjs. Повторный запуск
 * догружает только недостающее — это идемпотентный первый шаг конвейера.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const force = process.argv.includes('--force');
const dataPath = join(root, 'design/figma/structure.json');
if (!existsSync(dataPath)) {
  console.error('Нет design/figma/structure.json — сначала: npm run structure');
  process.exit(2);
}
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '');

const queue = [];
for (const page of data.pages) {
  for (const s of page.sections) {
    const slug = `${page.key}-${slugify(s.name)}`;
    const done = existsSync(join(root, 'design/figma/sections', slug, 'spec.json'));
    if (!done || force) queue.push({ ...s, slug, page: page.key });
  }
}

if (!queue.length) {
  console.log('все секции уже выгружены');
  process.exit(0);
}

console.log(`к выгрузке: ${queue.length} секций\n`);
let ok = 0;
const failed = [];

for (const [i, s] of queue.entries()) {
  const label = `${String(i + 1).padStart(2)}/${queue.length} ${s.page}/${s.name}`;
  try {
    const out = execFileSync(
      process.execPath,
      [join(root, 'tools/export-section.mjs'), s.id, '--name', s.slug],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 },
    );
    const line = out.trim().split('\n').find((l) => l.startsWith('фото:')) ?? '';
    console.log(`  ${label.padEnd(40)} ok  ${line}`);
    ok++;
  } catch (error) {
    const msg = (error.stderr?.toString() || error.message).split('\n')[0];
    console.log(`  ${label.padEnd(40)} ОШИБКА  ${msg}`);
    failed.push({ id: s.id, name: s.name, page: s.page, error: msg });
  }
}

console.log(`\nвыгружено ${ok} из ${queue.length}`);
if (failed.length) {
  console.log('не удалось:');
  for (const f of failed) console.log(`   ${f.page}/${f.name} (${f.id}): ${f.error}`);
  process.exit(1);
}
