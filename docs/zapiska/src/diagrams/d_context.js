window.DIAGRAMS = window.DIAGRAMS || {};

// Рисунок 2.5 — контекстная диаграмма
window.DIAGRAMS.fig_2_5 = function () {
  const W = 1140, H = 720, F = 20;
  const D = new Diagram(W, H, { font: F });
  const box = (x, y, w, h, t, o = {}) => { D.rect(x, y, w, h, { r: 10, sw: 2.6, fill: o.fill || '#fff' }); D.text(x + w / 2, y + h / 2, t, { maxW: w - 20, size: o.size || 21, bold: o.bold }); return { x, y, w, h, l: x, r: x + w, t: y, b: y + h, cx: x + w / 2, cy: y + h / 2 }; };
  const sys = box(410, 270, 290, 180, 'Программное средство прогнозирования продаж', { bold: true, size: 23, fill: '#eef3f8' });
  const mgr = box(20, 285, 160, 150, 'Менеджер по маркетингу');
  const adm = box(447, 20, 216, 82, 'Администратор');
  const ml = box(920, 285, 200, 150, 'Интеллектуальный сервис', { size: 20 });
  const db = D.dataStore(555, 640, 230, 120, 'СУБД PostgreSQL', { size: 21 });
  const bk = D.dataStore(985, 640, 230, 120, 'Хранилище зашифрованных копий', { size: 20 });
  // менеджер ⇄ система
  D.flow([[mgr.r, 330], [sys.l, 330]]);
  D.text(295, 292, 'Кампании, продажи,\nпараметры прогноза', { nowrap: true, size: 19 });
  D.flow([[sys.l, 400], [mgr.r, 400]]);
  D.text(295, 440, 'Прогноз, вклад каналов,\nрекомендация', { nowrap: true, size: 19 });
  // администратор ⇄ система
  D.flow([[500, adm.b], [500, sys.t]]);
  D.text(488, 186, 'Каналы, обучение\nмоделей, CSV', { nowrap: true, size: 19, anchor: 'end' });
  D.flow([[610, sys.t], [610, adm.b]]);
  D.text(622, 186, 'Состояние моделей\nи сервиса', { nowrap: true, size: 19, anchor: 'start' });
  // система ⇄ интеллектуальный сервис
  D.flow([[sys.r, 330], [ml.l, 330]]);
  D.text(810, 292, 'Ряд продаж, затраты\nпо каналам', { nowrap: true, size: 19 });
  D.flow([[ml.l, 400], [sys.r, 400]]);
  D.text(810, 440, 'Прогноз, вклады,\nрекомендация', { nowrap: true, size: 19 });
  // система ⇄ БД
  D.flow([[500, sys.b], [500, db.t]]);
  D.text(488, 520, 'Кампании, продажи,\nметаданные моделей', { nowrap: true, size: 19, anchor: 'end' });
  D.flow([[610, db.t], [610, sys.b]]);
  D.text(622, 520, 'Выборка данных', { nowrap: true, size: 19, anchor: 'start' });
  // БД → хранилище копий
  D.flow([[db.r, 640], [bk.l, 640]]);
  D.text(770, 598, 'Копии базы\n(AES-256-GCM)', { nowrap: true, size: 19 });
  return D;
};
