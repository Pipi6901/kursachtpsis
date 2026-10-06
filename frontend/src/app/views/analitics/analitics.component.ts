import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

declare var google: any;

@Component({
  selector: 'app-analitics',
  templateUrl: './analitics.component.html',
  styleUrls: ['./analitics.component.scss']
})
export class AnaliticsComponent implements OnInit {
  private apiUrl = 'http://localhost:8080/api/analytics';

  // Данные
  metrics: any = {};
  revenueData: any[] = [];
  roomTypeData: any[] = [];
  statusData: any[] = [];
  topClients: any[] = [];
  roomsReport: any[] = [];

  // Параметры для графика выручки
  revenuePeriod: 'monthly' | 'daily' = 'monthly';
  selectedMonth: string = '';
  selectedYear: number = new Date().getFullYear();

  // Доступные месяцы и годы
  availableMonths: Array<{value: string, label: string}> = [];
  availableYears: number[] = [];

  // Статус загрузки
  isLoading = true;
  isChartLoaded = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.initializeDateSelectors();
    this.loadAllData();
  }

  // Инициализация выбора дат
  initializeDateSelectors(): void {
    // Годы: от текущего до 2 лет назад
    const currentYear = new Date().getFullYear();
    this.availableYears = [currentYear, currentYear - 1, currentYear - 2];
    this.selectedYear = currentYear;

    // Месяцы
    const months = [
      {value: '01', label: 'Январь'}, {value: '02', label: 'Февраль'},
      {value: '03', label: 'Март'}, {value: '04', label: 'Апрель'},
      {value: '05', label: 'Май'}, {value: '06', label: 'Июнь'},
      {value: '07', label: 'Июль'}, {value: '08', label: 'Август'},
      {value: '09', label: 'Сентябрь'}, {value: '10', label: 'Октябрь'},
      {value: '11', label: 'Ноябрь'}, {value: '12', label: 'Декабрь'}
    ];

    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    this.availableMonths = months;
    this.selectedMonth = currentMonth;
  }

  loadAllData(): void {
    this.isLoading = true;
    this.loadMetrics();
  }

  loadMetrics(): void {
    this.http.get(`${this.apiUrl}/metrics`).subscribe({
      next: (data: any) => {
        this.metrics = data;
        this.loadRevenueData();
      },
      error: (error) => {
        console.error('Ошибка загрузки метрик:', error);
        this.isLoading = false;
      }
    });
  }

  // Загрузка данных для графика выручки
  loadRevenueData(): void {
    if (this.revenuePeriod === 'monthly') {
      this.loadMonthlyRevenue();
    } else {
      this.loadDailyRevenue();
    }
  }

  loadMonthlyRevenue(): void {
    this.http.get(`${this.apiUrl}/revenue/monthly`).subscribe({
      next: (data: any) => {
        this.revenueData = data;
        this.loadRoomTypeStats();
      },
      error: (error) => {
        console.error('Ошибка загрузки выручки по месяцам:', error);
        this.loadRoomTypeStats(); // Продолжаем загрузку других данных
      }
    });
  }

  loadDailyRevenue(): void {
    const params = {
      year: this.selectedYear.toString(),
      month: this.selectedMonth
    };

    this.http.get(`${this.apiUrl}/revenue/daily`, { params }).subscribe({
      next: (data: any) => {
        this.revenueData = data;
        this.loadRoomTypeStats();
      },
      error: (error) => {
        console.error('Ошибка загрузки выручки по дням:', error);
        this.loadRoomTypeStats(); // Продолжаем загрузку других данных
      }
    });
  }

  loadRoomTypeStats(): void {
    this.http.get(`${this.apiUrl}/rooms/types`).subscribe({
      next: (data: any) => {
        this.roomTypeData = data;
        this.loadBookingStatus();
      },
      error: (error) => console.error('Ошибка загрузки статистики номеров:', error)
    });
  }

  loadBookingStatus(): void {
    this.http.get(`${this.apiUrl}/bookings/status`).subscribe({
      next: (data: any) => {
        this.statusData = data;
        this.loadTopClients();
      },
      error: (error) => console.error('Ошибка загрузки статусов:', error)
    });
  }

  loadTopClients(): void {
    this.http.get(`${this.apiUrl}/top/clients?limit=5`).subscribe({
      next: (data: any) => {
        this.topClients = data.clients || [];
        this.loadRoomsReport();
      },
      error: (error) => console.error('Ошибка загрузки топ клиентов:', error)
    });
  }

  loadRoomsReport(): void {
    this.http.get(`${this.apiUrl}/rooms/report`).subscribe({
      next: (data: any) => {
        this.roomsReport = data;
        this.isLoading = false;

        // Инициализируем графики после загрузки данных
        setTimeout(() => {
          this.loadGoogleCharts();
        }, 100);
      },
      error: (error) => {
        console.error('Ошибка загрузки отчета по комнатам:', error);
        this.isLoading = false;
        this.loadGoogleCharts(); // Все равно пытаемся загрузить графики
      }
    });
  }

  // Метод для загрузки Google Charts
  loadGoogleCharts(): void {
    google.charts.load('current', {
      packages: ['corechart', 'bar']
    });
    google.charts.setOnLoadCallback(() => {
      this.isChartLoaded = true;
      this.drawCharts();
    });
  }

  // Метод для рисования всех графиков
  drawCharts(): void {
    this.drawRevenueChart();
    this.drawStatusChart();
    this.drawRoomTypeChart();
  }

  // График выручки
  private drawRevenueChart(): void {
    if (!this.revenueData.length) {
      this.showNoDataMessage('revenue_chart', 'Нет данных о выручке');
      return;
    }

    const data = new google.visualization.DataTable();

    if (this.revenuePeriod === 'monthly') {
      data.addColumn('string', 'Месяц');
      data.addColumn('number', 'Выручка');
      data.addColumn({ type: 'string', role: 'tooltip' });

      const rows = this.revenueData.map(item => [
        this.formatMonth(item.month),
        item.revenue,
        `Выручка: ${this.formatCurrency(item.revenue)}\nБронирований: ${item.bookingsCount}`
      ]);

      data.addRows(rows);
    } else {
      data.addColumn('string', 'День');
      data.addColumn('number', 'Выручка');
      data.addColumn({ type: 'string', role: 'tooltip' });

      const rows = this.revenueData.map(item => [
        item.day,
        item.revenue,
        `Выручка: ${this.formatCurrency(item.revenue)}\nБронирований: ${item.bookingsCount}`
      ]);

      data.addRows(rows);
    }

    const periodLabel = this.revenuePeriod === 'monthly' ? 'по месяцам' : 'по дням';
    const xAxisLabel = this.revenuePeriod === 'monthly' ? 'Месяц' : 'День месяца';
    const monthYearLabel = this.revenuePeriod === 'daily' ?
      ` (${this.getMonthName(this.selectedMonth)} ${this.selectedYear})` : '';

    const options = {
      title: `Динамика выручки ${periodLabel}${monthYearLabel}`,
      curveType: 'function',
      legend: { position: 'bottom' },
      colors: ['#002dcf'],
      backgroundColor: 'transparent',
      hAxis: {
        title: xAxisLabel,
        textStyle: { color: '#606060' },
        slantedText: this.revenuePeriod === 'monthly',
        slantedTextAngle: this.revenuePeriod === 'monthly' ? 45 : 0
      },
      vAxis: {
        title: 'Выручка ($)',
        format: 'short',
        textStyle: { color: '#19191a' }
      },
      titleTextStyle: {
        color: '#19191a',
        fontSize: 16,
        fontName: 'Lora'
      },
      chartArea: {
        width: '85%',
        height: '70%'
      }
    };

    const chart = new google.visualization.LineChart(document.getElementById('revenue_chart'));
    chart.draw(data, options);
  }

  // График статусов
  private drawStatusChart(): void {
    if (!this.statusData.length) {
      this.showNoDataMessage('status_chart', 'Нет данных о статусах бронирований');
      return;
    }

    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Статус');
    data.addColumn('number', 'Количество');

    const rows = this.statusData.map(item => [
      this.translateStatus(item.status),
      item.count
    ]);

    data.addRows(rows);

    const options = {
      title: 'Статусы бронирований',
      colors: ['#000471', '#1e32ae', '#4c5cdc'],
      backgroundColor: 'transparent',
      pieHole: 0.4,
      titleTextStyle: {
        color: '#19191a',
        fontSize: 16,
        fontName: 'Lora'
      },
      legend: {
        textStyle: { color: '#19191a' }
      }
    };

    const chart = new google.visualization.PieChart(document.getElementById('status_chart'));
    chart.draw(data, options);
  }

  // График типов номеров
  private drawRoomTypeChart(): void {
    if (!this.roomTypeData.length) {
      this.showNoDataMessage('roomtype_chart', 'Нет данных по типам номеров');
      return;
    }

    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Тип номера');
    data.addColumn('number', 'Количество бронирований');
    data.addColumn('number', 'Выручка (тыс.$)');

    const rows = this.roomTypeData.map(item => [
      this.translateRoomType(item.type),
      item.bookingsCount,
      item.totalRevenue / 1000
    ]);

    data.addRows(rows);

    const options = {
      title: 'Статистика по типам номеров',
      colors: ['#011776', '#6e6e6e'],
      backgroundColor: 'transparent',
      hAxis: {
        title: 'Тип номера',
        textStyle: { color: '#19191a' }
      },
      vAxes: {
        0: { title: 'Количество бронирований', textStyle: { color: '#19191a' } },
        1: { title: 'Выручка (тыс. $)', textStyle: { color: '#19191a' } }
      },
      series: {
        0: { targetAxisIndex: 0 },
        1: { targetAxisIndex: 1, type: 'line' }
      },
      titleTextStyle: {
        color: '#19191a',
        fontSize: 16,
        fontName: 'Lora'
      }
    };

    const chart = new google.visualization.ColumnChart(document.getElementById('roomtype_chart'));
    chart.draw(data, options);
  }

  // Вспомогательные методы
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      currencyDisplay: 'symbol'
    }).format(value);
  }

  formatMonth(monthStr: string): string {
    const [year, month] = monthStr.split('-');
    const months = [
      'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
      'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
    ];
    return `${months[parseInt(month) - 1]} ${year}`;
  }

  getMonthName(monthValue: string): string {
    const months: {[key: string]: string} = {
      '01': 'Январь', '02': 'Февраль', '03': 'Март', '04': 'Апрель',
      '05': 'Май', '06': 'Июнь', '07': 'Июль', '08': 'Август',
      '09': 'Сентябрь', '10': 'Октябрь', '11': 'Ноябрь', '12': 'Декабрь'
    };
    return months[monthValue] || monthValue;
  }

  translateStatus(status: string): string {
    const translations: {[key: string]: string} = {
      'WAITING': 'Ожидание',
      'DONE': 'Подтверждено',
      'REJECT': 'Отклонено',
      'COMPLETED': 'Завершено'
    };
    return translations[status] || status;
  }

  translateRoomType(type: string): string {
    const translations: {[key: string]: string} = {
      'STANDARD': 'Стандарт',
      'ECONOMY': 'Эконом',
      'VIP': 'VIP'
    };
    return translations[type] || type;
  }

  // Обработчики изменения периода и дат
  setRevenuePeriod(period: 'monthly' | 'daily'): void {
    this.revenuePeriod = period;
    this.loadRevenueData();
  }

  // Обновленные методы для обработки событий change
  onMonthChange(event: any): void {
    this.selectedMonth = event.target.value;
    if (this.revenuePeriod === 'daily') {
      this.loadDailyRevenue();
    }
  }

  onYearChange(event: any): void {
    this.selectedYear = Number(event.target.value);
    if (this.revenuePeriod === 'daily') {
      this.loadDailyRevenue();
    }
  }

  // Метод для отображения сообщения об отсутствии данных
  private showNoDataMessage(elementId: string, message: string): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100%;">
          <div style="text-align: center; color: #707079;">
            <i class="fas fa-chart-line" style="font-size: 48px; margin-bottom: 16px;"></i>
            <h4>${message}</h4>
          </div>
        </div>
      `;
    }
  }

  // Обновление данных
  refreshData(): void {
    this.isLoading = true;
    this.loadAllData();
  }
}
