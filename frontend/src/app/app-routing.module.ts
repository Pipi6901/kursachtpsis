import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {LayoutComponent} from "./shared/layout/layout.component";
import {MainComponent} from "./views/main/main.component";
import {AuthForwardGuard} from "./core/auth/auth-forward";
import {AuthGuard} from "./core/auth/auth.guard";
import {StaffGuard} from "./core/auth/staff.guard";

const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {path: '', component: MainComponent},
      // {path: '', loadChildren: () => import('./views/info/info.module').then(m => m.InfoModule)},
      {path: '', loadChildren: () => import('./views/user/user.module').then(m => m.UserModule), canActivate: [AuthForwardGuard]},
      {path: '', loadChildren: () => import('./views/rooms/rooms.module').then(m => m.RoomsModule)},
      {path: '', loadChildren: () => import('./views/account/account.module').then(m => m.AccountModule), canActivate: [AuthGuard]},
      {
        path: 'analytics',
        loadChildren: () => import('./views/analitics/analitics.module').then(m => m.AnaliticsModule)
      },
      {path: '', loadChildren: () => import('./views/stat/stat.module').then(m => m.StatModule), canActivate: [AuthGuard]},
      {
        path: 'forecast',
        loadChildren: () => import('./views/forecast/forecast.module').then(m => m.ForecastModule),
        canActivate: [AuthGuard, StaffGuard]
      },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {anchorScrolling: 'enabled', scrollPositionRestoration: "enabled"})],
  exports: [RouterModule]
})
export class AppRoutingModule { }
