import {Chart, ChartConfiguration, LegendItem, Plugin, TooltipItem} from 'chart.js';
import {channelColor, FC_COLORS} from './forecast-colors';
import {
  formatCompact, formatDate, formatNumber, formatPercent, formatValue, formatWeekShort, targetUnit
} from './forecast-format';
import {
  BacktestPoint, ForecastTarget, ModelCandidate, Monitoring, Optimization, Prediction
} from './forecast.types';

// Построители конфигураций графиков Chart.js. Правила оформления: линии 2 px, тонкие столбцы (до 24 px)
// со скруглением по концу данных, зазор 2 px цветом поверхности между сегментами, едва заметная сетка,
// подписи значений только на ключевых элементах, легенда — всегда при двух и более рядах.

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Служебные признаки наборов данных, которые не должны попадать в легенду и подсказку. */
interface HelperFlags {
  fcHideLegend?: boolean;
  fcHideTooltip?: boolean;
  /** Цвет и вид значка в легенде (по умолчанию — цвет линии/заливки набора данных). */
  fcLegendColor?: string;
  fcLegendStyle?: 'line' | 'rect';
}

function flags(dataset: unknown): HelperFlags {
  return dataset as HelperFlags;
}

/** Вертикальная «перекрёстная» линия, привязанная к ближайшей неделе (читатель целится в дату, а не в линию). */
const crosshair: Plugin = {
  id: 'fcCrosshair',
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements();
    if (!active || active.length === 0) {
      return;
    }
    const x = active[0].element.x;
    const {top, bottom} = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = FC_COLORS.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();
  }
};

