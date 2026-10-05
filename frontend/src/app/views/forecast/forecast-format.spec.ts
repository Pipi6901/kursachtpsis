import {
  CAMPAIGN_STATUS_TITLES, errorMessage, formatCompact, formatDate, formatDateTime, formatMoney, formatNumber,
  formatPercent, formatSignedPercent, formatValue, formatWeekShort
} from './forecast-format';

// Intl для ru-RU разделяет разряды неразрывным пробелом — приводим к обычному, чтобы сравнивать строки.
const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('forecast-format', () => {
  it('форматирует деньги с разрядами и знаком доллара', () => {
    expect(plain(formatMoney(236457.4))).toBe('236 457 $');
    expect(formatMoney(null)).toBe('—');
  });

  it('форматирует доли как проценты с запятой', () => {
    expect(formatPercent(0.0603)).toBe('6,0 %');
    expect(formatPercent(0.8, 0)).toBe('80 %');
    expect(formatPercent(undefined)).toBe('—');
  });

  it('знаковый процент использует настоящий минус', () => {
    expect(formatSignedPercent(0.086)).toBe('+8,6 %');
    expect(formatSignedPercent(-0.328)).toBe('−32,8 %');
    expect(formatSignedPercent(0)).toBe('0,0 %');
  });

  it('форматирует даты', () => {
    expect(formatDate('2026-10-05')).toBe('05.10.2026');
    expect(formatWeekShort('2026-10-05')).toBe('05.10');
    expect(formatDateTime('2026-10-05T23:14:55.123')).toBe('05.10.2026 23:14');
    expect(formatDate(null)).toBe('—');
  });

  it('значение показателя: выручка в долларах, бронирования — штуки', () => {
    expect(plain(formatValue('REVENUE', 1500))).toBe('1 500 $');
    expect(plain(formatValue('BOOKINGS', 1500))).toBe('1 500');
    expect(formatValue('REVENUE', null)).toBe('—');
  });

  it('форматирует числа с заданной точностью и компактно', () => {
    expect(formatNumber(7.456, 1)).toBe('7,5');
    expect(plain(formatCompact(20000))).toContain('20');
  });

  it('достаёт сообщение об ошибке из ответа сервера', () => {
    expect(errorMessage({error: {message: 'Модель не обучена'}})).toBe('Модель не обучена');
    expect(errorMessage({status: 0})).toBe('Нет связи с сервером');
    expect(errorMessage({status: 500}, 'Запасной текст')).toBe('Запасной текст');
  });

  it('содержит русские названия статусов', () => {
    expect(CAMPAIGN_STATUS_TITLES.PLANNED).toBe('Запланирована');
  });
});
