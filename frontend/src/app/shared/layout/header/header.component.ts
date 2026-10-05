/* --- ЗАМЕНИТЬ ЭТИМ ФАЙЛОМ --- */

import {Component, Input, OnInit} from '@angular/core';
import {AuthService} from "../../../core/auth/auth.service";
import {MatSnackBar} from "@angular/material/snack-bar";
import {Router} from "@angular/router";

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {

  @Input() isLogged: boolean = false;
  isAdmin: boolean = false;
  isManager: boolean = false;
  isMenuOpen = false; // Управление видимостью мобильного меню
  isSearchActive = false;

  constructor(private authService: AuthService,
              private _snackBar: MatSnackBar,
              private router: Router) {
    this.isAdmin = this.authService.getIsAdminIn();
    this.isManager = this.authService.getIsManagerIn();
  }

  ngOnInit(): void {
    this.authService.isAdmin$.subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });

    this.authService.isManager$.subscribe(isManager => {
      this.isManager = isManager;
    });
  }

  logout(): void {
    this.authService.removeToken();
    this._snackBar.open('Вы вышли из системы');
    this.router.navigate(['/']);
  }

  /**
   * Открывает мобильное меню (бургер) и блокирует прокрутку фона.
   */
  openMenu(): void {
    this.isMenuOpen = true;
    document.body.style.overflow = 'hidden';
  }

  /**
   * Закрывает мобильное меню (бургер) и восстанавливает прокрутку фона.
   */
  closeMenu(): void {
    this.isMenuOpen = false;
    document.body.style.overflow = 'auto';
  }

  openSearch(): void {
    this.isSearchActive = true;
  }
}
