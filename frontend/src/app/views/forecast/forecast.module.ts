import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ForecastRoutingModule} from './forecast-routing.module';
import {ForecastDashboardComponent} from './dashboard/forecast-dashboard.component';
import {CampaignsComponent} from './campaigns/campaigns.component';
import {ModelDataComponent} from './model-data/model-data.component';
import {NavComponent} from './components/nav/nav.component';
import {ChartComponent} from './components/chart/chart.component';

/** Модуль «Прогноз продаж с учётом мультиканальных маркетинговых активностей» (загружается по требованию). */
@NgModule({
  declarations: [
    ForecastDashboardComponent,
    CampaignsComponent,
    ModelDataComponent,
    NavComponent,
    ChartComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ForecastRoutingModule
  ]
})
export class ForecastModule {
}
