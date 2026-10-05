import { Component, OnInit } from '@angular/core';
import {AuthService} from "../../../core/auth/auth.service";
import {DefaultResponseType} from "../../../../types/default-response.type";
import {LoginResponseType} from "../../../../types/login-response.type";
import {HttpErrorResponse} from "@angular/common/http";
import {Router} from "@angular/router";
import {FormBuilder, Validators} from "@angular/forms";
import {MatSnackBar} from "@angular/material/snack-bar";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  loginForm = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  constructor(private fb: FormBuilder,
              private authService: AuthService,
              private _snackBar: MatSnackBar,
              private router: Router) { }
  ngOnInit(): void {
  }

  login(): void {
    if (this.loginForm.valid && this.loginForm.value.username && this.loginForm.value.password) {
      this.authService.login(this.loginForm.value.username, this.loginForm.value.password)
        .subscribe({
          next: (data: DefaultResponseType | LoginResponseType) => {
            let error = null;
            if ((data as DefaultResponseType).status === 400) {
              error = (data as DefaultResponseType).message;
            }

            const loginResponse = data as LoginResponseType;
            if (!loginResponse.token) {
              error = 'Ошибка авторизации';
            }

            if (error) {
              this._snackBar.open(error);
              throw new Error(error);
            }

            this.authService.setToken(loginResponse.token, loginResponse.roles);
            this._snackBar.open('Вы успешно авторизовались');
            this.router.navigate(['/']);

            this.authService.isAdmin$.next(this.authService.getIsAdminIn());
          },
          error: (errorResponse: HttpErrorResponse) => {
            if (errorResponse.error && errorResponse.error.message) {
              this._snackBar.open(errorResponse.error.message);
            } else {
              this._snackBar.open('Ошибка авторизации');
            }
          }
        })
    }
  }
}
