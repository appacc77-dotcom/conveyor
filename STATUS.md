# STATUS — Syntonia

Работаем **только через живой мост** `figma-agent`: файл «Website Syntonia2»,
`fileKey NInjODHyOOjIitF3lq4Vpe`, открытый в Figma desktop.

## Объём

Объём выводится из экспорта (`design/figma/pages/**`, решение 353): все семь
страниц файла — home, practice, library, masters, method, booking, quiz.
Адрес каждой страницы — `design/figma/project.json` → `routes`.
Мобильных макетов нет: только 1440 (решения 2, 186; долг D-2).

## Секции

Блок ниже собирается из артефактов: `node tools/status.mjs --write`.
Числа — из `gate.json` и `pixel.json` рядом с секцией, последнего прогона
`reports/runs/latest` и реестров. Руками не правится.

<!-- status:start -->
секций собрано: **48** из 48

| секция | геометрия | узлов | пиксель | > 16 | > 48 |
|---|---:|---:|---:|---:|---:|
| booking/header | зелёная | 14 | 4.08 | 5.77 % | 1.93 % |
| booking/booking-hero | зелёная | 5 | 3.87 | 4.08 % | 0.34 % |
| booking/booking-formats | зелёная | 21 | 2.50 | 3.74 % | 1.86 % |
| booking/footer | зелёная | 31 | 1.04 | 1.22 % | 0.44 % |
| design-system/logo-gold | зелёная | 2 | 229.66 | 100.00 % | 100.00 % |
| home/air-photo | зелёная | 1 | 5.91 | 0.38 % | 0.00 % |
| home/entry | зелёная | 17 | 5.10 | 11.24 % | 1.15 % |
| home/faq | зелёная | 32 | 4.14 | 1.69 % | 0.89 % |
| home/pain | зелёная | 29 | 4.14 | 3.43 % | 1.91 % |
| home/header | зелёная | 14 | 3.83 | 5.94 % | 1.97 % |
| home/banner-founder | зелёная | 5 | 3.06 | 2.02 % | 0.66 % |
| home/quiz | зелёная | 12 | 2.20 | 2.53 % | 1.75 % |
| home/formats | зелёная | 24 | 2.13 | 2.10 % | 1.37 % |
| home/process | зелёная | 25 | 2.13 | 4.23 % | 1.31 % |
| home/method | зелёная | 11 | 1.86 | 1.53 % | 0.97 % |
| home/hero | зелёная | 8 | 1.76 | 0.99 % | 0.56 % |
| home/library | зелёная | 15 | 1.48 | 1.04 % | 0.50 % |
| home/about-founder | зелёная | 16 | 1.24 | 1.52 % | 0.45 % |
| home/footer | зелёная | 31 | 1.04 | 1.22 % | 0.44 % |
| home/voices | зелёная | 35 | 0.95 | 1.37 % | 0.15 % |
| library/library-journal | зелёная | 14 | 11.17 | 19.36 % | 8.91 % |
| library/library-issues | зелёная | 11 | 6.76 | 15.68 % | 3.49 % |
| library/header | зелёная | 14 | 4.47 | 5.80 % | 1.93 % |
| library/footer | зелёная | 31 | 3.16 | 1.26 % | 0.44 % |
| library/library-book | зелёная | 11 | 2.90 | 3.00 % | 1.20 % |
| library/library-hero | зелёная | 6 | 2.17 | 2.70 % | 0.40 % |
| masters/founder-hero | зелёная | 15 | 5.25 | 4.56 % | 2.86 % |
| masters/masters-more | зелёная | 8 | 4.18 | 2.88 % | 1.13 % |
| masters/header | зелёная | 14 | 3.82 | 5.99 % | 1.90 % |
| masters/masters-team | зелёная | 12 | 1.82 | 2.18 % | 0.65 % |
| masters/footer | зелёная | 31 | 1.04 | 1.22 % | 0.44 % |
| method/header | зелёная | 14 | 3.75 | 5.84 % | 1.93 % |
| method/method-about | зелёная | 18 | 2.67 | 3.55 % | 2.13 % |
| method/method-cta | зелёная | 8 | 1.75 | 1.75 % | 0.70 % |
| method/method-hero | зелёная | 4 | 1.11 | 0.70 % | 0.22 % |
| method/footer | зелёная | 31 | 1.04 | 1.22 % | 0.44 % |
| practice/practice-pay | зелёная | 16 | 12.36 | 32.80 % | 3.64 % |
| practice/kody-practice-pay | зелёная | 16 | 11.85 | 31.43 % | 3.21 % |
| practice/practice-package | зелёная | 9 | 10.91 | 23.96 % | 6.27 % |
| practice/info-section | зелёная | 16 | 9.81 | 11.06 % | 3.82 % |
| practice/practice-free | зелёная | 16 | 9.13 | 10.42 % | 6.86 % |
| practice/hero | зелёная | 18 | 5.46 | 3.07 % | 2.36 % |
| practice/quiz | зелёная | 15 | 2.41 | 1.97 % | 1.39 % |
| practice/footer | зелёная | 31 | 1.04 | 1.22 % | 0.44 % |
| quiz/header | зелёная | 14 | 3.77 | 5.64 % | 1.86 % |
| quiz/quiz-section | зелёная | 16 | 3.22 | 3.27 % | 1.77 % |
| quiz/quiz-result | зелёная | 32 | 2.34 | 2.75 % | 1.53 % |
| quiz/footer | зелёная | 31 | 1.04 | 1.22 % | 0.44 % |

средний пиксель по собранным: **8.59**

последний прогон: `20261109-203311-18569` · **PASS** · full · к выпуску не пригоден

изобретённое (`design/figma/invented.json`): **6** записей
долги этапа 1 (`docs/debts.json`): открыто **31** из 36 · designer 28, studio 1, owner 2

### Закрытие этапа 1

готово: блокирующих долгов нет

закрыто 5 из 36 · открыто 31
по типу: figma 26, scope 3, tool 1, site 1
<!-- status:end -->

## Где смотреть остальное

- изобретённое (нет в макете) — `design/figma/invented.json`, анимации — `design/motion/motion.json`;
- долги этапа 1 (вопросы дизайнеру, заказчику, владельцу) — `docs/debts.json`;
- вопросы к файлу Figma — `docs/FIGMA-ISSUES.md`;
- доработки конвейера — `docs/BACKLOG.md` и `docs/AGENT-REFACTOR-TASKS.md`;
- решения — `docs/decisions.md`.
