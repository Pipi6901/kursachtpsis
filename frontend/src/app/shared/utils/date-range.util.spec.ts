import {BusyPeriod, DateRangeUtil} from './date-range.util';

describe('DateRangeUtil', () => {
  const busy: BusyPeriod[] = [{from: '2026-10-10', to: '2026-10-13'}];

  it('прибавляет дни через границы месяца и года', () => {
    expect(DateRangeUtil.addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(DateRangeUtil.addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(DateRangeUtil.addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(DateRangeUtil.addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('считает ночи как разницу дат выезда и заезда', () => {
    expect(DateRangeUtil.nights('2026-10-10', '2026-10-13')).toBe(3);
    expect(DateRangeUtil.nights('2026-10-30', '2026-11-02')).toBe(3);
    expect(DateRangeUtil.nights('2026-10-10', '2026-10-10')).toBe(0);
  });

  it('ночь дня выезда свободна, ночь дня заезда занята', () => {
    expect(DateRangeUtil.isNightBusy('2026-10-09', busy)).toBeFalse();
    expect(DateRangeUtil.isNightBusy('2026-10-10', busy)).toBeTrue();
    expect(DateRangeUtil.isNightBusy('2026-10-12', busy)).toBeTrue();
    expect(DateRangeUtil.isNightBusy('2026-10-13', busy)).toBeFalse();
  });

  it('период свободен, если все его ночи свободны: можно выехать в день заезда следующего гостя', () => {
    expect(DateRangeUtil.isRangeFree('2026-10-07', '2026-10-10', busy)).toBeTrue();
    expect(DateRangeUtil.isRangeFree('2026-10-13', '2026-10-15', busy)).toBeTrue();
    expect(DateRangeUtil.isRangeFree('2026-10-09', '2026-10-11', busy)).toBeFalse();
    expect(DateRangeUtil.isRangeFree('2026-10-08', '2026-10-15', busy)).toBeFalse();
  });

  it('определяет день недели с понедельника', () => {
    expect(DateRangeUtil.weekdayMonFirst('2026-10-05')).toBe(0);   // понедельник
    expect(DateRangeUtil.weekdayMonFirst('2026-10-11')).toBe(6);   // воскресенье
  });

  it('форматирует дату и склоняет «сутки»', () => {
    expect(DateRangeUtil.formatRu('2026-10-05')).toBe('05.10.2026');
    expect(DateRangeUtil.formatRu(null)).toBe('');
    expect(DateRangeUtil.daysWord(1)).toBe('сутки');
    expect(DateRangeUtil.daysWord(2)).toBe('суток');
    expect(DateRangeUtil.daysWord(11)).toBe('суток');
    expect(DateRangeUtil.daysWord(21)).toBe('сутки');
  });
});
