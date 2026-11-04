import {EMPTY_CRITERIA, RoomCriteria, RoomFilterUtil} from './room-filter.util';
import {BedsTypeType} from '../../../types/beds-type.type';
import {HotelTypeType} from '../../../types/hotel-type.type';
import {RoomResponseType} from '../../../types/room-response.type';

function room(id: number, extra: Partial<RoomResponseType> = {}): RoomResponseType {
  return {
    id: String(id), name: 'Номер ' + id, price: 100, photo: '', free: true, days: 1, type: HotelTypeType.STANDARD,
    beds: BedsTypeType.TWO, number: 100 + id, description: '', floor: 1, typeRus: 'Стандарт', ...extra
  };
}

const crit = (extra: Partial<RoomCriteria>): RoomCriteria => ({...EMPTY_CRITERIA, ...extra});

describe('RoomFilterUtil', () => {
  const rooms = [
    room(1, {name: 'Люкс с видом на парк', type: HotelTypeType.VIP, typeRus: 'ВИП', price: 300, area: 60, beds: BedsTypeType.TWO,
      amenities: ['WIFI', 'AC', 'BATHTUB'], view: 'На парк', description: 'Тёплый и светлый'}),
    room(2, {name: 'Семейный', price: 130, area: 45, beds: BedsTypeType.FOUR, amenities: ['WIFI', 'CRIB'], free: false,
      comments: [{id: '1', text: 'x', author: 'a', createdAt: ''}, {id: '2', text: 'y', author: 'b', createdAt: ''}]}),
    room(3, {name: 'Эконом', type: HotelTypeType.ECONOMY, typeRus: 'Эконом', price: 45, beds: BedsTypeType.ONE, amenities: []}),
  ];
  const ids = (list: RoomResponseType[]) => list.map(r => r.id);

  it('без условий возвращает все номера в исходном порядке', () => {
    expect(ids(RoomFilterUtil.apply(rooms, EMPTY_CRITERIA, 'default'))).toEqual(['1', '2', '3']);
  });

  describe('поиск', () => {
    it('ищет по части слова, без учёта регистра и «ё»', () => {
      expect(ids(RoomFilterUtil.apply(rooms, crit({query: 'ЛЮКС'}), 'default'))).toEqual(['1']);
      expect(ids(RoomFilterUtil.apply(rooms, crit({query: 'темн'}), 'default'))).toEqual([]);
      expect(ids(RoomFilterUtil.apply(rooms, crit({query: 'тепл'}), 'default'))).toEqual(['1']);
      expect(ids(RoomFilterUtil.apply(rooms, crit({query: 'теплый'}), 'default'))).toEqual(['1']);
    });

    it('все слова запроса должны найтись, порядок слов не важен', () => {
      expect(ids(RoomFilterUtil.apply(rooms, crit({query: 'парк люкс'}), 'default'))).toEqual(['1']);
      expect(ids(RoomFilterUtil.apply(rooms, crit({query: 'люкс семейный'}), 'default'))).toEqual([]);
    });

    it('находит по категории, виду из окна и номеру комнаты', () => {
      expect(ids(RoomFilterUtil.apply(rooms, crit({query: 'вип'}), 'default'))).toEqual(['1']);
      expect(ids(RoomFilterUtil.apply(rooms, crit({query: '102'}), 'default'))).toEqual(['2']);
      expect(ids(RoomFilterUtil.apply(rooms, crit({query: '   '}), 'default'))).toEqual(['1', '2', '3']);
    });
  });

  it('категории: номер подходит, если его категория среди выбранных', () => {
    expect(ids(RoomFilterUtil.apply(rooms, crit({categories: [HotelTypeType.VIP, HotelTypeType.ECONOMY]}), 'default'))).toEqual(['1', '3']);
  });

  it('вместимость: не меньше выбранного числа гостей', () => {
    expect(ids(RoomFilterUtil.apply(rooms, crit({minGuests: 2}), 'default'))).toEqual(['1', '2']);
    expect(ids(RoomFilterUtil.apply(rooms, crit({minGuests: 4}), 'default'))).toEqual(['2']);
  });

  it('цена: границы включаются, можно задать одну границу', () => {
    expect(ids(RoomFilterUtil.apply(rooms, crit({priceMin: 45, priceMax: 130}), 'default'))).toEqual(['2', '3']);
    expect(ids(RoomFilterUtil.apply(rooms, crit({priceMin: 131}), 'default'))).toEqual(['1']);
    expect(ids(RoomFilterUtil.apply(rooms, crit({priceMax: 44}), 'default'))).toEqual([]);
  });

  it('удобства: у номера должны быть все отмеченные', () => {
    expect(ids(RoomFilterUtil.apply(rooms, crit({amenities: ['WIFI']}), 'default'))).toEqual(['1', '2']);
    expect(ids(RoomFilterUtil.apply(rooms, crit({amenities: ['WIFI', 'AC']}), 'default'))).toEqual(['1']);
    expect(ids(RoomFilterUtil.apply(rooms, crit({amenities: ['WIFI', 'AC', 'CRIB']}), 'default'))).toEqual([]);
  });

  it('«только свободные» убирает арендованные сейчас', () => {
    expect(ids(RoomFilterUtil.apply(rooms, crit({onlyFree: true}), 'default'))).toEqual(['1', '3']);
  });

  it('условия действуют вместе, а список свободных на даты сужает результат дополнительно', () => {
    const c = crit({amenities: ['WIFI'], minGuests: 2});
    expect(ids(RoomFilterUtil.apply(rooms, c, 'default'))).toEqual(['1', '2']);
    expect(ids(RoomFilterUtil.apply(rooms, c, 'default', new Set(['2', '3'])))).toEqual(['2']);
    expect(ids(RoomFilterUtil.apply(rooms, EMPTY_CRITERIA, 'default', new Set<string>()))).toEqual([]);
  });

  it('сортировка: цена, площадь, отзывы; исходный массив не меняется', () => {
    expect(ids(RoomFilterUtil.apply(rooms, EMPTY_CRITERIA, 'price-asc'))).toEqual(['3', '2', '1']);
    expect(ids(RoomFilterUtil.apply(rooms, EMPTY_CRITERIA, 'price-desc'))).toEqual(['1', '2', '3']);
    expect(ids(RoomFilterUtil.apply(rooms, EMPTY_CRITERIA, 'area-desc'))).toEqual(['1', '2', '3']);
    expect(ids(RoomFilterUtil.apply(rooms, EMPTY_CRITERIA, 'reviews-desc'))[0]).toBe('2');
    expect(ids(rooms)).toEqual(['1', '2', '3']);
  });

  it('границы цены и счётчики удобств', () => {
    expect(RoomFilterUtil.priceBounds(rooms)).toEqual({min: 45, max: 300});
    expect(RoomFilterUtil.priceBounds([])).toEqual({min: 0, max: 0});
    const counts = RoomFilterUtil.amenityCounts(rooms);
    expect(counts.get('WIFI')).toBe(2);
    expect(counts.get('CRIB')).toBe(1);
    expect(counts.has('SAFE')).toBeFalse();
  });
});
