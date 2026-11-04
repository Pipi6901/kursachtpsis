import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONS } from './icons';

/**
 * Иконка из локального набора SVG: {@code <app-icon name="wifi" [size]="20"></app-icon>}.
 * Цвет берётся из текущего цвета текста (currentColor), размер задаётся в пикселях.
 */
@Component({
  selector: 'app-icon',
  template: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" [attr.fill]="fill" stroke="currentColor"
      [attr.stroke-width]="stroke" stroke-linecap="round" stroke-linejoin="round" [attr.width]="size"
      [attr.height]="size" aria-hidden="true" [innerHTML]="markup"></svg>`,
  styles: [`:host { display: inline-flex; flex: none; line-height: 0; } svg { display: block; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class IconComponent {
  @Input() size = 20;
  @Input() stroke = 1.8;
  /** none – контурная иконка; currentColor – закрашенная (например, звезда) */
  @Input() fill = 'none';

  markup: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {}

  @Input() set name(value: string) {
    // набор иконок – собственные константы приложения, не пользовательский ввод
    this.markup = this.sanitizer.bypassSecurityTrustHtml(ICONS[value] ?? '');
  }
}
