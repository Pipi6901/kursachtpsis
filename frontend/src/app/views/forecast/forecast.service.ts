import {Injectable} from '@angular/core';
import {HttpClient, HttpContext, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '../../../environments/environment';
import {SKIP_LOADER} from '../../core/auth/auth.interceptor';
import {
  Campaign, CampaignRequest, Channel, ChannelRequest, ForecastStatus, ForecastTarget, ModelDetails, ModelSummary,
  Monitoring, Optimization, OptimizeRequest, Page, PredictRequest, Prediction, SalesImportResult, SalesWeek
} from './forecast.types';

/** Клиент REST API модуля прогнозирования. Браузер общается только с серверной частью, не с ML-сервисом. */
@Injectable({
  providedIn: 'root'
})
export class ForecastService {

  private readonly base = environment.api + 'api/forecast';
  /** Страницы модуля показывают собственные индикаторы, поэтому общий индикатор загрузки не используется. */
  private readonly context = new HttpContext().set(SKIP_LOADER, true);

  constructor(private http: HttpClient) {
  }

  // прогноз и оптимизация
  predict(request: PredictRequest): Observable<Prediction> {
    return this.http.post<Prediction>(`${this.base}/predict`, request, {context: this.context});
  }

  optimize(request: OptimizeRequest): Observable<Optimization> {
    return this.http.post<Optimization>(`${this.base}/optimize`, request, {context: this.context});
  }

  getStatus(): Observable<ForecastStatus> {
    return this.http.get<ForecastStatus>(`${this.base}/status`, {context: this.context});
  }

  // каналы
  getChannels(): Observable<Channel[]> {
    return this.http.get<Channel[]>(`${this.base}/channels`, {context: this.context});
  }

  createChannel(request: ChannelRequest): Observable<Channel> {
    return this.http.post<Channel>(`${this.base}/channels`, request, {context: this.context});
  }

  updateChannel(id: number, request: ChannelRequest): Observable<Channel> {
    return this.http.put<Channel>(`${this.base}/channels/${id}`, request, {context: this.context});
  }

  deleteChannel(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/channels/${id}`, {context: this.context});
  }

  // кампании
  getCampaigns(filter: { channelId?: number | null; from?: string | null; to?: string | null; page: number; size: number }): Observable<Page<Campaign>> {
    let params = new HttpParams().set('page', filter.page).set('size', filter.size);
    if (filter.channelId) {
      params = params.set('channelId', filter.channelId);
    }
    if (filter.from) {
      params = params.set('from', filter.from);
    }
    if (filter.to) {
      params = params.set('to', filter.to);
    }
    return this.http.get<Page<Campaign>>(`${this.base}/campaigns`, {params, context: this.context});
  }

  createCampaign(request: CampaignRequest): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.base}/campaigns`, request, {context: this.context});
  }

  updateCampaign(id: number, request: CampaignRequest): Observable<Campaign> {
    return this.http.put<Campaign>(`${this.base}/campaigns/${id}`, request, {context: this.context});
  }

  deleteCampaign(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/campaigns/${id}`, {context: this.context});
  }

  // фактические продажи
  getLatestSales(weeks: number): Observable<SalesWeek[]> {
    return this.http.get<SalesWeek[]>(`${this.base}/sales`, {params: new HttpParams().set('latest', weeks), context: this.context});
  }

  saveSales(week: { weekStart: string; bookings: number; revenue: number }): Observable<SalesWeek> {
    return this.http.put<SalesWeek>(`${this.base}/sales`, week, {context: this.context});
  }

  deleteSales(weekStart: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/sales/${weekStart}`, {context: this.context});
  }

  importSales(file: File): Observable<SalesImportResult> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<SalesImportResult>(`${this.base}/sales/import`, form, {context: this.context});
  }

  // модели
  getModels(): Observable<ModelSummary[]> {
    return this.http.get<ModelSummary[]>(`${this.base}/models`, {context: this.context});
  }

  getModel(id: number): Observable<ModelDetails> {
    return this.http.get<ModelDetails>(`${this.base}/models/${id}`, {context: this.context});
  }

  trainModel(target: ForecastTarget): Observable<ModelDetails> {
    return this.http.post<ModelDetails>(`${this.base}/models/train`, {target}, {context: this.context});
  }

  activateModel(id: number): Observable<ModelDetails> {
    return this.http.post<ModelDetails>(`${this.base}/models/${id}/activate`, {}, {context: this.context});
  }

  getMonitoring(id: number): Observable<Monitoring> {
    return this.http.get<Monitoring>(`${this.base}/models/${id}/monitoring`, {context: this.context});
  }
}
