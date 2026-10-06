import {ComponentFixture, TestBed, fakeAsync, flush, tick} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatSnackBar} from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import {of, throwError} from 'rxjs';
import {AuthService} from '../../../core/auth/auth.service';
import {ForecastService} from '../forecast.service';
import {ForecastDashboardComponent} from './forecast-dashboard.component';
import {degradedPrediction, optimization, prediction} from '../forecast.fixtures';

describe('ForecastDashboardComponent', () => {
  let fixture: ComponentFixture<ForecastDashboardComponent>;
  let component: ForecastDashboardComponent;
  let service: jasmine.SpyObj<ForecastService>;
  let snackBar: jasmine.SpyObj<MatSnackBar>;

  beforeEach(() => {
    service = jasmine.createSpyObj<ForecastService>('ForecastService', ['predict', 'optimize']);
    service.predict.and.returnValue(of(prediction()));
    service.optimize.and.returnValue(of(optimization()));
    snackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
    TestBed.configureTestingModule({
      declarations: [ForecastDashboardComponent],
      imports: [CommonModule, FormsModule],
      providers: [
        {provide: ForecastService, useValue: service},
        {provide: AuthService, useValue: {getIsAdminIn: () => true, getIsManagerIn: () => false}},
        {provide: MatSnackBar, useValue: snackBar}
      ],
      // Вложенные компоненты (график, вкладки) и routerLink проверяются отдельно.
      schemas: [NO_ERRORS_SCHEMA]
    });
    fixture = TestBed.createComponent(ForecastDashboardComponent);
    component = fixture.componentInstance;
  });

  /** Первый расчёт запускается через debounce 250 мс. */
  function init(): void {
    fixture.detectChanges();
    tick(250);
    fixture.detectChanges();
  }

  it('при открытии запрашивает прогноз выручки на 12 недель по плану кампаний', fakeAsync(() => {
    init();
    expect(service.predict).toHaveBeenCalledTimes(1);
    expect(service.predict).toHaveBeenCalledWith({target: 'REVENUE', horizonWeeks: 12, scenario: {type: 'PLAN'}});
    expect(component.loading).toBeFalse();
    expect(component.prediction).not.toBeNull();
    expect(component.forecastChart).not.toBeNull();
    expect(component.contribTotalsChart).not.toBeNull();
    expect(component.contribWeeklyChart).not.toBeNull();
    expect(component.channelCodes).toEqual(['search', 'social', 'ota']);
    flush();
  }));

  it('показывает ключевые показатели и таблицу значений', fakeAsync(() => {
    init();
    const text = (fixture.nativeElement as HTMLElement).textContent!.replace(/[  ]/g, ' ');
    expect(text).toContain('Выручка: прогноз на 4 нед.');
    expect(text).toContain('96 600 $');
    expect(text).toContain('+7,3 %');
    expect(text).toContain('Ошибка модели (WAPE)');
    expect(text).toContain('6,0 %');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('table.fc-table tbody tr').length).toBeGreaterThanOrEqual(4);
    flush();
  }));

  it('несколько быстрых изменений объединяются в один запрос', fakeAsync(() => {
    init();
    service.predict.calls.reset();
    component.setScenario('CUSTOM');
    component.setMultiplier('search', 1.5);
    component.setMultiplier('search', 2);
    tick(250);
    expect(service.predict).toHaveBeenCalledTimes(1);
    expect(service.predict).toHaveBeenCalledWith({
      target: 'REVENUE', horizonWeeks: 12,
      scenario: {type: 'CUSTOM', multipliers: {search: 2}, weeklySpend: undefined}
    });
    flush();
  }));

  it('смена показателя сбрасывает рекомендацию и запрашивает новый прогноз', fakeAsync(() => {
    init();
    component.runOptimization();
    expect(component.optimization).not.toBeNull();
    service.predict.calls.reset();
    component.setTarget('BOOKINGS');
    tick(250);
    expect(component.optimization).toBeNull();
    expect(component.optimizationChart).toBeNull();
    expect(service.predict.calls.mostRecent().args[0].target).toBe('BOOKINGS');
    flush();
  }));

  it('в упрощённом режиме нет разложения по каналам и вклада маркетинга', fakeAsync(() => {
    service.predict.and.returnValue(of(degradedPrediction()));
    init();
    expect(component.contribTotalsChart).toBeNull();
    expect(component.contribWeeklyChart).toBeNull();
    expect(component.marketingEffect).toBeNull();
    expect(component.marketingShare).toBeNull();
    expect(component.returnText).toBeNull();
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Упрощённый режим');
    expect(text).toContain('Модель недоступна');
    flush();
  }));

  it('показывает сообщение сервера, если прогноз получить не удалось', fakeAsync(() => {
    service.predict.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: {message: 'Модель ещё не обучена'}
    })));
    init();
    expect(component.errorText).toBe('Модель ещё не обучена');
    expect(component.prediction).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.fc-alert-danger')).not.toBeNull();
    flush();
  }));

  it('считает вклад маркетинга и отдачу затрат', fakeAsync(() => {
    init();
    expect(component.marketingEffect).toBe(96600 - 60000);
    expect(component.marketingShare).toBeCloseTo(36600 / 96600, 6);
    expect(component.returnText).toMatch(/выручки на 1 \$ затрат/);
    flush();
  }));

  it('оптимизация отправляет бюджет и ограничения долей каналов', fakeAsync(() => {
    init();
    component.budget = 6000;
    component.setLimit('search', 'min', 10);
    component.setLimit('search', 'max', 50);
    component.runOptimization();
    expect(service.optimize).toHaveBeenCalledWith({
      target: 'REVENUE', horizonWeeks: 12, totalBudget: 6000,
      limits: [{channelCode: 'search', minShare: 0.1, maxShare: 0.5}]
    });
    expect(component.optimizing).toBeFalse();
    expect(component.optimizationChart).not.toBeNull();
    flush();
  }));

  it('без указанного бюджета оптимизирует плановый бюджет', fakeAsync(() => {
    init();
    component.runOptimization();
    expect(service.optimize.calls.mostRecent().args[0].totalBudget).toBeNull();
    expect(service.optimize.calls.mostRecent().args[0].limits).toEqual([]);
    flush();
  }));

  it('ошибка оптимизации выводится пользователю', fakeAsync(() => {
    init();
    service.optimize.and.returnValue(throwError(() => new HttpErrorResponse({status: 503, error: {message: 'Сервис недоступен'}})));
    component.runOptimization();
    expect(component.optimizationError).toBe('Сервис недоступен');
    expect(component.optimizing).toBeFalse();
    flush();
  }));

  it('применение рекомендации включает свой сценарий с постоянными недельными затратами', fakeAsync(() => {
    init();
    component.runOptimization();
    service.predict.calls.reset();
    component.applyRecommendation();
    tick(250);
    expect(component.scenarioType).toBe('CUSTOM');
    expect(component.weeklyOverrideRows.length).toBe(3);
    expect(component.weeklyOverrideRows[0]).toEqual({code: 'search', name: 'Контекстная реклама', amount: 250});
    expect(service.predict).toHaveBeenCalledWith({
      target: 'REVENUE', horizonWeeks: 12,
      scenario: {type: 'CUSTOM', multipliers: undefined, weeklySpend: {search: 250, social: 400, ota: 550}}
    });
    expect(snackBar.open).toHaveBeenCalled();
    flush();
  }));

  it('строки применённой рекомендации не пересоздаются при проверке изменений', fakeAsync(() => {
    init();
    component.runOptimization();
    component.applyRecommendation();
    tick(250);
    const rows = component.weeklyOverrideRows;
    fixture.detectChanges();
    fixture.detectChanges();
    expect(component.weeklyOverrideRows).toBe(rows);
    flush();
  }));

  it('сброс сценария возвращает план кампаний', fakeAsync(() => {
    init();
    component.setScenario('CUSTOM');
    component.setMultiplier('ota', 0.5);
    service.predict.calls.reset();
    component.resetScenario();
    tick(250);
    expect(component.scenarioType).toBe('PLAN');
    expect(component.multipliers).toEqual({});
    expect(service.predict).toHaveBeenCalledWith({target: 'REVENUE', horizonWeeks: 12, scenario: {type: 'PLAN'}});
    flush();
  }));

  it('цвет канала зависит от его места в списке, а не от фильтров', fakeAsync(() => {
    init();
    const before = component.channelColor('social');
    component.setScenario('NO_MARKETING');
    tick(250);
    expect(component.channelColor('social')).toBe(before);
    flush();
  }));

  it('текст изменения бюджета использует настоящий минус', () => {
    expect(component.changeText({planSpend: 1000, recommendedSpend: 1250})).toBe('+250 $');
    expect(component.changeText({planSpend: 1000, recommendedSpend: 600})).toBe('−400 $');
    expect(component.changeText({planSpend: 1000, recommendedSpend: 1000.2})).toBe('0 $');
  });
});
