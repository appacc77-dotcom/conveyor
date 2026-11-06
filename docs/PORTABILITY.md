# Переносимость

Проект должен запускаться из любой папки на любой машине с Node.js;
никаких `../syntonia-deepseek`, `../agent-system` или абсолютных `/Users/...`
в коде и скриптах.

## Требования

- Node.js ≥ 20 (рекомендуется 22 LTS, см. `.nvmrc`);
- npm;
- Chromium для Playwright:
  `npx playwright install chromium`.

## Установка

```bash
npm ci
npx playwright install chromium
npm run build
npm run smoke
npm run dev
```

`npm run smoke` сам поднимает `dist/` на `127.0.0.1:4325` и не требует
DSH. Порт меняется через `SMOKE_PORT`.

## Что опционально

- **DSH Kanban** — только для живых статусов и watcher. Без него сайт,
  сборка и smoke работают; `/progress.html` и `/structure.html` покажут
  состояние «нет соединения».
- **Figma desktop + Bridge** — только для повторного экспорта эталонов.
  Для сборки и сравнений уже выгруженные файлы лежат в `public/structure/`.
- **Старый сервер** — не нужен. «До» в структуре — статические Figma-секции,
  «после» снимает локальный Playwright.

## Адреса

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `SYNTONIA_URL` | `http://127.0.0.1:4321` | сайт для снимков |
| `DSH_URL` | `http://127.0.0.1:57686` | прокси `/kanban` |
| `DSH_BOARD_URL` | `http://127.0.0.1:57686/kanban/api/board` | watcher |
| `SMOKE_PORT` | `4325` | статический smoke-сервер |
| `PREVIEWS_INTERVAL_MS` | `3000` | период watcher |

## Правила

1. В `src/`, `scripts/`, конфигах и `package.json` — только относительные
   пути проекта и локальные зависимости.
2. Не добавлять `PLAYWRIGHT_PATH` и импорты из соседних репозиториев.
3. Тяжёлые исходники Figma (канвас, PDF) не коммитятся; канонические
   кропы и секции — коммитятся.
4. Исторические отчёты могут ссылаться на старые проекты как на источник;
   это не runtime-зависимость.
5. `npm run audit:paths` проверяет код и конфиги на абсолютные и соседние
   пути.

## Проверка переноса

```bash
npm ci
npx playwright install chromium
npm run build
npm run smoke
npm run previews:once   # при запущенном npm run dev
npm run audit:paths
```

Если все команды проходят, папку можно копировать/архивировать и
разворачивать на другой машине.
