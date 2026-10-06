import { Component, OnInit } from '@angular/core';
import {RoomService} from "../../../shared/services/room.service";
import {AuthService} from "../../../core/auth/auth.service";
import {RoomResponseType} from "../../../../types/room-response.type";
import {BedsTypeUtil} from "../../../shared/utils/beds-type.util";
import {HotelTypeUtil} from "../../../shared/utils/hotel-type.util";
import {FormControl} from "@angular/forms";
import {debounceTime} from "rxjs";
import {DateRangeUtil} from "../../../shared/utils/date-range.util";

@Component({
  selector: 'app-rooms',
  templateUrl: './rooms.component.html',
  styleUrls: ['./rooms.component.scss']
})
export class RoomsComponent implements OnInit {

  searchField = new FormControl();
  rooms: RoomResponseType[] = [];
  isAdmin: boolean = false;

  /** Фильтр «свободны на даты»: заезд и выезд; идентификаторы номеров, свободных на весь период. */
  checkIn = '';
  checkOut = '';
  readonly today = DateRangeUtil.today();
  availableIds: Set<string> | null = null;
  availabilityError = '';

  constructor(private roomService: RoomService,
              private authService: AuthService) {
    this.isAdmin = this.authService.getIsAdminIn();
  }

  /** Номера для показа: если выбраны даты — только свободные на них. */
  get visibleRooms(): RoomResponseType[] {
    const ids = this.availableIds;
    return ids ? this.rooms.filter(room => ids.has(String(room.id))) : this.rooms;
  }

  get dateFilterActive(): boolean {
    return this.availableIds !== null;
  }

  get minCheckOut(): string {
    return this.checkIn ? DateRangeUtil.addDays(this.checkIn, 1) : DateRangeUtil.addDays(this.today, 1);
  }

  onDatesChange(): void {
    this.availabilityError = '';
    if (!this.checkIn || !this.checkOut) {
      this.availableIds = null;
      return;
    }
    if (this.checkIn < this.today) {
      this.availabilityError = 'Дата заезда не может быть в прошлом';
      this.availableIds = null;
      return;
    }
    if (this.checkOut <= this.checkIn) {
      this.availabilityError = 'Дата выезда должна быть позже даты заезда';
      this.availableIds = null;
      return;
    }
    this.roomService.getAvailableRooms(this.checkIn, this.checkOut).subscribe({
      next: (data: RoomResponseType[]) => this.availableIds = new Set(data.map(room => String(room.id))),
      error: () => {
        this.availabilityError = 'Не удалось проверить занятость номеров';
        this.availableIds = null;
      }
    });
  }

  resetDates(): void {
    this.checkIn = '';
    this.checkOut = '';
    this.availabilityError = '';
    this.availableIds = null;
  }

  ngOnInit(): void {
    this.authService.isAdmin$.subscribe((isAdminIn: boolean) => {
      this.isAdmin = isAdminIn;
    });

    this.roomService.getRooms()
      .subscribe((data: RoomResponseType[]) => {
        this.rooms = data;

        this.rooms = data.map(item => {
          const bedType = BedsTypeUtil.getBedsType(item.beds);
          const hotelType = HotelTypeUtil.getHotelType(item.type);

          item.bedsTypeRus = bedType.name;
          item.typeRus = hotelType.name;
          return item;
        });
      })


    this.searchField.valueChanges
      .pipe(
        debounceTime(500)
      )
      .subscribe(value => {
        if (value && value.length > 0) {
          this.roomService.searchRoom(value)
            .subscribe((data: RoomResponseType[]) => {
              this.rooms = data;

              this.rooms = data.map(item => {
                const bedType = BedsTypeUtil.getBedsType(item.beds);
                const hotelType = HotelTypeUtil.getHotelType(item.type);

                item.bedsTypeRus = bedType.name;
                item.typeRus = hotelType.name;
                return item;
              });
            });
        } else {
          this.roomService.getRooms()
            .subscribe((data: RoomResponseType[]) => {
              this.rooms = data;

              this.rooms = data.map(item => {
                const bedType = BedsTypeUtil.getBedsType(item.beds);
                const hotelType = HotelTypeUtil.getHotelType(item.type);

                item.bedsTypeRus = bedType.name;
                item.typeRus = hotelType.name;
                return item;
              });
            });
        }
      });
  }

}
