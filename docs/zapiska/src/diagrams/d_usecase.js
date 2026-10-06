window.DIAGRAMS = window.DIAGRAMS || {};

// Рисунок 2.4 — диаграмма вариантов использования
window.DIAGRAMS.fig_2_4 = function () {
  const W = 1140, H = 980, F = 21;
  const D = new Diagram(W, H, { font: F });
  const bx = 330, bw = 790;
  D.rect(bx, 10, bw, H - 20, { sw: 2.6 });
  D.text(bx + bw / 2, 40, 'Программное средство прогнозирования продаж', { bold: true, nowrap: true, size: 23 });
  const cx = bx + bw / 2 + 10, rx = 300, ry = 31, y0 = 108, dy = 73;
  const mgr = ['UC-1 Авторизация в системе', 'UC-3 Управление маркетинговыми кампаниями', 'UC-4 Ввод фактических продаж',
    'UC-6 Просмотр прогноза продаж', 'UC-7 Сценарный анализ «что если»', 'UC-8 Оптимизация бюджета', 'UC-9 Анализ вклада каналов и качества модели'];
  const adm = ['UC-2 Управление справочником каналов', 'UC-5 Обучение модели', 'UC-10 Выбор версии модели (откат)',
    'UC-11 Загрузка продаж из файла CSV', 'UC-12 Резервное копирование данных'];
  const all = mgr.concat(adm);
  const pos = all.map((t, i) => ({ y: y0 + i * dy, t }));
  pos.forEach(p => D.useCase(cx, p.y, rx, ry, p.t, { size: 20 }));
  // акторы
  const ax = 140;
  const mTop = y0 + 3 * dy - 70, aTop = y0 + 9 * dy - 70;
  const m = D.actor(ax, mTop, 'Менеджер по маркетингу', { maxW: 200, size: 21 });
  const a = D.actor(ax, aTop, 'Администратор', { maxW: 200, size: 21 });
  const edge = (px, py, c) => {      // точка пересечения отрезка (p → центр) с эллипсом
    const dx = px - c.x, dy2 = py - c.y, t = 1 / Math.sqrt((dx / rx) ** 2 + (dy2 / ry) ** 2);
    return [c.x + dx * t, c.y + dy2 * t];
  };
  // ассоциации: от актора к «шине» и ответвления к левой вершине каждого эллипса (линии не пересекают чужие эллипсы)
  const trunkX = cx - rx - 42;
  [[m, 0, mgr.length - 1], [a, mgr.length, all.length - 1]].forEach(([act, i0, i1]) => {
    D.line(act.r + 4, act.cy, trunkX, act.cy, { sw: 2 });
    D.line(trunkX, pos[i0].y, trunkX, pos[i1].y, { sw: 2 });
    if (act.cy < pos[i0].y || act.cy > pos[i1].y) D.line(trunkX, act.cy, trunkX, act.cy < pos[i0].y ? pos[i0].y : pos[i1].y, { sw: 2 });
    for (let i = i0; i <= i1; i++) D.line(trunkX, pos[i].y, cx - rx, pos[i].y, { sw: 2 });
    D.circle(trunkX, act.cy, 4, { fill: '#000', sw: 1 });
  });
  // обобщение: администратор — тоже менеджер
  const ytop = a.t - 2, ybot = m.b + 84;
  D.line(ax, ytop, ax, ybot + 16, { sw: 2.4 });
  D.poly([[ax, ybot], [ax - 13, ybot + 24], [ax + 13, ybot + 24]], { fill: '#fff', sw: 2.4 });
  D.tag(ax + 12, (ytop + ybot) / 2, 'наследует права', { side: 'right', off: 4, size: 18 });
  return D;
};
