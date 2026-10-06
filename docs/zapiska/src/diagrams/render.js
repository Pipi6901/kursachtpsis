// Запуск: node render.js [имя_диаграммы ...]  → img/<имя>.png (4x) и img/<имя>.svg
const fs = require('fs');
const path = require('path');
const PW = '/tmp/claude-0/-home-user-kursachtpsis/5de3212e-c10c-56ee-9d4c-838fa6bbc9e5/scratchpad/pw/node_modules/playwright-core';
const { chromium } = require(PW);
const OUT = path.join(__dirname, '..', '..', 'img');
(async () => {
  const names = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ deviceScaleFactor: 4, viewport: { width: 1500, height: 1200 } });
  await page.setContent('<html><body style="margin:0;background:#fff"><div id="root"></div></body></html>');
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'lib.js'), 'utf8') });
  for (const f of fs.readdirSync(__dirname).filter(f => /^d_.*\.js$/.test(f))) {
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, f), 'utf8') });
  }
  const all = await page.evaluate(() => Object.keys(window.DIAGRAMS));
  for (const name of (names.length ? names : all)) {
    const res = await page.evaluate(n => { const D = window.DIAGRAMS[n](); document.getElementById('root').innerHTML = D.svg(); return { w: D.w, h: D.h, warnings: D.warnings }; }, name);
    await page.setViewportSize({ width: Math.ceil(res.w), height: Math.ceil(res.h) });
    const svg = await page.evaluate(() => document.querySelector('#root svg').outerHTML);
    fs.writeFileSync(path.join(OUT, name + '.svg'), svg);
    await page.locator('#root svg').screenshot({ path: path.join(OUT, name + '.png') });
    console.log(name, res.w + 'x' + res.h, res.warnings.length ? 'ПРЕДУПРЕЖДЕНИЯ: ' + res.warnings.join(' | ') : 'ok');
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
