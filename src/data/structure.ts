export type Status = 'done' | 'review' | 'progress' | 'todo';

export interface Shots {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  warning?: string;
}

export interface Block {
  id: string;
  title: string;
  does: string;
  task: string;
  status: Status;
  note?: string;
  images?: Shots;
}

export interface SitePage {
  id: string;
  number: string;
  title: string;
  route: string;
  status: Status;
  note: string;
  height: string;
  preview?: string;
  blocks: Block[];
}

const homeShot = (id: string): Shots => ({
  before: `/structure/home-${id}-figma.jpg`,
  after: `/structure/home-${id}-site.jpg`,
  beforeLabel: 'Figma',
  afterLabel: 'Сделано',
});

const methodShot = (id: string): Shots => ({
  before: `/structure/figma/method-${id}.png`,
  after: `/structure/method-${id}-site.jpg`,
  beforeLabel: 'Figma',
  afterLabel: 'Сделано',
});


const oldShot = (
  page: string,
  block: string,
  warning = 'Figma-рендера этой страницы нет: слева — старая сборка, справа — текущая.',
): Shots => ({
  before: `/structure/blocks/${page}-${block}-before.jpg`,
  after: `/structure/blocks/${page}-${block}-after.jpg`,
  beforeLabel: 'Старая сборка',
  afterLabel: 'Сделано',
  warning,
});

const figmaShot = (
  page: string,
  block: string,
  warning = 'Сравнение с Figma-секцией; справа — текущая сборка.',
): Shots => ({
  before: `/structure/figma/${page}-${block}.png`,
  after: `/structure/blocks/${page}-${block}-after.jpg`,
  beforeLabel: 'Figma',
  afterLabel: 'Сделано',
  warning,
});

const sharedHeaderShot: Shots = {
  before: '/structure/header-figma.jpg',
  after: '/structure/blocks/shared-header-after.jpg',
  beforeLabel: 'Figma',
  afterLabel: 'Сделано',
};

const sharedFooterShot: Shots = {
  before: '/structure/home-footer-figma.jpg',
  after: '/structure/blocks/shared-footer-after.jpg',
  beforeLabel: 'Figma',
  afterLabel: 'Сделано',
};

const quizShot = oldShot(
  'quiz',
  'quiz-section',
  'Отдельных экранов cover/thanks в сборке нет — показан общий quiz-блок.',
);

export const globalBlocks: Block[] = [
  {
    id: 'header',
    title: 'Шапка',
    does: 'Фиксированная тёмная шапка: nav, лого, CTA «Личная встреча», кабинет, бургер и мобильное меню.',
    task: 'Якоря, тап-таргет и фокус исправлены; 7 nav-ссылок + CTA. Смотреть приёмку.',
    status: 'done',
    note: 'Карточка c-3fea934a — принята.',
    images: sharedHeaderShot,
  },
  {
    id: 'footer',
    title: 'Подвал',
    does: 'Навигация, контакты, юридические ссылки, лого и подпись.',
    task: 'Якоря исправлены; соцсети и Cookie settings — заглушки.',
    status: 'done',
    note: 'Карточка c-3de034d8 — принята; Δ 8,41 на главной.',
    images: sharedFooterShot,
  },
];

