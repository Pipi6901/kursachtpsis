import {Component, OnInit} from '@angular/core';
import {SignupResponseType} from "../../../../types/signup-response.type";
import {MatSnackBar} from "@angular/material/snack-bar";
import {FormBuilder, Validators} from "@angular/forms";
import {DefaultResponseType} from "../../../../types/default-response.type";
import {HttpErrorResponse} from "@angular/common/http";
import {ProfileService} from "../../../shared/services/profile.service";
import {AuthService} from "../../../core/auth/auth.service";

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {

  profileForm = this.fb.group({
    name: ['', Validators.required],
    phone: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
  })
  balanceForm = this.fb.group({
    balance: [0, [Validators.required]],
  });

  originalProfileData: SignupResponseType;
  isAdmin: boolean = false;
  isManager: boolean = false;

  constructor(private profileService: ProfileService,
              private _snackBar: MatSnackBar,
              private fb: FormBuilder,
              private authService: AuthService) {
    this.isAdmin = this.authService.getIsAdminIn();
    this.isManager = this.authService.getIsManagerIn();

    this.originalProfileData = {
      id: '',
      name: '',
      username: '',
      email: '',
      phone: '',
      balance: 0,
    }
  }

  ngOnInit(): void {
    this.authService.isAdmin$.subscribe((isAdminIn: boolean) => {
      this.isAdmin = isAdminIn;
    });

    this.authService.isManager$.subscribe(isManager => {
      this.isManager = isManager;
    });

    this.profileService.getProfile()
      .subscribe((data: SignupResponseType) => {
        this.originalProfileData = {...data};
        this.profileForm.patchValue(data);
        this.balanceForm.patchValue(data);
      });
  }

  updateProfile() {
    if (this.profileForm.valid && this.profileForm.value.name && this.profileForm.value.phone && this.profileForm.value.email) {
      const updatedProfile: { name?: string; phone?: string; email?: string } = {};

      if (this.profileForm.value.name !== this.originalProfileData.name) {
        updatedProfile.name = this.profileForm.value.name;
      }
      if (this.profileForm.value.phone !== this.originalProfileData.phone) {
        updatedProfile.phone = this.profileForm.value.phone;
      }
      if (this.profileForm.value.email !== this.originalProfileData.email) {
        updatedProfile.email = this.profileForm.value.email;
      }

      if (Object.keys(updatedProfile).length > 0) {
        this.profileService.updateProfile(updatedProfile)
          .subscribe({
            next: (data: DefaultResponseType | SignupResponseType) => {
              let error = null;
              if ((data as DefaultResponseType).status === 400) {
                error = (data as DefaultResponseType).message;
              }

              if (error) {
                this._snackBar.open(error);
                throw new Error(error);
              }

              this._snackBar.open('Вы успешно обновили пользователя!');
            },
            error: (errorResponse: HttpErrorResponse) => {
              if (errorResponse.error && errorResponse.error.message) {
                this._snackBar.open(errorResponse.error.message);
              } else {
                this._snackBar.open('Ошибка обновления');
              }
            }
          });
      } else {
        this._snackBar.open('Нет изменений для отправки');
      }
    }
  }

  updateBalance() {
    if (this.balanceForm.valid && this.balanceForm.value.balance) {
      this.profileService.updateBalance(this.balanceForm.value.balance).subscribe(
        (data: SignupResponseType | DefaultResponseType) => {
          if ((data as DefaultResponseType).status === 400) {
            this._snackBar.open((data as DefaultResponseType).message);
            return;
          }

          this._snackBar.open('Баланс успешно изменен!');
        },
        error => {
          this._snackBar.open('Ошибка при добавлении баланса!');
        }
      );
    } else {
      this._snackBar.open('Введите сумму для пополнения баланса');
    }
  }

}
