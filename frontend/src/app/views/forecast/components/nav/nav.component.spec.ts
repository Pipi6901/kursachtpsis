import {ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks, tick} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {CommonModule} from '@angular/common';
import {of, throwError} from 'rxjs';
import {ForecastService} from '../../forecast.service';
import {NavComponent} from './nav.component';
import {status} from '../../forecast.fixtures';

describe('NavComponent', () => {
  let fixture: ComponentFixture<NavComponent>;
  let service: jasmine.SpyObj<ForecastService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<ForecastService>('ForecastService', ['getStatus']);
    TestBed.configureTestingModule({
      declarations: [NavComponent],
      imports: [CommonModule],
      providers: [{provide: ForecastService, useValue: service}],
      schemas: [NO_ERRORS_SCHEMA]
    });
  });

  function label(): string {
    return (fixture.nativeElement as HTMLElement).querySelector('.fc-ai')!.textContent!.trim();
  }

  function create(): void {
    fixture = TestBed.createComponent(NavComponent);
    fixture.detectChanges();
  }

  it('показывает, что интеллектуальный сервис работает', fakeAsync(() => {
    service.getStatus.and.returnValue(of(status('UP')));
    create();
    fixture.detectChanges();
    expect(label()).toBe('Интеллектуальный сервис работает');
    expect((fixture.nativeElement as HTMLElement).querySelector('.fc-ai-up')).not.toBeNull();
    discardPeriodicTasks();
  }));

  it('сообщает об упрощённом режиме, когда сервис недоступен', fakeAsync(() => {
    service.getStatus.and.returnValue(of(status('DOWN')));
    create();
    fixture.detectChanges();
    expect(label()).toContain('упрощённый режим');
    discardPeriodicTasks();
  }));

  it('сообщает о паузе после серии сбоев', fakeAsync(() => {
    service.getStatus.and.returnValue(of(status('CIRCUIT_OPEN')));
    create();
    fixture.detectChanges();
    expect(label()).toContain('пауза после сбоев');
    discardPeriodicTasks();
  }));

  it('различает недоступность серверной части', fakeAsync(() => {
    service.getStatus.and.returnValue(throwError(() => new Error('offline')));
    create();
    fixture.detectChanges();
    expect(label()).toBe('Сервер недоступен');
    discardPeriodicTasks();
  }));

  it('обновляет состояние каждые 30 секунд', fakeAsync(() => {
    service.getStatus.and.returnValue(of(status('UP')));
    create();
    expect(service.getStatus).toHaveBeenCalledTimes(1);
    tick(30000);
    expect(service.getStatus).toHaveBeenCalledTimes(2);
    discardPeriodicTasks();
  }));
});
