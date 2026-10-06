import {Component, OnInit} from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';
import {ChartConfiguration} from 'chart.js';
import {AuthService} from '../../../core/auth/auth.service';
import {ForecastService} from '../forecast.service';
import {buildBacktestChart, buildLeaderboardChart, buildMonitoringChart} from '../forecast-charts';
import {channelColor} from '../forecast-colors';
import {
  SOURCE_TITLES, errorMessage, formatDate, formatDateTime, formatMoney, formatNumber, formatPercent
} from '../forecast-format';
import {ForecastTarget, ModelDetails, ModelSummary, Monitoring, SalesImportResult, SalesWeek} from '../forecast.types';

/** Модель и данные: качество и версии моделей, параметры каналов, контроль точности, ввод и импорт продаж. */
@Component({
    selector: 'app-model-data',
    templateUrl: './model-data.component.html',
    standalone: false
})
export class ModelDataComponent implements OnInit {

  readonly targets: { value: ForecastTarget; title: string }[] = [
    {value: 'REVENUE', title: 'Выручка'},
    {value: 'BOOKINGS', title: 'Бронирования'}
  ];
  readonly fmtDate = formatDate;
  readonly fmtDateTime = formatDateTime;
  readonly fmtMoney = formatMoney;
  readonly fmtNumber = formatNumber;
  readonly fmtPercent = formatPercent;
  readonly sourceTitles = SOURCE_TITLES;

  isAdmin = false;
  target: ForecastTarget = 'REVENUE';
  models: ModelSummary[] = [];
  details: ModelDetails | null = null;
  monitoring: Monitoring | null = null;
  monitoringError: string | null = null;
  errorText: string | null = null;
  training = false;
  loadingDetails = false;

  leaderboardChart: ChartConfiguration | null = null;
  backtestChart: ChartConfiguration | null = null;
  monitoringChart: ChartConfiguration | null = null;

  sales: SalesWeek[] = [];
  saleForm: { weekStart: string; bookings: number | null; revenue: number | null } = {weekStart: '', bookings: null, revenue: null};
  saleError: string | null = null;
  savingSale = false;
  importFile: File | null = null;
  importing = false;
  importResult: SalesImportResult | null = null;
  importError: string | null = null;

  constructor(private service: ForecastService, private auth: AuthService, private snackBar: MatSnackBar) {
    this.isAdmin = auth.getIsAdminIn();
  }

  /** Производные значения хранятся полями и пересчитываются при смене данных (см. refreshDerived). */
  targetModels: ModelSummary[] = [];
  active: ModelSummary | undefined;
  channelCodes: string[] = [];

  private refreshDerived(): void {
    this.targetModels = this.models.filter(m => m.target === this.target);
    this.active = this.targetModels.find(m => m.status === 'ACTIVE');
    this.channelCodes = this.details?.channelEffects.map(e => e.channelCode) ?? [];
  }

  ngOnInit(): void {
    this.loadModels(true);
    this.loadSales();
  }

  color(code: string): string {
    return channelColor(code, this.channelCodes);
  }

  // ------------------------------------------------------------------ модели

  setTarget(target: ForecastTarget): void {
    if (target !== this.target) {
      this.target = target;
      this.details = null;
      this.monitoring = null;
      this.clearCharts();
      this.refreshDerived();
      this.showActive();
    }
  }

  loadModels(select: boolean): void {
    this.service.getModels().subscribe({
      next: models => {
        this.models = models;
        this.refreshDerived();
        this.errorText = null;
        if (select) {
          this.showActive();
        }
      },
      error: error => this.errorText = errorMessage(error, 'Не удалось загрузить реестр моделей')
    });
  }

  private showActive(): void {
    const active = this.active;
    if (active) {
      this.select(active.id);
    }
  }

  select(id: number): void {
    this.loadingDetails = true;
    this.service.getModel(id).subscribe({
      next: details => {
        this.loadingDetails = false;
        this.details = details;
        this.refreshDerived();
        this.leaderboardChart = buildLeaderboardChart(details.candidates);
        this.backtestChart = details.backtest.length
          ? buildBacktestChart(details.summary.target, details.backtest, details.intervalLevel) : null;
        this.loadMonitoring(id, details.summary.target);
      },
      error: error => {
        this.loadingDetails = false;
        this.errorText = errorMessage(error, 'Не удалось загрузить описание модели');
      }
    });
  }

  private loadMonitoring(id: number, target: ForecastTarget): void {
    this.monitoring = null;
    this.monitoringChart = null;
    this.monitoringError = null;
    this.service.getMonitoring(id).subscribe({
      next: monitoring => {
        this.monitoring = monitoring;
        this.monitoringChart = monitoring.points.length >= 2 ? buildMonitoringChart(target, monitoring) : null;
      },
      error: error => this.monitoringError = errorMessage(error, 'Контроль качества сейчас недоступен')
    });
  }

