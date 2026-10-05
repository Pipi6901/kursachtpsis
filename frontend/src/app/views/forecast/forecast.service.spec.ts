import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {environment} from '../../../environments/environment';
import {SKIP_LOADER} from '../../core/auth/auth.interceptor';
import {ForecastService} from './forecast.service';

describe('ForecastService', () => {
  let service: ForecastService;
  let http: HttpTestingController;
  const base = environment.api + 'api/forecast';

  beforeEach(() => {
    TestBed.configureTestingModule({imports: [HttpClientTestingModule]});
    service = TestBed.inject(ForecastService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('отправляет запрос прогноза и не включает общий индикатор загрузки', () => {
    service.predict({target: 'REVENUE', horizonWeeks: 12, scenario: {type: 'PLAN'}}).subscribe();
    const req = http.expectOne(`${base}/predict`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.horizonWeeks).toBe(12);
    expect(req.request.context.get(SKIP_LOADER)).toBeTrue();
    req.flush({});
  });

  it('передаёт фильтры кампаний параметрами запроса и пропускает пустые', () => {
    service.getCampaigns({channelId: 3, from: '2026-10-05', to: null, page: 1, size: 12}).subscribe();
    const req = http.expectOne(r => r.url === `${base}/campaigns`);
    expect(req.request.params.get('channelId')).toBe('3');
    expect(req.request.params.get('from')).toBe('2026-10-05');
    expect(req.request.params.has('to')).toBeFalse();
    expect(req.request.params.get('page')).toBe('1');
    req.flush({content: [], totalElements: 0, page: 1, size: 12, totalPages: 0});
  });

  it('обучение, активация и контроль качества обращаются к нужным адресам', () => {
    service.trainModel('BOOKINGS').subscribe();
    const train = http.expectOne(`${base}/models/train`);
    expect(train.request.body).toEqual({target: 'BOOKINGS'});
    train.flush({});

    service.activateModel(5).subscribe();
    http.expectOne(`${base}/models/5/activate`).flush({});

    service.getMonitoring(5).subscribe();
    expect(http.expectOne(`${base}/models/5/monitoring`).request.method).toBe('GET');
  });

  it('импорт CSV отправляет файл формой', () => {
    const file = new File(['2026-10-05;1;1'], 'sales.csv', {type: 'text/csv'});
    service.importSales(file).subscribe();
    const req = http.expectOne(`${base}/sales/import`);
    expect(req.request.body instanceof FormData).toBeTrue();
    expect((req.request.body as FormData).get('file')).toBeTruthy();
    req.flush({created: 1, updated: 0, normalizedDates: 0, warnings: []});
  });

  it('удаляет неделю продаж по дате', () => {
    service.deleteSales('2026-10-12').subscribe();
    const req = http.expectOne(`${base}/sales/2026-10-12`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
