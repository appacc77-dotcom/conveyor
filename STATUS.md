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
секций собрано: **47** из 47

| секция | геометрия | узлов | пиксель | > 16 | > 48 |
|---|---:|---:|---:|---:|---:|
| booking/booking-formats | зелёная | 21 | 6.21 | 5.97 % | 4.12 % |
| booking/header | зелёная | 14 | 4.08 | 5.77 % | 1.93 % |
| booking/booking-hero | зелёная | 5 | 3.87 | 4.08 % | 0.34 % |
| booking/footer | зелёная | 31 | 1.04 | 1.22 % | 0.44 % |
| home/air-photo | зелёная | 1 | 5.91 | 0.19 % | 0.00 % |
| home/entry | зелёная | 17 | 5.10 | 11.24 % | 1.15 % |
| home/faq | зелёная | 32 | 4.31 | 1.89 % | 0.90 % |
| home/pain | зелёная | 29 | 4.14 | 3.43 % | 1.91 % |
| home/header | зелёная | 14 | 3.83 | 5.94 % | 1.97 % |
| home/banner-founder | зелёная | 5 | 3.06 | 2.02 % | 0.66 % |
| home/formats | зелёная | 24 | 2.21 | 2.20 % | 1.46 % |
| home/quiz | зелёная | 12 | 2.20 | 2.53 % | 1.75 % |
| home/process | зелёная | 25 | 2.13 | 4.23 % | 1.31 % |
| home/method | зелёная | 11 | 1.87 | 1.55 % | 0.98 % |
| home/hero | зелёная | 8 | 1.76 | 0.99 % | 0.56 % |
| home/library | зелёная | 15 | 1.49 | 1.08 % | 0.51 % |
| home/about-founder | зелёная | 16 | 1.24 | 1.52 % | 0.45 % |
| home/footer | зелёная | 31 | 1.04 | 1.22 % | 0.44 % |
| home/voices | зелёная | 35 | 1.00 | 1.46 % | 0.20 % |
| library/library-journal | зелёная | 14 | 11.17 | 19.36 % | 8.91 % |
| library/library-issues | зелёная | 11 | 6.76 | 15.68 % | 3.49 % |
| library/header | зелёная | 14 | 4.47 | 5.80 % | 1.93 % |
| library/footer | зелёная | 31 | 3.16 | 1.26 % | 0.44 % |
| library/library-book | зелёная | 11 | 2.90 | 3.00 % | 1.20 % |
| library/library-hero | зелёная | 6 | 2.17 | 2.70 % | 0.40 % |
| masters/founder-hero | зелёная | 15 | 5.53 | 4.54 % | 2.86 % |
| masters/masters-more | зелёная | 8 | 4.18 | 2.88 % | 1.13 % |
| masters/header | зелёная | 14 | 3.84 | 5.99 % | 1.90 % |
| masters/masters-team | зелёная | 12 | 1.83 | 2.18 % | 0.65 % |
| masters/footer | зелёная | 31 | 1.04 | 1.22 % | 0.44 % |
| method/header | зелёная | 14 | 3.75 | 5.84 % | 1.93 % |
| method/method-cta | зелёная | 10 | 1.73 | 1.46 % | 0.71 % |
| method/method-about | зелёная | 18 | 1.47 | 1.88 % | 0.62 % |
| method/method-hero | зелёная | 4 | 1.11 | 0.70 % | 0.22 % |
| method/footer | зелёная | 31 | 1.04 | 1.22 % | 0.44 % |
| practice/practice-pay | зелёная | 16 | 12.36 | 32.80 % | 3.64 % |
| practice/kody-practice-pay | зелёная | 16 | 11.85 | 31.43 % | 3.21 % |
| practice/practice-package | зелёная | 9 | 10.66 | 23.61 % | 6.27 % |
| practice/info-section | зелёная | 16 | 9.81 | 11.06 % | 3.82 % |
| practice/practice-free | зелёная | 16 | 9.13 | 10.42 % | 6.86 % |
| practice/quiz | зелёная | 15 | 2.41 | 1.97 % | 1.39 % |
| practice/hero | зелёная | 18 | 1.25 | 1.02 % | 0.23 % |
| practice/footer | зелёная | 31 | 1.04 | 1.22 % | 0.44 % |
| quiz/header | зелёная | 14 | 3.77 | 5.64 % | 1.86 % |
| quiz/quiz-section | зелёная | 16 | 3.15 | 3.23 % | 1.75 % |
| quiz/quiz-result | зелёная | 32 | 2.64 | 2.90 % | 1.71 % |
| quiz/footer | зелёная | 31 | 1.04 | 1.22 % | 0.44 % |

средний пиксель по собранным: **3.87**

изобретённое (`design/figma/invented.json`): **6** записей
долги этапа 1 (`docs/debts.json`): открыто **35** из 35 · designer 30, client 2, studio 2, owner 1 · блокируют сдачу: D-1, D-3
<!-- status:end -->

## Где смотреть остальное

- изобретённое (нет в макете) — `design/figma/invented.json`, анимации — `design/motion/motion.json`;
- долги этапа 1 (вопросы дизайнеру, заказчику, владельцу) — `docs/debts.json`;
- вопросы к файлу Figma — `docs/FIGMA-ISSUES.md`;
- доработки конвейера — `docs/BACKLOG.md` и `docs/AGENT-REFACTOR-TASKS.md`;
- решения — `docs/decisions.md`.
