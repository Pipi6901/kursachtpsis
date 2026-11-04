import {RoomResponseType} from "../../../types/room-response.type";
import {HotelTypeType} from "../../../types/hotel-type.type";
import {RoomInfoUtil} from "./room-info.util";

export type RoomSort = 'default' | 'price-asc' | 'price-desc' | 'area-desc' | 'reviews-desc';

/** Условия отбора номеров на странице «Номера». Пустое значение условия означает «не фильтровать». */
export type RoomCriteria = {
  /** строка поиска: слова ищутся в названии, описании, категории, виде из окна и номере комнаты */
  query: string;
  categories: HotelTypeType[];
  /** минимальное число гостей (0 – любое) */
  minGuests: number;
  priceMin: number | null;
  priceMax: number | null;
  /** коды удобств: номер должен иметь все отмеченные */
  amenities: string[];
  /** только свободные сегодняшней ночью */
  onlyFree: boolean;
};

export const EMPTY_CRITERIA: RoomCriteria = {
  query: '', categories: [], minGuests: 0, priceMin: null, priceMax: null, amenities: [], onlyFree: false
};

/** Подбор, фильтрация и сортировка номеров на клиенте: номеров немного, список загружается один раз. */
export class RoomFilterUtil {

  /** Нижний регистр, «ё» как «е», лишние пробелы убраны. */
  static normalize(text: string | null | undefined): string {
    return (text ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  /** Все слова запроса должны встретиться в тексте номера (в любом порядке и месте слова). */
  static matchesQuery(room: RoomResponseType, query: string): boolean {
    const words = RoomFilterUtil.normalize(query).split(' ').filter(Boolean);
    if (!words.length) {
      return true;
    }
    const haystack = RoomFilterUtil.normalize([
      room.name, room.description, room.typeRus, room.view, String(room.number), `этаж ${room.floor}`
    ].join(' '));
    return words.every(word => haystack.includes(word));
  }

  static matches(room: RoomResponseType, c: RoomCriteria): boolean {
    if (!RoomFilterUtil.matchesQuery(room, c.query)) {
      return false;
    }
    if (c.categories.length && !c.categories.includes(room.type)) {
      return false;
    }
    if (c.minGuests && RoomInfoUtil.guests(room.beds) < c.minGuests) {
      return false;
    }
    if (c.priceMin !== null && room.price < c.priceMin) {
      return false;
    }
    if (c.priceMax !== null && room.price > c.priceMax) {
      return false;
    }
    if (c.amenities.length && !c.amenities.every(code => (room.amenities ?? []).includes(code))) {
      return false;
    }
    return !(c.onlyFree && !room.free);
  }

  /** Номера, подходящие под условия (и под список свободных на даты, если даты выбраны), в заданном порядке. */
  static apply(rooms: RoomResponseType[], c: RoomCriteria, sort: RoomSort,
               availableIds: Set<string> | null = null): RoomResponseType[] {
    const list = rooms.filter(room => (!availableIds || availableIds.has(String(room.id))) && RoomFilterUtil.matches(room, c));
    return RoomFilterUtil.sort(list, sort);
  }

  static sort(rooms: RoomResponseType[], sort: RoomSort): RoomResponseType[] {
    const reviews = (r: RoomResponseType) => r.comments?.length ?? 0;
    switch (sort) {
      case 'price-asc': return [...rooms].sort((a, b) => a.price - b.price);
      case 'price-desc': return [...rooms].sort((a, b) => b.price - a.price);
      case 'area-desc': return [...rooms].sort((a, b) => (b.area ?? 0) - (a.area ?? 0));
      case 'reviews-desc': return [...rooms].sort((a, b) => reviews(b) - reviews(a));
      default: return rooms;
    }
  }

  /** Наименьшая и наибольшая цена за сутки среди номеров (для ползунка цены). */
  static priceBounds(rooms: RoomResponseType[]): { min: number, max: number } {
    if (!rooms.length) {
      return {min: 0, max: 0};
    }
    const prices = rooms.map(r => r.price);
    return {min: Math.min(...prices), max: Math.max(...prices)};
  }

  /** Коды удобств, которые есть хотя бы у одного номера, и сколько номеров их имеют. */
  static amenityCounts(rooms: RoomResponseType[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const room of rooms) {
      for (const code of room.amenities ?? []) {
        counts.set(code, (counts.get(code) ?? 0) + 1);
      }
    }
    return counts;
  }
}
