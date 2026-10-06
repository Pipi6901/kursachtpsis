// Снимки интерфейса для записки: PW_CORE=<путь к playwright-core> node screenshots.js
// Нужны запущенные клиент (4200), сервер (8080) и демонстрационные пользователи guest, manager, admin (пароль 100).
// Результат: img/shots/*-all.png и boxes.json; затем нужные фрагменты вырезаются в img/ui_*.png (см. README).
const { chromium } = require(process.env.PW_CORE || 'playwright-core');
const OUT = require('path').join(__dirname, '..', 'img', 'shots');
require('fs').mkdirSync(OUT, { recursive: true });
const api = 'http://localhost:8080';
const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const login = async (u) => (await (await fetch(api + '/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: '100' }) })).json());
(async () => {
  const tokens = {};
  for (const u of ['guest', 'manager', 'admin']) tokens[u] = await login(u);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ['--no-sandbox', '--lang=ru'], env: { ...process.env, LANG: 'ru_RU.UTF-8', LANGUAGE: 'ru', LC_ALL: 'ru_RU.UTF-8' } });
  const open = async (who, path, wait = 2500) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 5200 }, deviceScaleFactor: 2, locale: 'ru-RU', timezoneId: 'Europe/Minsk' });
    if (who) await ctx.addInitScript(([t, r]) => { localStorage.setItem('Token', t); localStorage.setItem('roles', JSON.stringify(r)); }, [tokens[who].token, tokens[who].roles]);
    const page = await ctx.newPage();
    await page.route(/\/(null|undefined)$|:8080\/img\//, (r) => r.fulfill({ path: require('path').join(__dirname, 'room-placeholder.png'), contentType: 'image/png' }));
    await page.goto('http://localhost:4200' + path, { waitUntil: 'load' });
    await page.waitForTimeout(wait);
    const ph = 'data:image/png;base64,' + require('fs').readFileSync(require('path').join(__dirname, 'room-placeholder.png')).toString('base64');
    await page.evaluate((src) => document.querySelectorAll('img').forEach((i) => { if (i.naturalWidth === 0 && i.closest('.room-item, .room-details-item')) i.src = src; }), ph);
    await page.waitForTimeout(400);
    return { page, ctx };
  };
  const boxes = {};
  const mark = async (page, name, sel) => { await page.evaluate(() => { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }); await page.waitForTimeout(300); const n = await page.locator(sel).count(); const arr = [];
    for (let k = 0; k < n; k++) { const b = await page.locator(sel).nth(k).boundingBox(); const sy = await page.evaluate(() => window.scrollY); arr.push({ x: b.x, y: b.y + sy, w: b.width, h: b.height }); }
    boxes[name] = arr; };
  // панель прогноза
  let { page, ctx } = await open('admin', '/forecast', 3500);
  // оптимизация
  await page.locator('text=Рассчитать распределение').click();
  await page.waitForTimeout(2500);
  await mark(page, 'dash_cards', '.fc-card'); await mark(page, 'dash_toolbar', '.fc-toolbar'); await mark(page, 'dash_kpis', '.fc-kpis'); await mark(page, 'dash_header', 'h2');
  await page.screenshot({ path: `${OUT}/dashboard-all.png`, fullPage: false });
  await ctx.close();
  // кампании, модель
  ({ page, ctx } = await open('admin', '/forecast/campaigns', 2500));
  await mark(page, 'camp_cards', '.fc-card'); await page.screenshot({ path: `${OUT}/campaigns-all.png`, fullPage: false });
  await ctx.close();
  ({ page, ctx } = await open('admin', '/forecast/model', 3000));
  await mark(page, 'model_cards', '.fc-card'); await page.screenshot({ path: `${OUT}/model-all.png`, fullPage: false });
  await ctx.close();
  // номера: фильтр и календарь
  ({ page, ctx } = await open('guest', '/rooms', 2500));
  await page.fill('input[type=date] >> nth=0', iso(40));
  await page.fill('input[type=date] >> nth=1', iso(43));
  await page.waitForTimeout(1200);
  await page.mouse.click(5, 5);
  await page.waitForTimeout(300);
  await mark(page, 'rooms_items', '.room-item'); await mark(page, 'rooms_filter', 'text=Свободны на даты'); await page.screenshot({ path: `${OUT}/rooms-all.png`, fullPage: false });
  await ctx.close();
  ({ page, ctx } = await open('guest', '/rooms/3', 2500));
  const sel = async (n1, n2) => {
    const f = iso(n1), t = iso(n2);
    const mf = f.slice(0, 7), nowm = iso(0).slice(0, 7);
    if (mf !== nowm) await page.click('button[aria-label="Следующий месяц"]');
    await page.locator(`button.drp-day[aria-label="${f}"]`).click();
    if (t.slice(0, 7) !== mf) await page.click('button[aria-label="Следующий месяц"]');
    await page.locator(`button.drp-day[aria-label="${t}"]`).click();
  };
  await sel(40, 43);
  await page.waitForTimeout(500);
  await mark(page, 'room_booking', '.room-booking'); await page.screenshot({ path: `${OUT}/room-all.png`, fullPage: false });
  await ctx.close();
  ({ page, ctx } = await open('guest', '/rooms/my', 2500));
  await page.screenshot({ path: `${OUT}/my-rooms-all.png`, fullPage: false });
  await ctx.close();
  require('fs').writeFileSync(`${OUT}/boxes.json`, JSON.stringify(boxes, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
