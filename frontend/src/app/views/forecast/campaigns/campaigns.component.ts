import {Component, OnInit} from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';
import {AuthService} from '../../../core/auth/auth.service';
import {ForecastService} from '../forecast.service';
import {channelColor} from '../forecast-colors';
import {
  CAMPAIGN_STATUS_TITLES, CHANNEL_TYPE_TITLES, errorMessage, formatDate, formatMoney, todayIso
} from '../forecast-format';
import {Campaign, CampaignRequest, Channel, ChannelType, Page} from '../forecast.types';

interface CampaignForm {
  channelId: number | null;
  name: string;
  startDate: string;
  endDate: string;
  budget: number | null;
  note: string;
}

const emptyForm = (): CampaignForm => ({channelId: null, name: '', startDate: '', endDate: '', budget: null, note: ''});

/** Маркетинговые активности: прошедшие кампании — история затрат для обучения, будущие — план для прогноза. */
@Component({
  selector: 'app-campaigns',
  templateUrl: './campaigns.component.html'
})
export class CampaignsComponent implements OnInit {

  readonly fmtDate = formatDate;
  readonly fmtMoney = formatMoney;
  readonly statusTitles = CAMPAIGN_STATUS_TITLES;
  readonly channelTypes = (Object.keys(CHANNEL_TYPE_TITLES) as ChannelType[])
    .map(value => ({value, title: CHANNEL_TYPE_TITLES[value]}));

  isAdmin = false;
  channels: Channel[] = [];
  page: Page<Campaign> | null = null;
  loading = false;
  errorText: string | null = null;

  filterChannel: number | null = null;
  filterFrom = '';
  filterTo = '';
  pageIndex = 0;
  readonly pageSize = 12;

  showForm = false;
  editingId: number | null = null;
  form: CampaignForm = emptyForm();
  saving = false;
  formError: string | null = null;

  newChannel = {code: '', name: '', type: 'ONLINE_PAID' as ChannelType, description: ''};
  channelError: string | null = null;

  constructor(private service: ForecastService, private auth: AuthService, private snackBar: MatSnackBar) {
    this.isAdmin = auth.getIsAdminIn();
  }

  /** Производные списки хранятся полями: геттеры, создающие новый массив, ломают проверку изменений Angular. */
  activeChannels: Channel[] = [];
  channelCodes: string[] = [];

  ngOnInit(): void {
    this.loadChannels();
    this.loadCampaigns();
  }

  color(code: string): string {
    return channelColor(code, this.channelCodes);
  }

  // ------------------------------------------------------------------ список кампаний

  loadChannels(): void {
    this.service.getChannels().subscribe({
      next: channels => {
        this.channels = channels;
        this.activeChannels = channels.filter(c => c.active);
        this.channelCodes = channels.map(c => c.code);
      },
      error: error => this.errorText = errorMessage(error, 'Не удалось загрузить каналы')
    });
  }

  loadCampaigns(): void {
    this.loading = true;
    this.service.getCampaigns({
      channelId: this.filterChannel, from: this.filterFrom || null, to: this.filterTo || null,
      page: this.pageIndex, size: this.pageSize
    }).subscribe({
      next: page => {
        this.page = page;
        this.loading = false;
        this.errorText = null;
      },
      error: error => {
        this.loading = false;
        this.errorText = errorMessage(error, 'Не удалось загрузить кампании');
      }
    });
  }

  applyFilter(): void {
    this.pageIndex = 0;
    this.loadCampaigns();
  }

  showUpcoming(): void {
    this.filterFrom = todayIso();
    this.filterTo = '';
    this.applyFilter();
  }

  resetFilter(): void {
    this.filterChannel = null;
    this.filterFrom = '';
    this.filterTo = '';
    this.applyFilter();
  }

  goTo(index: number): void {
    if (this.page && index >= 0 && index < this.page.totalPages) {
      this.pageIndex = index;
      this.loadCampaigns();
    }
  }

  // ------------------------------------------------------------------ форма кампании

  openCreate(): void {
    this.editingId = null;
    this.form = emptyForm();
    this.form.channelId = this.activeChannels[0]?.id ?? null;
    this.formError = null;
    this.showForm = true;
  }

