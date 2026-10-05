import {ChannelType, CampaignStatus, ForecastTarget, MonitoringStatus} from './forecast.types';

// Форматирование чисел и дат для интерфейса на русском языке.

const NUMBER = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 0});
const COMPACT = new Intl.NumberFormat('ru-RU', {notation: 'compact', maximumFractionDigits: 1});

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return new Intl.NumberFormat('ru-RU', {minimumFractionDigits: digits, maximumFractionDigits: digits}).format(value);
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return NUMBER.format(value) + ' $';
}

export function formatCompact(value: number): string {
  return COMPACT.format(value);
}

/** Значение показателя: выручка в долларах, бронирования — штуки. */
export function formatValue(target: ForecastTarget, value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return target === 'REVENUE' ? formatMoney(value) : NUMBER.format(value);
}

export function targetUnit(target: ForecastTarget): string {
  return target === 'REVENUE' ? '$' : 'брон.';
}

/** Доля (0,123) в процентах: «12,3 %». */
export function formatPercent(fraction: number | null | undefined, digits = 1): string {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) {
    return '—';
  }
  return formatNumber(fraction * 100, digits) + ' %';
}

export function formatSignedPercent(fraction: number | null | undefined, digits = 1): string {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) {
    return '—';
  }
  const sign = fraction > 0 ? '+' : fraction < 0 ? '−' : '';
  return sign + formatNumber(Math.abs(fraction) * 100, digits) + ' %';
}

/** «05.10» для подписей оси. */
export function formatWeekShort(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}.${month}`;
}

/** «05.10.2026». */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const [year, month, day] = iso.substring(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  return `${formatDate(iso)} ${iso.substring(11, 16)}`;
}

export const TARGET_TITLES: Record<ForecastTarget, string> = {
  REVENUE: 'Выручка',
  BOOKINGS: 'Бронирования'
};

export const CHANNEL_TYPE_TITLES: Record<ChannelType, string> = {
  ONLINE_PAID: 'Онлайн: платная реклама',
  ONLINE_OWNED: 'Онлайн: собственные каналы',
  PARTNER: 'Партнёры',
  OFFLINE: 'Офлайн'
};

export const CAMPAIGN_STATUS_TITLES: Record<CampaignStatus, string> = {
  PLANNED: 'Запланирована',
  ACTIVE: 'Идёт',
  COMPLETED: 'Завершена'
};

export const MONITORING_TITLES: Record<MonitoringStatus, string> = {
  NO_DATA: 'Нет новых данных',
  INSUFFICIENT: 'Мало данных для оценки',
  OK: 'Точность в норме',
  WARN: 'Точность снизилась',
  RETRAIN: 'Требуется переобучение'
};

export const SOURCE_TITLES: Record<string, string> = {
  DEMO: 'Демо',
  IMPORT: 'Импорт',
  MANUAL: 'Вручную'
};

/** Дата следующего понедельника или сегодняшняя, если сегодня понедельник (для формы кампании). */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Сообщение об ошибке из ответа сервера (поле message) либо запасной текст. */
export function errorMessage(error: unknown, fallback = 'Не удалось выполнить запрос'): string {
  const body = (error as { error?: { message?: unknown } } | null)?.error;
  if (body && typeof body.message === 'string' && body.message) {
    return body.message;
  }
  const status = (error as { status?: number } | null)?.status;
  if (status === 0) {
    return 'Нет связи с сервером';
  }
  return fallback;
}
