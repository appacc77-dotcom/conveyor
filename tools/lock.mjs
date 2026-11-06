#!/usr/bin/env node
/**
 * Замок для шагов, которые трогают общий dist/ и общий сервер сборки.
 *
 *   node tools/lock.mjs "npm run build && node tools/measure.mjs <spec> --url /<page>"
 *
 * Зачем: `astro build` пишет в dist/, а measure отдаёт этот же dist по HTTP.
 * Два агента, собирающих одновременно, портят друг другу и сборку, и замер.
 * Замок сериализует связку «собрать → замерить», оставляя остальную работу
 * параллельной.
 *
 * Устаревший замок (старше пяти минут) снимается: агент мог упасть.
 */
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const LOCK = '.build.lock';
const STALE_MS = 5 * 60 * 1000;
const WAIT_MS = 200;
const DEADLINE_MS = 10 * 60 * 1000;

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const command = process.argv.slice(2).join(' ').replace(/^--\s*/, '');
if (!command) {
  console.error('использование: node tools/lock.mjs "<команда>"');
  process.exit(2);
}

const started = Date.now();
let taken = false;

while (!taken) {
  try {
    mkdirSync(LOCK);
    taken = true;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;

    // Замок от упавшего агента не должен блокировать навсегда.
    try {
      if (Date.now() - statSync(LOCK).mtimeMs > STALE_MS) {
        rmSync(LOCK, { recursive: true, force: true });
        continue;
      }
    } catch {
      // замок исчез между попытками — просто пробуем снова
    }

    if (Date.now() - started > DEADLINE_MS) {
      console.error('замок занят больше 10 минут — сдаюсь');
      process.exit(3);
    }
    sleep(WAIT_MS);
  }
}

let status = 1;
try {
  const result = spawnSync('sh', ['-c', command], { stdio: 'inherit' });
  status = result.status ?? 1;
} finally {
  try {
    rmSync(LOCK, { recursive: true, force: true });
  } catch {
    // уже снят
  }
}

process.exit(status);
