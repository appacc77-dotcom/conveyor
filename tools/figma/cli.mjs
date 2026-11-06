/**
 * Вызов figma-agent с гарантией полного ответа.
 *
 * Почему не execFileSync: CLI пишет ответ в stdout и завершается, не дожидаясь
 * слива в pipe. На ответах больше 64 КБ (например, base64 картинки) хвост
 * теряется — JSON приходит обрезанным. Поэтому stdout направляется в файл
 * через файловый дескриптор: запись в обычный файл синхронна и ничего не теряет.
 */
import { spawnSync } from 'node:child_process';
import { openSync, closeSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export class FigmaError extends Error {
  constructor(code, message, stderr) {
    super(message);
    this.code = code;
    this.stderr = stderr;
  }
}

function parseJson(text) {
  const at = text.indexOf('{');
  if (at < 0) return null;
  return JSON.parse(text.slice(at));
}

/**
 * @param {string[]} args аргументы для figma-agent
 * @param {{timeoutMs?: number}} opts
 * @returns {object} разобранный JSON-ответ
 * @throws {FigmaError} если CLI вернул ошибку или не ответил
 */
export function runFigma(args, { timeoutMs = 120000 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'figma-cli-'));
  const outPath = join(dir, 'stdout.json');
  const errPath = join(dir, 'stderr.txt');
  const outFd = openSync(outPath, 'w');
  const errFd = openSync(errPath, 'w');

  let result;
  try {
    result = spawnSync('figma-agent', args, {
      stdio: ['ignore', outFd, errFd],
      timeout: timeoutMs,
    });
  } finally {
    closeSync(outFd);
    closeSync(errFd);
  }

  const stdout = readFileSync(outPath, 'utf8');
  const stderr = readFileSync(errPath, 'utf8');
  rmSync(dir, { recursive: true, force: true });

  if (result.error?.code === 'ETIMEDOUT') {
    throw new FigmaError('E_TIMEOUT', `figma-agent ${args[0]}: превышен таймаут ${timeoutMs} мс`, stderr);
  }

  let json = null;
  try {
    json = parseJson(stdout);
  } catch {
    json = null;
  }

  if (!json) {
    throw new FigmaError(
      'E_NO_ANSWER',
      `figma-agent ${args[0]}: не JSON (${stdout.length} байт). ${stderr.slice(0, 200)}`,
      stderr,
    );
  }

  if (json.error) {
    throw new FigmaError(json.error.code ?? 'E_UNKNOWN', json.error.message ?? String(json.error), stderr);
  }

  return json;
}
