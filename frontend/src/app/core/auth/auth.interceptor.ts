import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, finalize, Observable, throwError } from "rxjs";
import { AuthService } from "./auth.service";
import { LoaderService } from "../../shared/services/loader.service";
import { MatSnackBar } from "@angular/material/snack-bar";

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private authService: AuthService,
    private loaderService: LoaderService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    this.loaderService.show();
    const tokens = this.authService.getToken();

    if (tokens && tokens.accessToken) {
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${tokens.accessToken}`
        }
      });

      return next.handle(authReq).pipe(
        catchError((error: HttpErrorResponse) => this.handleError(error)),
        finalize(() => this.loaderService.hide())
      );
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error)),
      finalize(() => this.loaderService.hide())
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    if (error.status === 401) {
      this.authService.removeToken();
      this.snackBar.open("Сессия истекла. Авторизуйтесь заново");
      this.router.navigate(['/login']);
    }
    return throwError(() => error);
  }
}
