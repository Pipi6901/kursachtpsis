import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import {Observable} from "rxjs";
import {StatAllResponseType} from "../../../types/stat-all-response.type";
import {environment} from "../../../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class StatService {

  constructor(private http: HttpClient) { }

  getStat(): Observable<StatAllResponseType> {
    return this.http.get<StatAllResponseType>(environment.api + 'stats');
  }
}
