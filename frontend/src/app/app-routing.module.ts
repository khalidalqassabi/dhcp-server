import { NgModule }             from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent }       from './login/login.component';
import { LayoutComponent }      from './layout/layout.component';
import { DashboardComponent }   from './dashboard/dashboard.component';
import { PoolComponent }        from './pool/pool.component';
import { SettingsComponent }    from './settings/settings.component';
import { authGuard }            from './guards/auth.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '',          redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'pool',      component: PoolComponent },
      { path: 'settings',  component: SettingsComponent },
      { path: '**',        redirectTo: 'dashboard' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
