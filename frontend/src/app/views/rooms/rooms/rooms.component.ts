import { Component, OnInit } from '@angular/core';
import {RoomService} from "../../../shared/services/room.service";
import {AuthService} from "../../../core/auth/auth.service";
import {RoomResponseType} from "../../../../types/room-response.type";
import {BedsTypeUtil} from "../../../shared/utils/beds-type.util";
import {HotelTypeUtil} from "../../../shared/utils/hotel-type.util";
import {FormControl} from "@angular/forms";
import {debounceTime} from "rxjs";

@Component({
  selector: 'app-rooms',
  templateUrl: './rooms.component.html',
  styleUrls: ['./rooms.component.scss']
})
export class RoomsComponent implements OnInit {

  searchField = new FormControl();
  rooms: RoomResponseType[] = [];
  isAdmin: boolean = false;

  constructor(private roomService: RoomService,
              private authService: AuthService) {
    this.isAdmin = this.authService.getIsAdminIn();
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
