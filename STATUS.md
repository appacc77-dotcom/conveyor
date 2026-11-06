# STATUS — Syntonia

Дата: 06.11.2026. Состояние после перезапуска.

## Что произошло

Проект сброшен к чистому листу. Готовый сайт (48 компонентов, 13 страниц,
73 MB ассетов) удалён: он был собран без ворот — приёмка показала escape rate
33% (5 дефектов из 15 карточек после «готово»), а два 🔴 в `decisions.md`
оставались открытыми, хотя P4 по процессу не может начаться при открытом G0.

Код и ассеты восстановимы из git: тег `pre-reset-2026-11-06` (коммит `65e91e2`).

## Что сохранено

| Что | Где | Зачем |
|---|---|---|
| Канвас 1:1 (27 MB) | `design/export/home/Website Syntonia.png` | вход для кропов; **не в git** |
| Эталон главной 1440 | `design/export/home/home-1440.png` | пиксельная сверка |
| Эталон «Метода» | `design/export/method/method-1440.png` | то же |
| `.fig` (106 MB) | `../syntonia-deepseek/design/figma/` | вход P0; хеш в `design/figma/source.json` |
| Процесс | `docs/system/` | P0–P7, ворота G0–G3 |
| Решения | `docs/decisions.md` | журнал, append-only |
| История | `docs/archive/` | отчёты, приёмка, старый README |

## Где мы сейчас

**Фаза P0 не начата.** Каталоги `design/figma/{canvas,extracted,spec,crops}`
заведены пустыми — под выход скриптов.

```
P0 Ingest     ← здесь            extracted/manifest.json
P1 Reality                       reports/reality.md            [G0]
P2 Resolve                       design/figma/spec/*.json
P3 Model                         crops/, tokens, inventory
P4 Components                    src/components/ds/            [G1]
P5 Pages                         src/pages/                    [G2]
P6 Adaptive                                                     [G3]
P7 Accept
```

## Чего нет (и это блокирует)

- `src/` — удалён; пустая сборка не соберётся, пока нет хотя бы одной страницы;
- скриптов пайплайна нет: `figma-extract`, `figma-reality`, `figma-resolve`,
  `figma-tokens`, `figma-crops` — P0–P3 нечем выполнить;
- ворот нет ни одних: `ds:check`, `anchors:check`, `pixel`, `audit`;
- 2 🔴 в `docs/decisions.md` (масштабы, канонические фреймы Practice/Quiz).

## Следующий шаг

P0: `figma-extract` по `Website Syntonia.fig` → `design/figma/extracted/` +
`manifest.json` с хешем `51bd7410…c9c28`. До него P1–P7 не начинаются.
