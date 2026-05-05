import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription }  from 'rxjs';
import { LeaseService }  from '../services/lease.service';
import { StatisticsService, KeaStats, statValue } from '../services/statistics.service';
import { Lease }         from '../services/kea.service';
import { lookupVendor }  from '../services/oui-data';

export type DeviceType = 'Mobile' | 'Desktop' | 'Network' | 'IoT' | 'Unknown';

const DONUT_C = 2 * Math.PI * 56;
const CHART_COLORS = ['#5ac4b0', '#3de89a', '#ddb83a', '#e84040', '#a78bfa', '#8a7845'];

const TYPE_COLORS: Record<DeviceType, string> = {
  Mobile: '#5ac4b0', Desktop: '#3de89a', Network: '#ddb83a',
  IoT: '#a78bfa', Unknown: '#8a7845'
};
const TYPE_ICONS: Record<DeviceType, string> = {
  Mobile: 'bi-phone', Desktop: 'bi-laptop', Network: 'bi-router',
  IoT: 'bi-cpu', Unknown: 'bi-question-circle'
};

@Component({
  selector:    'app-pool',
  templateUrl: './pool.component.html',
  styleUrls:   ['./pool.component.css']
})
export class PoolComponent implements OnInit, OnDestroy {
  leases: Lease[] = [];
  stats:  KeaStats = {};

  private subs: Subscription[] = [];

  constructor(
    private leasesSvc: LeaseService,
    private statsSvc:  StatisticsService
  ) {}

  ngOnInit() {
    this.subs.push(
      this.statsSvc.stats$.subscribe(s => {
        this.stats = s;
        this.leasesSvc.getAll().subscribe(l => this.leases = l);
      })
    );
  }

  ngOnDestroy() { this.subs.forEach(s => s.unsubscribe()); }

  get totalIps(): number    { return statValue(this.stats, 'subnet[1].total-addresses'); }
  get usedIps(): number     { return this.leases.length; }
  get availableIps(): number { return Math.max(0, this.totalIps - this.usedIps); }

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

  get manufacturerData(): { label: string; count: number; pct: number; color: string; dasharray: string; dashoffset: number }[] {
    if (!this.leases.length) return [];
    const counts = new Map<string, number>();
    for (const lease of this.leases) {
      const v = this.vendorFor(lease.mac) || 'Unknown';
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top  = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((s, [, c]) => s + c, 0);
    const entries = [
      ...top.map(([label, count]) => ({ label, count })),
      ...(rest > 0 ? [{ label: 'Others', count: rest }] : [])
    ];
    const total = this.leases.length;
    let cumulative = 0;
    return entries.map((e, i) => {
      const segLen    = (e.count / total) * DONUT_C;
      const dasharray = `${segLen.toFixed(2)} ${(DONUT_C - segLen).toFixed(2)}`;
      const dashoffset = DONUT_C - cumulative;
      cumulative += segLen;
      return { label: e.label, count: e.count, pct: (e.count / total) * 100, color: CHART_COLORS[i] ?? '#8a7845', dasharray, dashoffset };
    });
  }

  get deviceTypeData(): { label: string; count: number; pct: number; color: string; icon: string }[] {
    const total = this.leases.length;
    const types: DeviceType[] = ['Mobile', 'Desktop', 'Network', 'IoT', 'Unknown'];
    const counts = Object.fromEntries(types.map(t => [t, 0])) as Record<DeviceType, number>;
    for (const lease of this.leases) counts[this.deviceTypeFor(lease.mac, lease.hostname)]++;
    return types.map(t => ({
      label: t, count: counts[t], pct: total ? (counts[t] / total) * 100 : 0,
      color: TYPE_COLORS[t], icon: TYPE_ICONS[t]
    }));
  }

  trackByLabel(_: number, item: { label: string }): string { return item.label; }
}
