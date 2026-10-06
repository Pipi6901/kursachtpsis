import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {environment} from "../../../environments/environment";
import {RoomResponseType} from "../../../types/room-response.type";
import {DefaultResponseType} from "../../../types/default-response.type";
import {RentRoomResponseType} from "../../../types/rent-room-response.type";
import {BusyPeriod} from "../utils/date-range.util";

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

  /** Бронирование на даты: заезд и выезд в формате гггг-мм-дд; ночь даты выезда не оплачивается. */
  createRent(roomId: string, startDate: string, endDate: string): Observable<RentRoomResponseType | DefaultResponseType> {
    return this.http.post<RentRoomResponseType | DefaultResponseType>(
      environment.api + 'rooms/' + roomId + '/createRent?startDate=' + startDate + '&endDate=' + endDate, {});
  }

  /** Занятые периоды номера для календаря. */
  getBusyPeriods(roomId: string): Observable<BusyPeriod[]> {
    return this.http.get<BusyPeriod[]>(environment.api + 'rooms/' + roomId + '/busy');
  }

  /** Номера, свободные на все ночи периода [from, to). */
  getAvailableRooms(from: string, to: string): Observable<RoomResponseType[]> {
    return this.http.get<RoomResponseType[]>(environment.api + 'rooms/available?from=' + from + '&to=' + to);
  }

  searchRoom(name: string): Observable<RoomResponseType[]> {
    return this.http.get<RoomResponseType[]>(environment.api + 'rooms/searchRoom?name=' + name);
  }
}
