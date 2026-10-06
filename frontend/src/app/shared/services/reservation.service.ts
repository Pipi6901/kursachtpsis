import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import {Observable} from "rxjs";
import {environment} from "../../../environments/environment";
import {RentRoomResponseType} from "../../../types/rent-room-response.type";
import {ReceiptResponseType} from "../../../types/receipt-response.type";

@Injectable({
  providedIn: 'root'
})
export class ReservationService {

  constructor(private http: HttpClient) { }

  getReservations(): Observable<RentRoomResponseType[]> {
    return this.http.get<RentRoomResponseType[]>(environment.api + 'reservations');
  }

  confirmReservation(id: string): Observable<RentRoomResponseType> {
    return this.http.post<RentRoomResponseType>(environment.api + 'reservations/' + id + '/confirm', {});
  }

  rejectReservation(id: string): Observable<RentRoomResponseType> {
    return this.http.post<RentRoomResponseType>(environment.api + 'reservations/' + id + '/reject', {});
  }

  cancelReservation(id: string): Observable<string> {
    return this.http.post(environment.api + 'reservations/' + id + '/cancel', {}, {responseType: 'text'});
  }

  moveOutReservation(id: string): Observable<string> {
    return this.http.post(environment.api + 'reservations/' + id + '/moveOut', {}, {responseType: 'text'});
  }

  getReceipts(id: string): Observable<ReceiptResponseType> {
    return this.http.get<ReceiptResponseType>(environment.api + 'receipts/reservation/' + id, {});
  }
}
