export interface Format {
  id: string;
  number: string;
  title: string;
  description: string;
  duration: string;
  price: string;
  image: string;
  alt: string;
}

export const formats: Format[] = [
  {
    id: 'entry',
    number: '01',
    title: 'Точка входа',
    description:
      'Первая встреча. Твоё понимание, что мешает и куда двигаться. Дальше выбор за тобой.',
    duration: '30 мин',
    price: '$50',
    image: '/img/format-01-figma.jpg',
    alt: 'Рука открывает дверь в тёплую гостиную с креслами и чаем',
  },
  {
    id: 'master-session',
    number: '02',
    title: 'Индивидуальная мастер-сессия',
    description:
      'Глубокая работа с одним запросом. Вместе мы находим настоящую причину и работаем с ней, пока она не потеряет над тобой силу. Приходят узнавание, лёгкость и своё решение.',
    duration: '2 часа',
    price: '$230',
    image: '/img/format-02-figma.jpg',
    alt: 'Кристалл в солнечном свете',
  },
  {
    id: 'program-3',
    number: '03',
    title: 'Программа 3\u00a0встречи',
    description:
      'Встречи раз в две недели. Каждая ценна сама по себе, а вместе они дают новому состоянию время закрепиться.',
    duration: '3 х 2 часа',
    price: '$650',
    image: '/img/format-03-figma.jpg',
    alt: 'Арка над водным бассейном в тёплом солнечном свете',
  },
  {
    id: 'program-5',
    number: '04',
    title: 'Программа 5\u00a0встреч',
    description:
      'Достаточно времени, чтобы пройти привычный сценарий во всех слоях и выйти из него.',
    duration: '5 х 2 часа',
    price: '$1050',
    image: '/img/format-04-figma.jpg',
    alt: 'Закат над морем с видом на побережье',
  },
  {
    id: 'support',
    number: '05',
    title: 'Сопровождение',
    description:
      'Встреча раз в неделю, пока твоя жизнь преображается. Чтобы новое стало твоим, а опора не терялась.',
    duration: '60 минут',
    price: '$110',
    image: '/img/format-05-figma.jpg',
    alt: 'Береговая линия с волнами в золотистом свете',
  },
];
