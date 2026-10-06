import {Component, OnDestroy, OnInit} from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';
import {ChartConfiguration} from 'chart.js';
import {Subject, catchError, debounceTime, of, switchMap, takeUntil, tap} from 'rxjs';
import {AuthService} from '../../../core/auth/auth.service';
import {ForecastService} from '../forecast.service';
import {
  buildContributionTotalsChart, buildContributionWeeklyChart, buildForecastChart, buildOptimizationChart
} from '../forecast-charts';
import {FC_COLORS, channelColor} from '../forecast-colors';
import {
  errorMessage, formatDate, formatMoney, formatNumber, formatPercent, formatSignedPercent, formatValue,
  formatDateTime, formatWeekShort
} from '../forecast-format';
import {
  ChannelLimit, ForecastTarget, Optimization, Prediction, ScenarioRequest, ScenarioType
} from '../forecast.types';

/** Главная страница модуля: прогноз по сценарию, вклад каналов и рекомендация по бюджету. */
@Component({
    selector: 'app-forecast-dashboard',
    templateUrl: './forecast-dashboard.component.html',
    standalone: false
})
export class ForecastDashboardComponent implements OnInit, OnDestroy {

  readonly targets: { value: ForecastTarget; title: string }[] = [
    {value: 'REVENUE', title: 'Выручка'},
    {value: 'BOOKINGS', title: 'Бронирования'}
  ];
  readonly scenarios: { value: ScenarioType; title: string }[] = [
    {value: 'PLAN', title: 'План кампаний'},
    {value: 'NO_MARKETING', title: 'Без маркетинга'},
    {value: 'CUSTOM', title: 'Свой сценарий'}
  ];
  readonly horizons = [4, 8, 12, 26, 52];

  readonly fmtDate = formatDate;
  readonly fmtMoney = formatMoney;
  readonly fmtNumber = formatNumber;
  readonly fmtPercent = formatPercent;
  readonly fmtSigned = formatSignedPercent;
  readonly fmtWeek = formatWeekShort;
  readonly fmtDateTime = formatDateTime;
  readonly colors = FC_COLORS;

  target: ForecastTarget = 'REVENUE';
  horizon = 12;
  scenarioType: ScenarioType = 'PLAN';
  multipliers: Record<string, number> = {};
  /** Применённая рекомендация оптимизатора: постоянные недельные затраты по каналам. */
  weeklyOverride: Record<string, number> | null = null;
  /** Строки таблицы применённой рекомендации (хранятся полем, а не вычисляются в шаблоне при каждой проверке). */
  weeklyOverrideRows: { code: string; name: string; amount: number }[] = [];

  prediction: Prediction | null = null;
  loading = true;
  errorText: string | null = null;
  isAdmin = false;
  channelCodes: string[] = [];

  forecastChart: ChartConfiguration | null = null;
  contribTotalsChart: ChartConfiguration | null = null;
  contribWeeklyChart: ChartConfiguration | null = null;
  contribView: 'total' | 'weekly' = 'total';

  budget: number | null = null;
  showLimits = false;
  limits: Record<string, { min: number | null; max: number | null }> = {};
  optimization: Optimization | null = null;
  optimizing = false;
  optimizationChart: ChartConfiguration | null = null;
  optimizationError: string | null = null;

  private reload$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(private service: ForecastService, private auth: AuthService, private snackBar: MatSnackBar) {
    this.isAdmin = auth.getIsAdminIn();
  }

