import {ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {Subject, interval, startWith, switchMap, takeUntil, catchError, of} from 'rxjs';
import {ForecastService} from '../../forecast.service';
import {ForecastStatus} from '../../forecast.types';

/** Вкладки раздела «Прогноз продаж» и индикатор состояния интеллектуального сервиса. */
@Component({
  selector: 'app-fc-nav',
  template: `
    <nav class="fc-tabs" aria-label="Разделы прогноза">
      <a routerLink="/forecast" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Прогноз продаж</a>
      <a routerLink="/forecast/campaigns" routerLinkActive="active">Маркетинговые активности</a>
      <a routerLink="/forecast/model" routerLinkActive="active">Модель и данные</a>
      <span class="fc-ai" [ngClass]="'fc-ai-' + stateClass" [title]="title" role="status">
        <span class="fc-ai-dot"></span>{{ label }}
      </span>
    </nav>`
})
export class NavComponent implements OnInit, OnDestroy {

  status: ForecastStatus | null = null;
  unreachable = false;
  private destroy$ = new Subject<void>();

  constructor(private service: ForecastService, private cdr: ChangeDetectorRef) {
  }

  get stateClass(): string {
    return this.unreachable ? 'down' : (this.status?.ai.state ?? 'unknown').toLowerCase();
  }

  get label(): string {
    if (this.unreachable) {
      return 'Сервер недоступен';
    }
    switch (this.status?.ai.state) {
      case 'UP':
        return 'Интеллектуальный сервис работает';
      case 'CIRCUIT_OPEN':
        return 'Интеллектуальный сервис: пауза после сбоев';
      case 'DOWN':
        return 'Интеллектуальный сервис недоступен — упрощённый режим';
      default:
        return 'Проверка сервиса…';
    }
  }

  get title(): string {
    return this.status?.ai.stateTitle ?? '';
  }

  ngOnInit(): void {
    interval(30000).pipe(
      startWith(0),
      switchMap(() => this.service.getStatus().pipe(catchError(() => of(null)))),
      takeUntil(this.destroy$)
    ).subscribe(status => {
      this.unreachable = status === null;
      if (status) {
        this.status = status;
      }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
