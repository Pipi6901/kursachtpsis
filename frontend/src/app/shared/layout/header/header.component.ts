import {Component, ElementRef, HostListener, Input, OnInit} from '@angular/core';
import {AuthService} from "../../../core/auth/auth.service";
import {MatSnackBar} from "@angular/material/snack-bar";
import {Router} from "@angular/router";

@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    standalone: false
})
export class HeaderComponent implements OnInit {

  @Input() isLogged: boolean = false;
  isAdmin: boolean = false;
  isManager: boolean = false;
  /** мобильное меню (бургер) */
  isMenuOpen = false;
  /** открытое выпадающее меню: «Управление» или меню пользователя */
  dropdown: 'manage' | 'user' | null = null;

  constructor(private authService: AuthService,
              private _snackBar: MatSnackBar,
              private router: Router,
              private host: ElementRef<HTMLElement>) {
    this.isAdmin = this.authService.getIsAdminIn();
    this.isManager = this.authService.getIsManagerIn();
  }

  get isStaff(): boolean {
    return this.isAdmin || this.isManager;
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
    this.closeAll();
    this.authService.removeToken();
    this._snackBar.open('Вы вышли из системы');
    this.router.navigate(['/']);
  }

  toggle(name: 'manage' | 'user', event: Event): void {
    event.stopPropagation();
    this.dropdown = this.dropdown === name ? null : name;
  }

  /** Открывает мобильное меню (бургер) и блокирует прокрутку фона. */
  openMenu(): void {
    this.isMenuOpen = true;
    this.dropdown = null;
    document.body.style.overflow = 'hidden';
  }

  /** Закрывает мобильное меню (бургер) и восстанавливает прокрутку фона. */
  closeMenu(): void {
    this.isMenuOpen = false;
    document.body.style.overflow = 'auto';
  }

  closeAll(): void {
    this.dropdown = null;
    if (this.isMenuOpen) {
      this.closeMenu();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.dropdown && !(event.target as HTMLElement).closest('.hd__dd')) {
      this.dropdown = null;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeAll();
  }
}