/** Едва заметная подложка периода прогноза и подпись «Прогноз». */
function forecastZone(firstForecastIndex: number): Plugin {
  return {
    id: 'fcForecastZone',
    beforeDatasetsDraw(chart) {
      const meta = chart.getDatasetMeta(0);
      const point = meta.data[firstForecastIndex];
      if (!point) {
        return;
      }
      const {top, bottom, right} = chart.chartArea;
      const half = firstForecastIndex > 0 ? (point.x - meta.data[firstForecastIndex - 1].x) / 2 : 0;
      const left = point.x - half;
      const ctx = chart.ctx;
      ctx.save();
      ctx.fillStyle = FC_COLORS.zone;
      ctx.fillRect(left, top, right - left, bottom - top);
      ctx.fillStyle = FC_COLORS.muted;
      ctx.font = `12px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText('Прогноз', left + 8, top + 14);
      ctx.restore();
    }
  };
}

/** Подпись значения на конце горизонтального столбца. */
function valueLabels(format: (value: number) => string): Plugin {
  return {
    id: 'fcValueLabels',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.fillStyle = FC_COLORS.inkSecondary;
      ctx.font = `12px ${FONT}`;
      ctx.textBaseline = 'middle';
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        if (!chart.isDatasetVisible(datasetIndex)) {
          return;
        }
        chart.getDatasetMeta(datasetIndex).data.forEach((bar, index) => {
          const value = dataset.data[index];
          if (typeof value === 'number') {
            ctx.fillText(format(value), bar.x + 6, bar.y);
          }
        });
      });
      ctx.restore();
    }
  };
}

/** Значки легенды рисуются цветом набора данных (белая обводка точек не должна «обнулять» значок). */
function legendLabels(chart: Chart): LegendItem[] {
  return Chart.defaults.plugins.legend.labels.generateLabels(chart).map(item => {
    const dataset = chart.data.datasets[item.datasetIndex ?? 0] as any;
    const own = flags(dataset);
    const color = own.fcLegendColor ?? dataset.borderColor ?? dataset.backgroundColor;
    const style = own.fcLegendStyle ?? 'line';
    return {
      ...item, fillStyle: color, strokeStyle: color, lineWidth: style === 'line' ? 2 : 0, pointStyle: style,
      lineDash: style === 'line' ? (dataset.borderDash ?? []) : []
    } as LegendItem;
  });
}

function baseOptions(yTitle: string | null, ticks: (v: number) => string): any {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {duration: 250},
    interaction: {mode: 'index', intersect: false},
    layout: {padding: {top: 4, right: 8}},
    scales: {
      x: {
        grid: {display: false},
        border: {color: FC_COLORS.axis},
        ticks: {color: FC_COLORS.muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, font: {family: FONT, size: 12}}
      },
      y: {
        beginAtZero: true,
        grid: {color: FC_COLORS.grid, lineWidth: 1},
        border: {display: false},
        title: yTitle ? {display: true, text: yTitle, color: FC_COLORS.muted, font: {family: FONT, size: 12}} : {display: false},
        ticks: {color: FC_COLORS.muted, font: {family: FONT, size: 12}, callback: (v: number | string) => ticks(Number(v))}
      }
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: {
          usePointStyle: true, pointStyle: 'line', boxWidth: 28, boxHeight: 8, color: FC_COLORS.inkSecondary,
          font: {family: FONT, size: 13}, padding: 16,
          generateLabels: legendLabels,
          filter: (item: any, data: any) => !flags(data.datasets[item.datasetIndex]).fcHideLegend
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        titleColor: FC_COLORS.inkSecondary,
        bodyColor: FC_COLORS.ink,
        borderColor: FC_COLORS.axis,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 4,
        usePointStyle: true,
        titleFont: {family: FONT, size: 12, weight: 'normal'},
        bodyFont: {family: FONT, size: 13, weight: 'bold'},
        filter: (item: TooltipItem<any>) => !flags(item.dataset).fcHideTooltip
      }
    }
  };
}

const pad = (count: number): null[] => new Array<null>(Math.max(count, 0)).fill(null);

// ----------------------------------------------------------------------------------- прогноз

export function buildForecastChart(p: Prediction): ChartConfiguration {
  const target = p.target;
  const history = p.history;
  const points = p.points;
  const nH = history.length;
  const nF = points.length;
  const isoWeeks = [...history.map(h => h.weekStart), ...points.map(x => x.weekStart)];
  const labels = isoWeeks.map(formatWeekShort);
  const money = (v: number) => formatValue(target, v);
  const lastIndex = nH + nF - 1;

  const datasets: any[] = [];
  datasets.push({
    label: 'Нижняя граница', data: [...pad(nH), ...points.map(x => x.lower)], borderWidth: 0, pointRadius: 0,
    pointHoverRadius: 0, fill: false, fcHideLegend: true, fcHideTooltip: true
  });
  datasets.push({
    label: p.degraded ? 'Ориентировочный интервал' : `Интервал ${formatPercent(p.intervalLevel, 0)}`,
    data: [...pad(nH), ...points.map(x => x.upper)],
    borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, fill: '-1',
    backgroundColor: FC_COLORS.accentWash, borderColor: FC_COLORS.accentWash,
    fcHideLegend: false, fcHideTooltip: true, fcLegendColor: 'rgba(42, 120, 214, 0.35)', fcLegendStyle: 'rect'
  });
  datasets.push({
    label: 'Факт', data: [...history.map(h => h.actual), ...pad(nF)], borderColor: FC_COLORS.inkSecondary,
    backgroundColor: FC_COLORS.inkSecondary, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.2
  });
  datasets.push({
    label: 'Связка', data: [...pad(nH - 1), history[nH - 1]?.actual ?? null, points[0]?.predicted ?? null, ...pad(nF - 1)],
    borderColor: FC_COLORS.accent, borderWidth: 2, borderDash: [4, 4], pointRadius: 0, pointHoverRadius: 0,
    fcHideLegend: true, fcHideTooltip: true
  });
  datasets.push({
    label: p.degraded ? 'Упрощённый прогноз' : 'Прогноз', data: [...pad(nH), ...points.map(x => x.predicted)],
    borderColor: FC_COLORS.accent, backgroundColor: FC_COLORS.accent, borderWidth: 2, tension: 0.2,
    pointRadius: (ctx: any) => (ctx.dataIndex === lastIndex ? 4 : 0), pointHoverRadius: 5,
    pointBackgroundColor: FC_COLORS.accent, pointBorderColor: FC_COLORS.surface, pointBorderWidth: 2
  });
  if (points.length > 0 && points[0].base !== null) {
    datasets.push({
      label: 'База без маркетинга', data: [...pad(nH), ...points.map(x => x.base)], borderColor: FC_COLORS.muted,
      backgroundColor: FC_COLORS.muted, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 4,
      tension: 0.2
    });
  }

  const options = baseOptions(target === 'REVENUE' ? 'Выручка за неделю, $' : 'Бронирований за неделю', formatCompact);
  options.plugins.tooltip.callbacks = {
    title: (items: TooltipItem<any>[]) => 'Неделя с ' + formatDate(isoWeeks[items[0].dataIndex]),
    label: (item: TooltipItem<any>) => `${item.dataset.label}: ${money(Number(item.raw))}`,
    labelPointStyle: () => ({pointStyle: 'line', rotation: 0}),
    labelColor: (item: TooltipItem<any>) => ({
      borderColor: String(item.dataset.borderColor), backgroundColor: String(item.dataset.borderColor)
    }),
    afterBody: (items: TooltipItem<any>[]) => {
      const x = items[0].dataIndex - nH;
      return x >= 0 ? [`Интервал: ${money(points[x].lower)} – ${money(points[x].upper)}`] : [];
    }
  };
  return {type: 'line', data: {labels, datasets}, options, plugins: [crosshair, forecastZone(nH)]} as ChartConfiguration;
}

// ----------------------------------------------------------------------------------- вклад каналов

export function buildContributionTotalsChart(p: Prediction, codes: string[]): ChartConfiguration {
  const rows = p.channels
    .filter(c => c.contribution !== null)
    .map(c => ({label: c.name, value: c.contribution as number, color: channelColor(c.code, codes)}))
    .sort((a, b) => b.value - a.value);
  if (p.totals.base !== null) {
    rows.unshift({label: 'База без маркетинга', value: p.totals.base, color: FC_COLORS.neutral});
  }
  const format = (v: number) => formatValue(p.target, v);
  return {
    type: 'bar',
    data: {
      labels: rows.map(r => r.label),
      datasets: [{
        label: 'Вклад', data: rows.map(r => r.value), backgroundColor: rows.map(r => r.color),
        borderRadius: {topRight: 4, bottomRight: 4}, borderSkipped: 'start', maxBarThickness: 20
      }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: {duration: 250},
      layout: {padding: {right: 90}},
      scales: {
        x: {display: false, beginAtZero: true},
        y: {grid: {display: false}, border: {color: FC_COLORS.axis}, ticks: {color: FC_COLORS.inkSecondary, font: {family: FONT, size: 13}}}
      },
      plugins: {
        legend: {display: false},
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.98)', titleColor: FC_COLORS.inkSecondary, bodyColor: FC_COLORS.ink,
          borderColor: FC_COLORS.axis, borderWidth: 1, padding: 10, cornerRadius: 4,
          callbacks: {
            label: (item: TooltipItem<any>) => {
              const total = p.totals.predicted;
              return `${format(Number(item.raw))} (${formatPercent(Number(item.raw) / total)} прогноза)`;
            }
          }
        }
      }
    },
    plugins: [valueLabels(format)]
  } as unknown as ChartConfiguration;
}

export function buildContributionWeeklyChart(p: Prediction, codes: string[]): ChartConfiguration {
  const labels = p.points.map(x => formatWeekShort(x.weekStart));
  const names = new Map(p.channels.map(c => [c.code, c.name]));
  const datasets: any[] = [];
  if (p.points[0]?.base !== null && p.points[0]?.base !== undefined) {
    datasets.push({
      label: 'База без маркетинга', data: p.points.map(x => x.base), backgroundColor: FC_COLORS.neutral,
      stack: 'w', borderColor: FC_COLORS.surface, borderWidth: 2, borderRadius: 3, maxBarThickness: 24,
      fcLegendColor: FC_COLORS.neutral, fcLegendStyle: 'rect'
    });
  }
  for (const code of codes) {
    datasets.push({
      label: names.get(code) ?? code, data: p.points.map(x => x.contributions?.[code] ?? 0),
      backgroundColor: channelColor(code, codes), stack: 'w', borderColor: FC_COLORS.surface, borderWidth: 2,
      borderRadius: 3, maxBarThickness: 24, fcLegendColor: channelColor(code, codes), fcLegendStyle: 'rect'
    });
  }
  const options = baseOptions(p.target === 'REVENUE' ? 'Выручка за неделю, $' : 'Бронирований за неделю', formatCompact);
  options.scales.x.stacked = true;
  options.scales.y.stacked = true;
  options.plugins.legend.labels.pointStyle = 'rect';
  options.plugins.legend.labels.boxWidth = 12;
  options.plugins.legend.labels.boxHeight = 12;
  options.plugins.tooltip.callbacks = {
    title: (items: TooltipItem<any>[]) => 'Неделя с ' + formatDate(p.points[items[0].dataIndex].weekStart),
    label: (item: TooltipItem<any>) => `${item.dataset.label}: ${formatValue(p.target, Number(item.raw))}`,
    labelColor: (item: TooltipItem<any>) => ({
      borderColor: String(item.dataset.backgroundColor), backgroundColor: String(item.dataset.backgroundColor)
    }),
    footer: (items: TooltipItem<any>[]) => 'Прогноз: ' + formatValue(p.target, p.points[items[0].dataIndex].predicted)
  };
  options.interaction = {mode: 'index', intersect: false};
  return {type: 'bar', data: {labels, datasets}, options} as ChartConfiguration;
}

// ----------------------------------------------------------------------------------- оптимизация

export function buildOptimizationChart(o: Optimization): ChartConfiguration {
  const rows = [...o.allocations].sort((a, b) => b.recommendedSpend - a.recommendedSpend);
  const money = (v: number) => formatNumber(v) + ' $';
  return {
    type: 'bar',
    data: {
      labels: rows.map(r => r.name),
      datasets: [
        {
          label: 'План', data: rows.map(r => r.planSpend), backgroundColor: FC_COLORS.neutral,
          borderRadius: {topRight: 4, bottomRight: 4}, borderSkipped: 'start', maxBarThickness: 14,
          borderColor: FC_COLORS.surface, borderWidth: 2
        },
        {
          label: 'Рекомендация', data: rows.map(r => r.recommendedSpend), backgroundColor: FC_COLORS.accent,
          borderRadius: {topRight: 4, bottomRight: 4}, borderSkipped: 'start', maxBarThickness: 14,
          borderColor: FC_COLORS.surface, borderWidth: 2
        }
      ]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: {duration: 250},
      layout: {padding: {right: 80}},
      scales: {
        x: {display: false, beginAtZero: true},
        y: {grid: {display: false}, border: {color: FC_COLORS.axis}, ticks: {color: FC_COLORS.inkSecondary, font: {family: FONT, size: 13}}}
      },
      plugins: {
        legend: {
          position: 'top', align: 'start',
          labels: {usePointStyle: true, pointStyle: 'rect', boxWidth: 12, color: FC_COLORS.inkSecondary, font: {family: FONT, size: 13}, padding: 16}
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.98)', titleColor: FC_COLORS.inkSecondary, bodyColor: FC_COLORS.ink,
          borderColor: FC_COLORS.axis, borderWidth: 1, padding: 10, cornerRadius: 4,
          callbacks: {label: (item: TooltipItem<any>) => `${item.dataset.label}: ${money(Number(item.raw))}`}
        }
      }
    },
    plugins: [valueLabels(money)]
  } as unknown as ChartConfiguration;
}

// ----------------------------------------------------------------------------------- модель

/** Сравнение алгоритмов по ошибке: выбранный выделен акцентом, остальные — нейтральные. */
export function buildLeaderboardChart(candidates: ModelCandidate[]): ChartConfiguration {
  const rows = candidates.filter(c => c.wape !== null).sort((a, b) => (a.wape as number) - (b.wape as number));
  const format = (v: number) => formatPercent(v, 1);
  return {
    type: 'bar',
    data: {
      labels: rows.map(r => r.label),
      datasets: [{
        label: 'Ошибка WAPE', data: rows.map(r => r.wape),
        backgroundColor: rows.map(r => (r.selected ? FC_COLORS.accent : FC_COLORS.neutral)),
        borderRadius: {topRight: 4, bottomRight: 4}, borderSkipped: 'start', maxBarThickness: 20
      }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: {duration: 250},
      layout: {padding: {right: 70}},
      scales: {
        x: {display: false, beginAtZero: true},
        y: {grid: {display: false}, border: {color: FC_COLORS.axis}, ticks: {color: FC_COLORS.inkSecondary, font: {family: FONT, size: 13}}}
      },
      plugins: {
        legend: {display: false},
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.98)', titleColor: FC_COLORS.inkSecondary, bodyColor: FC_COLORS.ink,
          borderColor: FC_COLORS.axis, borderWidth: 1, padding: 10, cornerRadius: 4,
          callbacks: {label: (item: TooltipItem<any>) => 'Ошибка: ' + format(Number(item.raw))}
        }
      }
    },
    plugins: [valueLabels(format)]
  } as unknown as ChartConfiguration;
}

function actualVsPredicted(target: ForecastTarget, weeks: string[], actual: number[], predicted: number[],
                           lower: number[] | null, upper: number[] | null, intervalLabel: string): ChartConfiguration {
  const labels = weeks.map(formatWeekShort);
  const datasets: any[] = [];
  if (lower && upper) {
    datasets.push({label: 'Нижняя граница', data: lower, borderWidth: 0, pointRadius: 0, fill: false, fcHideLegend: true, fcHideTooltip: true});
    datasets.push({
      label: intervalLabel, data: upper, borderWidth: 0, pointRadius: 0, fill: '-1', backgroundColor: FC_COLORS.accentWash,
      fcHideTooltip: true, fcLegendColor: 'rgba(42, 120, 214, 0.35)', fcLegendStyle: 'rect'
    });
  }
  datasets.push({
    label: 'Факт', data: actual, borderColor: FC_COLORS.inkSecondary, backgroundColor: FC_COLORS.inkSecondary,
    borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.2
  });
  datasets.push({
    label: 'Прогноз модели', data: predicted, borderColor: FC_COLORS.accent, backgroundColor: FC_COLORS.accent,
    borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.2
  });
  const options = baseOptions(target === 'REVENUE' ? 'Выручка за неделю, $' : 'Бронирований за неделю', formatCompact);
  options.plugins.tooltip.callbacks = {
    title: (items: TooltipItem<any>[]) => 'Неделя с ' + formatDate(weeks[items[0].dataIndex]),
    label: (item: TooltipItem<any>) => `${item.dataset.label}: ${formatValue(target, Number(item.raw))}`,
    labelPointStyle: () => ({pointStyle: 'line', rotation: 0}),
    labelColor: (item: TooltipItem<any>) => ({
      borderColor: String(item.dataset.borderColor), backgroundColor: String(item.dataset.borderColor)
    })
  };
  return {type: 'line', data: {labels, datasets}, options, plugins: [crosshair]} as ChartConfiguration;
}

/** Проверка модели вне выборки: прогноз против факта на неделях, которых она не видела при обучении. */
export function buildBacktestChart(target: ForecastTarget, points: BacktestPoint[], level: number): ChartConfiguration {
  return actualVsPredicted(target, points.map(p => p.weekStart), points.map(p => p.actual), points.map(p => p.predicted),
    points.map(p => p.lower), points.map(p => p.upper), `Интервал ${formatPercent(level, 0)}`);
}

export function buildMonitoringChart(target: ForecastTarget, m: Monitoring): ChartConfiguration {
  return actualVsPredicted(target, m.points.map(p => p.weekStart), m.points.map(p => p.actual),
    m.points.map(p => p.predicted), null, null, '');
}

export {targetUnit};
