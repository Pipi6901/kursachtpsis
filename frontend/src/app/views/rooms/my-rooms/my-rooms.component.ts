import { Component, OnInit } from '@angular/core';
import {BedsTypeUtil} from "../../../shared/utils/beds-type.util";
import {HotelTypeUtil} from "../../../shared/utils/hotel-type.util";
import {ReservationService} from "../../../shared/services/reservation.service";
import {RentRoomResponseType} from "../../../../types/rent-room-response.type";
import {StatusUtil} from "../../../shared/utils/status.util";
import {AuthService} from "../../../core/auth/auth.service";
import {StatusTypeType} from "../../../../types/status-type.type";
import {MatSnackBar} from "@angular/material/snack-bar";
import { HttpErrorResponse } from "@angular/common/http";
import {DateRangeUtil} from "../../../shared/utils/date-range.util";

@Component({
    selector: 'app-my-rooms',
    templateUrl: './my-rooms.component.html',
    styleUrls: ['./my-rooms.component.scss'],
    standalone: false
})
export class MyRoomsComponent implements OnInit {

  rooms: RentRoomResponseType[] = [];
  isManager: boolean = false;
  statusTypeTypes = StatusTypeType;

  constructor(private reservationService: ReservationService,
              private authService: AuthService,
              private _snackBar: MatSnackBar) {
    this.isManager = this.authService.getIsManagerIn();
  }

  ngOnInit(): void {
    this.authService.isManager$.subscribe((isManagerIn: boolean) => {
      this.isManager = isManagerIn;
    });

    this.reservationService.getReservations()
      .subscribe((data: RentRoomResponseType[]) => {
        this.rooms = data;

        this.rooms = data.map(item => {
          const bedType = BedsTypeUtil.getBedsType(item.beds);
          const hotelType = HotelTypeUtil.getHotelType(item.type);
          const status = StatusUtil.getStatus(item.status);

          item.bedsTypeRus = bedType.name;
          item.typeRus = hotelType.name;
          item.statusRus = status.name;
          item.color = status.color;
          return item;
        });
      })
  }

  /** Выселиться можно из подтверждённой брони, проживание по которой уже началось (у старых броней дат нет). */
  canMoveOut(room: RentRoomResponseType): boolean {
    return room.status === StatusTypeType.DONE && (!room.startDate || room.startDate <= DateRangeUtil.today());
  }

  formatDate(iso: string | null | undefined): string {
    return DateRangeUtil.formatRu(iso ? iso.substring(0, 10) : '');
  }

  cancelRoom(roomId: string) {
    this.reservationService.cancelReservation(roomId).subscribe({
      next: () => {
        this.rooms = this.rooms.filter(app => app.id !== roomId);
        this._snackBar.open('Бронь отменена!');
      },
      error: (errorResponse: HttpErrorResponse) => {
        if (errorResponse.error && errorResponse.error.message) {
          this._snackBar.open(errorResponse.error.message);
        } else {
          this._snackBar.open('Ошибка отмены');
        }
      }
    })
  }

  moveOutReservation(roomId: string) {
    this.reservationService.moveOutReservation(roomId).subscribe({
      next: () => {
        const status = StatusUtil.getStatus(StatusTypeType.COMPLETED);
        this.rooms = this.rooms.map(app => app.id === roomId
          ? {...app, status: StatusTypeType.COMPLETED, statusRus: status.name, color: status.color,
            movedOutAt: new Date().toISOString()}
          : app);
        this._snackBar.open('Выселение успешно! Проживание засчитано.');
      },
      error: (errorResponse: HttpErrorResponse) => {
        if (typeof errorResponse.error === 'string' && errorResponse.error) {
          this._snackBar.open(errorResponse.error);
        } else if (errorResponse.error && errorResponse.error.message) {
          this._snackBar.open(errorResponse.error.message);
        } else {
          this._snackBar.open('Ошибка выселения');
        }
      }
    })
  }

  confirmReservation(roomId: string) {
    this.reservationService.confirmReservation(roomId).subscribe({
      next: (data: RentRoomResponseType) => {
        this.rooms = this.rooms.map(app => {
          if (app.id === data.id) {
            const status = StatusUtil.getStatus(data.status);
            const bedType = BedsTypeUtil.getBedsType(data.beds);
            const hotelType = HotelTypeUtil.getHotelType(data.type);

            return {
              ...app,
              ...data,
              statusRus: status.name,
              color: status.color,
              bedsTypeRus: bedType.name,
              typeRus: hotelType.name
            };
          }
          return app;
        });
        this._snackBar.open('Бронь одобрена');
      },
      error: (errorResponse: HttpErrorResponse) => {
        if (errorResponse.error && errorResponse.error.message) {
          this._snackBar.open(errorResponse.error.message);
        } else {
          this._snackBar.open('Ошибка одобрения');
        }
      }
    })
  }

  rejectReservation(roomId: string) {
    this.reservationService.rejectReservation(roomId).subscribe({
      next: (data: RentRoomResponseType) => {
        this.rooms = this.rooms.map(app => {
          if (app.id === data.id) {
            const status = StatusUtil.getStatus(data.status);
            const bedType = BedsTypeUtil.getBedsType(data.beds);
            const hotelType = HotelTypeUtil.getHotelType(data.type);

            return {
              ...app,
              ...data,
              statusRus: status.name,
              color: status.color,
              bedsTypeRus: bedType.name,
              typeRus: hotelType.name
            };
          }
          return app;
        });
        this._snackBar.open('Бронь отказана');
      },
      error: (errorResponse: HttpErrorResponse) => {
        if (errorResponse.error && errorResponse.error.message) {
          this._snackBar.open(errorResponse.error.message);
        } else {
          this._snackBar.open('Ошибка отказа');
        }
      }
    })
  }
}