  openEdit(campaign: Campaign): void {
    this.editingId = campaign.id;
    this.form = {
      channelId: campaign.channelId, name: campaign.name, startDate: campaign.startDate, endDate: campaign.endDate,
      budget: campaign.budget, note: campaign.note ?? ''
    };
    this.formError = null;
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
  }

  /** Подсказка, почему форму нельзя отправить (null — всё корректно). */
  get formProblem(): string | null {
    const f = this.form;
    if (!f.channelId) {
      return 'Выберите канал';
    }
    if (!f.name.trim()) {
      return 'Укажите название кампании';
    }
    if (!f.startDate || !f.endDate) {
      return 'Укажите даты начала и окончания';
    }
    if (f.endDate < f.startDate) {
      return 'Дата окончания не может быть раньше даты начала';
    }
    if (f.budget === null || f.budget < 0) {
      return 'Укажите бюджет (не меньше нуля)';
    }
    return null;
  }

  /** Недельные затраты, которые получатся из введённого бюджета и периода. */
  get weeklyPreview(): number | null {
    const f = this.form;
    if (!f.startDate || !f.endDate || f.endDate < f.startDate || f.budget === null || f.budget < 0) {
      return null;
    }
    const days = (Date.parse(f.endDate) - Date.parse(f.startDate)) / 86400000 + 1;
    return f.budget * 7 / days;
  }

  save(): void {
    if (this.formProblem) {
      this.formError = this.formProblem;
      return;
    }
    const request: CampaignRequest = {
      channelId: this.form.channelId as number, name: this.form.name.trim(), startDate: this.form.startDate,
      endDate: this.form.endDate, budget: this.form.budget as number, note: this.form.note.trim() || null
    };
    this.saving = true;
    const call = this.editingId === null
      ? this.service.createCampaign(request) : this.service.updateCampaign(this.editingId, request);
    call.subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open(this.editingId === null ? 'Кампания добавлена' : 'Кампания обновлена');
        this.closeForm();
        this.loadCampaigns();
        this.loadChannels();
      },
      error: error => {
        this.saving = false;
        this.formError = errorMessage(error, 'Не удалось сохранить кампанию');
      }
    });
  }

  remove(campaign: Campaign): void {
    if (!window.confirm(`Удалить кампанию «${campaign.name}»?`)) {
      return;
    }
    this.service.deleteCampaign(campaign.id).subscribe({
      next: () => {
        this.snackBar.open('Кампания удалена');
        this.loadCampaigns();
        this.loadChannels();
      },
      error: error => this.snackBar.open(errorMessage(error, 'Не удалось удалить кампанию'))
    });
  }

  // ------------------------------------------------------------------ каналы (администратор)

  addChannel(): void {
    this.channelError = null;
    this.service.createChannel({
      code: this.newChannel.code.trim(), name: this.newChannel.name.trim(), type: this.newChannel.type,
      description: this.newChannel.description.trim() || null
    }).subscribe({
      next: () => {
        this.newChannel = {code: '', name: '', type: 'ONLINE_PAID', description: ''};
        this.snackBar.open('Канал добавлен. Он будет учтён при следующем обучении модели.');
        this.loadChannels();
      },
      error: error => this.channelError = errorMessage(error, 'Не удалось добавить канал')
    });
  }

  toggleChannel(channel: Channel): void {
    this.service.updateChannel(channel.id, {
      code: channel.code, name: channel.name, type: channel.type, description: channel.description,
      active: !channel.active, sortOrder: channel.sortOrder
    }).subscribe({
      next: () => this.loadChannels(),
      error: error => this.snackBar.open(errorMessage(error, 'Не удалось изменить канал'))
    });
  }

  removeChannel(channel: Channel): void {
    if (!window.confirm(`Удалить канал «${channel.name}»?`)) {
      return;
    }
    this.service.deleteChannel(channel.id).subscribe({
      next: () => {
        this.snackBar.open('Канал удалён');
        this.loadChannels();
      },
      error: error => this.snackBar.open(errorMessage(error, 'Не удалось удалить канал'))
    });
  }

  statusClass(status: string): string {
    return status === 'PLANNED' ? 'fc-badge-planned' : status === 'ACTIVE' ? 'fc-badge-active' : '';
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }
}
