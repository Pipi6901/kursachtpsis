import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from './auth.service';

/** Допуск в служебные разделы (аналитика и прогноз): только администратор и менеджер. */
@Injectable({
  providedIn: 'root'
})
export class StaffGuard implements CanActivate {

  constructor(private authService: AuthService,
              private router: Router,
              private snackBar: MatSnackBar) {
  }

  canActivate(): boolean | UrlTree {
    if (this.authService.getIsAdminIn() || this.authService.getIsManagerIn()) {
      return true;
    }
    this.snackBar.open('Раздел доступен администратору и менеджеру');
    return this.router.parseUrl('/');
  }
}
