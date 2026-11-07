#!/usr/bin/env node
/**
 * Модуль 2 — экспорт секции из живого файла Figma.
 *
 *   node tools/export-section.mjs 79:105 --name hero
 *
 * Выход: design/figma/pages/<page>/<section>/
 *   spec.json  — факты: геометрия, текст, заливки, авто-раскладка, ссылки на ассеты
 *   crop.png   — эталон, снятый с самого узла
 *   assets/    — img/<hash>.<ext> (фото), svg/<component>.svg (иконки-инстансы)
 *
 * Коды возврата: 0 — ок, 1 — чужой файл, 2 — мост недоступен, 3 — ошибка Figma.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runFigma, FigmaError } from './figma/cli.mjs';

const root = process.cwd();
const argv = process.argv.slice(2);
const nodeId = argv.find((a) => /^\d+:\d+$/.test(a));
const nameArg = argv.includes('--name') ? argv[argv.indexOf('--name') + 1] : null;

const die = (code, message) => {
  console.error(`export: ${message}`);
  process.exit(code);
};

if (!nodeId) die(3, 'укажи узел: node tools/export-section.mjs 79:105 --name hero');

const projectPath = join(root, 'design/figma/project.json');
if (!existsSync(projectPath)) die(3, 'нет design/figma/project.json');
const project = JSON.parse(readFileSync(projectPath, 'utf8'));

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-|-$/g, '');

/** Ошибки моста — код 2, ошибки скрипта Figma — код 3. */
function figma(args, timeoutMs) {
  try {
    return runFigma(args, { timeoutMs });
  } catch (error) {
    if (error instanceof FigmaError) {
      const transport = ['E_NO_PLUGIN', 'E_NO_BROKER', 'E_TIMEOUT', 'E_NO_ANSWER', 'E_VERSION_MISMATCH'];
      die(transport.includes(error.code) ? 2 : 3, `${error.code}: ${error.message}`);
    }
    die(3, String(error.message ?? error));
  }
}

/** Подставляет параметры в шаблон exec-js и исполняет его. */
function runTemplate(templateName, replacements, timeoutMs = 90000) {
  let source = readFileSync(join(root, 'tools/figma', templateName), 'utf8');
  for (const [key, value] of Object.entries(replacements)) {
    source = source.split(key).join(value);
  }
  const tmp = join(tmpdir(), `figma-${templateName.replace('.js', '')}-${process.pid}.js`);
  writeFileSync(tmp, source);
  const reply = figma(['exec-js', tmp, '--timeout', String(timeoutMs)]);
  if (reply.error) die(3, `${reply.error.code}: ${reply.error.message}`);
  return reply;
}

/** Как runTemplate, но не убивает процесс: сбой возвращает null. */
function runTemplateSafe(templateName, replacements, timeoutMs) {
  let source = readFileSync(join(root, 'tools/figma', templateName), 'utf8');
  for (const [key, value] of Object.entries(replacements)) {
    source = source.split(key).join(value);
  }
  const tmp = join(tmpdir(), `figma-${templateName.replace('.js', '')}-${process.pid}.js`);
  writeFileSync(tmp, source);
  try {
    const reply = runFigma(['exec-js', tmp, '--timeout', String(timeoutMs)], { timeoutMs: timeoutMs + 10000 });
    return reply.error ? null : reply;
  } catch {
    return null;
  }
}

// --- 1. Прочитать секцию ---------------------------------------------------
const read = runTemplate('read-section.template.js', { __NODE_ID__: nodeId });
const section = read.result;
if (!section || section.error) die(3, `узел ${nodeId} не найден`);

const fileKey = read.fileContext?.fileKey;
if (fileKey !== project.source.fileKey) {
  die(1, `fileKey ${fileKey} ≠ ${project.source.fileKey} — открыт другой файл`);
}

// --- 2. Каталог секции -----------------------------------------------------
const slug = slugify(nameArg ?? section.root.name);
const sectionsRoot = join(root, project.paths.sections ?? 'design/figma/pages');
// Секции лежат по страницам, как в Figma: pages/<страница>/<секция>/.
const pageSlug = slugify(section.page?.name ?? 'page');
const dir = join(sectionsRoot, pageSlug, slug);
mkdirSync(dir, { recursive: true });

// Ассеты живут в общем складе по хешу: одно фото и одна иконка на весь проект.
// Иначе одна и та же текстура кнопки лежит в двадцати папках секций.
const assetsRoot = join(root, project.paths.assets ?? 'design/figma/assets');
mkdirSync(join(assetsRoot, 'img'), { recursive: true });
mkdirSync(join(assetsRoot, 'svg'), { recursive: true });

const rel = (abs) => abs.slice(root.length + 1);

// --- 3. Кроп ---------------------------------------------------------------
const cropPath = join(dir, 'crop.png');
const cropReply = figma([
  'export-png', '--node', nodeId, '--out', cropPath, '--scale', '1', '--timeout', '120000',
]);
if (!existsSync(cropPath)) die(3, 'кроп не записался');

// --- 4. Фото по imageHash --------------------------------------------------
const images = [];
for (const img of section.images) {
  const fetched = runTemplate('fetch-image.template.js', { __HASH__: img.hash });
  const bytes = Buffer.from(fetched.result.b64, 'base64');
  const ext =
    bytes[0] === 0xff && bytes[1] === 0xd8 ? 'jpg'
    : bytes[0] === 0x89 && bytes[1] === 0x50 ? 'png'
    : 'bin';
  const abs = join(assetsRoot, 'img', `${img.hash.slice(0, 12)}.${ext}`);
  if (!existsSync(abs)) writeFileSync(abs, bytes);
  images.push({ hash: img.hash, file: rel(abs), bytes: bytes.length, usedBy: img.nodeName });
}

