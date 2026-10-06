window.DIAGRAMS = window.DIAGRAMS || {};

// Рисунок 3.3 — модули интеллектуального сервиса
window.DIAGRAMS.fig_3_3 = function () {
  const W = 1140, H = 920, F = 19;
  const D = new Diagram(W, H, { font: F });
  // модуль: имя файла (жирным) и назначение
  const mod = (x, y, w, h, name, desc, o = {}) => {
    D.rect(x, y, w, h, { fill: o.fill || '#fff', sw: 2.4 });
    D.text(x + w / 2, y + 22, name, { nowrap: true, bold: true, size: 20 });
    const size = D.fit(desc, w - 22, h - 44, { size: 18, minSize: 16 });
    D.text(x + w / 2, y + 34 + (h - 34) / 2, desc, { maxW: w - 22, size });
    return { x, y, w, h, l: x, r: x + w, t: y, b: y + h, cx: x + w / 2, cy: y + h / 2 };
  };
  const down = (a, b, o = {}) => D.flow([[o.ax ?? a.cx, a.b], [o.bx ?? o.ax ?? b.cx, b.t]], { arrowLen: 13, sw: 2 });

  const sec = mod(10, 10, 260, 92, 'security.py', 'Проверка ключа X-API-Key за постоянное время');
  const main = mod(300, 10, 540, 92, 'main.py', 'Точка входа FastAPI: маршруты /api/v1, обработка ошибок, ограничение размера запроса', { fill: '#eef3f8' });
  const sch = mod(870, 10, 260, 92, 'schemas.py', 'Контракт обмена: схемы Pydantic');
  D.flow([[main.l, main.cy], [sec.r, main.cy]], { sw: 2, dash: '9 7', openArrow: true });
  D.flow([[main.r, main.cy], [sch.l, main.cy]], { sw: 2, dash: '9 7', openArrow: true });

  const svc = mod(10, 140, 1120, 78, 'service.py', 'Оркестрация: обучение, прогноз и оптимизация; формирование ответов API');
  down(main, svc);

  const tr = mod(10, 262, 350, 108, 'training.py', 'Обучение четырёх алгоритмов, выбор чемпиона, оценка вкладов каналов');
  const fc = mod(395, 262, 350, 108, 'forecasting.py', 'Прогноз с интервалом, разложение на базу и вклады каналов');
  const op = mod(780, 262, 350, 108, 'optimizer.py', 'Оптимизация бюджета: равенство предельных отдач');
  [tr, fc, op].forEach(b => down(svc, b, { ax: b.cx }));

  const mg = D.group(10, 420, 350, 482, 'Пакет models', { size: 20 });
  const ms = [['base.py', 'интерфейс Forecaster, метрики'], ['mmm.py', 'маркетинговый микс'], ['gbm.py', 'градиентный бустинг'],
    ['holt_winters.py', 'модель Хольта–Уинтерса'], ['seasonal_naive.py', 'сезонная наивная модель']];
  const mb = ms.map(([n, d], i) => mod(24, 460 + i * 82, 322, 74, n, d));
  const val = mod(395, 420, 350, 100, 'validation.py', 'Скользящая кросс-валидация, интервалы прогноза');
  const srv = mod(780, 420, 350, 100, 'serving.py', 'ModelStore: кэш моделей в памяти');
  const reg = mod(780, 568, 350, 100, 'registry.py', 'Реестр версий моделей на диске (JSON), защита имён');
  const cry = mod(780, 716, 350, 100, 'crypto.py', 'AES-256-GCM, ключ из парольной фразы (PBKDF2)');
  const tfm = mod(395, 568, 350, 120, 'transforms.py', 'Перенос эффекта (adstock) и насыщение; calendar_features.py — сезонность и праздники');

  // training → models, validation
  D.flow([[tr.cx - 60, tr.b], [tr.cx - 60, mg.t]], { arrowLen: 13, sw: 2 });
  D.flow([[tr.cx + 90, tr.b], [tr.cx + 90, 395], [val.cx - 90, 395], [val.cx - 90, val.t]], { arrowLen: 13, sw: 2 });
  // forecasting → validation, serving; optimizer → serving
  D.flow([[fc.cx + 40, fc.b], [fc.cx + 40, val.t]], { arrowLen: 13, sw: 2 });
  D.flow([[fc.cx + 120, fc.b], [fc.cx + 120, 395], [srv.cx - 90, 395], [srv.cx - 90, srv.t]], { arrowLen: 13, sw: 2 });
  D.flow([[op.cx + 60, op.b], [op.cx + 60, srv.t]], { arrowLen: 13, sw: 2 });
  down(srv, reg); down(reg, cry);
  // models → transforms
  D.flow([[mg.r, 640], [tfm.l, 640]], { arrowLen: 13, sw: 2 });
  D.h = 920;
  return D;
};
