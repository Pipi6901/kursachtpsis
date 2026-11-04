import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AMENITY_GROUPS, AmenitiesUtil } from '../../utils/amenities.util';

/**
 * Выбор удобств номера пунктами (форма добавления и редактирования номера): отметки сгруппированы по темам,
 * выбранные пункты подсвечиваются.
 */
@Component({
  selector: 'app-amenity-picker',
  templateUrl: './amenity-picker.component.html',
  styleUrls: ['./amenity-picker.component.scss'],
  standalone: false
})
export class AmenityPickerComponent {
  @Input() selected: string[] = [];
  @Output() selectedChange = new EventEmitter<string[]>();

  groups = AMENITY_GROUPS.map(name => ({name, items: AmenitiesUtil.group(name)}));

  has(code: string): boolean {
    return this.selected.includes(code);
  }

  toggle(code: string, checked: boolean): void {
    const next = this.selected.filter(c => c !== code);
    if (checked) {
      next.push(code);
    }
    this.selected = next;
    this.selectedChange.emit(next);
  }

  clear(): void {
    this.selected = [];
    this.selectedChange.emit([]);
  }
}
