import {ComponentFixture, TestBed} from '@angular/core/testing';
import {DateRangePickerComponent} from './date-range-picker.component';

describe('DateRangePickerComponent', () => {
  let fixture: ComponentFixture<DateRangePickerComponent>;
  let cmp: DateRangePickerComponent;
  let emitted: { from: string | null, to: string | null }[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({declarations: [DateRangePickerComponent]}).compileComponents();
    fixture = TestBed.createComponent(DateRangePickerComponent);
    cmp = fixture.componentInstance;
    cmp.minDate = '2026-10-05';
    cmp.viewYear = 2026;
    cmp.viewMonth = 9;
    cmp.busy = [{from: '2026-10-14', to: '2026-10-17'}];
    emitted = [];
    cmp.rangeChange.subscribe(r => emitted.push(r));
    fixture.detectChanges();
  });

  const cell = (iso: string) => cmp.weeks.flat().find(c => c && c.iso === iso)!;
  const click = (iso: string) => cmp.select(cell(iso));

  it('показывает октябрь 2026 с неделей, начинающейся в понедельник', () => {
    expect(cmp.monthTitle).toBe('Октябрь 2026');
    expect(cmp.weeks[0].filter(c => c).length).toBe(4);          // 1 октября 2026 — четверг: в первой неделе дни с четверга по воскресенье
    expect(fixture.nativeElement.querySelectorAll('button.drp-day').length).toBe(31);
  });

  it('прошедшие и занятые даты недоступны для заезда', () => {
    expect(cell('2026-10-04').clickable).toBeFalse();
    expect(cell('2026-10-14').clickable).toBeFalse();
    expect(cell('2026-10-16').clickable).toBeFalse();
    expect(cell('2026-10-17').clickable).toBeTrue();
    expect(cell('2026-10-05').clickable).toBeTrue();
  });

  it('два щелчка выбирают период и сообщают о нём', () => {
    click('2026-10-07');
    click('2026-10-10');
    expect(cmp.from).toBe('2026-10-07');
    expect(cmp.to).toBe('2026-10-10');
    expect(cmp.nights).toBe(3);
    expect(emitted[emitted.length - 1]).toEqual({from: '2026-10-07', to: '2026-10-10'});
  });

  it('выехать можно в день заезда следующего гостя, но не через занятые ночи', () => {
    click('2026-10-12');
    expect(cell('2026-10-14').clickable).toBeTrue();             // выезд в день, когда начинается чужая бронь
    click('2026-10-14');
    expect(cmp.to).toBe('2026-10-14');

    click('2026-10-12');                                         // новый выбор
    click('2026-10-18');                                         // через занятые ночи 14–16
    expect(cmp.to).toBeNull();
    expect(cmp.hint).toContain('занятые');
  });

  it('щелчок раньше заезда переносит заезд, сброс очищает выбор', () => {
    click('2026-10-09');
    click('2026-10-07');
    expect(cmp.from).toBe('2026-10-07');
    expect(cmp.to).toBeNull();
    cmp.reset();
    expect(cmp.from).toBeNull();
    expect(emitted[emitted.length - 1]).toEqual({from: null, to: null});
  });

  it('не позволяет выбрать больше допустимого числа суток', () => {
    cmp.maxNights = 3;
    cmp.build();
    click('2026-10-07');
    click('2026-10-11');
    expect(cmp.to).toBeNull();
    expect(cmp.hint).toContain('3 суток');
  });

  it('при изменении занятости выбранный период сбрасывается, если стал недопустим', () => {
    click('2026-10-07');
    click('2026-10-10');
    cmp.busy = [{from: '2026-10-08', to: '2026-10-09'}];
    cmp.ngOnChanges({busy: {previousValue: [], currentValue: cmp.busy, firstChange: false, isFirstChange: () => false}});
    expect(cmp.from).toBeNull();
    expect(cmp.to).toBeNull();
  });

  it('листает месяцы, но не раньше минимальной даты', () => {
    expect(cmp.canGoBack).toBeFalse();
    cmp.nextMonth();
    expect(cmp.monthTitle).toBe('Ноябрь 2026');
    expect(cmp.canGoBack).toBeTrue();
    cmp.prevMonth();
    expect(cmp.monthTitle).toBe('Октябрь 2026');
  });
});
