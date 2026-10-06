import { Component, OnInit } from '@angular/core';
import {FormBuilder, Validators} from "@angular/forms";
import {MatSnackBar} from "@angular/material/snack-bar";
import {Router} from "@angular/router";
import {RoomService} from "../../../shared/services/room.service";
import {HotelTypeType} from "../../../../types/hotel-type.type";
import {HotelTypeUtil} from "../../../shared/utils/hotel-type.util";
import {BedsTypeType} from "../../../../types/beds-type.type";
import {BedsTypeUtil} from "../../../shared/utils/beds-type.util";
import {RoomResponseType} from "../../../../types/room-response.type";
import {DefaultResponseType} from "../../../../types/default-response.type";
import { HttpErrorResponse } from "@angular/common/http";

@Component({
    selector: 'app-room-add',
    templateUrl: './room-add.component.html',
    styleUrls: ['./room-add.component.scss'],
    standalone: false
})
export class RoomAddComponent implements OnInit {

  hotelTypes = Object.values(HotelTypeType).map(type => ({
    value: type,
    label: HotelTypeUtil.getHotelType(type).name
  }));

  bedsTypes = Object.values(BedsTypeType).map(type => ({
    value: type,
    label: BedsTypeUtil.getBedsType(type).name
  }));

  addRoomForm = this.fb.group({
    name: ['', Validators.required],
    price: [0, Validators.required],
    type: [HotelTypeType.STANDARD, Validators.required],
    floor: [0, Validators.required],
    beds: [BedsTypeType.ONE, Validators.required],
    number: [0, Validators.required],
    description: ['', Validators.required],
    days: [14],
    free: [true],
    photo: ['', Validators.required]
  });

  constructor (private router: Router,
              private roomService: RoomService,
              private _snackBar: MatSnackBar,
              private fb: FormBuilder) {
  }

  ngOnInit(): void {
  }

  addRoom() {
    if (this.addRoomForm.valid) {

      const formData = new FormData();
      formData.append('room', JSON.stringify({
        name: this.addRoomForm.value.name,
        price: this.addRoomForm.value.price,
        type: this.addRoomForm.value.type,
        floor: this.addRoomForm.value.floor,
        beds: this.addRoomForm.value.beds,
        number: this.addRoomForm.value.number,
        description: this.addRoomForm.value.description,
        days: this.addRoomForm.value.days,
        free: this.addRoomForm.value.free,
      }));

      const fileInput = (document.querySelector('[formControlName="photo"]') as HTMLInputElement).files;
      if (fileInput && fileInput[0]) {
        formData.append('file', fileInput[0], fileInput[0].name);
      }

      this.roomService.addRoom(formData).subscribe({
        next: (data: RoomResponseType | DefaultResponseType) => {
          const roomResponse = data as RoomResponseType;

          this._snackBar.open('Номер успешно добавлен!');
          this.router.navigate(['/rooms/' + roomResponse.id]);
        },
        error: (errorResponse: HttpErrorResponse) => {
          if (errorResponse.error && errorResponse.error.message) {
            this._snackBar.open(errorResponse.error.message);
          } else {
            this._snackBar.open('Ошибка добавления');
          }
        }
      });
    }
  }
}
