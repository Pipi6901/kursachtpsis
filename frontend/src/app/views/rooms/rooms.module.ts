import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RoomsRoutingModule } from './rooms-routing.module';
import { RoomsComponent } from './rooms/rooms.component';
import { RoomComponent } from './room/room.component';
import { RoomAddComponent } from './room-add/room-add.component';
import { RoomEditComponent } from './room-edit/room-edit.component';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {SharedModule} from "../../shared/shared.module";
import { MyRoomsComponent } from './my-rooms/my-rooms.component';
import { ReceiptComponent } from './receipt/receipt.component';


@NgModule({
  declarations: [
    RoomsComponent,
    RoomComponent,
    RoomAddComponent,
    RoomEditComponent,
    MyRoomsComponent,
    ReceiptComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    FormsModule,
    ReactiveFormsModule,
    RoomsRoutingModule
  ]
})
export class RoomsModule { }
