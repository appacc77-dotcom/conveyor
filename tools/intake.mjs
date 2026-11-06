#!/usr/bin/env node
/**
 * Модуль 1 — figma-intake (P0 + P1).
 *
 * Снимает живой файл Figma через мост: структуру страниц, дизайн-систему и
 * реальность (масштабы, ширины). Ничего не выдумывает и ничего не выгружает
 * заранее — читает то, что открыто сейчас.
 *
 *   node tools/intake.mjs [--quiet]
 *
 * Вход:  design/figma/project.json
 * Выход: design/figma/live/{structure,ds,reality}.json + snapshot.json
 *
 * Коды возврата:
 *   0 — снимок снят, fileKey совпал
 *   1 — открыт другой файл (или fileKey не совпал с project.json)
 *   2 — мост недоступен: не запущен плагин или Figma закрыта
 *   3 — скрипт Figma вернул ошибку
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const root = process.cwd();
const quiet = process.argv.includes('--quiet');

const die = (code, message) => {
  console.error(`intake: ${message}`);
  process.exit(code);
};

const projectPath = join(root, 'design/figma/project.json');
if (!existsSync(projectPath)) die(3, 'нет design/figma/project.json');
const project = JSON.parse(readFileSync(projectPath, 'utf8'));

const liveDir = join(root, project.paths.live);
mkdirSync(liveDir, { recursive: true });

/** figma-agent иногда предваряет JSON строкой предупреждения линтера. */
function parseOutput(stdout) {
  const at = stdout.indexOf('{');
  if (at < 0) throw new Error(`не JSON: ${stdout.slice(0, 200)}`);
  return JSON.parse(stdout.slice(at));
}

function figma(args) {
  try {
    const out = execFileSync('figma-agent', args, {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return parseOutput(out);
  } catch (error) {
    const stdout = error.stdout?.toString?.() ?? '';
    const at = stdout.indexOf('{');
    if (at >= 0) {
      const parsed = JSON.parse(stdout.slice(at));
      if (parsed.error) die(3, `${parsed.error.code}: ${parsed.error.message}`);
    }
    die(2, `figma-agent ${args[0]} не ответил (${error.message.split('\n')[0]})`);
  }
}

// --- 1. Мост жив? ---------------------------------------------------------
const peek = figma(['status', '--peek']);
if (!peek.connected) {
  die(2, 'мост не подключён — открой файл в Figma desktop и запусти плагин DESIGN:OS Bridge');
}

const live = peek.plugins?.[0] ?? {};
if (live.fileName && live.fileName !== project.source.fileName) {
  die(1, `открыт «${live.fileName}», а проект настроен на «${project.source.fileName}»`);
}
if (peek.versionMatch === false || peek.protocolMatch === false) {
  die(2, 'версия плагина не совпадает с CLI — обнови одну из сторон');
}

// --- 2. Дизайн-система ----------------------------------------------------
const dsPath = join(liveDir, 'ds.json');
figma(['scan-design-system', '--out', dsPath, '--timeout', '60000']);
const ds = JSON.parse(readFileSync(dsPath, 'utf8'));

// --- 3. Структура и реальность -------------------------------------------
const runScript = (name, outName) => {
  const result = figma(['exec-js', join(root, 'tools/figma', name), '--timeout', '90000']);
  if (!result.result) die(3, `${name}: пустой результат`);
  writeFileSync(join(liveDir, outName), JSON.stringify(result.result, null, 2) + '\n');
  return result;
};

const structureReply = runScript('read-structure.js', 'structure.json');
const realityReply = runScript('read-reality.js', 'reality.json');

// --- 4. Тот ли это файл? --------------------------------------------------
const fileKey = structureReply.fileContext?.fileKey;
if (fileKey !== project.source.fileKey) {
  die(1, `fileKey ${fileKey} ≠ ${project.source.fileKey} в project.json`);
}

// --- 5. Сводка ------------------------------------------------------------
const reality = realityReply.result;

// Файл редактируют прямо во время работы: сравниваем с прошлым снимком.
const snapshotPath = join(liveDir, 'snapshot.json');
const previous = existsSync(snapshotPath)
  ? JSON.parse(readFileSync(snapshotPath, 'utf8'))
  : null;

const drift = [];
if (previous?.byPage) {
  for (const [page, n] of Object.entries(reality.instances.byPage)) {
    const before = previous.byPage[page];
    if (before !== undefined && before !== n) drift.push(`${page}: ${before} → ${n}`);
  }
  if (previous.fileKey !== project.source.fileKey) drift.push('fileKey сменился');
}

const snapshot = {
  at: new Date().toISOString(),
  fileName: project.source.fileName,
  fileKey,
  counts: {
    pages: structureReply.result.pages.length,
    components: ds.counts.components,
    tokens: ds.counts.tokens,
    styles: ds.counts.styles,
    instances: reality.instances.total,
    scaled: reality.instances.scaledCount,
    frames1440: reality.topLevelWidths['1440'] ?? 0,
  },
  byPage: reality.instances.byPage,
};
writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');

if (!quiet) {
  const c = snapshot.counts;
  console.log(`файл:        ${snapshot.fileName}  ${fileKey}`);
  console.log(`страниц:     ${c.pages}`);
  console.log(`компонентов: ${c.components}`);
  console.log(`токенов:     ${c.tokens}`);
  console.log(`стилей:      ${c.styles}`);
  console.log(`инстансов:   ${c.instances}  отмасштабированных: ${c.scaled}`);
  console.log(`фреймов 1440: ${c.frames1440}`);
  if (c.scaled > 0) {
    console.log(`\nВНИМАНИЕ: ${c.scaled} отмасштабированных инстансов — размер из дерева не равен размеру на холсте.`);
  }
  if (drift.length) {
    console.log(`\nФАЙЛ МЕНЯЛСЯ с прошлого снимка (${previous.at}):`);
    for (const d of drift) console.log(`   ${d}`);
    console.log('   спеки и кропы, снятые раньше, могли устареть.');
  }
}
