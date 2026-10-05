import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {StatFinancialComponent} from "./stat-financial/stat-financial.component";

const routes: Routes = [
  {path: 'stats', component: StatFinancialComponent},
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class StatRoutingModule { }
