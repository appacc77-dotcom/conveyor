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
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const runsDir = join(root, 'reports/runs');

// --- Шаги ------------------------------------------------------------------
// needsDist: без собранной страницы шаг не имеет смысла.
// kind: 'gate' — влияет на вердикт; 'signal' — диагностика, вердикт не меняет.


/**
 * Отпечатки прогона: к какому коду и каким артефактам он относится.
 *
 * Зачем: `reports/runs/` не коммитится, а `gate.json` рядом со спекой
 * перезаписывается. Без этого вердикт нельзя связать с кодом — «прогон был
 * зелёным» ничего не говорит, если неизвестно, когда и на чём.
 */
function hashFiles(paths) {
  const h = createHash('sha256');
  // Путь — относительный от корня проекта: иначе один и тот же набор файлов
  // в другом каталоге даёт другой отпечаток.
  for (const path of paths.sort()) {
    h.update(relative(process.cwd(), path));
    h.update('\0');
    h.update(readFileSync(path));
    h.update('\0');
  }
  return h.digest('hex').slice(0, 16);
}

function walkFiles(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, ext, out);
    else if (!ext || full.endsWith(ext)) out.push(full);
  }
  return out;
}

function provenance() {
  let commit = null;
  let dirty = null;
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
    dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
  } catch {
    // не git-репозиторий — провенанс просто пустой, прогон от этого не падает
  }

  const pagesDir = join(process.cwd(), 'design/figma/pages');
  const specs = walkFiles(pagesDir, 'spec.json');
  const crops = walkFiles(pagesDir, 'crop.png');
  const dist = walkFiles(join(process.cwd(), 'dist'));

  return {
    commit,
    dirty,
    hashes: {
      specs: specs.length ? hashFiles(specs) : null,
      crops: crops.length ? hashFiles(crops) : null,
      dist: dist.length ? hashFiles(dist) : null,
    },
    files: { specs: specs.length, crops: crops.length, dist: dist.length },
  };
}

/** Сколько секций файла покрыто прогоном: «19 из 46». */
function coverage(units) {
  const path = join(process.cwd(), 'design/figma/structure.json');
  if (!existsSync(path)) return null;
  const total = JSON.parse(readFileSync(path, 'utf8'))?.totals?.total ?? null;
  if (!total) return null;
  return { units: units.length, total, text: `${units.length} из ${total}` };
}

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
  { id: 'motion-manifest', tool: 'check-motion-manifest', kind: 'gate', needsDist: false, about: 'движение описано в манифесте' },
  { id: 'layout', tool: 'check-layout', kind: 'gate', needsDist: true, about: 'нет прокрутки на ширине макета' },
  { id: 'images', tool: 'check-images', kind: 'gate', needsDist: true, about: 'картинки не растянуты' },
];

// Все секции, которые уже в конвейере: у них есть замер рядом со спекой.
// Так «проверить всё» не зависит от того, собрана ли страница целиком.
/**
 * Объём приёмки — то, что обещано сдать, а не то, что уже измерено.
 *
 * Раньше секция попадала в прогон по наличию `gate.json`: результат прошлого
 * замера сам решал, входит ли секция в проверку. Удали результат — секция
 * тихо выпадала из объёма. Теперь список лежит в `project.json.acceptance`.
 */
function acceptedUnits() {
  const projectPath = join(root, 'design/figma/project.json');
  const list = existsSync(projectPath)
    ? JSON.parse(readFileSync(projectPath, 'utf8')).acceptance
    : null;
  if (!Array.isArray(list)) return null;
  // Ничего не фильтруем: обещанная, но несуществующая секция обязана упасть
  // на замере, а не тихо выпасть из объёма.
  return list;
}

function builtUnits() {
  const pagesRoot = join(root, 'design/figma/pages');
  // Объём берётся из реестра; скан по gate.json остаётся запасным путём для
  // проектов, где реестра ещё нет.
  const accepted = acceptedUnits();
  if (accepted) return accepted.sort();

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

// Адрес страницы берётся из project.json: секция может жить не на «/».
const routes = JSON.parse(readFileSync(join(process.cwd(), 'design/figma/project.json'), 'utf8')).routes ?? {};
const unitUrl = (unit) => routes[unit.split('/')[0]] ?? '/';

const measureStep = (unit) => ({
  id: `measure:${unit.split('/')[1]}`,
  tool: 'measure',
  args: [`design/figma/pages/${unit}/spec.json`, '--url', unitUrl(unit)],
  kind: 'gate',
  needsDist: true,
  about: `геометрия ${unit}`,
});

const unitSteps = (unit) => [
  { id: 'measure', tool: 'measure', args: [`design/figma/pages/${unit}/spec.json`, '--url', unitUrl(unit)], kind: 'gate', needsDist: true, about: 'геометрия секции' },
  // Снимок нужен до сравнения: compare не снимает страницу сам.
  {
    id: 'shot',
    tool: 'shot',
    args: [`.${unit.split('/').pop()}`, `.screens/${unit.replace('/', '-')}.png`, '1440', '--url', unitUrl(unit)],
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

    // Зависший инструмент не должен останавливать весь прогон: у шага есть
    // предел, после которого он снимается и считается непройденным по среде.
    const limit = step.timeoutMs ?? 300000;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({
        ...step,
        status: 'ERROR',
        ms: Date.now() - started,
        note: `превышен таймаут ${Math.round(limit / 1000)} с — шаг снят`,
      });
    }, limit);

    child.on('error', (error) => {
      resolve({ ...step, status: 'ERROR', ms: Date.now() - started, note: String(error.message).slice(0, 200) });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      // 0 — выполнено и чисто; 1 — выполнено и есть дефект; 3 — выполнено
      // частично (часть источников не прочитана); 2 и прочее — не смогло.
      const status = code === 0 ? 'PASS' : code === 1 ? 'FAIL' : code === 3 ? 'INCOMPLETE' : 'ERROR';
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
  const provenanceInfo = provenance();
  const report = {
    schemaVersion: 1,
    runId: id,
    unit: all ? null : unit ?? null,
    units,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: verdict.status,
    exitCode: verdict.exitCode,
    commit: provenanceInfo.commit,
    dirty: provenanceInfo.dirty,
    hashes: provenanceInfo.hashes,
    files: provenanceInfo.files,
    coverage: coverage(units),
    // Рабочий прогон может быть зелёным, но доказательством готовности
    // коммита он не становится: правки не зафиксированы.
    releaseEligible: verdict.status === 'PASS' && provenanceInfo.dirty === false && Boolean(provenanceInfo.commit),
    steps: results.map((r) => ({ id: r.id, status: r.status, ms: r.ms, kind: r.kind })),
  };

  writeFileSync(join(dir, 'verdict.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(dir, 'events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  writeFileSync(join(runsDir, 'latest'), id + '\n');

  if (json) {
    process.stdout.write(JSON.stringify(report) + '\n');
  } else {
    const failed = results.filter((r) => r.kind === 'gate' && r.status !== 'PASS');
    if (all) {
      // Покрытие печатается явно: «19 из 46» нельзя прочитать как «весь файл».
      const cov = coverage(units);
      process.stdout.write(
        `\nсекций проверено: ${units.length}${cov ? ` из ${cov.total}` : ''}`,
      );
    }
    process.stdout.write(
      `\nвердикт: ${verdict.status}${verdict.status === 'PASS' && !report.releaseEligible ? ' (рабочий: есть незакоммиченные правки)' : ''}`,
    );
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
