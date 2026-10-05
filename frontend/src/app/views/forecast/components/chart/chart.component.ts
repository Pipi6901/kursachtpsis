import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild
} from '@angular/core';
import {
  BarController, BarElement, CategoryScale, Chart, ChartConfiguration, Filler, Legend, LinearScale, LineController,
  LineElement, PointElement, Tooltip
} from 'chart.js';

// Регистрируются только нужные компоненты Chart.js: графики не зависят от CDN и работают без интернета.
Chart.register(LineController, BarController, LineElement, PointElement, BarElement, CategoryScale, LinearScale,
  Tooltip, Legend, Filler);

/**
 * Обёртка над Chart.js: отрисовывает график по готовой конфигурации и пересоздаёт его при её смене.
 * Холст имеет текстовое описание (role="img"), а полные данные доступны в «табличном виде» рядом с графиком.
 */
@Component({
  selector: 'app-fc-chart',
  template: `
    <div class="fc-chart-box" [style.height.px]="height">
      <canvas #canvas role="img" [attr.aria-label]="ariaLabel"></canvas>
    </div>`,
  styles: [`
    :host { display: block; }
    .fc-chart-box { position: relative; width: 100%; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {

  @Input() config: ChartConfiguration | null = null;
  @Input() height = 340;
  @Input() ariaLabel = 'График';

  @ViewChild('canvas', {static: true}) canvas!: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private ready = false;

  ngAfterViewInit(): void {
    this.ready = true;
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.ready && changes['config']) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private render(): void {
    this.chart?.destroy();
    this.chart = undefined;
    if (this.config) {
      this.chart = new Chart(this.canvas.nativeElement, this.config);
    }
  }
}