export const pages: SitePage[] = [
  {
    id: 'home',
    number: '01',
    title: 'Главная',
    route: '/',
    status: 'done',
    note: 'Собрана полностью: 15 блоков, 10 548 px, Δ 4,37 / 5,07 %. Voices и footer — известные хвосты.',
    height: '10 548 px',
    blocks: [
      {
        id: 'hero',
        title: 'Hero',
        does: 'Первый экран: H1 «Состояние, из которого строится жизнь», лид, CTA на quiz, play.',
        task: 'Play-кнопка без модального окна — отдельная задача.',
        status: 'done',
        images: homeShot('hero'),
      },
      {
        id: 'banner',
        title: 'Banner founder',
        does: 'Широкий баннер с основателем и подписью; вход в тему метода.',
        task: 'Готово.',
        status: 'done',
        images: homeShot('banner'),
      },
      {
        id: 'pain',
        title: 'Pain',
        does: 'Список того, что мешает жить; подводит к причине и методу.',
        task: 'Готово.',
        status: 'done',
        images: homeShot('pain'),
      },
      {
        id: 'method',
        title: 'Method',
        does: 'Четыре шага метода: увидеть, понять, отпустить, жить.',
        task: 'Готово.',
        status: 'done',
        images: homeShot('method'),
      },
      {
        id: 'quiz',
        title: 'Quiz',
        does: 'Лид-магнит: «Вопрос 1 из 9» и вход в quiz.',
        task: 'Полный набор вопросов — вне этой страницы.',
        status: 'done',
        images: homeShot('quiz'),
      },
      {
        id: 'founder',
        title: 'About founder',
        does: 'Карточка основателя: фото, имя, регалии, цитата.',
        task: 'Готово.',
        status: 'done',
        images: homeShot('founder'),
      },
      {
        id: 'process',
        title: 'Process',
        does: 'Три stage-карточки: как проходит работа.',
        task: 'Готово.',
        status: 'done',
        images: homeShot('process'),
      },
      {
        id: 'entry',
        title: 'Entry',
        does: 'Точка входа: текст, фото, две кнопки.',
        task: 'Готово.',
        status: 'done',
        images: homeShot('entry'),
      },
      {
        id: 'formats',
        title: 'Formats',
        does: 'Пять форматов: слайдер, табы, цены, CTA.',
        task: 'Цены и длительности не подтверждены заказчиком.',
        status: 'done',
        images: homeShot('formats'),
      },
      {
        id: 'voices',
        title: 'Voices',
        does: '12 отзывов: карусель, листовые точки, стрелки.',
        task: 'Фоновая фактура — остаточная Δ 11,6.',
        status: 'done',
        note: 'Самый большой пиксельный хвост.',
        images: homeShot('voices'),
      },
      {
        id: 'library',
        title: 'Library',
        does: 'Промо книги и журналов Syntonia.',
        task: 'Готово.',
        status: 'done',
        images: homeShot('library'),
      },
      {
        id: 'air',
        title: 'Air photo',
        does: 'Полноэкранный портрет основателя.',
        task: 'Готово.',
        status: 'done',
        images: homeShot('air'),
      },
      {
        id: 'faq',
        title: 'FAQ',
        does: 'Аккордеон из пяти вопросов.',
        task: 'Готово.',
        status: 'done',
        images: homeShot('faq'),
      },
    ],
  },
  {
    id: 'method',
    number: '02',
    title: 'Метод',
    route: '/method.html',
    status: 'done',
    note: 'Собрано 2737 px, геометрия и адаптив сходятся. Правки width/отчёта внесены; ждёт приёмки. Figma main 323:422 и секции экспортированы.',
    height: '2 737 px',
    blocks: [
      {
        id: 'hero',
        title: 'Hero',
        does: 'Первый экран метода: заголовок и описание подводного кадра.',
        task: 'Настоящий Figma-кроп; после этого пересчитать Δ.',
        status: 'done',
        images: methodShot('hero'),
      },
      {
        id: 'principles',
        title: 'Principles',
        does: 'Три принципа: глубинный уровень, целостный подход, практический результат.',
        task: 'Пересобрать отчёт по шаблону: figma_version, команды, deviations.',
        status: 'done',
        images: methodShot('principles'),
      },
      {
        id: 'cta',
        title: 'CTA',
        does: 'CTA на точку входа и вопрос; фото лестницы.',
        task: 'Убрать width 219/160 или оформить waiver в decisions.md.',
        status: 'done',
        images: methodShot('cta'),
      },
    ],
  },
  {
    id: 'masters',
    number: '03',
    title: 'Мастера',
    route: '/masters.html',
    preview: '/structure/pages/masters.jpg',
    status: 'done',
    note: 'Собрано 3886; Figma main 217:237 и секции экспортированы.',
    height: '3 886 px',
    blocks: [
      { id: 'founder-hero', title: 'Founder hero', does: 'Первый экран с основателем.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('masters', 'founder-hero') },
      { id: 'masters-team', title: 'Masters team', does: 'Команда мастеров и направления.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('masters', 'masters-team') },
      { id: 'masters-more', title: 'Masters more', does: 'Дополнительный блок о подходе.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('masters', 'masters-more') },
      { id: 'footer', title: 'Footer', does: 'Общий подвал.', task: 'Собрано; проверить на приёмке.', status: 'done', images: sharedFooterShot },
      { id: 'header', title: 'Header', does: 'Общая шапка.', task: 'Собрано; проверить на приёмке.', status: 'done', images: sharedHeaderShot },
    ],
  },
  {
    id: 'practice',
    number: '04',
    title: 'Пространство практики',
    route: '/practice.html',
    preview: '/structure/pages/practice.jpg',
    status: 'done',
    note: 'Собрано 9292; ждёт приёмки. Цены не подтверждены.',
    height: '9 292 px',
    blocks: [
      { id: 'hero', title: 'Hero', does: 'Первый экран практик.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('practice', 'hero') },
      { id: 'practice-free', title: 'Practice free', does: 'Бесплатный вход в практику.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('practice', 'practice-free') },
      { id: 'quiz', title: 'Quiz', does: 'Встроенный quiz.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('practice', 'quiz') },
      { id: 'practice-pay', title: 'Practice pay', does: 'Платные практики.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('practice', 'practice-pay') },
      { id: 'kody-practice-pay', title: 'Kody practice pay', does: 'Практики «Коды».', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('practice', 'kody-practice-pay') },
      { id: 'practice-package', title: 'Practice package', does: 'Пакет практик.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('practice', 'practice-package') },
      { id: 'info-section', title: 'Info section', does: 'Информационный блок.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('practice', 'info-section') },
      { id: 'footer', title: 'Footer', does: 'Общий подвал.', task: 'Собрано; проверить на приёмке.', status: 'done', images: sharedFooterShot },
    ],
  },
  {
    id: 'library',
    number: '05',
    title: 'Библиотека',
    route: '/library.html',
    preview: '/structure/pages/library.jpg',
    status: 'done',
    note: 'Собрано 3188 px; journal-шаблоны не начаты.',
    height: '3 188 px',
    blocks: [
      { id: 'library-hero', title: 'Library hero', does: 'Первый экран библиотеки.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('library', 'library-hero') },
      { id: 'library-book', title: 'Library book', does: 'Книга Syntonia.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('library', 'library-book') },
      { id: 'library-journal', title: 'Library journal', does: 'Журнал и выпуски.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('library', 'library-journal') },
      { id: 'library-issues', title: 'Library issues', does: 'Сетка выпусков.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('library', 'library-issues') },
      { id: 'journal-start', title: 'Journal start', does: 'Стартовая страница журнала.', task: 'Собрать отдельным шаблоном.', status: 'todo' },
      { id: 'journal-issue', title: 'Journal issue', does: 'Страница выпуска, 9692 px.', task: 'Собрать после основного шаблона.', status: 'todo' },
    ],
  },
  {
    id: 'booking',
    number: '06',
    title: 'Запись',
    route: '/booking.html',
    preview: '/structure/pages/booking.jpg',
    status: 'done',
    note: 'Собрано 2416; Figma main 383:286 экспортирован; форма без endpoint.',
    height: '2 416 px',
    blocks: [
      { id: 'booking-hero', title: 'Booking hero', does: 'Первый экран записи.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('booking', 'booking-hero') },
      { id: 'booking-formats', title: 'Booking formats', does: 'Форматы и форма.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('booking', 'booking-formats') },
      { id: 'footer', title: 'Footer', does: 'Общий подвал.', task: 'Собрано; проверить на приёмке.', status: 'done', images: sharedFooterShot },
    ],
  },
  {
    id: 'quiz',
    number: '07',
    title: 'Quiz',
    route: '/quiz.html',
    preview: '/structure/pages/quiz.jpg',
    status: 'done',
    note: 'Собрано 1218 px; 4 вопроса, результат. Полного набора 12 вопросов нет.',
    height: '1 218 px',
    blocks: [
      { id: 'quiz-section', title: 'Quiz section', does: 'Вопросы и результат.', task: 'Собрано; проверить на приёмке.', status: 'done', images: figmaShot('quiz', 'quiz-section', 'Сравнение с Figma-секцией quiz; справа — текущая сборка.') },
      { id: 'cover', title: 'Cover', does: 'Обложка quiz.', task: 'Отдельный экран не собран.', status: 'todo' },
      { id: 'thanks', title: 'Thanks', does: 'Экран благодарности.', task: 'Отдельный экран не собран.', status: 'todo' },
    ],
  },
  {
    id: 'offer',
    number: '08',
    title: 'Публичная оферта',
    route: '/offer.html',
    preview: '/structure/pages/offer.jpg',
    status: 'done',
    note: 'Макета нет — типовой текстовый шаблон.',
    height: 'text',
    blocks: [{ id: 'legal', title: 'Legal text', does: 'Юридический текст.', task: 'Собрано; проверить на приёмке.', status: 'done', images: oldShot('offer', 'legal') }],
  },
  {
    id: 'privacy',
    number: '09',
    title: 'Политика конфиденциальности',
    route: '/privacy.html',
    preview: '/structure/pages/privacy.jpg',
    status: 'done',
    note: 'Макета нет — типовой текстовый шаблон.',
    height: 'text',
    blocks: [{ id: 'legal', title: 'Legal text', does: 'Юридический текст.', task: 'Собрано; проверить на приёмке.', status: 'done', images: oldShot('privacy', 'legal') }],
  },
  {
    id: 'consent',
    number: '10',
    title: 'Согласие на обработку',
    route: '/consent.html',
    preview: '/structure/pages/consent.jpg',
    status: 'done',
    note: 'Макета нет — типовой текстовый шаблон.',
    height: 'text',
    blocks: [{ id: 'legal', title: 'Legal text', does: 'Юридический текст.', task: 'Собрано; проверить на приёмке.', status: 'done', images: oldShot('consent', 'legal') }],
  },
  {
    id: '404',
    number: '11',
    title: '404',
    route: '/404.html',
    preview: '/structure/pages/404.jpg',
    status: 'done',
    note: 'Макета нет.',
    height: 'text',
    blocks: [{ id: '404', title: '404', does: 'Страница ошибки.', task: 'Собрано; проверить на приёмке.', status: 'done', images: oldShot('404', '404') }],
  },
];

export const statusLabel: Record<Status, string> = {
  done: 'готово',
  review: 'на приёмке',
  progress: 'в работе',
  todo: 'не начато',
};