import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { DhcpService, Lease, PoolStats, WsMessage } from '../services/dhcp.service';

export type DeviceType = 'Mobile' | 'Desktop' | 'Network' | 'IoT' | 'Unknown';

const DONUT_C = 2 * Math.PI * 56;

const CHART_COLORS = ['#5ac4b0', '#3de89a', '#ddb83a', '#e84040', '#a78bfa', '#8a7845'];

const TYPE_COLORS: Record<DeviceType, string> = {
  Mobile:  '#5ac4b0',
  Desktop: '#3de89a',
  Network: '#ddb83a',
  IoT:     '#a78bfa',
  Unknown: '#8a7845',
};

const TYPE_ICONS: Record<DeviceType, string> = {
  Mobile:  'bi-phone',
  Desktop: 'bi-laptop',
  Network: 'bi-router',
  IoT:     'bi-cpu',
  Unknown: 'bi-question-circle',
};

@Component({
  selector:    'app-pool',
  templateUrl: './pool.component.html',
  styleUrls:   ['./pool.component.css']
})
export class PoolComponent implements OnInit, OnDestroy {
  leases: Lease[]   = [];
  stats:  PoolStats = { total: 0, used: 0, available: 0 };

  private sub!: Subscription;

  constructor(private dhcp: DhcpService) {}

  ngOnInit() {
    this.dhcp.getStatus().subscribe(s => {
      this.leases = s.leases;
      this.stats  = s.stats;
    });
    this.dhcp.connectWs();
    this.sub = this.dhcp.messages$.subscribe(msg => this.onWsMessage(msg));
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.dhcp.disconnectWs();
  }

  private onWsMessage(msg: WsMessage) {
    if (msg.type === 'connected') {
      const s = msg.data as { leases: Lease[]; stats: PoolStats };
      this.leases = s.leases;
      this.stats  = s.stats;
    } else if (msg.type === 'leases') {
      this.leases = msg.data as Lease[];
      this.dhcp.getStatus().subscribe(s => this.stats = s.stats);
    }
  }

  vendorFor(mac: string): string {
    return this.dhcp.getMacVendor(mac);
  }

  deviceTypeFor(mac: string, hostname: string): DeviceType {
    const h = (hostname || '').toLowerCase();
    if (/iphone|ipad|android|mobile|pixel|galaxy/.test(h)) return 'Mobile';
    if (/macbook|imac|desktop|laptop|\bpc\b|win/.test(h))  return 'Desktop';
    if (/router|access-point|gateway|switch|cisco|unifi|ap-/.test(h)) return 'Network';
    if (/raspberry|arduino|esp|iot|cam|printer/.test(h))   return 'IoT';
    if (/\bpi\b/.test(h))  return 'IoT';
    if (/\bmac\b/.test(h)) return 'Desktop';
    const v = this.vendorFor(mac);
    if (/Apple|Samsung|Huawei|Xiaomi|OnePlus|Sony/i.test(v))              return 'Mobile';
    if (/Cisco|TP-Link|Netgear|Ubiquiti|MikroTik|D-Link|Aruba/i.test(v)) return 'Network';
    if (/Raspberry|Arduino/i.test(v))                                      return 'IoT';
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
    const top    = sorted.slice(0, 5);
    const rest   = sorted.slice(5).reduce((s, [, c]) => s + c, 0);
    const entries: { label: string; count: number }[] = [
      ...top.map(([label, count]) => ({ label, count })),
      ...(rest > 0 ? [{ label: 'Others', count: rest }] : []),
    ];
    const total = this.leases.length;
    let cumulative = 0;
    return entries.map((e, i) => {
      const segLen     = (e.count / total) * DONUT_C;
      const dasharray  = `${segLen.toFixed(2)} ${(DONUT_C - segLen).toFixed(2)}`;
      const dashoffset = DONUT_C - cumulative;
      cumulative += segLen;
      return { label: e.label, count: e.count, pct: (e.count / total) * 100, color: CHART_COLORS[i] ?? '#8a7845', dasharray, dashoffset };
    });
  }

  get deviceTypeData(): { label: string; count: number; pct: number; color: string; icon: string }[] {
    const total  = this.leases.length;
    const types: DeviceType[] = ['Mobile', 'Desktop', 'Network', 'IoT', 'Unknown'];
    const counts = Object.fromEntries(types.map(t => [t, 0])) as Record<DeviceType, number>;
    for (const lease of this.leases) counts[this.deviceTypeFor(lease.mac, lease.hostname)]++;
    return types.map(t => ({
      label: t, count: counts[t], pct: total ? (counts[t] / total) * 100 : 0,
      color: TYPE_COLORS[t], icon: TYPE_ICONS[t],
    }));
  }

  trackByLabel(_: number, item: { label: string }): string { return item.label; }
}
