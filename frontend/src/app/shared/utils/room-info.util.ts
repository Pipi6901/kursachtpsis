import {BedsTypeType} from "../../../types/beds-type.type";
import {RoomResponseType} from "../../../types/room-response.type";

/** Производные сведения о номере для карточек и страницы номера. */
export class RoomInfoUtil {

  /** Число гостей по количеству мест. */
  static guests(beds: BedsTypeType | undefined | null): number {
    switch (beds) {
      case BedsTypeType.TWO: return 2;
      case BedsTypeType.FOUR: return 4;
      case BedsTypeType.SIX: return 6;
      case BedsTypeType.EIGHT: return 8;
      default: return 1;
    }
  }

  /** «1 гость», «2 гостя», «6 гостей» */
  static guestsLabel(count: number): string {
    return count === 1 ? '1 гость' : count < 5 ? `${count} гостя` : `${count} гостей`;
  }

  /** Адреса фотографий по порядку (обложка первая); для старых данных – единственное фото. */
  static photos(room: RoomResponseType): string[] {
    const urls = (room.images ?? []).map(i => i.url).filter(Boolean);
    if (urls.length) {
      return urls;
    }
    return room.photo ? [room.photo] : [];
  }

  /** «1 отзыв», «2 отзыва», «5 отзывов» */
  static reviewsLabel(count: number): string {
    const mod10 = count % 10, mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return `${count} отзыв`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} отзыва`;
    return `${count} отзывов`;
  }
}
