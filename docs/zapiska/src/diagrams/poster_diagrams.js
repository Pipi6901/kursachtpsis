window.DIAGRAMS = window.DIAGRAMS || {};

// Схемы для плаката 6.1: те же процессы, что на рисунках 2.1 и 2.2 записки, но растянуты по ширине листа А3
// (шире и ниже, чтобы подписи были крупными); соединения и обозначения BPMN те же.

window.DIAGRAMS.poster_asis = function () {
  const W = 1780, F = 21;
  const D = new Diagram(W, 400, { font: F });
  const lanes = D.pool(10, 10, W - 20, 64, 'Планирование маркетинга\nи продаж (AS-IS)',
    [{ name: 'Менеджер по маркетингу', h: 210 }, { name: 'Директор гостиницы', h: 170 }], { titleSize: 22, laneTitleW: 56, laneSize: 20 });
  const [L1, L2] = lanes;
  const tw = 230, th = 104;
  const ty = L1.mid + 8;
  const cx = { t1: 390, t2: 700, g: 925, t4: 1170, t5: 1470, en: 1700 };
  const st = D.startEvent(192, ty, 'Нужен\nплан', { maxW: 100, size: 19 });
  const t1 = D.task(cx.t1 - tw / 2, ty - th / 2, tw, th, 'Сбор данных из Excel и кабинетов каналов', { size: F });
  const t2 = D.task(cx.t2 - tw / 2, ty - th / 2, tw, th, 'Расчёт плана продаж в электронных таблицах', { size: F });
  const t4 = D.task(cx.t4 - tw / 2, ty - th / 2, tw, th, 'Ручное размещение рекламы по каналам', { size: F });
  const t5 = D.task(cx.t5 - tw / 2, ty - th / 2, tw, th, 'Контроль продаж по итогам периода', { size: F });
  const en = D.endEvent(cx.en, ty, '', {});
  const gy = L2.top + 70;
  const t3 = D.task(cx.t2 - tw / 2, gy - 50, tw, 100, 'Проверка и согласование бюджета', { size: F });
  const g = D.gateway(cx.g, gy, 'xor', '', { s: 32 });
  D.text(cx.g, gy + 32 + 12, 'Бюджет\nутверждён?', { top: true, nowrap: true, size: 19 });
  D.flow([[st.r, ty], [t1.l, ty]]);
  D.flow([[t1.r, ty], [t2.l, ty]]);
  D.flow([[t2.cx, t2.b], [t3.cx, t3.t]]);
  D.flow([[t3.r, gy], [g.l, gy]]);
  D.flow([[g.r, gy], [t4.cx, gy], [t4.cx, t4.b]]);
  D.tag(g.r + 6, gy - 20, 'Да', { side: 'right', off: 4 });
  D.flow([[cx.g, g.t], [cx.g, L1.top + 34], [t2.cx, L1.top + 34], [t2.cx, t2.t]]);
  D.tag(cx.g, g.t - 20, 'Нет', { side: 'right', off: 10 });
  D.flow([[t4.r, ty], [t5.l, ty]]);
  D.flow([[t5.r, ty], [en.l, ty]]);
  D.text(en.cx - 4, ty + 38, 'План\nисполнен', { top: true, nowrap: true, size: 19 });
  return D;
};

window.DIAGRAMS.poster_tobe = function () {
  const W = 1780, F = 20;
  const D = new Diagram(W, 569, { font: F });
  const lanes = D.pool(10, 10, W - 20, 64, 'Планирование маркетинга\nи продаж (TO-BE)',
    [{ name: 'Менеджер по маркетингу', h: 215 }, { name: 'Серверная часть', h: 132 }, { name: 'Интеллектуальный сервис', h: 202 }],
    { titleSize: 22, laneTitleW: 56, laneSize: 19 });
  const [LM, LS, LA] = lanes;
  const tw = 230, th = 104;
  const my = LM.mid + 14, sy = LS.mid, ay = LA.mid;
  const c = [390, 700, 925, 1170, 1470, 1700];
  const st = D.startEvent(192, my, 'Нужен\nплан', { maxW: 100, size: 19 });
  const m1 = D.task(c[0] - tw / 2, my - th / 2, tw, th, 'Выбрать показатель, горизонт, сценарий', { size: F });
  const s1 = D.task(c[0] - tw / 2, sy - th / 2, tw, th, 'Проверить данные и собрать план затрат', { size: F });
  const a1 = D.task(c[0] - tw / 2, ay - th / 2, tw, th, 'Прогноз с интервалом и вкладами каналов', { size: F });
  const s2 = D.task(c[1] - tw / 2, sy - th / 2, tw, th, 'Добавить сравнение с прошлым годом', { size: F });
  const m2 = D.task(c[1] - tw / 2, my - th / 2, tw, th, 'Анализ прогноза и вклада каналов', { size: F });
  const g = D.gateway(c[2], my, 'xor', '', { s: 30 });
  D.text(c[2], my + 30 + 12, 'Нужна\nоптимизация?', { top: true, nowrap: true, size: 19 });
  const m3 = D.task(c[3] - tw / 2, my - th / 2, tw, th, 'Задать бюджет и ограничения долей', { size: F });
  const a2 = D.task(c[3] - tw / 2, ay - th / 2, tw, th, 'Оптимальное размещение бюджета', { size: F });
  const s3 = D.task(c[4] - tw / 2, sy - th / 2, tw, th, 'Рекомендация и сценарий затрат', { size: F });
  const m4 = D.task(c[4] - tw / 2, my - th / 2, tw, th, 'Оценить результат, внести кампании', { size: F });
  const en = D.endEvent(c[5], my, '', {});
  D.text(en.cx - 6, my + 38, 'План\nутверждён', { top: true, nowrap: true, size: 19 });
  D.flow([[st.r, my], [m1.l, my]]);
  D.flow([[m1.cx, m1.b], [s1.cx, s1.t]]);
  D.flow([[s1.cx, s1.b], [a1.cx, a1.t]]);
  D.flow([[a1.r, ay], [s2.cx, ay], [s2.cx, s2.b]]);
  D.flow([[s2.cx, s2.t], [m2.cx, m2.b]]);
  D.flow([[m2.r, my], [g.l, my]]);
  D.flow([[g.r, my], [m3.l, my]]);
  D.tag((g.r + m3.l) / 2, my - 4, 'Да', { side: 'above', off: 4 });
  D.flow([[c[2], g.t], [c[2], LM.top + 34], [m4.cx, LM.top + 34], [m4.cx, m4.t]]);
  D.tag(c[2], g.t - 26, 'Нет', { side: 'right', off: 10 });
  D.flow([[m3.cx, m3.b], [a2.cx, a2.t]]);
  D.flow([[a2.r, ay], [s3.cx, ay], [s3.cx, s3.b]]);
  D.flow([[s3.cx, s3.t], [m4.cx, m4.b]]);
  D.flow([[m4.r, my], [en.l, my]]);
  return D;
};
