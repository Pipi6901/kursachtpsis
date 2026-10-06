import { Component, OnInit } from '@angular/core';
import {AuthService} from "../../core/auth/auth.service";
import {Router} from "@angular/router";

@Component({
    selector: 'app-layout',
    templateUrl: './layout.component.html',
    standalone: false
})
export class LayoutComponent implements OnInit {

  isLogged: boolean = false;

  constructor(private authService: AuthService,
              private router: Router) {
    this.isLogged = this.authService.getIsLoggedIn();
  }

  ngOnInit(): void {
    this.authService.isLogged$.subscribe((isLoggedIn: boolean) => {
      this.isLogged = isLoggedIn;
    });
  }
}