  ngOnInit(): void {
    this.reload$.pipe(
      debounceTime(250),
      tap(() => {
        this.loading = true;
        this.errorText = null;
      }),
      switchMap(() => this.service.predict({
        target: this.target, horizonWeeks: this.horizon, scenario: this.scenarioRequest()
      }).pipe(catchError(error => {
        this.errorText = errorMessage(error, 'Не удалось получить прогноз');
        return of(null);
      }))),
      takeUntil(this.destroy$)
    ).subscribe(prediction => {
      this.loading = false;
      if (prediction) {
        this.applyPrediction(prediction);
      }
    });
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  reload(): void {
    this.reload$.next();
  }

  // ------------------------------------------------------------------ управление

  setTarget(target: ForecastTarget): void {
    if (target !== this.target) {
      this.target = target;
      this.resetOptimization();
      this.reload();
    }
  }

  setHorizon(value: string | number): void {
    this.horizon = Number(value);
    this.resetOptimization();
    this.reload();
  }

  setScenario(type: ScenarioType): void {
    if (type !== this.scenarioType) {
      this.scenarioType = type;
      this.reload();
    }
  }

  multiplier(code: string): number {
    return this.multipliers[code] ?? 1;
  }

  setMultiplier(code: string, value: string | number): void {
    this.multipliers = {...this.multipliers, [code]: Number(value)};
    this.reload();
  }

  resetScenario(): void {
    this.multipliers = {};
    this.weeklyOverride = null;
    this.weeklyOverrideRows = [];
    this.scenarioType = 'PLAN';
    this.reload();
  }

  private scenarioRequest(): ScenarioRequest {
    if (this.scenarioType !== 'CUSTOM') {
      return {type: this.scenarioType};
    }
    return {
      type: 'CUSTOM',
      multipliers: this.weeklyOverride ? undefined : this.multipliers,
      weeklySpend: this.weeklyOverride ?? undefined
    };
  }

  private applyPrediction(prediction: Prediction): void {
    this.prediction = prediction;
    this.channelCodes = prediction.channels.map(c => c.code);
    this.forecastChart = buildForecastChart(prediction);
    const hasComponents = prediction.points.length > 0 && prediction.points[0].contributions !== null;
    this.contribTotalsChart = hasComponents ? buildContributionTotalsChart(prediction, this.channelCodes) : null;
    this.contribWeeklyChart = hasComponents ? buildContributionWeeklyChart(prediction, this.channelCodes) : null;
  }

  // ------------------------------------------------------------------ показатели

  value(v: number | null | undefined): string {
    return formatValue(this.target, v);
  }

  get marketingEffect(): number | null {
    const t = this.prediction?.totals;
    return t && t.base !== null ? t.predicted - t.base : null;
  }

  get marketingShare(): number | null {
    const t = this.prediction?.totals;
    return t && t.base !== null && t.predicted > 0 ? (t.predicted - t.base) / t.predicted : null;
  }

  /** Отдача плановых затрат: для выручки — долларов на доллар, для бронирований — броней на 1000 $. */
  get returnText(): string | null {
    const effect = this.marketingEffect;
    const spend = this.prediction?.totals.totalSpend ?? 0;
    if (effect === null || spend <= 0) {
      return null;
    }
    return this.target === 'REVENUE'
      ? `${formatNumber(effect / spend, 1)} $ выручки на 1 $ затрат`
      : `${formatNumber(effect / spend * 1000, 1)} брон. на 1000 $ затрат`;
  }

  deltaClass(value: number | null): string {
    return value === null ? '' : value >= 0 ? 'up' : 'down';
  }

  arrow(value: number | null): string {
    return value === null ? '' : value >= 0 ? '▲' : '▼';
  }

  channelColor(code: string): string {
    return channelColor(code, this.channelCodes);
  }

  get customChannels() {
    return this.prediction?.channels ?? [];
  }

  // ------------------------------------------------------------------ оптимизация бюджета

  private resetOptimization(): void {
    this.optimization = null;
    this.optimizationChart = null;
    this.optimizationError = null;
  }

  runOptimization(): void {
    if (!this.prediction) {
      return;
    }
    const limits: ChannelLimit[] = this.prediction.channels
      .filter(c => this.limits[c.code] && (this.limits[c.code].min !== null || this.limits[c.code].max !== null))
      .map(c => ({
        channelCode: c.code,
        minShare: (this.limits[c.code].min ?? 0) / 100,
        maxShare: (this.limits[c.code].max ?? 100) / 100
      }));
    this.optimizing = true;
    this.optimizationError = null;
    this.service.optimize({
      target: this.target, horizonWeeks: this.horizon,
      totalBudget: this.budget && this.budget > 0 ? this.budget : null, limits
    }).subscribe({
      next: result => {
        this.optimizing = false;
        this.optimization = result;
        this.optimizationChart = buildOptimizationChart(result);
      },
      error: error => {
        this.optimizing = false;
        this.optimizationError = errorMessage(error, 'Не удалось рассчитать распределение бюджета');
      }
    });
  }

  applyRecommendation(): void {
    if (!this.optimization) {
      return;
    }
    const suggested = {...this.optimization.suggestedWeeklySpend};
    this.weeklyOverride = suggested;
    this.weeklyOverrideRows = this.optimization.allocations
      .map(a => ({code: a.code, name: a.name, amount: suggested[a.code] ?? 0}));
    this.scenarioType = 'CUSTOM';
    this.reload();
    this.snackBar.open('Рекомендация применена как сценарий затрат');
  }

  changeText(allocation: { planSpend: number; recommendedSpend: number }): string {
    const diff = allocation.recommendedSpend - allocation.planSpend;
    if (Math.abs(diff) < 0.5) {
      return '0 $';
    }
    return (diff > 0 ? '+' : '−') + formatNumber(Math.abs(diff)) + ' $';
  }

  sumSpend(spend: Record<string, number>): number {
    return Object.values(spend).reduce((a, b) => a + b, 0);
  }

  limitOf(code: string): { min: number | null; max: number | null } {
    return this.limits[code] ?? {min: null, max: null};
  }

  setLimit(code: string, side: 'min' | 'max', value: number | string | null): void {
    const current = this.limitOf(code);
    const parsed = value === null || value === '' ? null : Number(value);
    this.limits = {...this.limits, [code]: {...current, [side]: parsed}};
  }

  trackByCode(_: number, item: { code: string }): string {
    return item.code;
  }
}
