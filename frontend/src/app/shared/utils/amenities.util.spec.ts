import {AMENITIES, AMENITY_GROUPS, AmenitiesUtil} from './amenities.util';
import {ICONS} from '../components/icon/icons';

describe('AmenitiesUtil', () => {
  it('коды удобств уникальны и все их иконки есть в наборе иконок', () => {
    const codes = AMENITIES.map(a => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const a of AMENITIES) {
      expect(ICONS[a.icon]).withContext(`иконка ${a.icon} у ${a.code}`).toBeTruthy();
      expect(AMENITY_GROUPS).toContain(a.group);
    }
  });

  it('коды допустимы для сервера: заглавные буквы, цифры и подчёркивание', () => {
    for (const a of AMENITIES) {
      expect(a.code).toMatch(/^[A-Z0-9_]{2,40}$/);
    }
  });

  it('удобства номера выдаются в порядке каталога независимо от порядка в базе', () => {
    const sorted = AmenitiesUtil.sorted(['SAFE', 'WIFI', 'BATHTUB', 'AC']);
    expect(sorted.map(a => a.code)).toEqual(['WIFI', 'AC', 'SAFE', 'BATHTUB']);
  });

  it('неизвестный код показывается с общей иконкой, а не пропадает', () => {
    const [custom] = AmenitiesUtil.sorted(['SEA_VIEW_BAR']);
    expect(custom.label).toBe('Sea view bar');
    expect(custom.icon).toBe('check');
  });

  it('пустой и отсутствующий список даёт пустой результат', () => {
    expect(AmenitiesUtil.sorted(undefined)).toEqual([]);
    expect(AmenitiesUtil.sorted([])).toEqual([]);
  });
});
