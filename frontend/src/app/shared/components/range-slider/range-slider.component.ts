import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Ползунок диапазона с двумя бегунками (цена за сутки). Значения ограничены пределами [min, max];
 * нижний бегунок не может уйти выше верхнего. Изменения передаются событием rangeChange.
 */
@Component({
  selector: 'app-range-slider',
  templateUrl: './range-slider.component.html',
  styleUrls: ['./range-slider.component.scss'],
  standalone: false
})
export class RangeSliderComponent {
  @Input() min = 0;
  @Input() max = 100;
  @Input() step = 5;
  @Input() low = 0;
  @Input() high = 100;
  @Output() rangeChange = new EventEmitter<{ low: number, high: number }>();

  /** положение закрашенного участка дорожки, % */
  get from(): number {
    return this.percent(this.low);
  }

  get to(): number {
    return this.percent(this.high);
  }

  private percent(value: number): number {
    return this.max > this.min ? ((value - this.min) / (this.max - this.min)) * 100 : 0;
  }

  onLow(value: string): void {
    this.low = Math.min(Number(value), this.high);
    this.emit();
  }

  onHigh(value: string): void {
    this.high = Math.max(Number(value), this.low);
    this.emit();
  }

  private emit(): void {
    this.rangeChange.emit({low: this.low, high: this.high});
  }
}
