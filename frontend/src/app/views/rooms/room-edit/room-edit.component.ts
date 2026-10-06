import {Component, OnInit} from '@angular/core';
import {HotelTypeType} from "../../../../types/hotel-type.type";
import {HotelTypeUtil} from "../../../shared/utils/hotel-type.util";
import {BedsTypeType} from "../../../../types/beds-type.type";
import {BedsTypeUtil} from "../../../shared/utils/beds-type.util";
import {RoomResponseType} from "../../../../types/room-response.type";
import {FormBuilder, Validators} from "@angular/forms";
import {ActivatedRoute, Router} from "@angular/router";
import {RoomService} from "../../../shared/services/room.service";
import {MatSnackBar} from "@angular/material/snack-bar";
import {DefaultResponseType} from "../../../../types/default-response.type";
import { HttpErrorResponse } from "@angular/common/http";

@Component({
  selector: 'app-room-edit',
  templateUrl: './room-edit.component.html',
  styleUrls: ['./room-edit.component.scss']
})
export class RoomEditComponent implements OnInit {

  hotelTypes = Object.values(HotelTypeType).map(type => ({
    value: type,
    label: HotelTypeUtil.getHotelType(type).name
  }));

  bedsTypes = Object.values(BedsTypeType).map(type => ({
    value: type,
    label: BedsTypeUtil.getBedsType(type).name
  }));

  roomForm = this.fb.group({
    name: ['', Validators.required],
    price: [0, Validators.required],
    type: [HotelTypeType.STANDARD, Validators.required],
    floor: [0, Validators.required],
    beds: [BedsTypeType.ONE, Validators.required],
    number: [0, Validators.required],
    description: ['', Validators.required],
    days: [10],
    free: [true],
    photo: ['']
  });
  originRoom: RoomResponseType;

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
            days: data.days,
            free: data.free
          });
        });
    });
  }

  editRoom() {
    if (this.roomForm.valid) {
      const formData = new FormData();

      const updatedRoom: Partial<RoomResponseType> = {};
      Object.keys(this.roomForm.controls).forEach((key) => {
        const formValue = this.roomForm.get(key)?.value;
        const originalValue = (this.originRoom as any)[key];

        if (formValue !== originalValue) {
          updatedRoom[key as keyof RoomResponseType] = formValue;
        }
      });

      updatedRoom['free'] = this.roomForm.get('free')?.value ?? true;

      if (Object.keys(updatedRoom).length > 0) {
        formData.append('room', JSON.stringify(updatedRoom));
      }

      const fileInput = (document.querySelector('[formControlName="photo"]') as HTMLInputElement).files;
      if (fileInput && fileInput[0]) {
        formData.append('file', fileInput[0], fileInput[0].name);
      }

      this.roomService.updateRoom(this.originRoom.id, formData)
        .subscribe({
          next: (data: DefaultResponseType | RoomResponseType) => {
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
            if (errorResponse.error && errorResponse.error.message) {
              this._snackBar.open(errorResponse.error.message);
            } else {
              this._snackBar.open('Ошибка обновления');
            }
          }
        });
    }
  }

}
