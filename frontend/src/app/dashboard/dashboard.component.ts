import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService }  from '../services/auth.service';
import { DhcpService, DHCPConfig, Lease, PoolStats, WsMessage } from '../services/dhcp.service';

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
