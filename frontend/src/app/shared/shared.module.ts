import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {RouterModule} from "@angular/router";
import { LoaderComponent } from './components/loader/loader.component';
import { DateRangePickerComponent } from './components/date-range-picker/date-range-picker.component';
import { PhoneMaskDirective } from './directives/phone-mask.directive';
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";

@NgModule({
  declarations: [
    LoaderComponent,
    DateRangePickerComponent,
    PhoneMaskDirective
  ],
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    RouterModule
  ],
  exports: [
    LoaderComponent,
    DateRangePickerComponent,
    PhoneMaskDirective
  ]
})
export class SharedModule { }
