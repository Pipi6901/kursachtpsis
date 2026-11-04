import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { RoomImageType } from '../../../../types/room-response.type';

type PhotoItem = { id?: number; file?: File; url: string };

/** Результат редактирования: порядок фотографий для сервера и новые файлы в порядке показа. */
export type PhotosChange = {
  /** положительное число – прежняя фотография с этим id, 0 – место очередного нового файла */
  order: number[];
  files: File[];
  count: number;
};

/**
 * Редактор фотографий номера: загрузка нескольких файлов (кнопкой или перетаскиванием), предпросмотр,
 * смена обложки и порядка, удаление. Первая фотография – обложка карточки номера.
 */
@Component({
  selector: 'app-room-photos-editor',
  templateUrl: './room-photos-editor.component.html',
  styleUrls: ['./room-photos-editor.component.scss'],
  standalone: false
})
export class RoomPhotosEditorComponent implements OnDestroy {
  static readonly MAX = 12;
  static readonly MAX_BYTES = 10 * 1024 * 1024;

  @Output() changed = new EventEmitter<PhotosChange>();

  items: PhotoItem[] = [];
  error = '';
  dragging = false;
  readonly max = RoomPhotosEditorComponent.MAX;

  private previews: string[] = [];

  /** Уже загруженные фотографии номера (при редактировании). */
  @Input() set existing(value: RoomImageType[] | undefined | null) {
    this.items = (value ?? []).map(i => ({id: i.id, url: i.url}));
    // сообщаем родителю после проверки изменений, чтобы не менять уже проверенное выражение шаблона
    queueMicrotask(() => this.emit());
  }

  ngOnDestroy(): void {
    this.previews.forEach(url => URL.revokeObjectURL(url));
  }

  onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.add(Array.from(input.files ?? []));
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging = false;
    this.add(Array.from(event.dataTransfer?.files ?? []));
  }

  onDrag(event: DragEvent, on: boolean): void {
    event.preventDefault();
    this.dragging = on;
  }

  private add(files: File[]): void {
    const problems: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        problems.push(`«${file.name}» – не изображение`);
      } else if (file.size > RoomPhotosEditorComponent.MAX_BYTES) {
        problems.push(`«${file.name}» больше 10 МБ`);
      } else if (this.items.length >= this.max) {
        problems.push(`можно загрузить не больше ${this.max} фотографий`);
        break;
      } else {
        const url = URL.createObjectURL(file);
        this.previews.push(url);
        this.items.push({file, url});
      }
    }
    this.error = problems.join('; ');
    this.emit();
  }

  makeCover(i: number): void {
    const [item] = this.items.splice(i, 1);
    this.items.unshift(item);
    this.emit();
  }

  move(i: number, delta: number): void {
    const j = i + delta;
    if (j < 0 || j >= this.items.length) {
      return;
    }
    [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    this.emit();
  }

  remove(i: number): void {
    this.items.splice(i, 1);
    this.error = '';
    this.emit();
  }

  private emit(): void {
    this.changed.emit({
      order: this.items.map(i => i.id ?? 0),
      files: this.items.filter(i => i.file).map(i => i.file as File),
      count: this.items.length
    });
  }
}
