import { NgModule }              from '@angular/core';
import { RouterModule, Routes }  from '@angular/router';
import { LoginComponent }        from './login/login.component';
import { LayoutComponent }       from './layout/layout.component';
import { DashboardComponent }    from './dashboard/dashboard.component';
import { PoolComponent }         from './pool/pool.component';
import { ReservationsComponent } from './reservations/reservations.component';
import { SubnetsComponent }      from './subnets/subnets.component';
import { OptionsComponent }      from './options/options.component';
import { StatisticsComponent }   from './statistics/statistics.component';
import { authGuard }             from './guards/auth.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '',              redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',    component: DashboardComponent },
      { path: 'leases',       component: PoolComponent },
      { path: 'reservations', component: ReservationsComponent },
      { path: 'subnets',      component: SubnetsComponent },
      { path: 'options',      component: OptionsComponent },
      { path: 'statistics',   component: StatisticsComponent },
      { path: '**',           redirectTo: 'dashboard' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
