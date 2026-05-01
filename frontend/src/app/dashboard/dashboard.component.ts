import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService }  from '../services/auth.service';
import { DhcpService, DHCPConfig, Lease, PoolStats, WsMessage } from '../services/dhcp.service';

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
  selector:    'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls:   ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('logPanel') logPanel!: ElementRef<HTMLDivElement>;

  running       = false;
  leases:  Lease[]    = [];
  stats:   PoolStats  = { total: 0, used: 0, available: 0 };
  logs:    { time: string; msg: string }[] = [];
  config!: DHCPConfig;

  actionLoading   = false;
  detectLoading   = false;
  configLoading   = false;
  configSaved     = false;

  activeTypeFilter: DeviceType | 'ALL' = 'ALL';
  leaseSearch = '';

  conflictResult: {
    hasConflict: boolean;
    servers: { ip: string; from: string }[];
    method:  string;
    warning?: string;
  } | null = null;

  configForm = this.fb.group({
    serverIp:   ['', Validators.required],
    subnetMask: ['', Validators.required],
    router:     ['', Validators.required],
    dnsText:    ['', Validators.required],
    poolStart:  ['', Validators.required],
    poolEnd:    ['', Validators.required],
    leaseTime:  [86400, [Validators.required, Validators.min(60)]]
  });

  private sub!: Subscription;

  constructor(
    private dhcp: DhcpService,
    public  auth: AuthService,
    private fb:   FormBuilder
  ) {}

  ngOnInit() {
    this.dhcp.getStatus().subscribe(s => this.applyStatus(s));
    this.dhcp.connectWs();
    this.sub = this.dhcp.messages$.subscribe(msg => this.onWsMessage(msg));
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.dhcp.disconnectWs();
  }

  private applyStatus(s: { running: boolean; config: DHCPConfig; leases: Lease[]; stats: PoolStats; logs: { time: string; msg: string }[] }) {
    this.running = s.running;
    this.leases  = s.leases;
    this.stats   = s.stats;
    this.logs    = s.logs;
    this.config  = s.config;
    this.configForm.patchValue({
      serverIp:   s.config.serverIp,
      subnetMask: s.config.subnetMask,
      router:     s.config.router,
      dnsText:    s.config.dns.join(', '),
      poolStart:  s.config.poolStart,
      poolEnd:    s.config.poolEnd,
      leaseTime:  s.config.leaseTime
    });
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

  typeIconFor(mac: string, hostname: string): string {
    return TYPE_ICONS[this.deviceTypeFor(mac, hostname)];
  }

  typeColorFor(mac: string, hostname: string): string {
    return TYPE_COLORS[this.deviceTypeFor(mac, hostname)];
  }

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
      return {
        label: e.label,
        count: e.count,
        pct:   (e.count / total) * 100,
        color: CHART_COLORS[i] ?? '#8a7845',
        dasharray,
        dashoffset,
      };
    });
  }

  get deviceTypeData(): { label: string; count: number; pct: number; color: string; icon: string }[] {
    const total  = this.leases.length;
    const types: DeviceType[] = ['Mobile', 'Desktop', 'Network', 'IoT', 'Unknown'];
    const counts = Object.fromEntries(types.map(t => [t, 0])) as Record<DeviceType, number>;
    for (const lease of this.leases) counts[this.deviceTypeFor(lease.mac, lease.hostname)]++;
    return types.map(t => ({
      label: t,
      count: counts[t],
      pct:   total ? (counts[t] / total) * 100 : 0,
      color: TYPE_COLORS[t],
      icon:  TYPE_ICONS[t],
    }));
  }

  get filteredLeases(): Lease[] {
    let result = this.leases;
    if (this.activeTypeFilter !== 'ALL') {
      result = result.filter(l => this.deviceTypeFor(l.mac, l.hostname) === this.activeTypeFilter);
    }
    const q = this.leaseSearch.toLowerCase().trim();
    if (q) {
      result = result.filter(l =>
        l.ip.includes(q) ||
        l.mac.toLowerCase().includes(q) ||
        (l.hostname ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }

  trackByLabel(_: number, item: { label: string }): string {
    return item.label;
  }

  private onWsMessage(msg: WsMessage) {
    if (msg.type === 'connected') {
      const s = msg.data as Parameters<typeof this.applyStatus>[0];
      this.applyStatus(s);
    } else if (msg.type === 'status') {
      this.running = (msg.data as { running: boolean }).running;
    } else if (msg.type === 'leases') {
      this.leases = msg.data as Lease[];
      this.dhcp.getStatus().subscribe(s => this.stats = s.stats);
    } else if (msg.type === 'log') {
      const entry = msg.data as { time: string; msg: string };
      this.logs.push(entry);
      if (this.logs.length > 200) this.logs.shift();
      setTimeout(() => {
        const el = this.logPanel?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      }, 0);
    }
  }

  toggleServer() {
    this.actionLoading = true;
    const call = this.running ? this.dhcp.stopServer() : this.dhcp.startServer();
    call.subscribe({
      next:  () => this.actionLoading = false,
      error: (e) => { alert(e.error?.error || 'Error'); this.actionLoading = false; }
    });
  }

  detectConflicts() {
    this.detectLoading  = true;
    this.conflictResult = null;
    this.dhcp.detectConflicts().subscribe({
      next:  r => { this.conflictResult = r; this.detectLoading = false; },
      error: () => { this.detectLoading = false; }
    });
  }

  saveConfig() {
    if (this.configForm.invalid) return;
    this.configLoading = true;
    const v = this.configForm.value;
    const payload: Partial<DHCPConfig> = {
      serverIp:   v.serverIp!,
      subnetMask: v.subnetMask!,
      router:     v.router!,
      dns:        v.dnsText!.split(',').map(s => s.trim()),
      poolStart:  v.poolStart!,
      poolEnd:    v.poolEnd!,
      leaseTime:  Number(v.leaseTime)
    };
    this.dhcp.updateConfig(payload).subscribe({
      next: res => {
        this.config       = res.config;
        this.configLoading = false;
        this.configSaved   = true;
        setTimeout(() => this.configSaved = false, 3000);
      },
      error: () => this.configLoading = false
    });
  }

  releaseLease(mac: string) {
    this.dhcp.releaseLease(mac).subscribe();
  }

  formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString();
  }

  formatExpiry(iso: string) {
    return new Date(iso).toLocaleString();
  }
}
