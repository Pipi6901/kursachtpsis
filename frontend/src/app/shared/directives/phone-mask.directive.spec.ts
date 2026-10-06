import {Component} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {PhoneMaskDirective} from './phone-mask.directive';

@Component({
  template: '<input appPhoneMask [formControl]="phone">'
})
class HostComponent {
  phone = new FormControl('');
}

describe('PhoneMaskDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let input: HTMLInputElement;
  let host: HostComponent;

  const type = (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      declarations: [HostComponent, PhoneMaskDirective]
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input');
  });

  it('форматирует цифры по маске +375-99-9999999', () => {
    expect(PhoneMaskDirective.format('')).toBe('+375-');
    expect(PhoneMaskDirective.format('2')).toBe('+375-2');
    expect(PhoneMaskDirective.format('29')).toBe('+375-29');
    expect(PhoneMaskDirective.format('291')).toBe('+375-29-1');
    expect(PhoneMaskDirective.format('291234567')).toBe('+375-29-1234567');
    expect(PhoneMaskDirective.format('+375 (29) 123-45-67')).toBe('+375-29-1234567');
    expect(PhoneMaskDirective.format('2912345678999')).toBe('+375-29-1234567');
  });

  it('при вводе записывает в форму отформатированное значение', () => {
    type('2');
    type('29123');
    expect(input.value).toBe('+375-29-123');
    expect(host.phone.value).toBe('+375-29-123');
  });

  it('при фокусе показывает префикс, пустое поле не оставляет с префиксом после ухода', () => {
    input.dispatchEvent(new Event('focus'));
    expect(input.value).toBe('+375-');
    input.dispatchEvent(new Event('blur'));
    expect(input.value).toBe('');
    expect(host.phone.value).toBe('');
    expect(host.phone.touched).toBeTrue();
  });

  it('неполный номер очищается, полный сохраняется', () => {
    type('29123');
    input.dispatchEvent(new Event('blur'));
    expect(host.phone.value).toBe('');

    type('291234567');
    input.dispatchEvent(new Event('blur'));
    expect(host.phone.value).toBe('+375-29-1234567');
    expect(input.value).toBe('+375-29-1234567');
  });

  it('не даёт стереть код страны', () => {
    type('+375');
    expect(input.value).toBe('+375-');
  });
});
