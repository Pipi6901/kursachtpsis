import {
  buildBacktestChart, buildContributionTotalsChart, buildContributionWeeklyChart, buildForecastChart,
  buildLeaderboardChart, buildOptimizationChart
} from './forecast-charts';
import {FC_COLORS, channelColor} from './forecast-colors';
import {degradedPrediction, modelDetails, optimization, prediction} from './forecast.fixtures';

const CODES = ['search', 'social', 'ota'];

describe('forecast-charts', () => {
  it('график прогноза: подписи, ряды и скрытые служебные наборы', () => {
    const p = prediction();
    const config = buildForecastChart(p);
    const labels = config.data.labels as string[];
    expect(labels.length).toBe(26 + 4);
    expect(labels[0]).toMatch(/^\d{2}\.\d{2}$/);
    const datasets = config.data.datasets as any[];
    const names = datasets.filter(d => !d.fcHideLegend).map(d => d.label);
    expect(names).toEqual(['Интервал 80 %', 'Факт', 'Прогноз', 'База без маркетинга']);
    const forecast = datasets.find(d => d.label === 'Прогноз');
    expect(forecast.data.slice(0, 26).every((v: unknown) => v === null)).toBeTrue();
    expect(forecast.data.slice(26)).toEqual(p.points.map(x => x.predicted));
    const fact = datasets.find(d => d.label === 'Факт');
    expect(fact.data.slice(26).every((v: unknown) => v === null)).toBeTrue();
  });

  it('интервал заполняется до нижней границы', () => {
    const datasets = buildForecastChart(prediction()).data.datasets as any[];
    const upperIndex = datasets.findIndex(d => d.label === 'Интервал 80 %');
    expect(datasets[upperIndex].fill).toBe('-1');
    expect(datasets[upperIndex - 1].label).toBe('Нижняя граница');
    expect(datasets[upperIndex - 1].fcHideTooltip).toBeTrue();
  });

  it('в упрощённом режиме нет базы без маркетинга и меняется подпись интервала', () => {
    const datasets = buildForecastChart(degradedPrediction()).data.datasets as any[];
    expect(datasets.some(d => d.label === 'База без маркетинга')).toBeFalse();
    expect(datasets.some(d => d.label === 'Ориентировочный интервал')).toBeTrue();
    expect(datasets.some(d => d.label === 'Упрощённый прогноз')).toBeTrue();
  });

  it('вклад каналов (итого): база и каналы по убыванию, цвет закреплён за каналом', () => {
    const config = buildContributionTotalsChart(prediction(), CODES);
    const data = config.data.datasets[0].data as number[];
    const labels = config.data.labels as string[];
    expect(labels[0]).toBe('База без маркетинга');
    expect(data[0]).toBe(60000);
    expect(data.slice(1)).toEqual([...data.slice(1)].sort((a, b) => b - a));
    const colors = config.data.datasets[0].backgroundColor as string[];
    expect(colors[0]).toBe(FC_COLORS.neutral);
    expect(colors[1]).toBe(channelColor('search', CODES));
  });

  it('вклад каналов по неделям: стопка из базы и каналов, сумма равна прогнозу', () => {
    const p = prediction();
    const config = buildContributionWeeklyChart(p, CODES);
    const datasets = config.data.datasets as any[];
    expect(datasets.length).toBe(1 + CODES.length);
    expect(datasets.every(d => d.stack === 'w')).toBeTrue();
    const week0 = datasets.reduce((sum, d) => sum + d.data[0], 0);
    expect(week0).toBe(p.points[0].predicted);
    expect(datasets.every(d => d.fcLegendStyle === 'rect')).toBeTrue();
  });

  it('цвета каналов берутся из проверенной палитры по порядку, сверх восьми — нейтральный', () => {
    const codes = Array.from({length: 10}, (_, i) => 'c' + i);
    expect(channelColor('c0', codes)).toBe(FC_COLORS.channels[0]);
    expect(channelColor('c7', codes)).toBe(FC_COLORS.channels[7]);
    expect(channelColor('c9', codes)).toBe(FC_COLORS.neutral);
    expect(channelColor('нет такого', codes)).toBe(FC_COLORS.neutral);
    expect(new Set(FC_COLORS.channels).size).toBe(8);
  });

  it('оптимизация: два ряда — план и рекомендация, каналы по убыванию рекомендации', () => {
    const config = buildOptimizationChart(optimization());
    const labels = config.data.labels as string[];
    expect(config.data.datasets.map((d: any) => d.label)).toEqual(['План', 'Рекомендация']);
    const recommended = config.data.datasets[1].data as number[];
    expect(recommended).toEqual([...recommended].sort((a, b) => b - a));
    expect(labels.length).toBe(3);
    expect(config.data.datasets[1].backgroundColor).toBe(FC_COLORS.accent);
  });

  it('сравнение алгоритмов: выбранный выделен акцентом, пропущенные не показываются', () => {
    const config = buildLeaderboardChart(modelDetails().candidates);
    const labels = config.data.labels as string[];
    expect(labels.length).toBe(2);
    expect(labels[0]).toBe('Модель маркетингового микса (MMM)');
    expect((config.data.datasets[0].backgroundColor as string[])[0]).toBe(FC_COLORS.accent);
    expect((config.data.datasets[0].backgroundColor as string[])[1]).toBe(FC_COLORS.neutral);
  });

  it('проверка вне выборки: факт против прогноза с интервалом', () => {
    const points = [
      {weekStart: '2026-01-05', actual: 100, predicted: 98, lower: 90, upper: 110},
      {weekStart: '2026-01-12', actual: 105, predicted: 101, lower: 92, upper: 112}
    ];
    const datasets = buildBacktestChart('REVENUE', points, 0.8).data.datasets as any[];
    expect(datasets.map(d => d.label)).toEqual(['Нижняя граница', 'Интервал 80 %', 'Факт', 'Прогноз модели']);
    expect(datasets[2].data).toEqual([100, 105]);
  });
});
