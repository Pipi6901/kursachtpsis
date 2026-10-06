// Расширение библиотеки диаграмм: блок-схемы (ГОСТ 19.701), диаграммы последовательности и состояний UML, компоненты.
(function () {
  const P = Diagram.prototype;
  const box = (x, y, w, h) => ({ x, y, w, h, l: x, r: x + w, t: y, b: y + h, cx: x + w / 2, cy: y + h / 2 });

  // Подбор размера шрифта: текст должен целиком помещаться в области w × h.
  P.fit = function (text, w, h, o = {}) {
    let size = o.size || this.font;
    const min = o.minSize || 17;
    const ok = (s) => {
      const ls = this.wrap(text, w, s, o.bold);
      return ls.every(l => this.measure(l, s, o.bold) <= w + 0.5) && ls.length * s * 1.22 <= h;
    };
    const saved = this.warnings.length;
    while (size > min && !ok(size)) size -= 0.5;
    this.warnings.length = saved;
    if (!ok(size)) this.warnings.push(`текст «${String(text).slice(0, 40)}» не помещается (${Math.round(w)}×${Math.round(h)})`);
    return size;
  };
  P.put = function (cx, cy, text, w, h, o = {}) {
    const size = this.fit(text, w, h, o);
    this.text(cx, cy + (o.dy || 0), text, { maxW: w, size, bold: o.bold, italic: o.italic, fill: o.textFill });
    return size;
  };

  // ---------------------------------------------------------------- блок-схемы
  P.proc = function (x, y, w, h, text, o = {}) {
    this.rect(x, y, w, h, { fill: o.fill || '#fff', sw: o.sw || 2.4, r: o.r || 0, dash: o.dash });
    this.put(x + w / 2, y + h / 2, text, w - 18, h - 12, o);
    return box(x, y, w, h);
  };
  P.term = function (cx, cy, w, h, text, o = {}) {
    this.rect(cx - w / 2, cy - h / 2, w, h, { fill: o.fill || '#fff', sw: o.sw || 2.4, r: h / 2 });
    this.put(cx, cy, text, w - h * 0.7, h - 10, o);
    return box(cx - w / 2, cy - h / 2, w, h);
  };
  P.dec = function (cx, cy, w, h, text, o = {}) {
    this.poly([[cx, cy - h / 2], [cx + w / 2, cy], [cx, cy + h / 2], [cx - w / 2, cy]], { fill: o.fill || '#fff', sw: o.sw || 2.4 });
    this.put(cx, cy, text, w * 0.62, h * 0.56, o);
    return box(cx - w / 2, cy - h / 2, w, h);
  };
  P.io = function (x, y, w, h, text, o = {}) {      // данные (параллелограмм)
    const k = Math.min(26, w * 0.12);
    this.poly([[x + k, y], [x + w, y], [x + w - k, y + h], [x, y + h]], { fill: o.fill || '#fff', sw: o.sw || 2.4 });
    this.put(x + w / 2, y + h / 2, text, w - 2 * k - 8, h - 12, o);
    return box(x, y, w, h);
  };
  P.pred = function (x, y, w, h, text, o = {}) {    // предопределённый процесс (с двойными боковыми линиями)
    this.rect(x, y, w, h, { fill: o.fill || '#fff', sw: o.sw || 2.4 });
    this.line(x + 14, y, x + 14, y + h, { sw: 2 }); this.line(x + w - 14, y, x + w - 14, y + h, { sw: 2 });
    this.put(x + w / 2, y + h / 2, text, w - 46, h - 12, o);
    return box(x, y, w, h);
  };
  P.conn = function (cx, cy, text, r = 17) {      // соединитель
    this.circle(cx, cy, r, { sw: 2.2 });
    this.text(cx, cy, text, { nowrap: true, size: 18, bold: true });
    return { cx, cy, l: cx - r, r: cx + r, t: cy - r, b: cy + r };
  };
  // подпись ветви рядом с линией: «Да» / «Нет»
  P.yn = function (x, y, text, o = {}) {
    this.text(x, y, text, { nowrap: true, size: o.size || this.font * 0.92, bold: false, anchor: o.anchor || 'middle' });
  };

  // ---------------------------------------------------------------- диаграмма последовательности
  P.lifeline = function (cx, top, bottom, title, o = {}) {
    const w = o.w || 150, h = o.h || 66;
    this.line(cx, top + h, cx, bottom, { sw: 1.8, dash: '9 7' });
    this.rect(cx - w / 2, top, w, h, { fill: o.fill || '#fff', sw: 2.4, r: 3 });
    this.put(cx, top + h / 2, title, w - 14, h - 10, { size: o.size || this.font * 0.95, bold: true, minSize: 16 });
    return { cx, top, h, bottom };
  };
  P.activation = function (cx, y1, y2, w = 14) {
    this.rect(cx - w / 2, y1, w, y2 - y1, { fill: '#fff', sw: 2 });
  };
  // сообщение между линиями жизни: подпись над стрелкой, ответ — штриховой
  P.msg = function (x1, x2, y, text, o = {}) {
    const dir = x2 > x1 ? 1 : -1;
    const sx = x1 + dir * (o.off1 ?? 7), ex = x2 - dir * (o.off2 ?? 7);
    this.flow([[sx, y], [ex, y]], { dash: o.dash ? '9 6' : null, openArrow: !!o.dash, sw: 2.2, arrowLen: 14 });
    if (text) {
      const size = o.size || this.font * 0.92;
      const maxW = Math.abs(ex - sx) - 16;
      const lines = this.wrap(text, maxW, size);
      const lh = size * 1.2;
      const cx = (sx + ex) / 2;
      const textBottom = y - 7;
      lines.forEach((ln, i) => {
        const ty = textBottom - (lines.length - 1 - i) * lh - lh / 2, tw = this.measure(ln, size) + 8;
        this.parts.push(`<rect x="${cx - tw / 2}" y="${ty - lh / 2 + 1}" width="${tw}" height="${lh - 2}" fill="#fff"/>`);
        this.text(cx, ty, ln, { nowrap: true, size, italic: false });
      });
    }
  };
  P.selfmsg = function (cx, y, text, o = {}) {      // сообщение самому себе
    const w = o.w || 56, h = o.h || 34, size = o.size || this.font * 0.92;
    this.flow([[cx + 7, y], [cx + 7 + w, y], [cx + 7 + w, y + h], [cx + 7, y + h]], { sw: 2.2, arrowLen: 14 });
    this.text(cx + 7 + w + 10, y + h / 2, text, { anchor: 'start', maxW: o.maxW || 260, size });
  };
  // комбинированный фрагмент (alt, opt, loop): рамка с меткой в левом верхнем углу
  P.fragment = function (x, y, w, h, label, o = {}) {
    this.rect(x, y, w, h, { fill: 'none', sw: 2, stroke: '#333' });
    const lw = this.measure(label, 19, true) + 22, lh = 28;
    this.poly([[x, y], [x + lw, y], [x + lw, y + lh * 0.55], [x + lw - 11, y + lh], [x, y + lh]], { fill: '#fff', sw: 2, stroke: '#333' });
    this.text(x + 10, y + lh / 2, label, { anchor: 'start', nowrap: true, size: 19, bold: true });
    const tag = (tx, ty, text) => {
      const w = this.measure(text, 18) + 10;
      this.parts.push(`<rect x="${tx - 4}" y="${ty - 12}" width="${w}" height="24" fill="#fff"/>`);
      this.text(tx, ty, text, { anchor: 'start', nowrap: true, size: 18, italic: true });
    };
    if (o.guard) tag(x + lw + 8, y + lh / 2, o.guard);
    (o.dividers || []).forEach(d => {
      this.line(x, d.y, x + w, d.y, { sw: 1.8, dash: '10 7', stroke: '#333' });
      if (d.text) tag(x + 12, d.y + 17, d.text);
    });
  };

  // ---------------------------------------------------------------- вертикальная блок-схема по описанию
  // items: [{t:'term'|'proc'|'io'|'dec'|'pred', text, h, w, no:{text,t,label,h,w}, yes:'Да'}]
  P.vflow = function (items, o) {
    const cx = o.cx, gap = o.gap || 36, w = o.w || 400, dw = o.dw || w + 50;
    const bx = o.bx, bw = o.bw || 340;
    const H = { term: 46, proc: 68, io: 66, dec: 100, pred: 68 };
    let y = o.y0 || 16;
    const nodes = [];
    items.forEach((it) => {
      const h = it.h || H[it.t];
      const ww = it.w || (it.t === 'dec' ? dw : w);
      let n;
      if (it.t === 'term') n = this.term(cx, y + h / 2, ww, h, it.text, it.o || {});
      else if (it.t === 'proc') n = this.proc(cx - ww / 2, y, ww, h, it.text, it.o || {});
      else if (it.t === 'io') n = this.io(cx - ww / 2, y, ww, h, it.text, it.o || {});
      else if (it.t === 'pred') n = this.pred(cx - ww / 2, y, ww, h, it.text, it.o || {});
      else n = this.dec(cx, y + h / 2, ww, h, it.text, it.o || {});
      n.item = it;
      nodes.push(n);
      y += h + (it.gap || gap);
    });
    nodes.forEach((n, i) => {
      const it = n.item;
      if (i < nodes.length - 1) {
        this.flow([[cx, n.b], [cx, nodes[i + 1].t]], { arrowLen: 13, sw: 2 });
        if (it.t === 'dec' && it.yes !== false) this.yn(cx + 12, n.b + 17, it.yes || 'Да', { anchor: 'start' });
      }
      if (it.no) {
        const b = it.no, bh = b.h || (b.t === 'proc' ? 64 : 56), bww = b.w || bw;
        const bn = b.t === 'proc' ? this.proc(bx - bww / 2, n.cy - bh / 2, bww, bh, b.text, b.o || {})
          : this.term(bx, n.cy, bww, bh, b.text, b.o || {});
        this.flow([[n.r, n.cy], [bn.l, n.cy]], { arrowLen: 13, sw: 2 });
        this.yn((n.r + bn.l) / 2, n.cy - 15, b.label || 'Нет');
        n.branch = bn;
        if (b.join !== undefined) {
          const j = nodes[b.join];
          if (b.via) this.flow([[bn.r, n.cy], [b.via, n.cy], [b.via, j.cy], [j.r, j.cy]], { arrowLen: 13, sw: 2 });
          else this.flow([[bx, bn.b], [bx, j.cy], [j.r, j.cy]], { arrowLen: 13, sw: 2 });
        }
      }
    });
    this.endY = y - gap;
    return nodes;
  };

  // ---------------------------------------------------------------- диаграмма состояний
  P.state = function (x, y, w, h, text, o = {}) {
    this.rect(x, y, w, h, { fill: o.fill || '#fff', sw: 2.4, r: 20 });
    if (o.sub) {
      this.put(x + w / 2, y + 22, text, w - 20, 30, { bold: true, size: o.size || this.font, minSize: 17 });
      this.line(x, y + 38, x + w, y + 38, { sw: 1.6 });
      this.put(x + w / 2, y + 38 + (h - 38) / 2, o.sub, w - 20, h - 46, { size: this.font * 0.86, minSize: 15 });
    } else {
      this.put(x + w / 2, y + h / 2, text, w - 20, h - 12, { size: o.size || this.font, bold: o.bold });
    }
    return box(x, y, w, h);
  };
  P.initial = function (cx, cy, r = 11) { this.circle(cx, cy, r, { fill: '#000', sw: 1 }); return { cx, cy, l: cx - r, r: cx + r, t: cy - r, b: cy + r }; };
  P.final = function (cx, cy, r = 15) { this.circle(cx, cy, r, { fill: '#fff', sw: 2.4 }); this.circle(cx, cy, r - 6, { fill: '#000', sw: 1 }); return { cx, cy, l: cx - r, r: cx + r, t: cy - r, b: cy + r }; };

  // ---------------------------------------------------------------- компоненты / пакеты
  P.group = function (x, y, w, h, title, o = {}) {      // область с заголовком (узел, слой)
    this.rect(x, y, w, h, { fill: o.fill || '#f6f6f6', sw: o.sw || 2.4, r: o.r ?? 8, dash: o.dash });
    if (title) this.text(x + (o.tx ?? 16), y + (o.ty ?? 24), title, { anchor: o.center ? 'middle' : 'start', nowrap: true, bold: true, size: o.size || this.font * 1.02 });
    return box(x, y, w, h);
  };
  P.comp = function (x, y, w, h, text, o = {}) {      // компонент UML: прямоугольник со «вставками»
    this.rect(x, y, w, h, { fill: o.fill || '#fff', sw: 2.4 });
    if (!o.plain) {
      this.rect(x - 9, y + 12, 18, 9, { fill: '#fff', sw: 1.8 });
      this.rect(x - 9, y + 27, 18, 9, { fill: '#fff', sw: 1.8 });
    }
    this.put(x + w / 2, y + h / 2, text, w - 24, h - 12, o);
    return box(x, y, w, h);
  };
  P.iface = function (cx, cy, r = 9) { this.circle(cx, cy, r, { sw: 2 }); return { cx, cy }; };
  P.arrowdash = function (points, o = {}) { this.flow(points, { dash: '9 7', openArrow: true, sw: 2, ...o }); };
  window.__box = box;
})();
