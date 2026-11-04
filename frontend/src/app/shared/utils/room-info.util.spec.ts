import {RoomInfoUtil} from './room-info.util';
import {BedsTypeType} from '../../../types/beds-type.type';
import {HotelTypeType} from '../../../types/hotel-type.type';
import {RoomResponseType} from '../../../types/room-response.type';

function room(extra: Partial<RoomResponseType> = {}): RoomResponseType {
  return {
    id: '1', name: 'Люкс', price: 100, photo: '', free: true, days: 1, type: HotelTypeType.VIP,
    beds: BedsTypeType.TWO, number: 1, description: '', floor: 1, ...extra
  };
}

describe('RoomInfoUtil', () => {
  it('число гостей определяется по количеству мест', () => {
    expect(RoomInfoUtil.guests(BedsTypeType.ONE)).toBe(1);
    expect(RoomInfoUtil.guests(BedsTypeType.TWO)).toBe(2);
    expect(RoomInfoUtil.guests(BedsTypeType.FOUR)).toBe(4);
    expect(RoomInfoUtil.guests(BedsTypeType.EIGHT)).toBe(8);
    expect(RoomInfoUtil.guests(undefined)).toBe(1);
  });

  it('склонение гостей и отзывов', () => {
    expect([1, 2, 4, 6].map(n => RoomInfoUtil.guestsLabel(n))).toEqual(['1 гость', '2 гостя', '4 гостя', '6 гостей']);
    expect([1, 2, 5, 11, 12, 21, 24, 25].map(n => RoomInfoUtil.reviewsLabel(n)))
      .toEqual(['1 отзыв', '2 отзыва', '5 отзывов', '11 отзывов', '12 отзывов', '21 отзыв', '24 отзыва', '25 отзывов']);
  });

  it('фотографии: список изображений, а для старых данных – единственное фото', () => {
    const many = room({photo: 'a.jpg', images: [{id: 1, url: 'a.jpg'}, {id: 2, url: 'b.jpg'}]});
    expect(RoomInfoUtil.photos(many)).toEqual(['a.jpg', 'b.jpg']);
    expect(RoomInfoUtil.photos(room({photo: 'old.jpg'}))).toEqual(['old.jpg']);
    expect(RoomInfoUtil.photos(room())).toEqual([]);
  });
});
