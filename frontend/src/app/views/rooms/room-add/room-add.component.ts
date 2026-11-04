import { Component, OnInit } from '@angular/core';
import {FormBuilder, Validators} from "@angular/forms";
import {MatSnackBar} from "@angular/material/snack-bar";
import {Router} from "@angular/router";
import {RoomService} from "../../../shared/services/room.service";
import {HotelTypeType} from "../../../../types/hotel-type.type";
import {BedsTypeType} from "../../../../types/beds-type.type";
import {RoomResponseType} from "../../../../types/room-response.type";
import {DefaultResponseType} from "../../../../types/default-response.type";
import { HttpErrorResponse } from "@angular/common/http";
import {PhotosChange} from "../../../shared/components/room-photos-editor/room-photos-editor.component";

@Component({
    selector: 'app-room-add',
    templateUrl: './room-add.component.html',
    styleUrls: ['./room-add.component.scss'],
    standalone: false
})
export class RoomAddComponent implements OnInit {

  addRoomForm = this.fb.group({
    name: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(1)]],
    type: [HotelTypeType.STANDARD, Validators.required],
    floor: [0, Validators.required],
    beds: [BedsTypeType.ONE, Validators.required],
    number: [0, Validators.required],
    area: [null as number | null],
    view: [''],
    description: ['', Validators.required],
    days: [14],
    free: [true]
  });

  /** Отмеченные удобства и фотографии (в порядке показа; первая – обложка). */
  amenities: string[] = [];
  photos: PhotosChange = {order: [], files: [], count: 0};
  saving = false;

  constructor (private router: Router,
              private roomService: RoomService,
              private _snackBar: MatSnackBar,
              private fb: FormBuilder) {
  }

  ngOnInit(): void {
  }

  addRoom() {
    if (this.addRoomForm.invalid) {
      this.addRoomForm.markAllAsTouched();
      return;
    }
    if (this.saving) {
      return;
    }
    const v = this.addRoomForm.value;
    const formData = new FormData();
    formData.append('room', JSON.stringify({
      name: v.name,
      price: v.price,
      type: v.type,
      floor: v.floor,
      beds: v.beds,
      number: v.number,
      area: v.area || null,
      view: v.view,
      description: v.description,
      days: v.days,
      free: v.free,
      amenities: this.amenities,
    }));
    this.photos.files.forEach(file => formData.append('files', file, file.name));

    this.saving = true;
    this.roomService.addRoom(formData).subscribe({
      next: (data: RoomResponseType | DefaultResponseType) => {
        this.saving = false;
        const roomResponse = data as RoomResponseType;

        this._snackBar.open('Номер успешно добавлен!');
        this.router.navigate(['/rooms/' + roomResponse.id]);
      },
      error: (errorResponse: HttpErrorResponse) => {
        this.saving = false;
        if (errorResponse.error && errorResponse.error.message) {
          this._snackBar.open(errorResponse.error.message);
        } else {
          this._snackBar.open('Ошибка добавления');
        }
      }
    });
  }
}
