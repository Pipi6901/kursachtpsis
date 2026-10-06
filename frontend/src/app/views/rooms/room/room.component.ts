import { Component, OnInit } from '@angular/core';
import {RoomResponseType} from "../../../../types/room-response.type";
import {RoomService} from "../../../shared/services/room.service";
import {MatSnackBar} from "@angular/material/snack-bar";
import {AuthService} from "../../../core/auth/auth.service";
import {ActivatedRoute, Router} from "@angular/router";
import {HotelTypeUtil} from "../../../shared/utils/hotel-type.util";
import {BedsTypeUtil} from "../../../shared/utils/beds-type.util";
import {FormBuilder, Validators} from "@angular/forms";
import { HttpErrorResponse } from "@angular/common/http";
import {CommentService} from "../../../shared/services/comment.service";
import {CommentResponseType} from "../../../../types/comment-response.type";
import {HotelTypeType} from "../../../../types/hotel-type.type";
import {BedsTypeType} from "../../../../types/beds-type.type";
import {BusyPeriod, DateRangeUtil} from "../../../shared/utils/date-range.util";

declare var $: any;

@Component({
    selector: 'app-room',
    templateUrl: './room.component.html',
    styleUrls: ['./room.component.scss'],
    standalone: false
})
export class RoomComponent implements OnInit {

  room: RoomResponseType;
  isAdmin: boolean = false;
  isLogged: boolean = false;
  isManager: boolean = false;
  comments: CommentResponseType[] = [];
  commentForm = this.fb.group({
    text: ['', [Validators.required]]
  });

  /** Занятые периоды номера и выбранные в календаре даты проживания. */
  busy: BusyPeriod[] = [];
  rentFrom: string | null = null;
  rentTo: string | null = null;
  renting = false;

  constructor(private authService: AuthService,
              private roomService: RoomService,
              private commentService: CommentService,
              private activatedRoute: ActivatedRoute,
              private router: Router,
              private _snackBar: MatSnackBar,
              private fb: FormBuilder) {
    this.isAdmin = this.authService.getIsAdminIn();
    this.isManager = this.authService.getIsManagerIn();
    this.isLogged = this.authService.getIsLoggedIn();

    this.room = {
      id: '',
      name: '',
      price: 0,
      photo: '',
      free: true,
      days: 1,
      type: HotelTypeType.STANDARD,
      beds: BedsTypeType.ONE,
      number: 0,
      description: '',
      floor: 0,
    }
  }

  ngOnInit(): void {
    this.authService.isAdmin$.subscribe((isAdminIn: boolean) => {
      this.isAdmin = isAdminIn;
    });

    this.authService.isLogged$.subscribe((isLoggedIn: boolean) => {
      this.isLogged = isLoggedIn;
    });

    this.authService.isManager$.subscribe(isManager => {
      this.isManager = isManager;
    });

    this.activatedRoute.params.subscribe(params => {
      this.roomService.getRoom(params['id'])
        .subscribe((data: RoomResponseType) => {
          this.room = data;

          const hotelType = HotelTypeUtil.getHotelType(data.type);
          this.room.typeRus = hotelType.name;

          const bedsType = BedsTypeUtil.getBedsType(data.beds);
          this.room.bedsTypeRus = bedsType.name;

          this.loadBusy();

          this.commentService.getComments(this.room.id)
            .subscribe((commentsData: CommentResponseType[]) => {
              this.comments = commentsData;
            });
        });
    })

    $('select').niceSelect();
  }

  private loadBusy(): void {
    this.roomService.getBusyPeriods(this.room.id)
      .subscribe((periods: BusyPeriod[]) => this.busy = periods);
  }

  onRangeChange(range: { from: string | null, to: string | null }): void {
    this.rentFrom = range.from;
    this.rentTo = range.to;
  }

  get rentNights(): number {
    return this.rentFrom && this.rentTo ? DateRangeUtil.nights(this.rentFrom, this.rentTo) : 0;
  }

  get rentTotal(): number {
    return this.room.price * this.rentNights;
  }

  rentRoom() {
    if (!this.rentFrom || !this.rentTo || this.renting) {
      return;
    }
    this.renting = true;
    this.roomService.createRent(this.room.id, this.rentFrom, this.rentTo).subscribe({
      next: () => {
        this.renting = false;
        this._snackBar.open('Номер успешно арендован!');
        this.router.navigate(['/rooms/my']);
      },
      error: (errorResponse: HttpErrorResponse) => {
        this.renting = false;
        if (errorResponse.error && errorResponse.error.message) {
          this._snackBar.open(errorResponse.error.message);
        } else {
          this._snackBar.open('Ошибка аренды');
        }
        this.loadBusy();   // даты могли занять, пока открыта страница
      }
    })
  }

  deleteRoom() {
    this.roomService.deleteRoom(this.room.id).subscribe({
      next: () => {
        this.router.navigate(['/rooms']);
        this._snackBar.open('Номер успешно удален!');
      },
      error: (errorResponse: HttpErrorResponse) => {
        if (errorResponse.error && errorResponse.error.message) {
          this._snackBar.open(errorResponse.error.message);
        } else {
          this._snackBar.open('Ошибка удаления');
        }
      }
    })
  }

  addComment() {
    if (this.commentForm.valid && this.commentForm.value.text) {
      const commentText = this.commentForm.value.text;
      this.commentService.addComment(this.room.id, commentText).subscribe({
        next: (data: CommentResponseType) => {
          this.comments.unshift(data);
          this.commentForm.reset();
          this._snackBar.open('Комментарий успешно добавлен!');
        },
        error: (errorResponse: HttpErrorResponse) => {
          if (errorResponse.error && errorResponse.error.message) {
            this._snackBar.open(errorResponse.error.message);
          } else {
            this._snackBar.open('Ошибка добавления');
          }
        }
      });
    }
  }

  deleteComment(commentId: string) {
    this.commentService.deleteComment(commentId).subscribe({
      next: () => {
        this.comments = this.comments.filter(comment => comment.id !== commentId);
        this._snackBar.open('Комментарий успешно удален!');
      },
      error: (errorResponse: HttpErrorResponse) => {
        if (errorResponse.error && errorResponse.error.message) {
          this._snackBar.open(errorResponse.error.message);
        } else {
          this._snackBar.open('Ошибка удаления');
        }
      }
    })
  }
}
