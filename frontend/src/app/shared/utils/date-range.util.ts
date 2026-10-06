/**
 * Работа с датами проживания без часовых поясов: даты — строки ISO «гггг-мм-дд».
 * Проживание — полуинтервал [заезд, выезд): ночь даты выезда уже свободна.
 */
export type BusyPeriod = { from: string, to: string };

export class DateRangeUtil {
  private static readonly DAY_MS = 86400000;

  static toIso(year: number, monthIndex: number, day: number): string {
    return year.toString().padStart(4, '0') + '-' + (monthIndex + 1).toString().padStart(2, '0') + '-' + day.toString().padStart(2, '0');
  }

  static today(): string {
    const now = new Date();
    return DateRangeUtil.toIso(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private static utc(iso: string): number {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }

  static addDays(iso: string, days: number): string {
    const dt = new Date(DateRangeUtil.utc(iso) + days * DateRangeUtil.DAY_MS);
    return DateRangeUtil.toIso(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
  }

  /** Число ночей между датами (выезд минус заезд). */
  static nights(from: string, to: string): number {
    return Math.round((DateRangeUtil.utc(to) - DateRangeUtil.utc(from)) / DateRangeUtil.DAY_MS);
  }

  /** Занята ли ночь указанной даты: заезд ≤ дата < выезд хотя бы одной брони. */
  static isNightBusy(iso: string, busy: BusyPeriod[]): boolean {
    return busy.some(p => p.from <= iso && iso < p.to);
  }

  /** Свободны ли все ночи периода [from, to). */
  static isRangeFree(from: string, to: string, busy: BusyPeriod[]): boolean {
    for (let d = from; d < to; d = DateRangeUtil.addDays(d, 1)) {
      if (DateRangeUtil.isNightBusy(d, busy)) {
        return false;
      }
    }
    return true;
  }

  /** День недели с понедельника: 0 — пн, 6 — вс. */
  static weekdayMonFirst(iso: string): number {
    const dow = new Date(DateRangeUtil.utc(iso)).getUTCDay();
    return (dow + 6) % 7;
  }

  static daysInMonth(year: number, monthIndex: number): number {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  }

  static formatRu(iso: string | null | undefined): string {
    if (!iso) {
      return '';
    }
    const [y, m, d] = iso.split('-');
    return d + '.' + m + '.' + y;
  }

  /** Склонение слова «сутки» по числу. */
  static daysWord(n: number): string {
    const mod100 = Math.abs(n) % 100;
    const mod10 = mod100 % 10;
    if (mod100 > 10 && mod100 < 20) {
      return 'суток';
    }
    if (mod10 === 1) {
      return 'сутки';
    }
    return 'суток';
  }
}
