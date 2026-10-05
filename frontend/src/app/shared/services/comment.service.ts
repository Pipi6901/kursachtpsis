import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {environment} from "../../../environments/environment";
import {CommentResponseType} from "../../../types/comment-response.type";

@Injectable({
  providedIn: 'root'
})
export class CommentService {

  constructor(private http: HttpClient) { }

  getComments(publicationId: string): Observable<CommentResponseType[]> {
    return this.http.get<CommentResponseType[]>(environment.api + 'comments/' + publicationId);
  }

  addComment(publicationId: string, text: string): Observable<CommentResponseType> {
    return this.http.post<CommentResponseType>(environment.api + 'comments/' + publicationId + '/add', {text: text})
  }

  deleteComment(commentId: string): Observable<string> {
    return this.http.delete(environment.api + 'comments/' + commentId + '/delete', {responseType: "text"});
  }

}
