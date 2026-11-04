import { Component, Input } from '@angular/core';
import { Amenity, AmenitiesUtil } from '../../utils/amenities.util';

/** Удобства номера значками с подписями (страница номера). */
@Component({
  selector: 'app-amenity-list',
  template: `
    @if (items.length) {
      <ul class="al">
        @for (a of items; track a.code) {
          <li class="al__item"><span class="al__ico"><app-icon [name]="a.icon" [size]="20"></app-icon></span>{{ a.label }}</li>
        }
      </ul>
    } @else {
      <p class="al__none">Список удобств для этого номера пока не заполнен.</p>
    }`,
  styles: [`
    .al { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px 20px; margin: 0; padding: 0; list-style: none; }
    .al__item { display: flex; align-items: center; gap: 12px; font-size: 15px; font-weight: 600; color: var(--c-ink); }
    .al__ico { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 42px; height: 42px;
      border-radius: 50%; background: var(--c-accent-soft); color: var(--c-accent-deep); }
    .al__none { margin: 0; color: var(--c-muted); }
  `],
  standalone: false
})
export class AmenityListComponent {
  items: Amenity[] = [];

  @Input() set codes(value: string[] | undefined | null) {
    this.items = AmenitiesUtil.sorted(value);
  }
}
