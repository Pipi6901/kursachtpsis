// app/views/analitics/analitics-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AnaliticsComponent } from './analitics.component';

const routes: Routes = [
  { path: '', component: AnaliticsComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AnaliticsRoutingModule { }
