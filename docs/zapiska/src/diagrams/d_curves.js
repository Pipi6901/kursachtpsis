window.DIAGRAMS = window.DIAGRAMS || {};

// Рисунок 1.1 — перенос эффекта (адсток) и насыщение
window.DIAGRAMS.fig_1_1 = function () {
  const W = 1140, H = 470, F = 20;
  const D = new Diagram(W, H, { font: F });
  const panel = (x0, title) => {
    const o = { x0, y0: 84, w: 480, h: 290 };      // область графика
    o.xa = x0 + 60; o.ya = o.y0 + o.h;              // начало осей
    D.text(x0 + 60 + o.w / 2 - 30, 24, title, { nowrap: true, bold: true, size: 21 });
    D.flow([[o.xa, o.ya], [o.xa, o.y0 - 14]], { sw: 2.2 });
    D.flow([[o.xa, o.ya], [o.xa + o.w - 20, o.ya]], { sw: 2.2 });
    return o;
  };

  // ---- (а) адсток
  const A = panel(30, 'а) Перенос эффекта затрат (адсток)');
  const lam = 0.6, spend = [0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0];
  const adst = []; let prev = 0;
  spend.forEach(s => { prev = s + lam * prev; adst.push(prev); });
  const n = spend.length, step = (A.w - 50) / n, ymax = Math.max(...adst) * 1.12;
  const px = i => A.xa + 24 + i * step, py = v => A.ya - (v / ymax) * (A.h - 20);
  spend.forEach((s, i) => { if (s > 0) D.rect(px(i) - step * 0.28, py(s), step * 0.56, A.ya - py(s), { fill: '#bdbdbd', sw: 2 }); });
  let d = '';
  adst.forEach((v, i) => { d += (i ? 'L' : 'M') + px(i) + ' ' + py(v) + ' '; });
  D.path(d, { sw: 3 });
  adst.forEach((v, i) => D.circle(px(i), py(v), 5.5, { fill: '#fff', sw: 2.4 }));
  D.text(A.xa + A.w / 2 - 10, A.ya + 40, 'Время, недели', { nowrap: true, size: 20 });
  D.text(A.xa + 18, A.y0 - 8, 'Эффект', { nowrap: true, size: 20, anchor: 'start' });
  // легенда
  const lx = A.xa + 250, ly = A.y0 + 4;
  D.rect(lx, ly, 26, 18, { fill: '#bdbdbd', sw: 2 });
  D.text(lx + 38, ly + 9, 'затраты за неделю', { nowrap: true, size: 19, anchor: 'start' });
  D.line(lx, ly + 44, lx + 26, ly + 44, { sw: 3 }); D.circle(lx + 13, ly + 44, 5.5, { fill: '#fff', sw: 2.4 });
  D.text(lx + 38, ly + 44, 'накопленный эффект', { nowrap: true, size: 19, anchor: 'start' });
  D.text(lx, ly + 92, 'после остановки рекламы\nэффект затухает постепенно', { nowrap: true, size: 19, anchor: 'start' });

  // ---- (б) насыщение
  const B = panel(600, 'б) Насыщение: убывающая отдача затрат');
  const s = 0.38, f = x => 1 - Math.exp(-x / s), df = x => Math.exp(-x / s) / s;
  const bx = x => B.xa + x * (B.w - 70), by = v => B.ya - v * (B.h - 24) / 1.02;
  // потолок
  D.line(B.xa, by(1), B.xa + B.w - 20, by(1), { sw: 2, dash: '8 6' });
  D.text(B.xa + B.w - 30, by(1) - 16, 'предельный эффект канала', { nowrap: true, size: 19, anchor: 'end' });
  let c = '';
  for (let i = 0; i <= 60; i++) { const x = i / 60; c += (i ? 'L' : 'M') + bx(x) + ' ' + by(f(x)) + ' '; }
  D.path(c, { sw: 3.2 });
  // касательные в двух точках
  const tang = (x, half, lbl, side) => {
    const k = df(x) * ((B.h - 24) / 1.02) / (B.w - 70);       // наклон в пикселях
    const X = bx(x), Y = by(f(x));
    D.line(X - half, Y + k * half, X + half, Y - k * half, { sw: 2.4, dash: '10 6' });
    D.circle(X, Y, 7, { fill: '#fff', sw: 2.6 });
    return { X, Y };
  };
  const p1 = tang(0.1, 40, '', 'l');
  const p2 = tang(0.72, 85, '', 'l');
  D.text(p1.X + 32, p1.Y + 34, 'малые затраты:\nвысокая отдача', { nowrap: true, size: 19, anchor: 'start' });
  D.text(p2.X + 6, p2.Y + 62, 'большие затраты:\nотдача близка к нулю', { nowrap: true, size: 19, anchor: 'middle' });
  D.text(B.xa + B.w / 2 - 10, B.ya + 40, 'Затраты на канал', { nowrap: true, size: 20 });
  D.text(B.xa + 18, B.y0 - 8, 'Эффект', { nowrap: true, size: 20, anchor: 'start' });
  D.h = B.ya + 62;
  return D;
};
