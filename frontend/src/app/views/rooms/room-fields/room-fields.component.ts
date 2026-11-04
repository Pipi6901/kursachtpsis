import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { HotelTypeType } from '../../../../types/hotel-type.type';
import { BedsTypeType } from '../../../../types/beds-type.type';
import { RoomImageType } from '../../../../types/room-response.type';
import { HotelTypeUtil } from '../../../shared/utils/hotel-type.util';
import { BedsTypeUtil } from '../../../shared/utils/beds-type.util';
import { PhotosChange } from '../../../shared/components/room-photos-editor/room-photos-editor.component';

/**
 * Поля номера для форм добавления и редактирования: основные сведения, параметры, удобства (пунктами) и
 * фотографии. Значения полей хранятся в форме родителя; выбранные удобства и фотографии передаются событиями.
 */
@Component({
  selector: 'app-room-fields',
  templateUrl: './room-fields.component.html',
  styleUrls: ['./room-fields.component.scss'],
  standalone: false
})
export class RoomFieldsComponent {
  @Input({required: true}) form!: FormGroup;
  /** Уже загруженные фотографии (при редактировании). */
  @Input() images: RoomImageType[] = [];
  /** Отмеченные удобства (при редактировании). */
  @Input() amenities: string[] = [];

  @Output() amenitiesChange = new EventEmitter<string[]>();
  @Output() photosChange = new EventEmitter<PhotosChange>();

  readonly hotelTypes = Object.values(HotelTypeType).map(type => ({
    value: type,
    label: HotelTypeUtil.getHotelType(type).name
  }));

  readonly bedsTypes = Object.values(BedsTypeType).map(type => ({
    value: type,
    label: BedsTypeUtil.getBedsType(type).name
  }));

  /** Подсказки для поля «Вид из окна»; можно ввести и свой вариант. */
  readonly views = ['На город', 'На парк', 'Во двор', 'На реку', 'Панорамный'];

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }
}
