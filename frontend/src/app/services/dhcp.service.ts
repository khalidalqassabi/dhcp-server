import { Injectable }              from '@angular/core';
import { HttpClient }              from '@angular/common/http';
import { Subject }                 from 'rxjs';
import { environment }             from '../../environments/environment';
import { AuthService }             from './auth.service';
import { lookupVendor }            from './oui-data';

export interface DHCPConfig {
  serverIp:    string;
  subnetMask:  string;
  router:      string;
  dns:         string[];
  poolStart:   string;
  poolEnd:     string;
  leaseTime:   number;
  bindAddress: string;
}

export interface Lease {
  mac:        string;
  ip:         string;
  hostname:   string;
  expiry:     string;
  assignedAt: string;
}

export interface PoolStats {
  total:     number;
  used:      number;
  available: number;
}

export interface DHCPStatus {
  running: boolean;
  config:  DHCPConfig;
  leases:  Lease[];
  stats:   PoolStats;
  logs:    { time: string; msg: string }[];
}

export interface WsMessage {
  type: 'connected' | 'status' | 'leases' | 'log';
  data: unknown;
}

@Injectable({ providedIn: 'root' })
export class DhcpService {
  private ws: WebSocket | null = null;
  readonly messages$ = new Subject<WsMessage>();

  constructor(private http: HttpClient, private auth: AuthService) {}

  // ── REST ────────────────────────────────────────────────────────────────────
  getStatus() {
    return this.http.get<DHCPStatus>(`${environment.apiUrl}/dhcp/status`);
  }

  startServer() {
    return this.http.post<{ success: boolean }>(`${environment.apiUrl}/dhcp/start`, {});
  }

  stopServer() {
    return this.http.post<{ success: boolean }>(`${environment.apiUrl}/dhcp/stop`, {});
  }

  detectConflicts() {
    return this.http.post<{
      hasConflict: boolean;
      servers: { ip: string; from: string }[];
      method:  string;
      warning?: string;
    }>(`${environment.apiUrl}/dhcp/detect`, {});
  }

  updateConfig(config: Partial<DHCPConfig>) {
    return this.http.put<{ success: boolean; config: DHCPConfig }>(
      `${environment.apiUrl}/dhcp/config`, config
    );
  }

  releaseLease(mac: string) {
    return this.http.delete<{ success: boolean }>(
      `${environment.apiUrl}/dhcp/leases/${encodeURIComponent(mac)}`
    );
  }

  getMacVendor(mac: string): string {
    return lookupVendor(mac);
  }

  // ── WebSocket ───────────────────────────────────────────────────────────────
  connectWs() {
    if (this.ws) return;
    const token = this.auth.getToken();
    const wsUrl = environment.wsUrl
      ? `${environment.wsUrl}?token=${token}`
      : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws?token=${token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = ({ data }) => {
      try { this.messages$.next(JSON.parse(data)); } catch {}
    };

    this.ws.onclose = () => {
      this.ws = null;
      // Reconnect after 5 s if still logged in
      if (this.auth.isLoggedIn()) {
        setTimeout(() => this.connectWs(), 5000);
      }
    };
  }

  disconnectWs() {
    this.ws?.close();
    this.ws = null;
  }
}
