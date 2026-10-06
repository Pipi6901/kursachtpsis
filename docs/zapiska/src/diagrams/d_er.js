window.DIAGRAMS = window.DIAGRAMS || {};

// Рисунок 2.6 — логическая модель данных
window.DIAGRAMS.fig_2_6 = function () {
  const W = 1140, F = 21;
  const D = new Diagram(W, 1480, { font: F });
  const w = 316, X = [20, 412, 804];
  const E = (col, y, title, rows) => D.entity(X[col], y, w, title, rows, { size: 19 });
  const alg = E(0, 20, 'fc_algorithm', [['PK', 'code', 'varchar(40)'], ['', 'label', 'varchar(100)'], ['', 'scenario_aware', 'boolean']]);
  const cand = E(1, 20, 'fc_model_candidate', [['PK', 'id', 'bigint'], ['FK', 'model_id', 'bigint'], ['FK', 'algorithm', 'varchar(40)'], ['', 'selected', 'boolean'],
    ['', 'wape', 'double'], ['', 'mape', 'double'], ['', 'rmse', 'double'], ['', 'skill_vs_naive', 'double'], ['', 'skipped_reason', 'varchar(300)']]);
  const warn = E(2, 20, 'fc_model_warning', [['PK,FK', 'model_id', 'bigint'], ['PK', 'position', 'integer'], ['', 'message', 'varchar(500)']]);
  const y2 = Math.max(cand.b, alg.b, warn.b) + 78;
  const chan = E(0, y2, 'mk_channel', [['PK', 'id', 'bigint'], ['UK', 'code', 'varchar(40)'], ['', 'name', 'varchar(100)'], ['', 'type', 'varchar(20)'],
    ['', 'description', 'varchar(300)'], ['', 'active', 'boolean'], ['', 'sort_order', 'integer']]);
  const model = E(1, y2, 'fc_model', [['PK', 'id', 'bigint'], ['UK', 'external_id', 'varchar(64)'], ['', 'target', 'varchar(10)'], ['', 'status', 'varchar(10)'],
    ['FK', 'algorithm', 'varchar(40)'], ['', 'trained_at', 'timestamp'], ['', 'trained_by', 'varchar(50)'], ['', 'data_from', 'date'], ['', 'data_to', 'date'],
    ['', 'data_fingerprint', 'varchar(64)'], ['', 'cv_folds', 'integer'], ['', 'cv_horizon', 'integer'], ['', 'interval_level', 'double'],
    ['', 'wape', 'double'], ['', 'mape', 'double'], ['', 'smape', 'double'], ['', 'rmse', 'double'], ['', 'bias', 'double']]);
  const back = E(2, y2, 'fc_model_backtest_point', [['PK', 'id', 'bigint'], ['FK', 'model_id', 'bigint'], ['', 'week_start', 'date'], ['', 'actual', 'double'],
    ['', 'predicted', 'double'], ['', 'lower', 'double'], ['', 'upper', 'double']]);
  const y3 = model.b + 78;
  const camp = E(0, y3, 'mk_campaign', [['PK', 'id', 'bigint'], ['FK', 'channel_id', 'bigint'], ['', 'name', 'varchar(150)'], ['', 'start_date', 'date'],
    ['', 'end_date', 'date'], ['', 'budget', 'numeric(12,2)'], ['', 'note', 'varchar(500)'], ['', 'created_by', 'varchar(50)'], ['', 'created_at', 'timestamp']]);
  const eff = E(1, y3, 'fc_model_channel_effect', [['PK', 'id', 'bigint'], ['FK', 'model_id', 'bigint'], ['FK', 'channel_id', 'bigint'], ['', 'adstock_decay', 'double'],
    ['', 'saturation_scale', 'double'], ['', 'max_effect', 'double'], ['', 'total_spend', 'double'], ['', 'active_weeks', 'integer'], ['', 'spend_cv', 'double'],
    ['', 'contribution_total', 'double'], ['', 'contribution_share', 'double'], ['', 'marginal_roi', 'double'], ['', 'saturation_level', 'double'], ['', 'low_variation', 'boolean']]);
  const sales = E(2, y3, 'fc_sales_weekly', [['PK', 'id', 'bigint'], ['UK', 'week_start', 'date'], ['', 'bookings', 'integer'], ['', 'revenue', 'numeric(14,2)'],
    ['', 'source', 'varchar(10)'], ['', 'updated_at', 'timestamp']]);
  D.h = Math.max(eff.b, camp.b, sales.b) + 20;

  // связи (1 — N): линия + «воронья лапка» на стороне N
  const rel = (pts, a, b) => {      // a: [x,y,dir,kind] — конец «один», b — конец «много»
    D.flow(pts, { noArrow: true });
    D.crow(a[0], a[1], a[2], 'one'); D.crow(b[0], b[1], b[2], 'many');
  };
  // fc_algorithm 1—N fc_model_candidate
  const ya = alg.t + 74;
  rel([[alg.r, ya], [cand.l, ya]], [alg.r, ya, 'r'], [cand.l, ya, 'l']);
  // fc_algorithm 1—N fc_model
  const xa = alg.l + 70, ym = model.rowY(4), xv = 396;
  rel([[xa, alg.b], [xa, y2 - 38], [xv, y2 - 38], [xv, ym], [model.l, ym]], [xa, alg.b, 'd'], [model.l, ym, 'l']);
  // fc_model 1—N fc_model_candidate
  const xm = model.l + 120;
  rel([[xm, model.t], [xm, cand.b]], [xm, model.t, 'u'], [xm, cand.b, 'd']);
  // fc_model 1—N fc_model_backtest_point
  const yb = back.rowY(1);
  rel([[model.r, yb], [back.l, yb]], [model.r, yb, 'r'], [back.l, yb, 'l']);
  // fc_model 1—N fc_model_warning
  const xwm = model.r - 60, xwa = warn.l + 80;
  rel([[xwm, model.t], [xwm, y2 - 38], [xwa, y2 - 38], [xwa, warn.b]], [xwm, model.t, 'u'], [xwa, warn.b, 'd']);
  // fc_model 1—N fc_model_channel_effect
  const xe = model.l + 220;
  rel([[xe, model.b], [xe, eff.t]], [xe, model.b, 'd'], [xe, eff.t, 'u']);
  // mk_channel 1—N mk_campaign
  const xc = chan.l + 80;
  rel([[xc, chan.b], [xc, camp.t]], [xc, chan.b, 'd'], [xc, camp.t, 'u']);
  // mk_channel 1—N fc_model_channel_effect
  const yc = chan.rowY(3), ye = eff.rowY(2), xk = 374;
  rel([[chan.r, yc], [xk, yc], [xk, ye], [eff.l, ye]], [chan.r, yc, 'r'], [eff.l, ye, 'l']);
  D.text(804 + w / 2, sales.b + 26, 'Внешних ключей нет: таблица хранит\nнезависимый ряд фактических продаж', { nowrap: true, size: 17, italic: true, top: true });
  D.h += 40;
  return D;
};
