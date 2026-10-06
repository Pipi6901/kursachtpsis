window.DIAGRAMS = window.DIAGRAMS || {};

// двунаправленная связь (стрелки на обоих концах)
function bi(D, pts, o = {}) {
  D.flow(pts, { noArrow: true, ...o });
  const dirOf = (a, b) => (b[0] > a[0] ? 'r' : b[0] < a[0] ? 'l' : b[1] > a[1] ? 'd' : 'u');
  const n = pts.length;
  D.arrowHead(pts[n - 1][0], pts[n - 1][1], dirOf(pts[n - 2], pts[n - 1]));
  const rev = { r: 'l', l: 'r', d: 'u', u: 'd' };
  D.arrowHead(pts[0][0], pts[0][1], rev[dirOf(pts[0], pts[1])]);
}
window.__bi = bi;

// Рисунок 3.1 — структурная схема программного средства (узлы развёртывания)
window.DIAGRAMS.fig_3_1 = function () {
  const W = 1140, H = 800, F = 20;
  const D = new Diagram(W, H, { font: F });
  const n1 = D.group(10, 20, 210, 580, 'Узел 1. Клиент');
  const n2 = D.group(340, 20, 450, 580, 'Узел 2. Сервер приложений');
  const n3 = D.group(910, 20, 220, 580, 'Узел 3. Сервис ИИ');
  D.text(115, 62, 'браузер, Angular 21', { nowrap: true, size: 18, italic: true });
  D.text(565, 62, 'Java 17+, Spring Boot 4', { nowrap: true, size: 18, italic: true });
  D.text(1020, 62, 'Python 3.13, FastAPI', { nowrap: true, size: 18, italic: true });

  const cw = 186, cx0 = 22;
  const c1 = D.proc(cx0, 84, cw, 140, 'Страницы гостиницы: номера, бронирование, аналитика');
  const c2 = D.proc(cx0, 244, cw, 140, 'Раздел «Прогноз продаж»: панель, кампании, модель');
  const c3 = D.proc(cx0, 404, cw, 140, 'Маршрутизация, охранники, перехватчик токена');

  const sw = 418, sx = 356, sh = 78, gap = 22, sy = 84;
  const names = [
    'Безопасность: фильтр JWT, роли ADMIN, MANAGER, USER',
    'REST-контроллеры: /rooms, /reservations, /api/forecast',
    'Бизнес-логика: бронирование, кампании, продажи, сценарии, мониторинг',
    'Шлюз ИИ: тайм-ауты, повторы, предохранитель, кэш, упрощённый прогноз',
    'Доступ к данным: Spring Data JPA, Hibernate'];
  const S = names.map((t, i) => D.proc(sx, sy + i * (sh + gap), sw, sh, t));
  for (let i = 0; i < 4; i++) D.flow([[sx + sw / 2, S[i].b], [sx + sw / 2, S[i + 1].t]], { arrowLen: 12, sw: 2 });

  const mw = 196, mx = 922;
  const m1 = D.proc(mx, 84, mw, 100, 'API версии 1: проверка ключа X-API-Key и входных данных');
  const m2 = D.proc(mx, 206, mw, 100, 'Обучение: четыре алгоритма, скользящая проверка');
  const m3 = D.proc(mx, 328, mw, 100, 'Прогноз с интервалом, вклады каналов, оптимизатор');
  const reg = D.dataStore(mx + mw / 2, 512, mw, 124, 'Реестр моделей: файлы AES-256-GCM', { size: 18 });
  D.flow([[m1.cx, m1.b], [m1.cx, m2.t]], { arrowLen: 12, sw: 2 });
  D.flow([[m2.cx, m2.b], [m2.cx, m3.t]], { arrowLen: 12, sw: 2 });
  D.flow([[m3.cx, m3.b], [m3.cx, reg.t]], { arrowLen: 12, sw: 2 });

  // связи между узлами (на границах узлов)
  const ym = 300;
  bi(D, [[n1.r, ym], [n2.l, ym]]);
  D.text((n1.r + n2.l) / 2, ym - 40, 'HTTP(S)', { nowrap: true, size: 18 });
  D.text((n1.r + n2.l) / 2, ym - 18, 'JSON, JWT', { nowrap: true, size: 18 });
  bi(D, [[n2.r, ym], [n3.l, ym]]);
  D.text((n2.r + n3.l) / 2, ym - 62, 'REST,', { nowrap: true, size: 18 });
  D.text((n2.r + n3.l) / 2, ym - 40, 'JSON', { nowrap: true, size: 18 });
  D.text((n2.r + n3.l) / 2, ym + 24, 'X-API-Key,', { nowrap: true, size: 18 });
  D.text((n2.r + n3.l) / 2, ym + 46, 'TLS', { nowrap: true, size: 18 });

  // СУБД и копии
  const db = D.dataStore(565, 712, 260, 112, 'Узел 4. СУБД PostgreSQL: таблицы гостиницы, mk_*, fc_*', { size: 19 });
  bi(D, [[565, S[4].b], [565, db.t]]);
  D.text(583, (S[4].b + db.t) / 2 + 0, 'JDBC, SQL', { nowrap: true, size: 18, anchor: 'start' });
  const bk = D.dataStore(1000, 712, 250, 112, 'Хранилище шифрованных копий (AES-256-GCM)', { size: 19 });
  D.flow([[db.r, 712], [bk.l, 712]]);
  D.text((db.r + bk.l) / 2, 686, 'pg_dump', { nowrap: true, size: 18 });
  D.text((db.r + bk.l) / 2, 734, 'шифрование', { nowrap: true, size: 18 });
  return D;
};
