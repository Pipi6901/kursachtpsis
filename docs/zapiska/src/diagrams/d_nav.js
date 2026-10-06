window.DIAGRAMS = window.DIAGRAMS || {};

// Рисунок 3.15 — схема навигации по страницам клиентского приложения
window.DIAGRAMS.fig_3_15 = function () {
  const W = 1140, F = 20;
  const D = new Diagram(W, 830, { font: F });
  D.proc(10, 10, W - 20, 54, 'Главное меню в шапке каждой страницы: набор пунктов зависит от роли пользователя', { fill: '#eef3f8', size: 20 });
  // страница: заголовок и маршрут
  const page = (x, y, w, h, title, route) => {
    D.rect(x, y, w, h, { fill: '#fff', sw: 2.4, r: 6 });
    const size = D.fit(title, w - 20, h - 36, { size: 19, minSize: 16, bold: true });
    D.text(x + w / 2, y + 20 + (h - 36) / 2 - 2, title, { maxW: w - 20, size, bold: true });
    D.text(x + w / 2, y + h - 17, route, { nowrap: true, size: 16, italic: true });
    return { x, y, w, h, l: x, r: x + w, t: y, b: y + h, cx: x + w / 2, cy: y + h / 2 };
  };
  const zone = (x, y, w, h, title) => { D.group(x, y, w, h, '', { fill: '#f6f6f6', r: 10, dash: '10 7' }); D.text(x + 16, y + 24, title, { anchor: 'start', nowrap: true, bold: true, size: 20 }); };
  const lab = (x, y, t, o = {}) => D.text(x, y, t, { nowrap: true, size: 17, anchor: o.anchor || 'middle' });

  // зона A: без входа
  zone(10, 84, 540, 372, 'Без входа в систему');
  const pw = 230, ph = 70;
  const login = page(26, 124, pw, ph, 'Вход', '/login');
  const signup = page(300, 124, pw, ph, 'Регистрация', '/signup');
  const home = page(26, 240, pw, ph, 'Главная', '/');
  const rooms = page(300, 240, pw, ph, 'Доступные номера', '/rooms');
  const room = page(300, 356, pw, ph, 'Страница номера', '/rooms/:id');
  D.flow([[login.r, login.cy - 14], [signup.l, login.cy - 14]], { arrowLen: 12, sw: 2 });
  D.flow([[signup.l, login.cy + 14], [login.r, login.cy + 14]], { arrowLen: 12, sw: 2 });
  D.flow([[login.cx, login.b], [login.cx, home.t]], { arrowLen: 12, sw: 2 });
  lab(login.cx + 10, (login.b + home.t) / 2, 'вход', { anchor: 'start' });
  D.flow([[home.r, home.cy], [rooms.l, rooms.cy]], { arrowLen: 12, sw: 2 });
  D.flow([[rooms.cx, rooms.b], [rooms.cx, room.t]], { arrowLen: 12, sw: 2 });
  lab(rooms.cx + 10, (rooms.b + room.t) / 2, 'выбор номера', { anchor: 'start' });
  D.text(26, 392, 'Фильтр «Свободны на даты» — на странице «Доступные номера», календарь выбора дат — на странице номера', { anchor: 'start', maxW: 250, size: 17 });

  // зона B: пользователь
  zone(590, 84, 540, 372, 'Пользователь с входом');
  const my = page(606, 240, pw, ph, 'Мои брони', '/rooms/my');
  const rec = page(880, 240, 234, ph, 'Чек', '/receipt/:id');
  const prof = page(606, 124, pw, ph, 'Профиль', '/profile');
  D.flow([[room.r, room.cy], [my.cx, room.cy], [my.cx, my.b]], { arrowLen: 12, sw: 2 });
  lab(my.cx + 12, 350, 'аренда', { anchor: 'start' });
  D.flow([[my.r, my.cy], [rec.l, rec.cy]], { arrowLen: 12, sw: 2 });
  lab((my.r + rec.l) / 2, my.cy - 16, 'чек');

  // зона C: менеджер и администратор
  zone(10, 480, 540, 330, 'Менеджер и администратор');
  const fc = page(26, 524, 160, 100, 'Прогноз продаж', '/forecast');
  const cp = page(206, 524, 160, 100, 'Маркетинговые активности', '/forecast/campaigns');
  const md = page(386, 524, 148, 100, 'Модель и данные', '/forecast/model');
  D.flow([[fc.r, fc.cy - 12], [cp.l, fc.cy - 12]], { arrowLen: 11, sw: 2 });
  D.flow([[cp.l, fc.cy + 12], [fc.r, fc.cy + 12]], { arrowLen: 11, sw: 2 });
  D.flow([[cp.r, fc.cy - 12], [md.l, fc.cy - 12]], { arrowLen: 11, sw: 2 });
  D.flow([[md.l, fc.cy + 12], [cp.r, fc.cy + 12]], { arrowLen: 11, sw: 2 });
  lab(280, 650, 'вкладки раздела «Прогноз продаж»');
  const edit = page(26, 680, pw, ph, 'Правка номера', '/rooms/:id/edit');
  lab(26, 776, 'Раздел «Прогноз продаж» доступен ролям ADMIN и MANAGER', { anchor: 'start', size: 16 });

  // зона D: только администратор
  zone(590, 480, 540, 330, 'Только администратор');
  const usr = page(606, 524, 250, 80, 'Управление правами', '/users');
  const fin = page(880, 524, 234, 80, 'Финансовая статистика', '/stats');
  const an = page(606, 640, 250, 80, 'Аналитика', '/analytics');
  const add = page(880, 640, 234, 80, 'Добавление номера', '/rooms/add');
  D.text(606, 760, 'Показатели аналитики и статистики учитывают завершённые проживания', { anchor: 'start', maxW: 500, size: 17 });
  D.h = 826;
  return D;
};
