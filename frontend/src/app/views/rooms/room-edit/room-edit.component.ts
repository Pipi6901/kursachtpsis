import {Component, OnInit} from '@angular/core';
import {HotelTypeType} from "../../../../types/hotel-type.type";
import {BedsTypeType} from "../../../../types/beds-type.type";
import {RoomImageType, RoomResponseType} from "../../../../types/room-response.type";
import {PhotosChange} from "../../../shared/components/room-photos-editor/room-photos-editor.component";
import {FormBuilder, Validators} from "@angular/forms";
import {ActivatedRoute, Router} from "@angular/router";
import {RoomService} from "../../../shared/services/room.service";
import {MatSnackBar} from "@angular/material/snack-bar";
import {DefaultResponseType} from "../../../../types/default-response.type";
import { HttpErrorResponse } from "@angular/common/http";

@Component({
    selector: 'app-room-edit',
    templateUrl: './room-edit.component.html',
    styleUrls: ['./room-edit.component.scss'],
    standalone: false
})
export class RoomEditComponent implements OnInit {

  roomForm = this.fb.group({
    name: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(1)]],
    type: [HotelTypeType.STANDARD, Validators.required],
    floor: [0, Validators.required],
    beds: [BedsTypeType.ONE, Validators.required],
    number: [0, Validators.required],
    area: [null as number | null],
    view: [''],
    description: ['', Validators.required],
    days: [10],
    free: [true]
  });
  originRoom: RoomResponseType;

  /** Загруженные фотографии, отмеченные удобства и итог редактирования фотографий. */
  images: RoomImageType[] = [];
  amenities: string[] = [];
  photos: PhotosChange = {order: [], files: [], count: 0};
  loaded = false;
  saving = false;

  constructor(private router: Router,
              private roomService: RoomService,
              private _snackBar: MatSnackBar,
              private activatedRoute: ActivatedRoute,
              private fb: FormBuilder) {
    this.originRoom = {
      id: '',
      name: '',
      price: 0,
      photo: '',
      free: true,
      days: 0,
      type: HotelTypeType.STANDARD,
      beds: BedsTypeType.ONE,
      number: 0,
      description: '',
      floor: 0,
    }
  }

  ngOnInit(): void {
    this.activatedRoute.params.subscribe(params => {
      this.roomService.getRoom(params['id'])
        .subscribe((data: RoomResponseType) => {
          this.originRoom = {...data};
          this.roomForm.patchValue({
            name: data.name,
            price: data.price,
            type: data.type,
            floor: data.floor,
            beds: data.beds,
            number: data.number,
            description: data.description,
            area: data.area ?? null,
            view: data.view ?? '',
            days: data.days,
            free: data.free
          });
          this.images = data.images ?? [];
          this.amenities = [...(data.amenities ?? [])];
          this.loaded = true;
        });
    });
  }

  editRoom() {
    if (this.roomForm.invalid) {
      this.roomForm.markAllAsTouched();
      return;
    }
    if (this.saving) {
      return;
    }
    const formData = new FormData();

    // прежние поля отправляются только если изменились; удобства, площадь, вид и порядок фотографий – всегда
    const updatedRoom: Record<string, unknown> = {};
    ['name', 'price', 'type', 'floor', 'beds', 'number', 'description', 'days'].forEach((key) => {
      const formValue = this.roomForm.get(key)?.value;
      if (formValue !== (this.originRoom as any)[key]) {
        updatedRoom[key] = formValue;
      }
    });
    updatedRoom['free'] = this.roomForm.get('free')?.value ?? true;
    updatedRoom['area'] = this.roomForm.get('area')?.value || 0;
    updatedRoom['view'] = this.roomForm.get('view')?.value ?? '';
    updatedRoom['amenities'] = this.amenities;
    updatedRoom['imageOrder'] = this.photos.order;
    formData.append('room', JSON.stringify(updatedRoom));
    this.photos.files.forEach(file => formData.append('files', file, file.name));

    this.saving = true;
    this.roomService.updateRoom(this.originRoom.id, formData)
      .subscribe({
        next: (data: DefaultResponseType | RoomResponseType) => {
          this.saving = false;
          let error = null;
          if ((data as DefaultResponseType).status === 400) {
            error = (data as DefaultResponseType).message;
          }

          if (error) {
            this._snackBar.open(error);
            throw new Error(error);
          }

          const roomResponse = data as RoomResponseType;

          this._snackBar.open('Номер успешно обновлен');
          this.router.navigate(['/rooms/' + roomResponse.id]);
        },
        error: (errorResponse: HttpErrorResponse) => {
          this.saving = false;
          if (errorResponse.error && errorResponse.error.message) {
            this._snackBar.open(errorResponse.error.message);
          } else {
            this._snackBar.open('Ошибка обновления');
          }
        }
      });
  }

}
