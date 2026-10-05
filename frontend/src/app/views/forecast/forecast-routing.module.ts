import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {ForecastDashboardComponent} from './dashboard/forecast-dashboard.component';
import {CampaignsComponent} from './campaigns/campaigns.component';
import {ModelDataComponent} from './model-data/model-data.component';

const routes: Routes = [
  {path: '', component: ForecastDashboardComponent},
  {path: 'campaigns', component: CampaignsComponent},
  {path: 'model', component: ModelDataComponent},
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ForecastRoutingModule {
}
