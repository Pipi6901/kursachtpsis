// Мини-библиотека для чётких диаграмм (BPMN, UML, ER, схемы) на SVG.
// Выполняется в Chromium: текст измеряется через canvas, слова не разрываются, переносы считаются по ширине фигуры.
(function () {
  const FONT = '"Liberation Sans", Arial, Helvetica, sans-serif';
  const ctx = document.createElement('canvas').getContext('2d');

  class Diagram {
    constructor(w, h, opts = {}) {
      this.w = w; this.h = h;
      this.font = opts.font || 24;
      this.stroke = opts.stroke || 2.4;
      this.parts = [];
      this.warnings = [];
      this.boxes = [];      // для проверки наложений подписей
    }
    // ---------------------------------------------------------------- текст
    measure(text, size, bold) {
      ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
      return ctx.measureText(text).width;
    }
    wrap(text, maxW, size, bold) {
      const lines = [];
      for (const para of String(text).split('\n')) {
        let cur = '';
        for (const word of para.split(/\s+/).filter(Boolean)) {
          const t = cur ? cur + ' ' + word : word;
          if (this.measure(t, size, bold) <= maxW || !cur) {
            if (!cur && this.measure(word, size, bold) > maxW + 0.5) {
              this.warnings.push(`слово «${word}» шире области (${Math.round(this.measure(word, size, bold))} > ${Math.round(maxW)})`);
            }
            cur = t;
          } else { lines.push(cur); cur = word; }
        }
        lines.push(cur);
      }
      return lines;
    }
    esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    // многострочный текст, центр по (cx, cy); вернуть высоту
    text(cx, cy, text, o = {}) {
      const size = o.size || this.font, lh = size * (o.lh || 1.22);
      const lines = o.nowrap ? String(text).split('\n') : this.wrap(text, o.maxW || 9999, size, o.bold);
      const anchor = o.anchor || 'middle';
      const total = lines.length * lh;
      let y0 = o.top ? cy + lh / 2 : cy - total / 2 + lh / 2;
      if (o.bottom) y0 = cy - total + lh / 2;
      const rot = o.rotate ? ` transform="rotate(${o.rotate} ${cx} ${cy})"` : '';
      let out = `<g${rot}>`;
      lines.forEach((ln, i) => {
        out += `<text x="${cx}" y="${y0 + i * lh}" font-family='${FONT}' font-size="${size}" text-anchor="${anchor}" dominant-baseline="central"` +
          `${o.bold ? ' font-weight="bold"' : ''}${o.italic ? ' font-style="italic"' : ''} fill="${o.fill || '#000'}">${this.esc(ln)}</text>`;
      });
      out += '</g>';
      this.parts.push(out);
      const wmax = Math.max(...lines.map(l => this.measure(l, size, o.bold)));
      return { w: wmax, h: total, lines: lines.length };
    }
    // подпись на связи: белая подложка, чтобы линии не пересекали текст
    label(cx, cy, text, o = {}) {
      const size = o.size || this.font * 0.92;
      const lines = o.maxW ? this.wrap(text, o.maxW, size) : String(text).split('\n');
      const lh = size * 1.2, w = Math.max(...lines.map(l => this.measure(l, size))) + 12, h = lines.length * lh + 6;
      this.parts.push(`<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" fill="#fff" opacity="${o.opacity ?? 1}"/>`);
      this.text(cx, cy, lines.join('\n'), { size, nowrap: true, bold: o.bold, italic: o.italic });
      return { x: cx - w / 2, y: cy - h / 2, w, h };
    }
    // ---------------------------------------------------------------- примитивы
    rect(x, y, w, h, o = {}) {
      this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r || 0}" fill="${o.fill || '#fff'}" stroke="${o.stroke === null ? 'none' : (o.stroke || '#000')}" stroke-width="${o.sw || this.stroke}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`);
    }
    line(x1, y1, x2, y2, o = {}) {
      this.parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.stroke || '#000'}" stroke-width="${o.sw || this.stroke}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''} stroke-linecap="round"/>`);
    }
    circle(cx, cy, r, o = {}) {
      this.parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${o.fill || '#fff'}" stroke="${o.stroke || '#000'}" stroke-width="${o.sw || this.stroke}"/>`);
    }
    poly(points, o = {}) {
      this.parts.push(`<polygon points="${points.map(p => p.join(',')).join(' ')}" fill="${o.fill || '#fff'}" stroke="${o.stroke || '#000'}" stroke-width="${o.sw || this.stroke}" stroke-linejoin="round"/>`);
    }
    arrowHead(x, y, dir, o = {}) {      // dir: 'r','l','u','d'
      const L = o.len || 15, W = o.wid || 7;
      const pts = { r: [[x, y], [x - L, y - W], [x - L, y + W]], l: [[x, y], [x + L, y - W], [x + L, y + W]],
                    d: [[x, y], [x - W, y - L], [x + W, y - L]], u: [[x, y], [x - W, y + L], [x + W, y + L]] }[dir];
      this.poly(pts, { fill: o.open ? '#fff' : '#000', sw: o.open ? 2 : 1 });
    }
    // ломаная связь по заданным точкам; последний сегмент заканчивается стрелкой
    flow(points, o = {}) {
      const pts = points.map(p => p.slice());
      const n = pts.length;
      const last = pts[n - 1], prev = pts[n - 2];
      let dir = last[0] > prev[0] ? 'r' : last[0] < prev[0] ? 'l' : last[1] > prev[1] ? 'd' : 'u';
      const L = o.noArrow ? 0 : (o.arrowLen || 15);
      const end = last.slice();
      if (!o.noArrow) { if (dir === 'r') end[0] -= L - 1; if (dir === 'l') end[0] += L - 1; if (dir === 'd') end[1] -= L - 1; if (dir === 'u') end[1] += L - 1; }
      const d = pts.slice(0, n - 1).map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ') + ` L${end[0]} ${end[1]}`;
      this.parts.push(`<path d="${d}" fill="none" stroke="${o.stroke || '#000'}" stroke-width="${o.sw || this.stroke}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`);
      if (o.startDot) this.circle(pts[0][0], pts[0][1], 5, { fill: '#fff', sw: 2 });
      if (!o.noArrow) this.arrowHead(last[0], last[1], dir, { open: o.openArrow });
      if (o.label) this.label(o.label.x ?? (pts[0][0] + last[0]) / 2, o.label.y ?? (pts[0][1] + last[1]) / 2, o.label.text, o.label);
    }
    // ---------------------------------------------------------------- BPMN
    task(x, y, w, h, text, o = {}) {
      this.rect(x, y, w, h, { r: 14, fill: o.fill || '#fff', sw: o.sw || 2.6 });
      const pad = o.pad || 10;
      let size = o.size || this.font;
      // автоподбор размера: текст должен помещаться и по ширине слов, и по высоте
      const fits = (sz) => {
        const ls = this.wrap(text, w - 2 * pad, sz, o.bold);
        const okW = ls.every(l => this.measure(l, sz, o.bold) <= w - 2 * pad + 0.5);
        return okW && ls.length * sz * 1.22 <= h - 12;
      };
      const saved = this.warnings.length;
      while (size > (o.minSize || 17) && !fits(size)) size -= 0.5;
      this.warnings.length = saved;
      const t = this.text(x + w / 2, y + h / 2 + (o.dy || 0), text, { maxW: w - 2 * pad, size, bold: o.bold });
      if (t.h > h - 8) this.warnings.push(`текст «${text}» не помещается по высоте (${Math.round(t.h)} > ${h - 8})`);
      if (size < (o.size || this.font)) this.sizes = (this.sizes || []).concat([[text.slice(0, 24), size]]);
      return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, l: x, r: x + w, t: y, b: y + h };
    }
    tag(x, y, text, o = {}) {      // короткая подпись рядом с линией (без подложки)
      const side = o.side || 'right', size = o.size || this.font * 0.92, off = o.off || 10;
      const w = this.measure(text, size);
      if (side === 'right') this.text(x + off, y, text, { anchor: 'start', nowrap: true, size, bold: o.bold });
      else if (side === 'left') this.text(x - off, y, text, { anchor: 'end', nowrap: true, size, bold: o.bold });
      else if (side === 'above') this.text(x, y - off - size / 2, text, { nowrap: true, size, bold: o.bold });
      else this.text(x, y + off + size / 2, text, { nowrap: true, size, bold: o.bold });
    }
    startEvent(cx, cy, label, o = {}) {
      const r = o.r || 24; this.circle(cx, cy, r, { sw: 2.4 });
      if (label) this.text(cx, cy + r + 10 + (o.ly || 0), label, { top: true, maxW: o.maxW || 150, size: o.size || this.font * 0.9 });
      return { cx, cy, l: cx - r, r: cx + r, t: cy - r, b: cy + r };
    }
    endEvent(cx, cy, label, o = {}) {
      const r = o.r || 24; this.circle(cx, cy, r, { sw: 6 });
      if (label) this.text(cx, cy + r + 12 + (o.ly || 0), label, { top: true, maxW: o.maxW || 150, size: o.size || this.font * 0.9 });
      return { cx, cy, l: cx - r, r: cx + r, t: cy - r, b: cy + r };
    }
    gateway(cx, cy, type, label, o = {}) {      // type: 'xor' | 'and'
      const s = o.s || 34;
      this.poly([[cx, cy - s], [cx + s, cy], [cx, cy + s], [cx - s, cy]], { sw: 2.6 });
      if (type === 'xor') { const k = s * 0.42; this.line(cx - k, cy - k, cx + k, cy + k, { sw: 5 }); this.line(cx - k, cy + k, cx + k, cy - k, { sw: 5 }); }
      if (type === 'and') { const k = s * 0.5; this.line(cx - k, cy, cx + k, cy, { sw: 5 }); this.line(cx, cy - k, cx, cy + k, { sw: 5 }); }
      if (label) {
        const pos = o.labelPos || 'below';
        const maxW = o.maxW || 170, size = o.size || this.font * 0.9;
        if (pos === 'below') this.text(cx, cy + s + 10, label, { top: true, maxW, size });
        else if (pos === 'above') this.text(cx, cy - s - 10, label, { bottom: true, maxW, size });
        else if (pos === 'right') this.text(cx + s + 10, cy, label, { anchor: 'start', maxW, size });
        else if (pos === 'left') this.text(cx - s - 10, cy, label, { anchor: 'end', maxW, size });
      }
      return { cx, cy, l: cx - s, r: cx + s, t: cy - s, b: cy + s };
    }
    dataStore(cx, cy, w, h, label, o = {}) {      // цилиндр
      const rx = w / 2, ry = Math.min(14, h / 5), x = cx - rx, y = cy - h / 2;
      this.parts.push(`<path d="M${x} ${y + ry} L${x} ${y + h - ry} A${rx} ${ry} 0 0 0 ${x + w} ${y + h - ry} L${x + w} ${y + ry} A${rx} ${ry} 0 0 0 ${x} ${y + ry} Z" fill="${o.fill || '#fff'}" stroke="#000" stroke-width="2.4"/>` +
        `<path d="M${x} ${y + ry} A${rx} ${ry} 0 0 0 ${x + w} ${y + ry}" fill="none" stroke="#000" stroke-width="2.4"/>`);
      this.text(cx, cy + ry * 0.8, label, { maxW: w - 20, size: o.size || this.font * 0.9 });
      return { cx, cy, l: x, r: x + w, t: y, b: y + h };
    }
    // ---------------------------------------------------------------- дорожки
    pool(x, y, w, titleW, title, lanes, o = {}) {      // lanes: [{name, h}], возвращает {laneTop:[], laneH:[]}
      const totalH = lanes.reduce((s, l) => s + l.h, 0);
      this.rect(x, y, w, totalH, { sw: 2.8 });
      this.line(x + titleW, y, x + titleW, y + totalH, { sw: 2.8 });
      this.text(x + titleW / 2, y + totalH / 2, title, { rotate: -90, nowrap: true, bold: true, size: o.titleSize || this.font });
      let cy = y; const res = [];
      lanes.forEach((ln, i) => {
        res.push({ top: cy, h: ln.h, mid: cy + ln.h / 2, bottom: cy + ln.h });
        if (i > 0) this.line(x + titleW, cy, x + w, cy, { sw: 2.2 });
        cy += ln.h;
      });
      // подписи дорожек (вертикальные) во втором столбце
      const laneTitleW = o.laneTitleW || 0;
      if (laneTitleW) {
        this.line(x + titleW + laneTitleW, y, x + titleW + laneTitleW, y + totalH, { sw: 2.2 });
        lanes.forEach((ln, i) => this.text(x + titleW + laneTitleW / 2, res[i].mid, ln.name, { rotate: -90, nowrap: false, maxW: ln.h - 16, size: o.laneSize || this.font * 0.95, bold: true }));
      }
      return res;
    }

    // ---------------------------------------------------------------- UML / ER / общие
    path(d, o = {}) {
      this.parts.push(`<path d="${d}" fill="${o.fill || 'none'}" stroke="${o.stroke === null ? 'none' : (o.stroke || '#000')}" stroke-width="${o.sw || this.stroke}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`);
    }
    ellipse(cx, cy, rx, ry, o = {}) {
      this.parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${o.fill || '#fff'}" stroke="${o.stroke || '#000'}" stroke-width="${o.sw || 2.4}"/>`);
    }
    actor(cx, top, label, o = {}) {       // человечек UML; top — верх головы
      const r = 15;
      this.circle(cx, top + r, r, { sw: 2.6 });
      this.line(cx, top + 2 * r, cx, top + 2 * r + 38, { sw: 2.6 });
      this.line(cx - 26, top + 2 * r + 14, cx + 26, top + 2 * r + 14, { sw: 2.6 });
      this.line(cx, top + 2 * r + 38, cx - 22, top + 2 * r + 76, { sw: 2.6 });
      this.line(cx, top + 2 * r + 38, cx + 22, top + 2 * r + 76, { sw: 2.6 });
      this.text(cx, top + 2 * r + 76 + 14, label, { top: true, maxW: o.maxW || 190, size: o.size || this.font * 0.95, bold: true });
      return { cx, cy: top + 2 * r + 20, l: cx - 28, r: cx + 28, t: top, b: top + 2 * r + 76 };
    }
    useCase(cx, cy, rx, ry, text, o = {}) {
      this.ellipse(cx, cy, rx, ry);
      const size = o.size || this.font * 0.92;
      let sz = size;
      const w = rx * 1.55;
      while (sz > 16 && this.wrap(text, w, sz).length * sz * 1.2 > ry * 1.75) sz -= 0.5;
      this.text(cx, cy, text, { maxW: w, size: sz });
      return { cx, cy, rx, ry };
    }
    // «воронья лапка»: точка (x,y) на границе сущности, dir — направление наружу, kind: 'one' | 'many' | 'zero-many'
    crow(x, y, dir, kind) {
      const v = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] }[dir];
      const n = [-v[1], v[0]];
      const at = (a, b) => [x + v[0] * a + n[0] * b, y + v[1] * a + n[1] * b];
      const seg = (p, q) => this.line(p[0], p[1], q[0], q[1], { sw: 2.4 });
      if (kind === 'one') { seg(at(16, -11), at(16, 11)); seg(at(26, -11), at(26, 11)); }
      if (kind === 'many') { seg(at(22, 0), at(0, -13)); seg(at(22, 0), at(0, 0)); seg(at(22, 0), at(0, 13)); seg(at(26, -12), at(26, 12)); }
      if (kind === 'zero-many') { seg(at(22, 0), at(0, -13)); seg(at(22, 0), at(0, 0)); seg(at(22, 0), at(0, 13)); const c = at(34, 0); this.circle(c[0], c[1], 7, { sw: 2.2 }); }
    }
    entity(x, y, w, title, rows, o = {}) {      // rows: [[ключ, имя, тип]]; ключ: 'PK' | 'FK' | 'UK' | ''
      const size = o.size || this.font * 0.9, rh = o.rh || size * 1.38, th = size * 1.9;
      const h = th + rows.length * rh + 8;
      this.rect(x, y, w, h, { sw: 2.4 });
      this.rect(x, y, w, th, { fill: '#e8e8e8', sw: 2.4 });
      this.text(x + w / 2, y + th / 2, title, { bold: true, nowrap: true, size: size * 1.04 });
      const mk = Math.max(...rows.map(r => (r[0] || '').length));
      const kw = Math.max(size * 2.5, mk * size * 0.86 * 0.66 + 18);
      this.line(x + kw, y + th, x + kw, y + h, { sw: 1.4 });
      rows.forEach((r, i) => {
        const cy = y + th + 4 + i * rh + rh / 2;
        if (r[0]) this.text(x + 8, cy, r[0], { anchor: 'start', nowrap: true, size: size * 0.86, bold: true });
        this.text(x + kw + 10, cy, r[1], { anchor: 'start', nowrap: true, size });
        if (r[2]) this.text(x + w - 8, cy, r[2], { anchor: 'end', nowrap: true, size: size * 0.86, fill: '#333' });
      });
      return { x, y, w, h, l: x, r: x + w, t: y, b: y + h, cx: x + w / 2, cy: y + h / 2, rowY: i => y + th + 4 + i * rh + rh / 2 };
    }
    // ---------------------------------------------------------------- вывод
    svg() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}">` +
        `<rect width="100%" height="100%" fill="#fff"/>` + this.parts.join('') + '</svg>';
    }
  }
  window.Diagram = Diagram;
})();
