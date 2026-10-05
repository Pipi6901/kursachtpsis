// app/views/analitics/analitics.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { AnaliticsComponent } from './analitics.component';
import { AnaliticsRoutingModule } from './analitics-routing.module';
import {FormsModule} from "@angular/forms";

@NgModule({
  declarations: [
    AnaliticsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    AnaliticsRoutingModule
  ],
  providers: [
    // Регистрируем интерцептор ТОЛЬКО для этого модуля
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ]
})
export class AnaliticsModule { }
