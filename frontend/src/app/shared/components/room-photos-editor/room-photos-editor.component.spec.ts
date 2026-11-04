import {TestBed, ComponentFixture, fakeAsync, flushMicrotasks} from '@angular/core/testing';
import {SharedModule} from '../../shared.module';
import {PhotosChange, RoomPhotosEditorComponent} from './room-photos-editor.component';

describe('RoomPhotosEditorComponent', () => {
  let fixture: ComponentFixture<RoomPhotosEditorComponent>;
  let component: RoomPhotosEditorComponent;
  let last: PhotosChange;

  const png = (name: string) => new File([new Uint8Array([1, 2, 3])], name, {type: 'image/png'});

  function setup(existing: { id: number, url: string }[] = []) {
    fixture = TestBed.createComponent(RoomPhotosEditorComponent);
    component = fixture.componentInstance;
    component.changed.subscribe((c: PhotosChange) => last = c);
    fixture.componentRef.setInput('existing', existing);
    fixture.detectChanges();
    flushMicrotasks();
  }

  beforeEach(() => TestBed.configureTestingModule({imports: [SharedModule]}));

  it('прежние фотографии передаются идентификаторами в прежнем порядке', fakeAsync(() => {
    setup([{id: 5, url: 'a'}, {id: 9, url: 'b'}]);
    expect(last.order).toEqual([5, 9]);
    expect(last.files).toEqual([]);
    expect(last.count).toBe(2);
  }));

  it('новые файлы отмечаются нулём в порядке и добавляются списком', fakeAsync(() => {
    setup([{id: 5, url: 'a'}]);
    (component as any).add([png('x.png'), png('y.png')]);
    expect(last.order).toEqual([5, 0, 0]);
    expect(last.files.map(f => f.name)).toEqual(['x.png', 'y.png']);
  }));

  it('«сделать обложкой» переносит фото в начало, в том числе новое', fakeAsync(() => {
    setup([{id: 5, url: 'a'}, {id: 9, url: 'b'}]);
    (component as any).add([png('x.png')]);
    component.makeCover(2);
    expect(last.order).toEqual([0, 5, 9]);
    component.makeCover(2);
    expect(last.order).toEqual([9, 0, 5]);
  }));

  it('удаление и перестановка меняют порядок и счётчик', fakeAsync(() => {
    setup([{id: 1, url: 'a'}, {id: 2, url: 'b'}, {id: 3, url: 'c'}]);
    component.remove(1);
    expect(last.order).toEqual([1, 3]);
    component.move(0, 1);
    expect(last.order).toEqual([3, 1]);
    component.move(0, -1);
    expect(last.order).toEqual([3, 1]);
    expect(last.count).toBe(2);
  }));

  it('не принимает не изображения и больше предельного числа фотографий', fakeAsync(() => {
    setup();
    (component as any).add([new File(['hi'], 'doc.txt', {type: 'text/plain'})]);
    expect(component.error).toContain('не изображение');
    expect(last.count).toBe(0);

    const many = Array.from({length: RoomPhotosEditorComponent.MAX + 2}, (_, i) => png(`p${i}.png`));
    (component as any).add(many);
    expect(last.count).toBe(RoomPhotosEditorComponent.MAX);
    expect(component.error).toContain('не больше');
  }));
});
