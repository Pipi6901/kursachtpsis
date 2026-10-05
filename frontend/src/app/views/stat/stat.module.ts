import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { StatRoutingModule } from './stat-routing.module';
import { StatFinancialComponent } from './stat-financial/stat-financial.component';
import {SharedModule} from "../../shared/shared.module";


@NgModule({
  declarations: [
    StatFinancialComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    StatRoutingModule
  ]
})
export class StatModule { }
