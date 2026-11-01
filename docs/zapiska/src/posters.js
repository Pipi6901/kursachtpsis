// Плакаты 6.2–6.6 (лист А3, альбомная ориентация, формат как у плаката 6.1): заголовок, схемы со своими подписями
// «Схема …» сверху и «Рисунок N» снизу. Запуск: node posters.js [номер плаката ...] → ../plakaty/ПЛ<N>_*.pdf и .png
// Схемы – те же файлы, что в пояснительной записке (../img/fig_*.svg, ui_*.png).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const PW = '/tmp/claude-0/-home-user-kursachtpsis/5de3212e-c10c-56ee-9d4c-838fa6bbc9e5/scratchpad/pw/node_modules/playwright-core';
const { chromium } = require(PW);

const IMG = path.join(__dirname, '..', 'img');
const OUT = path.join(__dirname, '..', 'plakaty');

// компоновка листа, мм
const PAGE_W = 420, PAGE_H = 297, MARGIN = 10, GAP_X = 8;
const TITLE_GAP = 6, SUB_H = 7, CAP_H = 7, ITEM_GAP = 5, LABEL_PT = 14, TITLE_PT = 26;
const ITEM_OH = SUB_H + 2 + 2 + CAP_H + ITEM_GAP;      // надпись сверху, отступы, подпись снизу, промежуток до следующего рисунка

// столбцы: wf – относительная ширина столбца; рисунки в столбце идут сверху вниз
const POSTERS = {
  2: { file: 'ПЛ2_Архитектура_ПС', title: 'Архитектура программного средства',
    columns: [
      { wf: 1, items: [
        { src: 'fig_3_1.svg', sub: 'Структурная схема программного средства' },
        { src: 'fig_2_3.svg', sub: 'Конвейер интеллектуальной обработки прогноза и оптимизации' }] },
      { wf: 1.25, items: [
        { src: 'fig_3_3.svg', sub: 'Модули интеллектуального сервиса' }] },
    ] },
  3: { file: 'ПЛ3_Модель_данных', title: 'Схема модели данных',
    columns: [
      { wf: 1, items: [{ src: 'fig_2_6.svg', sub: 'Логическая модель данных модуля прогнозирования' }] },
      { wf: 1.1, items: [{ src: 'fig_3_6.svg', sub: 'Физическая модель данных гостиничной подсистемы' }] },
    ] },
  4: { file: 'ПЛ4_Бизнес-логика', title: 'Организация бизнес-логики программного средства',
    columns: [
      { wf: 1, items: [
        { src: 'fig_3_2.svg', sub: 'Структура серверной части' },
        { src: 'fig_3_13.svg', sub: 'Состояния брони' }] },
      { wf: 1.28, items: [{ src: 'fig_3_8.svg', sub: 'Алгоритм получения прогноза' }] },
    ] },
  5: { file: 'ПЛ5_Интерфейсы_и_интеграция', title: 'Модели представления логики пользовательского и программных интерфейсов, а также интеграционных решений',
    columns: [
      { wf: 1, items: [
        { src: 'fig_3_15.svg', sub: 'Схема навигации по страницам приложения' },
        { src: 'fig_3_5.svg', sub: 'Последовательность обучения модели' }] },
      { wf: 1, items: [
        { src: 'fig_3_4.svg', sub: 'Последовательность получения прогноза' },
        { src: 'fig_2_5.svg', sub: 'Контекстная диаграмма программного средства' }] },
    ] },
  6: { file: 'ПЛ6_Скриншоты', title: 'Скриншоты рабочих окон программного средства',
    rows: [
      [{ src: 'ui_dashboard.png', sub: 'Панель прогноза' },
       { src: 'ui_channels.png', sub: 'Вклад маркетинговых каналов' },
       { src: 'ui_optimization.png', sub: 'Оптимизация бюджета' }],
      [{ src: 'ui_campaigns.png', sub: 'Маркетинговые активности' },
       { src: 'ui_model.png', sub: 'Модель и данные' },
       { src: 'ui_room.png', sub: 'Страница номера с календарём' }],
    ] },
};

