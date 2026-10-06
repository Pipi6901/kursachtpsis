import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import {BusyPeriod, DateRangeUtil} from "../../utils/date-range.util";

type DayCell = {
  iso: string,
  day: number,
  disabled: boolean,   // прошедшая дата или занятая ночь, с которой нельзя начать проживание
  busy: boolean,
  start: boolean,
  end: boolean,
  inRange: boolean,
  clickable: boolean,
};

/**
 * Календарь выбора дат проживания. Первый щелчок — день заезда, второй — день выезда. Занятые ночи недоступны;
 * день выезда может совпадать с днём заезда следующего гостя. Выбранный период передаётся событием {@code rangeChange}.
 */
@Component({
  selector: 'app-date-range-picker',
  templateUrl: './date-range-picker.component.html',
  styleUrls: ['./date-range-picker.component.scss']
})
export class DateRangePickerComponent implements OnInit, OnChanges {

  @Input() busy: BusyPeriod[] = [];
  @Input() maxNights = 100;
  @Input() minDate: string = DateRangeUtil.today();
  @Output() rangeChange = new EventEmitter<{ from: string | null, to: string | null }>();

  readonly weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  readonly months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  viewYear = new Date().getFullYear();
  viewMonth = new Date().getMonth();
  from: string | null = null;
  to: string | null = null;
  hover: string | null = null;
  hint = '';
  weeks: DayCell[][] = [];

  ngOnInit(): void {
    this.build();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['busy'] || changes['minDate']) {
      // занятость изменилась: выбранный период мог стать недопустимым
      if (this.from && this.to && !DateRangeUtil.isRangeFree(this.from, this.to, this.busy)) {
        this.reset();
      }
      this.build();
    }
  }

  get monthTitle(): string {
    return this.months[this.viewMonth] + ' ' + this.viewYear;
  }

  get canGoBack(): boolean {
    const [y, m] = this.minDate.split('-').map(Number);
    return this.viewYear > y || (this.viewYear === y && this.viewMonth > m - 1);
  }

  prevMonth(): void {
    if (!this.canGoBack) {
      return;
    }
    this.viewMonth--;
    if (this.viewMonth < 0) {
      this.viewMonth = 11;
      this.viewYear--;
    }
    this.build();
  }

  nextMonth(): void {
    this.viewMonth++;
    if (this.viewMonth > 11) {
      this.viewMonth = 0;
      this.viewYear++;
    }
    this.build();
  }

  reset(): void {
    this.from = null;
    this.to = null;
    this.hover = null;
    this.hint = '';
    this.rangeChange.emit({from: null, to: null});
    this.build();
  }

  private isFreeNight(iso: string): boolean {
    return iso >= this.minDate && !DateRangeUtil.isNightBusy(iso, this.busy);
  }

  /** Можно ли выбрать день выезда: ночи от заезда до этого дня свободны, число ночей в пределах лимита. */
  private canEndOn(iso: string): boolean {
    if (!this.from || iso <= this.from) {
      return false;
    }
    return DateRangeUtil.nights(this.from, iso) <= this.maxNights && DateRangeUtil.isRangeFree(this.from, iso, this.busy);
  }

  select(cell: DayCell): void {
    this.hint = '';
    if (!cell.clickable) {
      return;
    }
    const iso = cell.iso;
    if (!this.from || this.to) {
      this.from = iso;
      this.to = null;
      this.rangeChange.emit({from: null, to: null});
    } else if (iso <= this.from) {
      this.from = iso;
    } else if (this.canEndOn(iso)) {
      this.to = iso;
      this.rangeChange.emit({from: this.from, to: this.to});
    } else if (DateRangeUtil.nights(this.from, iso) > this.maxNights) {
      this.hint = 'Максимальный срок проживания – ' + this.maxNights + ' суток';
    } else if (this.isFreeNight(iso)) {
      // между выбранными датами есть занятые ночи: начинаем выбор заново с этой даты
      this.from = iso;
      this.hint = 'В выбранном периоде есть занятые даты, заезд перенесён';
    } else {
      this.hint = 'В выбранном периоде есть занятые даты';
    }
    this.build();
  }

  setHover(cell: DayCell | null): void {
    this.hover = cell && cell.clickable ? cell.iso : null;
    this.build();
  }

  build(): void {
    const first = DateRangeUtil.toIso(this.viewYear, this.viewMonth, 1);
    const offset = DateRangeUtil.weekdayMonFirst(first);
    const total = DateRangeUtil.daysInMonth(this.viewYear, this.viewMonth);
    const cells: (DayCell | null)[] = Array(offset).fill(null);
    // предварительный просмотр периода при наведении, пока день выезда не выбран
    const previewEnd = this.from && !this.to && this.hover && this.canEndOn(this.hover) ? this.hover : null;
    const rangeEnd = this.to || previewEnd;
    for (let d = 1; d <= total; d++) {
      const iso = DateRangeUtil.toIso(this.viewYear, this.viewMonth, d);
      const past = iso < this.minDate;
      const busy = !past && DateRangeUtil.isNightBusy(iso, this.busy);
      const startClickable = !past && !busy;
      const endClickable = !!this.from && !this.to && this.canEndOn(iso);
      cells.push({
        iso,
        day: d,
        disabled: past || busy,
        busy,
        start: iso === this.from,
        end: iso === rangeEnd,
        inRange: !!this.from && !!rangeEnd && iso > this.from && iso < rangeEnd,
        clickable: startClickable || endClickable,
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    this.weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      this.weeks.push(cells.slice(i, i + 7) as DayCell[]);
    }
  }

  /** Ячейки пересоздаются при наведении мыши: сохраняем узлы DOM, иначе щелчок теряется. */
  trackByIndex(index: number): number {
    return index;
  }

  get nights(): number {
    return this.from && this.to ? DateRangeUtil.nights(this.from, this.to) : 0;
  }

  get nightsWord(): string {
    return DateRangeUtil.daysWord(this.nights);
  }

  format(iso: string | null): string {
    return DateRangeUtil.formatRu(iso);
  }
}
