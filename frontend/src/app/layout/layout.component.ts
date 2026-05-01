import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector:    'app-layout',
  templateUrl: './layout.component.html',
  styleUrls:   ['./layout.component.css']
})
export class LayoutComponent {
  collapsed = localStorage.getItem('dhcp_sidebar_collapsed') === 'true';

  constructor(public auth: AuthService) {}

  toggleSidebar() {
    this.collapsed = !this.collapsed;
    localStorage.setItem('dhcp_sidebar_collapsed', String(this.collapsed));
  }
}
