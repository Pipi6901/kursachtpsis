/** Каталог удобств номера. Администратор отмечает пункты в форме номера, гости видят их на карточке и странице номера. */
export type Amenity = {
  /** код, хранится в базе (таблица room_amenity) */
  code: string;
  label: string;
  /** имя иконки из shared/components/icon/icons.ts */
  icon: string;
  group: string;
};

export const AMENITY_GROUPS = ['Основное', 'Ванная комната', 'Еда и напитки', 'Комфорт', 'Условия'];

export const AMENITIES: Amenity[] = [
  {code: 'WIFI', label: 'Wi-Fi', icon: 'wifi', group: 'Основное'},
  {code: 'AC', label: 'Кондиционер', icon: 'snowflake', group: 'Основное'},
  {code: 'TV', label: 'Телевизор', icon: 'tv', group: 'Основное'},
  {code: 'DESK', label: 'Рабочий стол', icon: 'armchair', group: 'Основное'},
  {code: 'SAFE', label: 'Сейф', icon: 'lock-keyhole', group: 'Основное'},

  {code: 'SHOWER', label: 'Душ', icon: 'shower-head', group: 'Ванная комната'},
  {code: 'BATHTUB', label: 'Ванна', icon: 'bath', group: 'Ванная комната'},
  {code: 'HAIRDRYER', label: 'Фен', icon: 'wind', group: 'Ванная комната'},
  {code: 'BATHROBE', label: 'Халаты и тапочки', icon: 'shirt', group: 'Ванная комната'},
  {code: 'TOILETRIES', label: 'Косметика', icon: 'sparkles', group: 'Ванная комната'},

  {code: 'BREAKFAST', label: 'Завтрак включён', icon: 'utensils', group: 'Еда и напитки'},
  {code: 'MINIBAR', label: 'Мини-бар', icon: 'wine', group: 'Еда и напитки'},
  {code: 'FRIDGE', label: 'Холодильник', icon: 'refrigerator', group: 'Еда и напитки'},
  {code: 'KETTLE', label: 'Чайник', icon: 'coffee', group: 'Еда и напитки'},
  {code: 'COFFEE', label: 'Кофемашина', icon: 'coffee', group: 'Еда и напитки'},

  {code: 'BALCONY', label: 'Балкон', icon: 'door-open', group: 'Комфорт'},
  {code: 'SOUNDPROOF', label: 'Шумоизоляция', icon: 'volume-x', group: 'Комфорт'},
  {code: 'IRON', label: 'Утюг', icon: 'shirt', group: 'Комфорт'},
  {code: 'DAILY_CLEANING', label: 'Ежедневная уборка', icon: 'sparkles', group: 'Комфорт'},
  {code: 'CRIB', label: 'Детская кроватка', icon: 'baby', group: 'Комфорт'},

  {code: 'PARKING', label: 'Парковка', icon: 'car', group: 'Условия'},
  {code: 'PETS', label: 'Можно с животными', icon: 'paw-print', group: 'Условия'},
  {code: 'NO_SMOKING', label: 'Для некурящих', icon: 'cigarette-off', group: 'Условия'},
];

export class AmenitiesUtil {
  static byCode(code: string): Amenity {
    return AMENITIES.find(a => a.code === code)
      ?? {code, label: code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' '), icon: 'check', group: 'Основное'};
  }

  /** Удобства номера в порядке каталога (порядок в базе не гарантирован). */
  static sorted(codes: string[] | undefined | null): Amenity[] {
    const list = codes ?? [];
    const known = AMENITIES.filter(a => list.includes(a.code));
    const unknown = list.filter(c => !AMENITIES.some(a => a.code === c)).map(c => AmenitiesUtil.byCode(c));
    return [...known, ...unknown];
  }

  static group(group: string): Amenity[] {
    return AMENITIES.filter(a => a.group === group);
  }
}
