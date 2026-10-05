// Типы обмена с серверной частью (REST /api/forecast/**). Имена полей совпадают с DTO сервера.

export type ForecastTarget = 'REVENUE' | 'BOOKINGS';
export type ScenarioType = 'PLAN' | 'NO_MARKETING' | 'CUSTOM';

export interface ScenarioRequest {
  type: ScenarioType;
  /** Множители к запланированным затратам канала (1 = как в плане). */
  multipliers?: Record<string, number>;
  /** Постоянные недельные затраты канала (заменяют план для этого канала). */
  weeklySpend?: Record<string, number>;
}

export interface PredictRequest {
  target: ForecastTarget;
  horizonWeeks: number;
  scenario: ScenarioRequest;
}

export interface ModelInfo {
  id: number;
  externalId: string;
  algorithm: string;
  algorithmLabel: string;
  trainedAt: string;
  dataTo: string;
  wape: number | null;
  mape: number | null;
  stale: boolean;
}

export interface PredictionPoint {
  weekStart: string;
  predicted: number;
  lower: number;
  upper: number;
  base: number | null;
  contributions: Record<string, number> | null;
  spend: Record<string, number>;
}

export interface HistoryPoint {
  weekStart: string;
  actual: number;
}

export interface PredictionTotals {
  predicted: number;
  lower: number;
  upper: number;
  base: number | null;
  totalSpend: number;
  previousPeriodActual: number | null;
  changeVsPreviousPct: number | null;
  sameWeeksLastYearActual: number | null;
  changeVsLastYearPct: number | null;
}

export interface ChannelSummary {
  code: string;
  name: string;
  plannedSpend: number;
  contribution: number | null;
  contributionShare: number | null;
  roi: number | null;
  marginalRoi: number | null;
  saturationLevel: number | null;
  lowVariation: boolean;
}

export interface Prediction {
  target: ForecastTarget;
  targetTitle: string;
  horizonWeeks: number;
  originWeek: string;
  scenarioType: ScenarioType;
  model: ModelInfo;
  degraded: boolean;
  degradedReason: string | null;
  intervalLevel: number;
  points: PredictionPoint[];
  history: HistoryPoint[];
  totals: PredictionTotals;
  channels: ChannelSummary[];
  warnings: string[];
}

export interface ChannelLimit {
  channelCode: string;
  minShare: number;
  maxShare: number;
}

export interface OptimizeRequest {
  target: ForecastTarget;
  horizonWeeks: number;
  totalBudget?: number | null;
  limits?: ChannelLimit[];
}

export interface OptimizationAllocation {
  code: string;
  name: string;
  planSpend: number;
  recommendedSpend: number;
  weeklySpend: number;
  share: number;
  planEffect: number;
  expectedEffect: number;
  marginalReturn: number;
}

export interface Optimization {
  target: ForecastTarget;
  targetTitle: string;
  horizonWeeks: number;
  originWeek: string;
  totalBudget: number;
  spentBudget: number;
  planBudget: number;
  planMarketingEffect: number;
  optimizedMarketingEffect: number;
  upliftAbs: number;
  upliftPct: number | null;
  allocations: OptimizationAllocation[];
  suggestedWeeklySpend: Record<string, number>;
  notes: string[];
}

export type ChannelType = 'ONLINE_PAID' | 'ONLINE_OWNED' | 'PARTNER' | 'OFFLINE';

export interface Channel {
  id: number;
  code: string;
  name: string;
  type: ChannelType;
  typeTitle: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  campaignCount: number;
}

export interface ChannelRequest {
  code: string;
  name: string;
  type: ChannelType;
  description?: string | null;
  active?: boolean;
  sortOrder?: number | null;
}

export type CampaignStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export interface Campaign {
  id: number;
  channelId: number;
  channelCode: string;
  channelName: string;
  name: string;
  startDate: string;
  endDate: string;
  budget: number;
  weeklyBudget: number;
  days: number;
  status: CampaignStatus;
  note: string | null;
  createdBy: string | null;
}

export interface CampaignRequest {
  channelId: number;
  name: string;
  startDate: string;
  endDate: string;
  budget: number;
  note?: string | null;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface SalesWeek {
  weekStart: string;
  bookings: number;
  revenue: number;
  source: 'DEMO' | 'IMPORT' | 'MANUAL';
}

export interface SalesImportResult {
  created: number;
  updated: number;
  normalizedDates: number;
  warnings: string[];
}

export interface ModelSummary {
  id: number;
  externalId: string;
  target: ForecastTarget;
  targetTitle: string;
  status: 'ACTIVE' | 'ARCHIVED';
  algorithm: string;
  algorithmLabel: string;
  trainedAt: string;
  trainedBy: string | null;
  dataFrom: string;
  dataTo: string;
  observations: number;
  wape: number | null;
  mape: number | null;
  rmse: number | null;
  stale: boolean;
}

export interface ModelCandidate {
  algorithm: string;
  label: string;
  scenarioAware: boolean;
  selected: boolean;
  wape: number | null;
  mape: number | null;
  rmse: number | null;
  skillVsNaive: number | null;
  skippedReason: string | null;
}

export interface ModelChannelEffect {
  channelCode: string;
  channelName: string;
  adstockDecay: number;
  saturationScale: number;
  maxEffect: number;
  totalSpend: number;
  meanWeeklySpend: number;
  activeWeeks: number;
  spendCv: number;
  contributionTotal: number;
  contributionShare: number;
  roi: number | null;
  marginalRoi: number | null;
  saturationLevel: number;
  lowVariation: boolean;
}

export interface BacktestPoint {
  weekStart: string;
  actual: number;
  predicted: number;
  lower: number;
  upper: number;
}

export interface ModelDetails {
  summary: ModelSummary;
  cvFolds: number;
  cvHorizon: number;
  intervalLevel: number;
  smape: number | null;
  bias: number | null;
  candidates: ModelCandidate[];
  channelEffects: ModelChannelEffect[];
  backtest: BacktestPoint[];
  warnings: string[];
}

export type MonitoringStatus = 'NO_DATA' | 'INSUFFICIENT' | 'OK' | 'WARN' | 'RETRAIN';

export interface Monitoring {
  modelId: number;
  status: MonitoringStatus;
  statusTitle: string;
  weeks: number;
  wape: number | null;
  baselineWape: number | null;
  ratio: number | null;
  recommendation: string;
  points: { weekStart: string; actual: number; predicted: number }[];
}

export interface ForecastStatus {
  ai: {
    state: 'UP' | 'DOWN' | 'CIRCUIT_OPEN';
    stateTitle: string;
    version: string | null;
    encryptionEnabled: boolean | null;
    circuitBreaker: string;
    baseUrl: string;
  };
  cache: { hits: number; misses: number; size: number };
  models: { target: ForecastTarget; targetTitle: string; modelId: number | null; algorithmLabel: string | null; stale: boolean }[];
  data: { salesWeeks: number; firstWeek: string | null; lastWeek: string | null; channels: number; campaigns: number };
}
