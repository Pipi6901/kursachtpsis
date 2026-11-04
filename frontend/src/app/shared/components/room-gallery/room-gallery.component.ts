import { Component, HostListener, Input } from '@angular/core';

/**
 * Галерея фотографий номера: крупный кадр, миниатюры, стрелки и просмотр на весь экран (клавиши ← → Esc).
 */
@Component({
  selector: 'app-room-gallery',
  templateUrl: './room-gallery.component.html',
  styleUrls: ['./room-gallery.component.scss'],
  standalone: false
})
export class RoomGalleryComponent {
  @Input() images: string[] = [];
  @Input() alt = '';

  index = 0;
  lightbox = false;

  get current(): string | undefined {
    return this.images[Math.min(this.index, this.images.length - 1)];
  }

  step(delta: number, event?: Event): void {
    event?.stopPropagation();
    const n = this.images.length;
    if (n > 1) {
      this.index = (this.index + delta + n) % n;
    }
  }

  select(i: number): void {
    this.index = i;
  }

  open(): void {
    if (this.images.length) {
      this.lightbox = true;
    }
  }

  close(): void {
    this.lightbox = false;
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (!this.lightbox) {
      return;
    }
    if (event.key === 'Escape') {
      this.close();
    } else if (event.key === 'ArrowLeft') {
      this.step(-1);
    } else if (event.key === 'ArrowRight') {
      this.step(1);
    }
  }
}
