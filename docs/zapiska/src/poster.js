// Плакат 6.1: BPMN-модели AS-IS и TO-BE на листе А3 (альбомная ориентация).
// Запуск: node poster.js  → ../plakaty/ПЛ1_BPMN_AS-IS_TO-BE.pdf (векторный) и .png (просмотр)
// Схемы строятся из diagrams/poster_diagrams.js – те же процессы, что на рисунках 2.1 и 2.2 пояснительной записки.
const fs = require('fs');
const path = require('path');
const PW = '/tmp/claude-0/-home-user-kursachtpsis/5de3212e-c10c-56ee-9d4c-838fa6bbc9e5/scratchpad/pw/node_modules/playwright-core';
const { chromium } = require(PW);

const OUT = path.join(__dirname, '..', 'plakaty');
const NAME = 'ПЛ1_BPMN_AS-IS_TO-BE';

// размеры листа и компоновка, мм
const PAGE_W = 420, PAGE_H = 297, MARGIN = 10;
const TITLE_H = 12, TITLE_GAP = 7, LABEL_H = 8, LABEL_GAP = 3, BLOCK_GAP = 8;

const DIAG = path.join(__dirname, 'diagrams');

// Схемы строятся тем же генератором, что и рисунки записки (diagrams/lib*.js), но в плакатной компоновке (poster_diagrams.js)
async function buildDiagrams(browser) {
  const page = await browser.newPage();
  await page.setContent('<html><body style="margin:0;background:#fff"><div id="root"></div></body></html>');
  for (const f of ['lib.js', 'lib2.js', 'poster_diagrams.js']) await page.addScriptTag({ content: fs.readFileSync(path.join(DIAG, f), 'utf8') });
  const res = {};
  for (const n of ['poster_asis', 'poster_tobe']) {
    res[n] = await page.evaluate(name => { const D = window.DIAGRAMS[name](); return { svg: D.svg(), w: D.w, h: D.h, warnings: D.warnings, sizes: D.sizes || [] }; }, n);
    const r = res[n];
    r.svg = r.svg.replace(/<svg ([^>]*?)width="[\d.]+" height="[\d.]+"/, '<svg $1width="100%" height="100%"');
    console.log(n, r.w + 'x' + r.h, r.warnings.length ? 'ПРЕДУПРЕЖДЕНИЯ: ' + r.warnings.join(' | ') : 'ok');
    if (r.sizes.length) console.log('  уменьшен шрифт в блоках:', JSON.stringify(r.sizes));
  }
  await page.close();
  return res;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const diagrams = await buildDiagrams(browser);
  const asis = diagrams.poster_asis, tobe = diagrams.poster_tobe;
  // масштаб подбирается так, чтобы обе схемы вместе с подписями заняли лист
  const fixed = 2 * MARGIN + TITLE_H + TITLE_GAP + 2 * (LABEL_H + 2 * LABEL_GAP + LABEL_H) + BLOCK_GAP;
  const k = Math.min((PAGE_H - fixed) / (asis.h + tobe.h), (PAGE_W - 2 * MARGIN) / Math.max(asis.w, tobe.w));
  const mm = v => (v * k).toFixed(2) + 'mm';
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
    @page { size: ${PAGE_W}mm ${PAGE_H}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { width: ${PAGE_W}mm; height: ${PAGE_H}mm; padding: ${MARGIN}mm; font-family: "Liberation Sans", Arial, Helvetica, sans-serif; color: #000;
           display: flex; flex-direction: column; align-items: center; overflow: hidden; }
    .title { height: ${TITLE_H}mm; margin-bottom: ${TITLE_GAP}mm; font-size: 27pt; line-height: ${TITLE_H}mm; text-align: center; white-space: nowrap; }
    .block { display: flex; flex-direction: column; align-items: center; }
    .block + .block { margin-top: ${BLOCK_GAP}mm; }
    .label { height: ${LABEL_H}mm; font-size: 17pt; line-height: ${LABEL_H}mm; text-align: center; white-space: nowrap; }
    .label.top { margin-bottom: ${LABEL_GAP}mm; }
    .label.bottom { margin-top: ${LABEL_GAP}mm; }
    .fig svg { display: block; }
  </style></head><body>
    <div class="title">AS-IS и TO-BE модели процессов предметной области в нотации BPMN</div>
    <div class="block">
      <div class="label top">Схема бизнес-процесса планирования маркетинга и продаж гостиницы в состоянии AS-IS</div>
      <div class="fig" style="width:${mm(asis.w)};height:${mm(asis.h)}">${asis.svg}</div>
      <div class="label bottom">Рисунок 1</div>
    </div>
    <div class="block">
      <div class="label top">Схема бизнес-процесса планирования маркетинга и продаж гостиницы в состоянии TO-BE</div>
      <div class="fig" style="width:${mm(tobe.w)};height:${mm(tobe.h)}">${tobe.svg}</div>
      <div class="label bottom">Рисунок 2</div>
    </div>
  </body></html>`;

  fs.mkdirSync(OUT, { recursive: true });
  const page = await browser.newPage();
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(OUT, NAME + '.pdf'), width: PAGE_W + 'mm', height: PAGE_H + 'mm', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await browser.close();
  console.log(`масштаб схем ${k.toFixed(4)} мм/px; схема 1: ${(asis.w * k).toFixed(0)}x${(asis.h * k).toFixed(0)} мм, схема 2: ${(tobe.w * k).toFixed(0)}x${(tobe.h * k).toFixed(0)} мм`);
})().catch(e => { console.error(e); process.exit(1); });