function load(src) {
  const p = path.join(IMG, src);
  if (src.endsWith('.svg')) {
    let svg = fs.readFileSync(p, 'utf8');
    const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const w = +m[1], h = +m[2];
    svg = svg.replace(/<svg ([^>]*?)width="[\d.]+" height="[\d.]+"/, '<svg $1width="100%" height="100%"');
    return { html: svg, aspect: w / h };
  }
  const buf = fs.readFileSync(p);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  return { html: `<img src="data:image/png;base64,${buf.toString('base64')}" style="width:100%;height:100%;display:block">`, aspect: w / h };
}

function layoutRows(cfg, titleH) {
  // строки: у всех рисунков строки одна высота, ширина по пропорциям; высота подбирается по ширине листа и высоте листа
  const availW = PAGE_W - 2 * MARGIN, availH = PAGE_H - 2 * MARGIN - titleH - TITLE_GAP;
  const rows = cfg.rows.map(r => r.map(it => ({ ...it, ...load(it.src) })));
  const h0 = rows.map(r => (availW - GAP_X * (r.length - 1)) / r.reduce((a, it) => a + it.aspect, 0));
  const f = Math.min(1, (availH - rows.length * ITEM_OH + ITEM_GAP) / h0.reduce((a, b) => a + b, 0));
  return { rows, h: h0.map(h => h * f), availH };
}

function layout(cfg, titleH) {
  const availW = PAGE_W - 2 * MARGIN, availH = PAGE_H - 2 * MARGIN - titleH - TITLE_GAP;
  const cols = cfg.columns.map(c => ({ ...c, items: c.items.map(it => ({ ...it, ...load(it.src) })) }));
  // общий масштаб s (мм на единицу wf): влезть по ширине и по высоте каждого столбца
  let s = (availW - GAP_X * (cols.length - 1)) / cols.reduce((a, c) => a + c.wf, 0);
  for (const c of cols) {
    const inv = c.items.reduce((a, it) => a + 1 / it.aspect, 0);
    s = Math.min(s, (availH - c.items.length * ITEM_OH + ITEM_GAP) / (c.wf * inv));
  }
  return { cols, s, availH };
}

