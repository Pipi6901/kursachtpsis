import {TestBed, ComponentFixture} from '@angular/core/testing';
import {RouterTestingModule} from '@angular/router/testing';
import {SharedModule} from '../../shared.module';
import {RoomCardComponent} from './room-card.component';
import {BedsTypeType} from '../../../../types/beds-type.type';
import {HotelTypeType} from '../../../../types/hotel-type.type';
import {RoomResponseType} from '../../../../types/room-response.type';

function room(extra: Partial<RoomResponseType> = {}): RoomResponseType {
  return {
    id: '7', name: 'Люкс 101', price: 150, photo: '', free: true, days: 1, type: HotelTypeType.VIP,
    beds: BedsTypeType.TWO, number: 101, description: 'Просторный номер', floor: 3, typeRus: 'ВИП', ...extra
  };
}

describe('RoomCardComponent', () => {
  let fixture: ComponentFixture<RoomCardComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  function render(r: RoomResponseType, freeForDates = false) {
    fixture = TestBed.createComponent(RoomCardComponent);
    fixture.componentRef.setInput('room', r);
    fixture.componentRef.setInput('freeForDates', freeForDates);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({imports: [RouterTestingModule, SharedModule]}));

  it('показывает название, цену, вместимость, площадь и этаж', () => {
    render(room({area: 48}));
    expect(el().querySelector('.rc__title')?.textContent).toContain('Люкс 101');
    expect(el().querySelector('.rc__price b')?.textContent).toContain('150');
    const facts = el().querySelector('.rc__facts')?.textContent ?? '';
    expect(facts).toContain('2 гостя');
    expect(facts).toContain('48 м²');
    expect(facts).toContain('3 этаж');
  });

  it('без площади строка фактов не содержит пустого значения', () => {
    render(room());
    expect(el().querySelector('.rc__facts')?.textContent).not.toContain('м²');
  });

  it('несколько фото: точки, счётчик и листание стрелками по кругу', () => {
    render(room({images: [{id: 1, url: 'a.jpg'}, {id: 2, url: 'b.jpg'}, {id: 3, url: 'c.jpg'}]}));
    expect(el().querySelectorAll('.rc__dot').length).toBe(3);
    expect(el().querySelector('.rc__count')?.textContent).toContain('1/3');
    (el().querySelector('.rc__nav--prev') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelector('.rc__count')?.textContent).toContain('3/3');
    (el().querySelector('.rc__nav--next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelector('.rc__count')?.textContent).toContain('1/3');
  });

  it('одно фото и отсутствие фото: без стрелок; вместо фото – заглушка', () => {
    render(room({images: [{id: 1, url: 'a.jpg'}]}));
    expect(el().querySelector('.rc__nav')).toBeNull();
    render(room());
    expect(el().querySelector('.rc__noimg')).not.toBeNull();
  });

  it('значки удобств: не больше пяти, остальные в счётчике «+N»', () => {
    render(room({amenities: ['WIFI', 'AC', 'TV', 'SAFE', 'BATHTUB', 'MINIBAR', 'DESK']}));
    expect(el().querySelectorAll('.rc__amenities li:not(.rc__more)').length).toBe(5);
    expect(el().querySelector('.rc__more')?.textContent?.trim()).toBe('+2');
  });

  it('статус: свободен, арендован и свободен на выбранные даты', () => {
    render(room({free: true}));
    expect(el().querySelector('.rc__status')?.textContent).toContain('Свободен');
    render(room({free: false}));
    expect(el().querySelector('.rc__status')?.textContent).toContain('Арендован');
    render(room({free: false}), true);
    expect(el().querySelector('.rc__status')?.textContent).toContain('Свободен на выбранные даты');
  });

  it('значок отзывов виден только при наличии отзывов', () => {
    render(room());
    expect(el().querySelector('.rc__reviews')).toBeNull();
    render(room({comments: [{id: '1', text: 'x', author: 'a', createdAt: ''}]}));
    expect(el().querySelector('.rc__reviews')?.textContent).toContain('1');
  });
});