  private clearCharts(): void {
    this.leaderboardChart = null;
    this.backtestChart = null;
    this.monitoringChart = null;
  }

  train(): void {
    this.training = true;
    this.errorText = null;
    this.service.trainModel(this.target).subscribe({
      next: details => {
        this.training = false;
        this.snackBar.open('Модель обучена и стала активной');
        this.loadModels(false);
        this.details = details;
        this.refreshDerived();
        this.leaderboardChart = buildLeaderboardChart(details.candidates);
        this.backtestChart = details.backtest.length
          ? buildBacktestChart(details.summary.target, details.backtest, details.intervalLevel) : null;
        this.loadMonitoring(details.summary.id, details.summary.target);
      },
      error: error => {
        this.training = false;
        this.errorText = errorMessage(error, 'Не удалось обучить модель');
      }
    });
  }

  activate(model: ModelSummary): void {
    this.service.activateModel(model.id).subscribe({
      next: () => {
        this.snackBar.open('Версия модели активирована');
        this.loadModels(false);
        this.select(model.id);
      },
      error: error => this.snackBar.open(errorMessage(error, 'Не удалось активировать модель'))
    });
  }

  statusBadge(status: string): string {
    return status === 'OK' ? 'fc-badge-ok' : status === 'WARN' ? 'fc-badge-warn' : status === 'RETRAIN' ? 'fc-badge-bad' : '';
  }

  statusIcon(status: string): string {
    return status === 'OK' ? '✓' : status === 'WARN' ? '⚠' : status === 'RETRAIN' ? '✕' : 'ⓘ';
  }

  /** Сколько эффекта рекламы «переходит» на следующую неделю: пояснение коэффициента затухания. */
  carryText(decay: number): string {
    return decay < 0.05 ? 'нет' : formatPercent(decay, 0);
  }

  unit(): string {
    return this.target === 'REVENUE' ? '$' : 'брон.';
  }

  /** Отдача: для выручки — долларов на доллар, для бронирований — броней на 1000 $. */
  roi(value: number | null): string {
    return value === null ? '—' : formatNumber(this.target === 'REVENUE' ? value : value * 1000, 1);
  }

  // ------------------------------------------------------------------ продажи

  loadSales(): void {
    this.service.getLatestSales(16).subscribe({
      next: sales => this.sales = [...sales].reverse(),
      error: error => this.errorText = errorMessage(error, 'Не удалось загрузить продажи')
    });
  }

  editSale(week: SalesWeek): void {
    this.saleForm = {weekStart: week.weekStart, bookings: week.bookings, revenue: week.revenue};
    this.saleError = null;
  }

  saveSale(): void {
    const f = this.saleForm;
    if (!f.weekStart || f.bookings === null || f.revenue === null || f.bookings < 0 || f.revenue < 0) {
      this.saleError = 'Укажите дату недели, число бронирований и выручку (не меньше нуля)';
      return;
    }
    this.savingSale = true;
    this.saleError = null;
    this.service.saveSales({weekStart: f.weekStart, bookings: f.bookings, revenue: f.revenue}).subscribe({
      next: () => {
        this.savingSale = false;
        this.saleForm = {weekStart: '', bookings: null, revenue: null};
        this.snackBar.open('Данные недели сохранены');
        this.loadSales();
        this.loadModels(false);
      },
      error: error => {
        this.savingSale = false;
        this.saleError = errorMessage(error, 'Не удалось сохранить данные');
      }
    });
  }

  deleteSale(week: SalesWeek): void {
    if (!window.confirm(`Удалить данные недели с ${formatDate(week.weekStart)}?`)) {
      return;
    }
    this.service.deleteSales(week.weekStart).subscribe({
      next: () => {
        this.snackBar.open('Данные недели удалены');
        this.loadSales();
        this.loadModels(false);
      },
      error: error => this.snackBar.open(errorMessage(error, 'Не удалось удалить данные'))
    });
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importFile = input.files && input.files.length > 0 ? input.files[0] : null;
    this.importResult = null;
    this.importError = null;
  }

  importCsv(): void {
    if (!this.importFile) {
      return;
    }
    this.importing = true;
    this.importResult = null;
    this.importError = null;
    this.service.importSales(this.importFile).subscribe({
      next: result => {
        this.importing = false;
        this.importResult = result;
        this.importFile = null;
        this.loadSales();
        this.loadModels(false);
      },
      error: error => {
        this.importing = false;
        this.importError = errorMessage(error, 'Не удалось загрузить файл');
      }
    });
  }

  downloadTemplate(): void {
    const csv = '﻿Неделя;Бронирований;Выручка\n05.10.2026;90;19500,50\n12.10.2026;95;20100,25\n';
    const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'prodazhi-shablon.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }
}
