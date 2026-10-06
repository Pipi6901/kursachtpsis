window.DIAGRAMS = window.DIAGRAMS || {};

// Рисунок 3.4 — последовательность получения прогноза
window.DIAGRAMS.fig_3_4 = function () {
  const W = 1140, H = 930, F = 20;
  const D = new Diagram(W, H, { font: F });
  const X = { m: 80, c: 305, s: 545, k: 775, a: 1020 };
  const bottom = H - 14, top = 10;
  D.lifeline(X.m, top, bottom, 'Менеджер', { w: 140 });
  D.lifeline(X.c, top, bottom, 'Клиент', { w: 140 });
  D.lifeline(X.s, top, bottom, 'Сервер', { w: 140 });
  D.lifeline(X.k, top, bottom, 'Кэш прогнозов', { w: 150 });
  D.lifeline(X.a, top, bottom, 'Сервис ИИ', { w: 140 });

  D.msg(X.m, X.c, 128, 'Параметры прогноза', { size: 18 });
  D.msg(X.c, X.s, 190, 'POST /predict + JWT', { size: 18 });
  D.selfmsg(X.s, 222, '', { w: 44, h: 34 });
  D.label(X.s + 215, 239, 'проверка прав и данных, план затрат, сценарий', { size: 17, maxW: 220 });
  D.msg(X.s, X.k, 322, 'Поиск по ключу запроса', { size: 18, off1: 12 });

  D.fragment(440, 348, 680, 412, 'alt', { guard: '[ответ есть в кэше]', dividers: [{ y: 452, text: '[ответа в кэше нет]' }] });
  D.msg(X.k, X.s, 420, 'готовый ответ', { dash: true, size: 18, off1: 12, off2: 12 });
  D.msg(X.s, X.a, 520, 'POST /api/v1/models/{id}/forecast', { size: 18, off1: 12 });
  D.fragment(470, 548, 640, 200, 'alt', { guard: '[ответ получен]', dividers: [{ y: 662, text: '[сбой, тайм-аут, предохранитель разомкнут]' }] });
  D.msg(X.a, X.s, 606, 'точки, интервал, вклады', { dash: true, size: 18, off1: 12, off2: 12 });
  D.msg(X.s, X.k, 650, 'сохранить ответ', { size: 18, off1: 12, off2: 12 });
  D.selfmsg(X.s, 696, '', { w: 44, h: 34 });
  D.label(X.s + 215, 713, 'упрощённый прогноз по сезонности', { size: 17, maxW: 260 });

  D.msg(X.s, X.c, 836, 'прогноз, история, признак упрощённого режима', { dash: true, size: 18, off1: 12 });
  D.msg(X.c, X.m, 898, 'график, показатели, вклады', { dash: true, size: 18, off2: 12 });
  return D;
};

// Рисунок 3.5 — последовательность обучения модели
window.DIAGRAMS.fig_3_5 = function () {
  const W = 1140, H = 900, F = 20;
  const D = new Diagram(W, H, { font: F });
  const X = { a: 85, s: 335, b: 570, m: 800, r: 1040 };
  const bottom = H - 14, top = 10;
  D.lifeline(X.a, top, bottom, 'Администратор', { w: 150 });
  D.lifeline(X.s, top, bottom, 'Сервер', { w: 130 });
  D.lifeline(X.b, top, bottom, 'PostgreSQL', { w: 130 });
  D.lifeline(X.m, top, bottom, 'Сервис ИИ', { w: 130 });
  D.lifeline(X.r, top, bottom, 'Реестр моделей', { w: 150 });

  D.msg(X.a, X.s, 130, 'POST /models/train', { size: 18 });
  D.selfmsg(X.s, 160, '', { w: 44, h: 34 });
  D.label(X.s + 215, 177, 'проверка прав, запрет параллельного обучения', { size: 17, maxW: 210 });
  D.msg(X.s, X.b, 268, 'продажи по неделям и кампании', { size: 18, off1: 12 });
  D.msg(X.b, X.s, 318, 'данные', { dash: true, size: 18, off2: 12 });
  D.selfmsg(X.s, 346, '', { w: 44, h: 34 });
  D.label(X.s + 215, 363, 'сборка ряда, матрица затрат, отпечаток данных', { size: 17, maxW: 210 });
  D.msg(X.s, X.m, 450, 'POST /api/v1/models/train', { size: 18, off1: 12 });
  D.selfmsg(X.m, 482, '', { w: 44, h: 34 });
  D.label(X.m + 142, 499, 'проверка четырёх алгоритмов, выбор чемпиона', { size: 17, maxW: 150 });
  D.msg(X.m, X.r, 600, 'сохранить модель (AES-256-GCM)', { size: 18, off1: 12 });
  D.msg(X.m, X.s, 676, 'метрики, таблица лидеров, эффекты каналов', { dash: true, size: 18, off2: 12 });
  D.msg(X.s, X.b, 762, 'новая модель ACTIVE, прежняя ARCHIVED', { size: 18, off1: 12 });
  D.msg(X.s, X.a, 842, 'описание обученной модели', { dash: true, size: 18, off2: 12 });
  return D;
};
