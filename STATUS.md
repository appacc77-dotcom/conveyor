# STATUS — Syntonia

Дата: 06.11.2026, вечер. Работаем **только через живой мост** `figma-agent`.

## Режим

Ни `.fig`, ни заранее выгруженных PNG. Всё читается с файла, открытого в Figma
desktop: **«Website Syntonia2»**, `fileKey NInjODHyOOjIitF3lq4Vpe`.

Старые эталоны удалены: они были выгружены из другого файла
(`wbtBZLldiNMyOD4vX8ukKz`), поэтому любое сравнение с ними давало ложные числа.
Код удалённого сайта восстановим из тега `pre-reset-2026-11-06`.

## Фазы

| Фаза | Состояние | Чем закрыта |
|---|---|---|
| P0 Ingest | **готово** | `design/figma/live/{structure,ds,reality}.json` + `project.json` с fileKey |
| P1 Reality | **готово** | 0 отмасштабированных из 1145; 48 фреймов шириной 1440 |
| G0 | **закрыт** | см. «Ревизия 06.11.2026» в `docs/decisions.md` |
| P2 Resolve | **готово для hero** | `design/figma/pages/home/hero/spec.json` |
| P3 Model | **готово для первого шага** | `npm run ds:tokens` → 41 переменная, 34 стиля |
| P4 Components | начато | `ds/btn-primary`, `ds/arrow-quiet`, `ds/play` |
| P5 Pages | идёт | `index.astro` — hero + pain, 1487 px |

## Первый блок — hero

Собран из живого файла: фото фона забрано по `imageHash`, иконки — вектором с
узлов, цвета и типографика — из сгенерированных токенов.

| Проверка | Число |
|---|---|
| геометрия против Figma | **0 нарушений**, максимум Δ **0,11 px** (допуск 1) |
| пиксельная сверка | средняя **1,82**, пикселей > 16 — **1,05 %** |
| сборка | 1 страница, exit 0 |

Для сравнения, прежний прогон давал по hero среднюю 3,52 и 2,25 %.

## Команды

```bash
npm run ds:tokens                                  # токены и типографика из живого файла
npm run build
npm run shot -- .hero .screens/hero.png 1440       # снимок элемента
npm run measure -- design/figma/pages/home/hero/spec.json        # геометрия по data-figma-node
npm run compare -- design/figma/pages/home/hero/crop.png .screens/hero.png
```


## Что дальше

1. Остальные 13 секций главной — по одной, каждая: узел → спека → компонент →
   замер → кроп → сверка.
2. `spec/home.json` собирать не руками, а скриптом из `live/`.
3. Ворота G1: `measure` + `compare` по каждому компоненту из
   `scan-design-system` — пока проверены только hero и три ds-компонента.
4. Доска: 28 старых карточек ссылаются на удалённые файлы — в архив.
