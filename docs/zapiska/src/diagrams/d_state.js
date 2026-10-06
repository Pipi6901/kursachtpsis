window.DIAGRAMS = window.DIAGRAMS || {};

// Рисунок 3.13 — состояния брони
window.DIAGRAMS.fig_3_13 = function () {
  const W = 1140, H = 480, F = 20;
  const D = new Diagram(W, H, { font: F });
  const y0 = 166, sh = 84;
  const wait = D.state(130, y0, 200, sh, 'Ожидание', { sub: 'WAITING', size: 21 });
  const done = D.state(480, y0, 200, sh, 'Подтверждено', { sub: 'DONE', size: 21 });
  const comp = D.state(840, y0, 200, sh, 'Завершено', { sub: 'COMPLETED', size: 21 });
  const rej = D.state(470, 372, 220, sh, 'Отказано', { sub: 'REJECT', size: 21 });
  const ini = D.initial(28, wait.cy);
  const fin = D.final(1098, comp.cy);
  const cancel = D.final(585, 50);
  const lab = (x, y, t, o = {}) => D.text(x, y, t, { nowrap: true, size: 18, anchor: o.anchor || 'middle' });

  D.flow([[ini.r, wait.cy], [wait.l, wait.cy]], { arrowLen: 13, sw: 2 });
  lab(80, wait.cy - 18, 'создание');
  D.flow([[wait.r, wait.cy], [done.l, done.cy]], { arrowLen: 13, sw: 2 });
  lab((wait.r + done.l) / 2, wait.cy - 40, 'менеджер');
  lab((wait.r + done.l) / 2, wait.cy - 19, 'подтверждает');
  D.flow([[done.r, done.cy], [comp.l, comp.cy]], { arrowLen: 13, sw: 2 });
  lab((done.r + comp.l) / 2, done.cy - 40, 'гость выселяется,');
  lab((done.r + comp.l) / 2, done.cy - 19, 'заезд состоялся');
  D.flow([[comp.r, comp.cy], [fin.l, comp.cy]], { arrowLen: 13, sw: 2 });

  // отказ менеджера
  const xw = wait.cx, yr = rej.cy;
  D.flow([[xw, wait.b], [xw, yr], [rej.l, yr]], { arrowLen: 13, sw: 2 });
  lab(xw + 12, yr - 38, 'менеджер отказывает,', { anchor: 'start' });
  lab(xw + 12, yr - 17, 'сумма возвращается', { anchor: 'start' });
  D.flow([[done.cx + 40, done.b], [done.cx + 40, rej.t]], { arrowLen: 13, sw: 2 });
  lab(done.cx + 54, 308, 'менеджер', { anchor: 'start' });
  lab(done.cx + 54, 329, 'отказывает', { anchor: 'start' });

  // отмена гостем: запись удаляется
  D.flow([[wait.cx, wait.t], [wait.cx, cancel.cy], [cancel.l, cancel.cy]], { arrowLen: 13, sw: 2 });
  D.flow([[done.cx - 40, done.t], [done.cx - 40, cancel.b + 40], [cancel.cx - 6, cancel.b + 40], [cancel.cx - 6, cancel.b]], { arrowLen: 13, sw: 2 });
  lab(cancel.r + 14, cancel.cy - 14, 'гость отменяет бронь:', { anchor: 'start' });
  lab(cancel.r + 14, cancel.cy + 8, 'запись удаляется, сумма возвращается', { anchor: 'start' });
  // выход из «Отказано»
  const fin2 = D.final(570 + 120 + 110, rej.cy);
  D.flow([[rej.r, rej.cy], [fin2.l, rej.cy]], { arrowLen: 13, sw: 2 });
  return D;
};

// Рисунок 3.14 — жизненный цикл модели прогнозирования
window.DIAGRAMS.fig_3_14 = function () {
  const W = 1140, H = 480, F = 20;
  const D = new Diagram(W, H, { font: F });
  const lab = (x, y, t, o = {}) => D.text(x, y, t, { nowrap: true, size: 18, anchor: o.anchor || 'middle' });
  // составное состояние ACTIVE
  const box = D.group(10, 90, 690, 270, '', { fill: '#fff', r: 22 });
  D.text(30, 112, 'Активна (ACTIVE)', { anchor: 'start', nowrap: true, bold: true, size: 21 });
  D.line(10, 128, 700, 128, { sw: 1.6 });
  const act = D.state(50, 190, 220, 84, 'Актуальна', { sub: 'данные не менялись', size: 21 });
  const old = D.state(470, 190, 220, 84, 'Устарела', { sub: 'данные изменились', size: 21 });
  const arch = D.state(890, 190, 230, 84, 'В архиве', { sub: 'ARCHIVED', size: 21 });
  const ini = D.initial(30, 420);
  // обучение
  D.flow([[ini.cx, ini.t], [ini.cx, 384], [act.cx - 60, 384], [act.cx - 60, act.b]], { arrowLen: 13, sw: 2 });
  lab(ini.cx + 18, 404, 'обучение', { anchor: 'start' });
  // актуальна ⇄ устарела
  D.flow([[act.r, act.cy - 22], [old.l, old.cy - 22]], { arrowLen: 13, sw: 2 });
  lab((act.r + old.l) / 2, act.cy - 62, 'изменились продажи', { size: 18 });
  lab((act.r + old.l) / 2, act.cy - 41, 'или затраты');
  D.flow([[old.l, old.cy + 26], [act.r, act.cy + 26]], { arrowLen: 13, sw: 2 });
  lab((act.r + old.l) / 2, act.cy + 48, 'переобучение');
  // обучена новая версия / откат
  D.flow([[box.r, arch.cy - 24], [arch.l, arch.cy - 24]], { arrowLen: 13, sw: 2 });
  lab((box.r + arch.l) / 2, arch.cy - 64, 'обучена новая', { size: 18 });
  lab((box.r + arch.l) / 2, arch.cy - 43, 'версия');
  D.flow([[arch.l, arch.cy + 28], [box.r, arch.cy + 28]], { arrowLen: 13, sw: 2 });
  lab((box.r + arch.l) / 2, arch.cy + 50, 'откат на');
  lab((box.r + arch.l) / 2, arch.cy + 71, 'выбранную версию');
  // самопереход: модель пропала из реестра ИИ
  D.flow([[210, box.t], [210, 40], [560, 40], [560, box.t]], { arrowLen: 13, sw: 2 });
  lab(385, 22, 'модель пропала из реестра ИИ — обучена заново');
  D.h = H;
  return D;
};
