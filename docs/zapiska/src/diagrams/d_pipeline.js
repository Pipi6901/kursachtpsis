window.DIAGRAMS = window.DIAGRAMS || {};

// Рисунок 2.3 — пайплайн интеллектуальной обработки
window.DIAGRAMS.fig_2_3 = function () {
  const W = 1140, F = 20;
  const D = new Diagram(W, 660, { font: F });
  const band = (y, h, title) => {
    D.rect(10, y, W - 20, h, { fill: '#f4f4f4', sw: 2.4, r: 10 });
    D.text(30, y + 26, title, { anchor: 'start', nowrap: true, bold: true, size: 22 });
  };
  band(10, 280, 'Контур обучения');
  band(320, 330, 'Контур прогноза и оптимизации');
  const bw = 176, bh = 132, xs = [28, 236, 444, 652];
  const y1 = 100, y2 = 400;
  const a1 = D.task(xs[0], y1, bw, bh, 'Источники данных: продажи по неделям, кампании, затраты', { size: F });
  const a2 = D.task(xs[1], y1, bw, bh, 'Подготовка: недельный ряд, матрица затрат, отпечаток', { size: F });
  const a3 = D.task(xs[2], y1, bw, bh, 'Обучение четырёх алгоритмов, скользящая проверка', { size: F });
  const a4 = D.task(xs[3], y1, bw, bh, 'Выбор чемпиона по ошибке WAPE', { size: F });
  const reg = D.dataStore(985, y1 + bh / 2, 170, 150, 'Реестр моделей (AES-256-GCM)', { size: 20 });
  D.flow([[a1.r, a1.cy], [a2.l, a1.cy]]);
  D.flow([[a2.r, a1.cy], [a3.l, a1.cy]]);
  D.flow([[a3.r, a1.cy], [a4.l, a1.cy]]);
  D.flow([[a4.r, a1.cy], [reg.l, a1.cy]]);

  const b1 = D.task(xs[0], y2, bw, bh, 'Запрос менеджера: показатель, горизонт, сценарий', { size: F });
  const b2 = D.task(xs[1], y2, bw, bh, 'Сборка плана затрат, проверка, кэш ответов', { size: F });
  const b3 = D.task(xs[2], y2, bw, bh, 'Прогноз с интервалом и вкладами каналов', { size: F });
  const b4 = D.task(xs[3], y2, bw, bh, 'Оптимизация распределения бюджета', { size: F });
  const b5 = D.task(860, y2, bw, bh, 'Интерфейс: графики, таблицы, рекомендация', { size: F });
  D.flow([[b1.r, b1.cy], [b2.l, b1.cy]]);
  D.flow([[b2.r, b1.cy], [b3.l, b1.cy]]);
  D.flow([[b3.r, b1.cy], [b4.l, b1.cy]]);
  D.flow([[b4.r, b1.cy], [b5.l, b1.cy]]);
  // реестр → прогноз (используемая модель)
  D.flow([[985, reg.b], [985, 310], [b3.cx, 310], [b3.t, b3.t]].slice(0, 3).concat([[b3.cx, 310], [b3.cx, b3.t]]), {});
  D.label(b3.cx + 150, 296, 'активная модель', { size: 19 });
  // упрощённый режим
  const fb = D.task(236, 570, 376, 62, 'Упрощённый прогноз по сезонности', { size: F, dy: 0 });
  D.flow([[b2.cx, b2.b], [b2.cx, fb.t]], { dash: '9 7' });
  D.tag(b2.cx, (b2.b + fb.t) / 2, 'сервис недоступен', { side: 'right', off: 10, size: 18 });
  D.flow([[fb.r, fb.cy], [b5.cx, fb.cy], [b5.cx, b5.b]], { dash: '9 7' });
  return D;
};
