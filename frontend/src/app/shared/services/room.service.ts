import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {environment} from "../../../environments/environment";
import {RoomResponseType} from "../../../types/room-response.type";
import {DefaultResponseType} from "../../../types/default-response.type";
import {RentRoomResponseType} from "../../../types/rent-room-response.type";

@Injectable({
  providedIn: 'root'
})
export class RoomService {

  constructor(private http: HttpClient) { }

  getRooms(): Observable<RoomResponseType[]> {
    return this.http.get<RoomResponseType[]>(environment.api + 'rooms');
  }

  getRoom(url: string): Observable<RoomResponseType> {
    return this.http.get<RoomResponseType>(environment.api + 'rooms/' + url);
  }

  addRoom(formData: FormData): Observable<RoomResponseType | DefaultResponseType> {
    return this.http.post<RoomResponseType | DefaultResponseType>(environment.api + 'rooms/add', formData)
  }

  updateRoom(id: string, updatedData: FormData):Observable<RoomResponseType | DefaultResponseType>  {
    return this.http.put<RoomResponseType | DefaultResponseType>(environment.api + 'rooms/' + id + '/edit', updatedData);
  }

  deleteRoom(commentId: string): Observable<string> {
    return this.http.delete(environment.api + 'rooms/' + commentId + '/delete', {responseType: "text"});
  }

  createRent(roomId: string, days: number): Observable<RentRoomResponseType | DefaultResponseType> {
    return this.http.post<RentRoomResponseType | DefaultResponseType>(environment.api + 'rooms/' + roomId + '/createRent?days=' + days, {});
  }

  searchRoom(name: string): Observable<RoomResponseType[]> {
    return this.http.get<RoomResponseType[]>(environment.api + 'rooms/searchRoom?name=' + name);
  }
}
