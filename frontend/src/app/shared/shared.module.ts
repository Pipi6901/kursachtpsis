import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {RouterModule} from "@angular/router";
import { LoaderComponent } from './components/loader/loader.component';
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";

@NgModule({
  declarations: [
    LoaderComponent
  ],
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    RouterModule
  ],
  exports: [
    LoaderComponent
  ]
})
export class SharedModule { }