// --- 5. Иконки вектором ----------------------------------------------------
// Отпечаток содержимого: считается ровно как в tools/figma/fingerprint.js.
// По нему видно, изменилась ли секция после выгрузки.
function fingerprintOf(nodes) {
  let h = 0x811c9dc5;
  for (const n of nodes) {
    const line = [n.id, n.x, n.y, n.w, n.h, n.type === 'TEXT' ? n.text ?? '' : ''].join('|');
    for (let i = 0; i < line.length; i++) {
      h ^= line.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= 10;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Версия облака на момент выгрузки: из аргумента или из live/api.json. */
function cloudVersion() {
  const i = process.argv.indexOf('--cloud-version');
  if (i > 0) return process.argv[i + 1];
  const p = join(root, 'design/figma/live/api.json');
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, 'utf8')).version ?? null;
    } catch {}
  }
  return null;
}

const icons = [];
const iconErrors = [];
const usedNames = new Set();
for (const icon of section.icons) {
  // Сбой одной иконки не должен убивать секцию: спека и кроп нужны всё равно.
  // Бывает, что Figma не может отрендерить инстанс («Unable to establish
  // connection to Figma») — тогда иконка берётся из готовых или рисуется заново.
  // Короткий таймаут и безопасная выгрузка: нерендерящаяся иконка не должна
  // ни держать выгрузку две минуты, ни убивать процесс.
  const fetched = runTemplateSafe('fetch-svg.template.js', { __NODE_ID__: icon.id }, 20000);
  if (!fetched) {
    iconErrors.push({ id: icon.id, name: icon.name, reason: 'svg не выгрузился' });
    continue;
  }
  const svg = fetched.result?.svg;
  if (!svg) {
    iconErrors.push({ id: icon.id, name: icon.name, reason: 'svg пустой' });
    continue;
  }
  // Вариант в имени: arrow-quiet + {color: white, direction: right} →
  // arrow-quiet-white-right.svg. Иначе разные стрелки перезапишут друг друга.
  const variant = icon.props
    ? Object.values(icon.props)
        .filter((v) => typeof v === 'string' && v.length < 20)
        .map((v) => slugify(v))
        .filter(Boolean)
        .join('-')
    : '';
  let base = slugify(icon.componentName || icon.name) || icon.id.replace(':', '-');
  if (variant) base = `${base}-${variant}`;
  let name = `${base}.svg`;
  let n = 2;
  while (usedNames.has(name)) name = `${base}-${n++}.svg`;
  usedNames.add(name);
  const abs = join(assetsRoot, 'svg', name);
  if (!existsSync(abs)) writeFileSync(abs, svg.trim() + '\n');
  icons.push({
    node: icon.id,
    component: icon.componentName,
    variant: icon.props ?? null,
    file: rel(abs),
    bytes: svg.length,
  });
}

// --- 6. Спека --------------------------------------------------------------
const spec = {
  file: { name: project.source.fileName, key: fileKey, at: new Date().toISOString() },
  section: section.root,
  fingerprint: fingerprintOf(section.nodes),
  cloudVersion: cloudVersion(),
  counts: { nodes: section.count, images: images.length, icons: icons.length, iconInstances: section.iconInstances },
  assets: { crop: 'crop.png', images, icons },
  nodes: section.nodes,
};
writeFileSync(join(dir, 'spec.json'), JSON.stringify(spec, null, 2) + '\n');

// --- 6.1 Состояния секции --------------------------------------------------
// Секция живёт в файле не в одном виде: у `formats` пять инстансов, по одному
// на активный формат, и у каждого своя картинка слайдера и свои описания.
// Один выгруженный инстанс — одно состояние; остальные теряются молча.
try {
  const variantsTemplate = readFileSync(join(root, 'tools/figma/variants.template.js'), 'utf8');
  const variantsTmp = join(tmpdir(), `figma-variants-${process.pid}.js`);
  writeFileSync(variantsTmp, variantsTemplate.split('__ID__').join(nodeId));
  // runFigma напрямую: обёртка figma() при ошибке завершает процесс, и
  // отсутствие состояний валило бы всю выгрузку.
  const variantsReply = runFigma(['exec-js', variantsTmp, '--timeout', '120000']);
  if (variantsReply.result && !variantsReply.result.error) {
    writeFileSync(
      join(dir, 'states.json'),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          section: variantsReply.result.name,
          nodeId,
          total: variantsReply.result.total,
          states: variantsReply.result.states,
        },
        null,
        2,
      ) + '\n',
    );
    spec.counts.states = variantsReply.result.total;
    writeFileSync(join(dir, 'spec.json'), JSON.stringify(spec, null, 2) + '\n');
  }
} catch (error) {
  console.warn(`состояния не сняты: ${String(error.message).slice(0, 120)}`);
}

// --- 7. Сводка -------------------------------------------------------------
console.log(`секция:  ${section.root.name}  ${section.root.w}×${section.root.h}  (${nodeId})`);
console.log(`узлов:   ${section.count}`);
console.log(`фото:    ${images.length}${images.length ? ' — ' + images.map((i) => i.file.split('/').pop()).join(', ') : ''}`);
console.log(`иконок:  ${icons.length}${icons.length ? ' — ' + icons.map((i) => i.component ?? i.node).join(', ') : ''}`);
console.log(`каталог: ${dir.replace(root + '/', '')}`);
