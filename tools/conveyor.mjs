#!/usr/bin/env node
/**
 * Единый вход для проверок. Тонкая обёртка над существующими инструментами:
 * ни один из них не переписан, но запускаются они вместе, не срезая друг
 * друга, и оставляют след прогона.
 *
 *   node tools/conveyor.mjs check [--unit home/hero] [--json]
 *   node tools/conveyor.mjs status [--json]
 *   node tools/conveyor.mjs plan [--unit home/hero]
 *
 * Зачем:
 *   1. `npm run verify` — цепочка `&&`: первая красная проверка скрывает
 *      остальные. Здесь выполняются все, каждая пишет свой результат.
 *   2. `gate.json` лежит рядом со спекой и затирается каждым прогоном.
 *      Здесь результат прогона живёт в `reports/runs/<runId>/` и не пропадает.
 *   3. Код возврата один на всё, и он не различал «не измерено» и «плохо».
 *      Здесь четыре статуса: PASS, FAIL, INCOMPLETE, ERROR.
 *
 * Шаги — дочерние процессы: `spawn(node, [tool, ...args])`, без shell-строк.
 * Упавший шаг не останавливает остальные; решение принимает политика.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const root = process.cwd();
const runsDir = join(root, 'reports/runs');

// --- Шаги ------------------------------------------------------------------
// needsDist: без собранной страницы шаг не имеет смысла.
// kind: 'gate' — влияет на вердикт; 'signal' — диагностика, вердикт не меняет.

const GLOBAL_STEPS = [
  // Сборка — не наш скрипт, а бинарь Astro из node_modules.
  { id: 'build', bin: 'node_modules/.bin/astro', args: ['build'], kind: 'gate', needsDist: false, about: 'сборка dist/' },
  { id: 'sources', tool: 'verify-sources', kind: 'gate', needsDist: false, about: 'экспорт не устарел' },
  { id: 'assets', tool: 'check-assets', kind: 'gate', needsDist: false, about: 'ассеты на месте' },
  { id: 'tokens', tool: 'check-tokens', kind: 'gate', needsDist: false, about: 'нет var() без токена' },
  { id: 'invented', tool: 'check-invented', kind: 'gate', needsDist: false, about: 'нет вёрстки под несуществующие ширины' },
  { id: 'portability', tool: 'check-portability', kind: 'gate', needsDist: false, about: 'нет привязки к проекту' },
  { id: 'scaffold', tool: 'check-scaffold', kind: 'gate', needsDist: false, about: 'шаблон не отстал' },
  { id: 'bindings', tool: 'check-bindings', kind: 'gate', needsDist: false, about: 'цвета из переменных' },
  { id: 'states', tool: 'check-states', kind: 'gate', needsDist: true, about: 'контент всех состояний собран' },
  { id: 'interactive', tool: 'check-interactive', kind: 'gate', needsDist: true, about: 'блоки живые' },
  { id: 'motion', tool: 'check-motion', kind: 'gate', needsDist: true, about: 'есть переходы' },
  { id: 'layout', tool: 'check-layout', kind: 'gate', needsDist: true, about: 'нет прокрутки на ширине макета' },
];

// Все секции, которые уже в конвейере: у них есть замер рядом со спекой.
// Так «проверить всё» не зависит от того, собрана ли страница целиком.
function builtUnits() {
  const pagesRoot = join(root, 'design/figma/pages');
  const units = [];
  for (const page of readdirSync(pagesRoot)) {
    const pageDir = join(pagesRoot, page);
    if (!statSync(pageDir).isDirectory()) continue;
    for (const section of readdirSync(pageDir)) {
      if (existsSync(join(pageDir, section, 'gate.json'))) units.push(`${page}/${section}`);
    }
  }
  return units.sort();
}

const measureStep = (unit) => ({
  id: `measure:${unit.split('/')[1]}`,
  tool: 'measure',
  args: [`design/figma/pages/${unit}/spec.json`],
  kind: 'gate',
  needsDist: true,
  about: `геометрия ${unit}`,
});

const unitSteps = (unit) => [
  { id: 'measure', tool: 'measure', args: [`design/figma/pages/${unit}/spec.json`], kind: 'gate', needsDist: true, about: 'геометрия секции' },
  // Снимок нужен до сравнения: compare не снимает страницу сам.
  {
    id: 'shot',
    tool: 'shot',
    args: [`.${unit.split('/').pop()}`, `.screens/${unit.replace('/', '-')}.png`, '1440'],
    kind: 'signal',
    needsDist: true,
    about: 'снимок секции',
  },
  {
    id: 'visual',
    tool: 'compare',
    args: [`design/figma/pages/${unit}/crop.png`, `.screens/${unit.replace('/', '-')}.png`],
    kind: 'signal',
    needsDist: true,
    about: 'пиксель — диагностика, не приёмка',
  },
];

// --- Исполнение ------------------------------------------------------------

function runStep(step) {
  return new Promise((resolve) => {
    const started = Date.now();
    const [command, args] = step.bin
      ? [join(root, step.bin), step.args ?? []]
      : [process.execPath, [join(root, 'tools', `${step.tool}.mjs`), ...(step.args ?? [])]];

    const child = spawn(command, args, {
      cwd: root,
      shell: false,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    child.on('error', (error) => {
      resolve({ ...step, status: 'ERROR', ms: Date.now() - started, note: String(error.message).slice(0, 200) });
    });

    child.on('close', (code) => {
      // 0 — выполнено и чисто; 1 — выполнено и есть дефект; 2+ — не смогло.
      const status = code === 0 ? 'PASS' : code === 1 ? 'FAIL' : 'ERROR';
      const note = (stderr || stdout).trim().split('\n').slice(-1)[0] ?? '';
      resolve({ ...step, status, exitCode: code, ms: Date.now() - started, note: note.slice(0, 200) });
    });
  });
}

/**
 * Политика: что считается итогом.
 *
 * Порядок важен и не симметричен:
 *   ERROR      — инструмент не смог выполниться, мы не знаем ничего;
 *   FAIL       — проверка выполнена и нашла дефект. Это определённость,
 *                поэтому она сильнее INCOMPLETE: сломанная сборка — не
 *                «неизвестно», а точно плохо;
 *   INCOMPLETE — ничего не сломалось, но часть не измерена (нет спеки,
 *                пропущено из-за упавшей сборки);
 *   PASS       — всё измерено и чисто.
 *
 * Сигналы (пиксель) в вердикт не входят: это диагностика, а не приёмка.
 */