function htmlRows(lay, titleLines, titlePt, titleH) {
  let n = 0;
  const rowsHtml = lay.rows.map((r, ri) => `<div class="row">${r.map(it => {
    const w = it.aspect * lay.h[ri];
    return `<div class="item" style="width:${w.toFixed(2)}mm"><div class="sub">${it.sub}</div>
      <div class="fig framed" style="width:${w.toFixed(2)}mm;height:${lay.h[ri].toFixed(2)}mm">${it.html}</div>
      <div class="cap">Рисунок ${++n}</div></div>`;
  }).join('')}</div>`).join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
    @page { size: ${PAGE_W}mm ${PAGE_H}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { width: ${PAGE_W}mm; height: ${PAGE_H}mm; padding: ${MARGIN}mm; font-family: "Liberation Sans", Arial, Helvetica, sans-serif; color: #000; overflow: hidden; }
    .title { height: ${titleH}mm; margin-bottom: ${TITLE_GAP}mm; font-size: ${titlePt}pt; line-height: 1.15; text-align: center; display: flex; align-items: center; justify-content: center; }
    .rows { display: flex; flex-direction: column; align-items: center; height: ${lay.availH}mm; }
    .row { display: flex; gap: ${GAP_X}mm; align-items: flex-start; }
    .row + .row { margin-top: ${ITEM_GAP}mm; }
    .item { display: flex; flex-direction: column; align-items: center; }
    .sub { height: ${SUB_H}mm; font-size: ${LABEL_PT}pt; line-height: ${SUB_H}mm; margin-bottom: 2mm; text-align: center; white-space: nowrap; }
    .cap { height: ${CAP_H}mm; font-size: ${LABEL_PT}pt; line-height: ${CAP_H}mm; margin-top: 2mm; text-align: center; }
    .framed { outline: 0.25mm solid #8a8a8a; }
  </style></head><body>
    <div class="title">${titleLines.join('<br>')}</div>
    <div class="rows">${rowsHtml}</div>
  </body></html>`;
}

function html(cfg, lay, titleLines, titlePt, titleH) {
  const itemHtml = (it, w) => `<div class="item"><div class="sub">${it.sub}</div>
      <div class="fig" style="width:${w.toFixed(2)}mm;height:${(w / it.aspect).toFixed(2)}mm">${it.html}</div>
      <div class="cap">Рисунок ${it.n}</div></div>`;
  let n = 0;
  const colsHtml = lay.cols.map(c => {
    const w = c.wf * lay.s;
    return `<div class="col" style="width:${w.toFixed(2)}mm">${c.items.map(it => itemHtml({ ...it, n: ++n }, w)).join('')}</div>`;
  }).join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
    @page { size: ${PAGE_W}mm ${PAGE_H}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { width: ${PAGE_W}mm; height: ${PAGE_H}mm; padding: ${MARGIN}mm; font-family: "Liberation Sans", Arial, Helvetica, sans-serif; color: #000; overflow: hidden; }
    .title { height: ${titleH}mm; margin-bottom: ${TITLE_GAP}mm; font-size: ${titlePt}pt; line-height: 1.15; text-align: center; display: flex; align-items: center; justify-content: center; }
    .cols { display: flex; justify-content: center; align-items: flex-start; gap: ${GAP_X}mm; height: ${lay.availH}mm; }
    .col { display: flex; flex-direction: column; align-items: center; }
    .item { display: flex; flex-direction: column; align-items: center; width: 100%; }
    .item + .item { margin-top: ${ITEM_GAP}mm; }
    .sub { height: ${SUB_H}mm; font-size: ${LABEL_PT}pt; line-height: ${SUB_H}mm; margin-bottom: 2mm; text-align: center; white-space: nowrap; }
    .cap { height: ${CAP_H}mm; font-size: ${LABEL_PT}pt; line-height: ${CAP_H}mm; margin-top: 2mm; text-align: center; }
    .fig svg { display: block; }
  </style></head><body>
    <div class="title">${titleLines.join('<br>')}</div>
    <div class="cols">${colsHtml}</div>
  </body></html>`;
}

(async () => {
  const want = process.argv.slice(2).map(Number);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  fs.mkdirSync(OUT, { recursive: true });
  for (const [num, cfg] of Object.entries(POSTERS)) {
    if (want.length && !want.includes(+num)) continue;
    const page = await browser.newPage();
    // заголовок плаката: одна строка, а если не помещается, то две строки меньшим шрифтом
    await page.setContent('<html><body></body></html>');
    const fits = await page.evaluate(([t, pt]) => {
      const s = document.createElement('span');
      s.style.cssText = `font:${pt}pt "Liberation Sans";white-space:nowrap;position:absolute`;
      s.textContent = t; document.body.appendChild(s);
      return s.getBoundingClientRect().width / 96 * 25.4;
    }, [cfg.title, TITLE_PT]);
    let titleLines = [cfg.title], titlePt = TITLE_PT, titleH = 12;
    if (fits > PAGE_W - 2 * MARGIN - 6) {
      const words = cfg.title.split(' ');
      let best = 0, bestDiff = 1e9, acc = 0;
      const total = cfg.title.length;
      words.forEach((w, i) => { acc += w.length + 1; const d = Math.abs(acc - total / 2); if (d < bestDiff && i < words.length - 1) { bestDiff = d; best = i; } });
      titleLines = [words.slice(0, best + 1).join(' '), words.slice(best + 1).join(' ')];
      titlePt = 24; titleH = 21;
    }
    let lay, doc;
    if (cfg.rows) { lay = layoutRows(cfg, titleH); doc = htmlRows(lay, titleLines, titlePt, titleH); }
    else { lay = layout(cfg, titleH); doc = html(cfg, lay, titleLines, titlePt, titleH); }
    await page.setContent(doc);
    await page.evaluate(() => document.fonts.ready);
    const pdf = path.join(OUT, cfg.file + '.pdf');
    await page.pdf({ path: pdf, width: PAGE_W + 'mm', height: PAGE_H + 'mm', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    await page.close();
    execFileSync('pdftoppm', ['-r', '150', '-png', '-singlefile', pdf, path.join(OUT, cfg.file)]);
    const info = lay.cols ? 'ширина столбцов ' + lay.cols.map(c => (c.wf * lay.s).toFixed(0) + ' мм').join(', ')
                          : 'высота строк ' + lay.h.map(h => h.toFixed(0) + ' мм').join(', ');
    console.log(`ПЛ${num}: ${cfg.file}; ${info}; заголовок ${titleLines.length} стр.`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
