// Тестовые данные для модульных тестов модуля прогнозирования.
import {
  Channel, ForecastStatus, ModelDetails, Optimization, Prediction
} from './forecast.types';

export const CHANNELS = [
  {code: 'search', name: 'Контекстная реклама'},
  {code: 'social', name: 'Социальные сети'},
  {code: 'ota', name: 'Агрегаторы'}
];

function week(index: number): string {
  const d = new Date(Date.UTC(2026, 0, 5 + 7 * index));
  return d.toISOString().substring(0, 10);
}

export function prediction(overrides: Partial<Prediction> = {}): Prediction {
  const history = Array.from({length: 26}, (_, i) => ({weekStart: week(i), actual: 20000 + 100 * i}));
  const points = Array.from({length: 4}, (_, i) => ({
    weekStart: week(26 + i), predicted: 24000 + 100 * i, lower: 22000 + 100 * i, upper: 26000 + 100 * i,
    base: 15000, contributions: {search: 4000, social: 3000, ota: 2000 + 100 * i},
    spend: {search: 400, social: 300, ota: 500}
  }));
  return {
    target: 'REVENUE', targetTitle: 'Выручка', horizonWeeks: 4, originWeek: week(26), scenarioType: 'PLAN',
    model: {
      id: 1, externalId: 'revenue-1', algorithm: 'mmm_ridge', algorithmLabel: 'Модель маркетингового микса (MMM)',
      trainedAt: '2026-10-05T23:14:00', dataTo: week(25), wape: 0.06, mape: 0.062, stale: false
    },
    degraded: false, degradedReason: null, intervalLevel: 0.8, points, history,
    totals: {
      predicted: 96600, lower: 88400, upper: 104800, base: 60000, totalSpend: 4800,
      previousPeriodActual: 82000, changeVsPreviousPct: 0.178, sameWeeksLastYearActual: 90000, changeVsLastYearPct: 0.073
    },
    channels: CHANNELS.map((c, i) => ({
      code: c.code, name: c.name, plannedSpend: 1600, contribution: 12000 - 2000 * i, contributionShare: 0.12 - 0.02 * i,
      roi: 7.5 - i, marginalRoi: 2.2, saturationLevel: 0.5 + 0.1 * i, lowVariation: i === 2
    })),
    warnings: [],
    ...overrides
  };
}

export function degradedPrediction(): Prediction {
  const base = prediction();
  return {
    ...base, degraded: true, degradedReason: 'Интеллектуальный сервис недоступен', intervalLevel: 0,
    points: base.points.map(p => ({...p, base: null, contributions: null})),
    totals: {...base.totals, base: null}
  };
}

export function optimization(): Optimization {
  return {
    target: 'REVENUE', targetTitle: 'Выручка', horizonWeeks: 4, originWeek: week(26), totalBudget: 4800, spentBudget: 4800,
    planBudget: 4800, planMarketingEffect: 30000, optimizedMarketingEffect: 36000, upliftAbs: 6000, upliftPct: 0.2,
    allocations: CHANNELS.map((c, i) => ({
      code: c.code, name: c.name, planSpend: 1600, recommendedSpend: 1000 + 600 * i, weeklySpend: 250 + 150 * i,
      share: 0.2 + 0.1 * i, planEffect: 10000, expectedEffect: 12000, marginalReturn: 3.7
    })),
    suggestedWeeklySpend: {search: 250, social: 400, ota: 550}, notes: []
  };
}

export function modelDetails(): ModelDetails {
  return {
    summary: {
      id: 1, externalId: 'revenue-1', target: 'REVENUE', targetTitle: 'Выручка', status: 'ACTIVE', algorithm: 'mmm_ridge',
      algorithmLabel: 'Модель маркетингового микса (MMM)', trainedAt: '2026-10-05T23:14:00', trainedBy: 'system',
      dataFrom: '2023-01-02', dataTo: '2026-09-28', observations: 196, wape: 0.06, mape: 0.062, rmse: 1700, stale: false
    },
    cvFolds: 4, cvHorizon: 12, intervalLevel: 0.8, smape: 0.06, bias: 0.01,
    candidates: [
      {algorithm: 'seasonal_naive', label: 'Сезонная наивная модель', scenarioAware: false, selected: false, wape: 0.09, mape: 0.09, rmse: 2600, skillVsNaive: 0, skippedReason: null},
      {algorithm: 'mmm_ridge', label: 'Модель маркетингового микса (MMM)', scenarioAware: true, selected: true, wape: 0.06, mape: 0.062, rmse: 1700, skillVsNaive: 0.33, skippedReason: null},
      {algorithm: 'holt_winters', label: 'Хольта–Уинтерса (ETS)', scenarioAware: false, selected: false, wape: null, mape: null, rmse: null, skillVsNaive: null, skippedReason: 'недостаточно истории'}
    ],
    channelEffects: [], backtest: [], warnings: []
  };
}

export function channel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 1, code: 'search', name: 'Контекстная реклама', type: 'ONLINE_PAID', typeTitle: 'Онлайн: платная реклама',
    description: null, active: true, sortOrder: 1, campaignCount: 3, ...overrides
  };
}

export function status(state: 'UP' | 'DOWN' | 'CIRCUIT_OPEN' = 'UP'): ForecastStatus {
  return {
    ai: {state, stateTitle: 'тест', version: '1.0.0', encryptionEnabled: true, circuitBreaker: 'CLOSED', baseUrl: 'http://localhost:8001'},
    cache: {hits: 0, misses: 0, size: 0},
    models: [], data: {salesWeeks: 196, firstWeek: '2023-01-02', lastWeek: '2026-09-28', channels: 6, campaigns: 240}
  };
}
