import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {RoomsComponent} from "./rooms/rooms.component";
import {RoomAddComponent} from "./room-add/room-add.component";
import {RoomComponent} from "./room/room.component";
import {RoomEditComponent} from "./room-edit/room-edit.component";
import {MyRoomsComponent} from "./my-rooms/my-rooms.component";
import {ReceiptComponent} from "./receipt/receipt.component";

const routes: Routes = [
  {path: 'rooms', component: RoomsComponent},
  {path: 'rooms/add', component: RoomAddComponent},
  {path: 'rooms/my', component: MyRoomsComponent},
  {path: 'receipt/:id', component: ReceiptComponent},
  {path: 'rooms/:id', component: RoomComponent},
  {path: 'rooms/:id/edit', component: RoomEditComponent},
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RoomsRoutingModule { }
