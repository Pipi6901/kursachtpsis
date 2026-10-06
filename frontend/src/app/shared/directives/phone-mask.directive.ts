import {Directive, ElementRef, HostListener, Optional, Self} from '@angular/core';
import {NgControl} from '@angular/forms';

/**
 * Маска телефона «+375-99-9999999» для поля ввода. Значение формы хранится в том же виде, в каком его видит
 * пользователь («+375-29-1234567»); если на момент ухода из поля цифр меньше девяти, поле очищается.
 */
@Directive({
    selector: 'input[appPhoneMask]',
    standalone: false
})
export class PhoneMaskDirective {

  static readonly PREFIX = '+375-';
  static readonly DIGITS = 9;

  constructor(private el: ElementRef<HTMLInputElement>, @Optional() @Self() private control: NgControl | null) {
  }

  /** Оставляет только цифры номера без кода страны и расставляет разделители по маске. */
  static format(raw: string): string {
    let digits = (raw || '').replace(/\D/g, '');
    if (digits.startsWith('375')) {
      digits = digits.substring(3);
    }
    digits = digits.substring(0, PhoneMaskDirective.DIGITS);
    if (digits.length <= 2) {
      return PhoneMaskDirective.PREFIX + digits;
    }
    return PhoneMaskDirective.PREFIX + digits.substring(0, 2) + '-' + digits.substring(2);
  }

  static isComplete(value: string): boolean {
    return (value || '').replace(/\D/g, '').length === PhoneMaskDirective.DIGITS + 3;
  }

  @HostListener('input')
  onInput(): void {
    this.write(PhoneMaskDirective.format(this.el.nativeElement.value));
  }

  @HostListener('focus')
  onFocus(): void {
    if (!this.el.nativeElement.value) {
      this.el.nativeElement.value = PhoneMaskDirective.PREFIX;
    }
  }

  @HostListener('blur')
  onBlur(): void {
    if (!PhoneMaskDirective.isComplete(this.el.nativeElement.value)) {
      this.write('');
    }
    this.control?.control?.markAsTouched();
  }

  private write(value: string): void {
    this.el.nativeElement.value = value;
    this.control?.control?.setValue(value, {emitModelToViewChange: false});
  }
}
