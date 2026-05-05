import { NgModule }            from '@angular/core';
import { BrowserModule }       from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule }      from './app-routing.module';
import { AppComponent }          from './app.component';
import { LoginComponent }        from './login/login.component';
import { LayoutComponent }       from './layout/layout.component';
import { DashboardComponent }    from './dashboard/dashboard.component';
import { PoolComponent }         from './pool/pool.component';
import { ReservationsComponent } from './reservations/reservations.component';
import { SubnetsComponent }      from './subnets/subnets.component';
import { OptionsComponent }      from './options/options.component';
import { StatisticsComponent }   from './statistics/statistics.component';
import { KeaInterceptor }        from './interceptors/kea.interceptor';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    LayoutComponent,
    DashboardComponent,
    PoolComponent,
    ReservationsComponent,
    SubnetsComponent,
    OptionsComponent,
    StatisticsComponent
  ],
  imports:   [BrowserModule, AppRoutingModule, ReactiveFormsModule, HttpClientModule],
  providers: [{ provide: HTTP_INTERCEPTORS, useClass: KeaInterceptor, multi: true }],
  bootstrap: [AppComponent]
})
export class AppModule {}
