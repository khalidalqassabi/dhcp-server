import { NgModule }            from '@angular/core';
import { BrowserModule }       from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule }   from './app-routing.module';
import { AppComponent }       from './app.component';
import { LoginComponent }     from './login/login.component';
import { LayoutComponent }    from './layout/layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { SettingsComponent }  from './settings/settings.component';
import { AuthInterceptor }    from './interceptors/auth.interceptor';

@NgModule({
  declarations: [AppComponent, LoginComponent, LayoutComponent, DashboardComponent, SettingsComponent],
  imports:      [BrowserModule, AppRoutingModule, ReactiveFormsModule, HttpClientModule],
  providers:    [{ provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }],
  bootstrap:    [AppComponent]
})
export class AppModule {}
