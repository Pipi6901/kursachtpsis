window.DIAGRAMS = window.DIAGRAMS || {};

// Рисунок 3.2 — структура серверной части
window.DIAGRAMS.fig_3_2 = function () {
  const W = 1140, F = 19;
  const D = new Diagram(W, 1040, { font: F });
  const sec = D.proc(10, 10, W - 20, 64, 'Сквозная безопасность: SecurityConfig, JwtRequestFilter, JwtTokenUtils, аннотации @PreAuthorize', { fill: '#eef3f8', size: 20 });

  const lx = 10, lw = 400, rx = 430, rw = 520, ex = 1010, ew = 120;
  const gy = 104, gh = 884;
  const gl = D.group(lx, gy, lw, gh, 'Гостиничная подсистема', { center: true, tx: lw / 2, size: 21 });
  const gr = D.group(rx, gy, rw, gh, 'Подсистема прогнозирования', { center: true, tx: rw / 2, size: 21 });
  D.text(lx + lw / 2, gy + 50, 'пакет com.HotelManager', { nowrap: true, size: 17, italic: true });
  D.text(rx + rw / 2, gy + 50, 'пакет com.HotelManager.forecast', { nowrap: true, size: 17, italic: true });

  // ячейка слоя: заголовок и перечень классов
  const cell = (x, y, w, h, head, list, top) => {
    D.rect(x, y, w, h, { fill: '#fff', sw: 2.4 });
    D.text(x + w / 2, y + 20, head, { nowrap: true, bold: true, size: 19 });
    const body = list;
    const size = D.fit(body, w - 24, h - 44, { size: 18, minSize: 16 });
    const lines = D.wrap(body, w - 24, size).length;
    D.text(x + w / 2, top ? y + 40 + lines * size * 0.61 : y + 36 + (h - 36) / 2, body, { maxW: w - 24, size });
    return { x, y, w, h, l: x, r: x + w, t: y, b: y + h, cx: x + w / 2, cy: y + h / 2 };
  };
  const pad = 14, cwL = lw - 2 * pad, padR = 40, cwR = rw - padR - pad;
  let y = gy + 72;
  const hC = 150, hS = 192, hG = 100, hR = 126, hE = 116, g = 26;
  const cL1 = cell(lx + pad, y, cwL, hC, 'Контроллеры (REST)', 'AuthController, RoomController, ReservationController, ReceiptController, CommentController, StatsController, AnalyticsController, UserController, ProfileController, ImageController');
  const cR1 = cell(rx + padR, y, cwR, hC, 'Контроллеры (REST)', 'ForecastController, CampaignController, ChannelController, SalesController, ModelController, ForecastExceptionHandler');
  y += hC + g;
  const cL2 = cell(lx + pad, y, cwL, hS, 'Сервисы', 'AuthService, UserService, RoleService, RoomAvailabilityService (занятость номеров по датам); правила бронирования и выселения — в RoomController и ReservationController');
  const cR2 = cell(rx + padR, y, cwR, hS, 'Сервисы (бизнес-логика)', 'ForecastService, ForecastPlanner, DatasetAssembler, FallbackForecaster, OptimizationService, MonitoringService, ForecastModelService, ForecastDataService, CampaignService, ChannelService, SalesHistoryService, SalesCsvParser, StatusService, ModelBootstrapper, ModelRetrainScheduler');
  y += hS + g;
  const cR3 = cell(rx + padR, y, cwR, hG, 'Интеграция с ИИ', 'ForecastAiGateway (интерфейс), HttpForecastAiGateway, AiContract, AiForecastCache (Caffeine)');
  y += hG + g;
  const cL4 = cell(lx + pad, y, cwL, hR, 'Репозитории (Spring Data JPA)', 'RoomRepository, ReservationRepository, ReceiptRepository, UserRepository, CommentRepository, StatsRepository, RoleRepository');
  const cR4 = cell(rx + padR, y, cwR, hR, 'Репозитории (Spring Data JPA)', 'ForecastModelRepository, MarketingCampaignRepository, MarketingChannelRepository, SalesWeeklyRepository, ForecastAlgorithmRepository');
  y += hR + g;
  const cL5 = cell(lx + pad, y, cwL, hE, 'Сущности (Hibernate)', 'Room, Reservation, Receipt, User, Role, Comment, Stats');
  const cR5 = cell(rx + padR, y, cwR, hE, 'Сущности (Hibernate)', 'MarketingChannel, MarketingCampaign, SalesWeekly, ForecastModel, ForecastAlgorithm, ForecastModelCandidate, ForecastModelChannelEffect, ForecastModelBacktestPoint');

  const down = (a, b) => D.flow([[a.cx, a.b], [b.cx, b.t]], { arrowLen: 13, sw: 2 });
  down(cL1, cL2); down(cR1, cR2); down(cR2, cR3);
  D.flow([[cL2.cx, cL2.b], [cL2.cx, cL4.t]], { arrowLen: 13, sw: 2 });
  D.flow([[cR3.cx, cR3.b], [cR3.cx, cR4.t]], { arrowLen: 13, sw: 2 });
  down(cL4, cL5); down(cR4, cR5);
  // связь «сервисы → репозитории» подсистемы прогнозирования проходит мимо шлюза: отдельная стрелка по левому краю группы
  const xs = rx + 18;
  D.flow([[cR2.l, cR2.b - 40], [xs, cR2.b - 40], [xs, cR4.cy], [cR4.l, cR4.cy]], { arrowLen: 13, sw: 2 });

  // безопасность → контроллеры
  D.flow([[lx + lw / 2, sec.b], [lx + lw / 2, gl.t]], { arrowLen: 13, sw: 2 });
  D.flow([[rx + rw / 2, sec.b], [rx + rw / 2, gr.t]], { arrowLen: 13, sw: 2 });

  // внешний узел ИИ
  const ml = D.proc(ex, cR3.t - 24, ew, cR3.h + 48, 'Узел 3. Сервис ИИ (FastAPI)', { size: 19, fill: '#eef3f8' });
  window.__bi(D, [[cR3.r, cR3.cy], [ml.l, cR3.cy]], { sw: 2.4 });
  D.text((gr.r + ml.l) / 2, cR3.cy - 18, 'REST', { nowrap: true, size: 17 });

  // СУБД
  const dbY = gy + gh + 60;
  const db = D.dataStore(W / 2, dbY + 40, 1090, 84, 'PostgreSQL: таблицы гостиницы и модуля прогнозирования (mk_*, fc_*)', { size: 20 });
  D.flow([[cL5.cx, cL5.b], [cL5.cx, db.t + 10]], { arrowLen: 13, sw: 2 });
  D.flow([[cR5.cx, cR5.b], [cR5.cx, db.t + 10]], { arrowLen: 13, sw: 2 });
  D.h = db.b + 24;
  return D;
};
