import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription }   from 'rxjs';
import { switchMap }      from 'rxjs/operators';
import { AuthService }    from '../services/auth.service';
import { ServerService }  from '../services/server.service';
import { LeaseService }   from '../services/lease.service';
import { StatisticsService, KeaStats, statValue } from '../services/statistics.service';
import { Lease }          from '../services/kea.service';
import { lookupVendor }   from '../services/oui-data';

type DeviceType = 'Mobile' | 'Desktop' | 'Network' | 'IoT' | 'Unknown';

const TYPE_ICONS: Record<DeviceType, string> = {
  Mobile: 'bi-phone', Desktop: 'bi-laptop', Network: 'bi-router',
  IoT: 'bi-cpu', Unknown: 'bi-question-circle'
};
const TYPE_COLORS: Record<DeviceType, string> = {
  Mobile: '#5ac4b0', Desktop: '#3de89a', Network: '#ddb83a',
  IoT: '#a78bfa', Unknown: '#8a7845'
};

@Component({
  selector:    'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls:   ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  running      = false;
  reachable    = true;
  leases: Lease[] = [];
  stats: KeaStats = {};
  keaConfig: Record<string, unknown> = {};

  actionLoading = false;
  leaseSearch   = '';
  activeTypeFilter: DeviceType | 'ALL' = 'ALL';

  private subs: Subscription[] = [];

  constructor(
    public  auth:       AuthService,
    private server:     ServerService,
    private leasesSvc:  LeaseService,
    private statsSvc:   StatisticsService
  ) {}

  ngOnInit() {
    this.subs.push(
      this.server.running$.subscribe(r => this.running = r),
      this.server.reachable$.subscribe(r => this.reachable = r),
      this.server.config$.subscribe(c => this.keaConfig = c),
      this.statsSvc.stats$.pipe(
        switchMap(() => this.leasesSvc.getAll())
      ).subscribe(l => this.leases = l),
      this.statsSvc.stats$.subscribe(s => this.stats = s)
    );
  }

  ngOnDestroy() { this.subs.forEach(s => s.unsubscribe()); }

  get totalAddresses(): number { return statValue(this.stats, 'cumulative-assigned-addresses'); }
  get assignedNow():    number { return this.leases.length; }

  get subnets(): unknown[] {
    return (this.keaConfig['subnet4'] as unknown[]) ?? [];
  }

  get leaseTime(): number {
    return (this.keaConfig['valid-lifetime'] as number) ?? 0;
  }

  toggleServer() {
    this.actionLoading = true;
    const call = this.running ? this.server.disable() : this.server.enable();
    call.subscribe({ next: () => this.actionLoading = false, error: () => this.actionLoading = false });
  }

  releaseLease(ip: string) {
    this.leasesSvc.delete(ip).subscribe(() => {
      this.leases = this.leases.filter(l => l.ip !== ip);
    });
  }

  vendorFor(mac: string): string { return lookupVendor(mac); }

  deviceTypeFor(mac: string, hostname: string): DeviceType {
    const h = (hostname || '').toLowerCase();
    if (/iphone|ipad|android|mobile|pixel|galaxy/.test(h)) return 'Mobile';
    if (/macbook|imac|desktop|laptop|\bpc\b|win/.test(h))  return 'Desktop';
    if (/router|access-point|gateway|switch|cisco|unifi|ap-/.test(h)) return 'Network';
    if (/raspberry|arduino|esp|iot|cam|printer|\bpi\b/.test(h)) return 'IoT';
    const v = this.vendorFor(mac);
    if (/Apple|Samsung|Huawei|Xiaomi|OnePlus|Sony/i.test(v)) return 'Mobile';
    if (/Cisco|TP-Link|Netgear|Ubiquiti|MikroTik|D-Link|Aruba/i.test(v)) return 'Network';
    if (/Raspberry|Arduino/i.test(v)) return 'IoT';
    return 'Unknown';
  }

  typeIconFor(mac: string, hostname: string): string  { return TYPE_ICONS[this.deviceTypeFor(mac, hostname)]; }
  typeColorFor(mac: string, hostname: string): string { return TYPE_COLORS[this.deviceTypeFor(mac, hostname)]; }

  vendorColorKey(mac: string): string {
    const v = this.vendorFor(mac);
    if (/Apple/i.test(v))                          return 'cyan';
    if (/Samsung/i.test(v))                        return 'green';
    if (/Cisco|TP-Link|Netgear|Ubiquiti/i.test(v)) return 'amber';
    if (/Huawei|Xiaomi/i.test(v))                  return 'purple';
    return 'dim';
  }

  leaseHealthPct(lease: Lease): number {
    const now    = Date.now();
    const expiry = new Date(lease.expiry).getTime();
    const start  = new Date(lease.assignedAt).getTime();
    const total  = expiry - start;
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, ((expiry - now) / total) * 100));
  }

  leaseHealthColor(pct: number): string {
    if (pct > 50) return '#3de89a';
    if (pct > 20) return '#ddb83a';
    return '#e84040';
  }

  get filteredLeases(): Lease[] {
    let result = this.leases;
    if (this.activeTypeFilter !== 'ALL') {
      result = result.filter(l => this.deviceTypeFor(l.mac, l.hostname) === this.activeTypeFilter);
    }
    const q = this.leaseSearch.toLowerCase().trim();
    if (q) result = result.filter(l =>
      l.ip.includes(q) || l.mac.toLowerCase().includes(q) || (l.hostname ?? '').toLowerCase().includes(q)
    );
    return result;
  }

  formatTime(iso: string)   { return new Date(iso).toLocaleTimeString(); }
  formatExpiry(iso: string) { return new Date(iso).toLocaleString(); }
}