function evaluate(results) {
  const gates = results.filter((r) => r.kind === 'gate');
  if (gates.some((r) => r.status === 'ERROR')) return { status: 'ERROR', exitCode: 2 };
  if (gates.some((r) => r.status === 'FAIL')) return { status: 'FAIL', exitCode: 1 };
  if (gates.some((r) => r.status === 'INCOMPLETE')) return { status: 'INCOMPLETE', exitCode: 2 };
  return { status: 'PASS', exitCode: 0 };
}

function runId() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  return `${stamp}-${process.pid}`;
}

async function commandCheck(unit, json, all) {
  const units = all ? builtUnits() : unit ? [unit] : [];
  const steps = [
    ...GLOBAL_STEPS,
    ...units.flatMap((item) => (all ? [measureStep(item)] : unitSteps(item))),
  ];
  const id = runId();
  const dir = join(runsDir, id);
  mkdirSync(join(dir, 'results'), { recursive: true });

  const events = [];
  const results = [];
  const startedAt = new Date().toISOString();

  for (const step of steps) {
    // Сборка не прошла — остальным нечего смотреть, но и молча пропускать
    // нельзя: это INCOMPLETE, а не успех. Учитываем любой не-PASS: Astro при
    // ошибке выходит с кодом 1, а не 2.
    const build = results.find((r) => r.id === 'build');
    const buildBroken = build && build.status !== 'PASS';
    if (buildBroken && step.needsDist) {
      results.push({ ...step, status: 'INCOMPLETE', ms: 0, note: 'сборка не прошла' });
      events.push({ at: new Date().toISOString(), step: step.id, status: 'INCOMPLETE' });
      continue;
    }

    if (!json) process.stdout.write(`  ${step.id.padEnd(12)} `);
    const result = await runStep(step);
    results.push(result);
    events.push({ at: new Date().toISOString(), step: step.id, status: result.status, ms: result.ms });
    if (!json) {
      const mark = result.status === 'PASS' ? 'ок' : result.status === 'FAIL' ? 'КРАСНЫЙ' : result.status;
      process.stdout.write(`${mark}  ${String(result.ms).padStart(6)} мс  ${result.about}\n`);
    }
    writeFileSync(join(dir, 'results', `${step.id}.json`), JSON.stringify(result, null, 2) + '\n');
  }

  const verdict = evaluate(results);
  const report = {
    schemaVersion: 1,
    runId: id,
    unit: all ? null : unit ?? null,
    units,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: verdict.status,
    exitCode: verdict.exitCode,
    steps: results.map((r) => ({ id: r.id, status: r.status, ms: r.ms, kind: r.kind })),
  };

  writeFileSync(join(dir, 'verdict.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(dir, 'events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  writeFileSync(join(runsDir, 'latest'), id + '\n');

  if (json) {
    process.stdout.write(JSON.stringify(report) + '\n');
  } else {
    const failed = results.filter((r) => r.kind === 'gate' && r.status !== 'PASS');
    if (all) process.stdout.write(`\nсекций проверено: ${units.length}`);
    process.stdout.write(`\nвердикт: ${verdict.status}`);
    if (failed.length) process.stdout.write(` · красных ${failed.length}: ${failed.map((r) => r.id).join(', ')}`);
    process.stdout.write(`\nпрогон: reports/runs/${id}/\n`);
  }

  return verdict.exitCode;
}

function latestRun() {
  const marker = join(runsDir, 'latest');
  if (!existsSync(marker)) return null;
  const id = readFileSync(marker, 'utf8').trim();
  const file = join(runsDir, id, 'verdict.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

function commandStatus(json) {
  const report = latestRun();
  if (!report) {
    process.stderr.write('прогонов не было: node tools/conveyor.mjs check\n');
    return 2;
  }
  if (json) {
    process.stdout.write(JSON.stringify(report) + '\n');
  } else {
    process.stdout.write(`прогон ${report.runId} · ${report.status}${report.unit ? ` · ${report.unit}` : ''}\n`);
    for (const step of report.steps) process.stdout.write(`  ${step.id.padEnd(12)} ${step.status}\n`);
  }
  return 0;
}

function commandPlan(unit, all) {
  const units = all ? builtUnits() : unit ? [unit] : [];
  const steps = [...GLOBAL_STEPS, ...units.flatMap((item) => (all ? [measureStep(item)] : unitSteps(item)))];
  process.stdout.write(`план${unit ? ` для ${unit}` : all ? ` для ${units.length} секций` : ''} — ${steps.length} шагов, последовательно:\n`);
  for (const step of steps) {
    process.stdout.write(`  ${step.id.padEnd(12)} ${step.kind.padEnd(6)} ${step.about}\n`);
  }
  process.stdout.write('\nничего не выполнено: это план\n');
  return 0;
}

// --- Вход ------------------------------------------------------------------

const [command, ...rest] = process.argv.slice(2);
const { values, positionals } = parseArgs({
  args: rest,
  allowPositionals: true,
  strict: true,
  options: {
    unit: { type: 'string' },
    all: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
  },
});

const unit = values.unit ?? positionals[0] ?? null;

try {
  let code;
  if (command === 'check') code = await commandCheck(unit, values.json, values.all);
  else if (command === 'status') code = commandStatus(values.json);
  else if (command === 'plan') code = commandPlan(unit, values.all);
  else {
    process.stderr.write('команды: check [--unit home/hero | --all] | status | plan\n');
    code = 2;
  }
  process.exitCode = code;
} catch (error) {
  process.stderr.write(`${String(error.message).slice(0, 300)}\n`);
  process.exitCode = 2;
}
