import { Component, Input } from '@angular/core';
import { RoomResponseType } from '../../../../types/room-response.type';
import { AmenitiesUtil } from '../../utils/amenities.util';
import { RoomInfoUtil } from '../../utils/room-info.util';

/**
 * Карточка номера для списка номеров и главной страницы. Высота карточек в строке сетки одинаковая и не зависит
 * от длины названия и описания: название и описание ограничены двумя строками, блок удобств – одной строкой,
 * цена и кнопка всегда прижаты к низу.
 */
@Component({
  selector: 'app-room-card',
  templateUrl: './room-card.component.html',
  styleUrls: ['./room-card.component.scss'],
  standalone: false
})
export class RoomCardComponent {
  /** сколько значков удобств помещается в одну строку карточки */
  static readonly MAX_AMENITIES = 5;

  @Input({required: true}) room!: RoomResponseType;
  /** Выбраны даты проживания, и номер свободен на них (список уже отфильтрован). */
  @Input() freeForDates = false;

  index = 0;

  get photos(): string[] {
    return RoomInfoUtil.photos(this.room);
  }

  get guests(): string {
    return RoomInfoUtil.guestsLabel(RoomInfoUtil.guests(this.room.beds));
  }

  get amenities() {
    return AmenitiesUtil.sorted(this.room.amenities);
  }

  get shownAmenities() {
    return this.amenities.slice(0, RoomCardComponent.MAX_AMENITIES);
  }

  get moreAmenities(): number {
    return Math.max(0, this.amenities.length - RoomCardComponent.MAX_AMENITIES);
  }

  get reviews(): number {
    return this.room.comments?.length ?? 0;
  }

  get reviewsLabel(): string {
    return RoomInfoUtil.reviewsLabel(this.reviews);
  }

  get statusText(): string {
    if (this.freeForDates) {
      return 'Свободен на выбранные даты';
    }
    return this.room.free ? 'Свободен' : 'Арендован';
  }

  get isFree(): boolean {
    return this.freeForDates || this.room.free;
  }

  step(delta: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const n = this.photos.length;
    this.index = (this.index + delta + n) % n;
  }

  go(i: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.index = i;
  }
}
