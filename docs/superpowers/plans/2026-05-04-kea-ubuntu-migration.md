# Kea DHCP4 Ubuntu Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom Node.js DHCP backend with ISC Kea 2.6.x running natively on Ubuntu, expose full Kea capabilities (leases, host reservations, subnets, DHCP options, statistics) through the Angular frontend using Kea Control Agent Basic Auth over HTTPS via nginx.

**Architecture:** Kea DHCPv4 + Control Agent + MySQL 8 run as Ubuntu systemd services. nginx serves the Angular SPA and reverse-proxies `/api/` to Kea CA at `127.0.0.1:8000`. The Angular frontend authenticates with Kea CA's built-in HTTP Basic Auth; all DHCP management is done via Kea's REST command API.

**Tech Stack:** ISC Kea 2.6.x, MySQL 8, nginx, Angular 16, RxJS `timer`+`shareReplay`, TypeScript.

---

## File Map

### Created
| Path | Purpose |
|---|---|
| `kea/kea-dhcp4.conf` | Kea DHCP4 config template (deploy to `/etc/kea/`) |
| `kea/kea-ctrl-agent.conf` | Control Agent config with Basic Auth |
| `kea/init-mysql.sh` | One-time MySQL + Kea schema setup |
| `nginx/dhcp-admin.conf` | nginx site config (HTTPS + `/api/` proxy) |
| `docs/ubuntu-install.md` | Step-by-step Ubuntu installation guide |
| `frontend/src/app/services/kea.service.ts` | Base HTTP client: `POST /api/` command wrapper |
| `frontend/src/app/services/server.service.ts` | `dhcp-enable`, `dhcp-disable`, `config-get`, `status-get` |
| `frontend/src/app/services/lease.service.ts` | `lease4-get-all`, `lease4-del`, `lease4-add` |
| `frontend/src/app/services/reservation.service.ts` | `reservation-get-page`, `reservation-add`, `reservation-del` |
| `frontend/src/app/services/subnet.service.ts` | `subnet4-list`, `remote-subnet4-set`, `remote-subnet4-del-by-id` |
| `frontend/src/app/services/option.service.ts` | `remote-option4-global-get-all`, `remote-option4-global-set`, `remote-option4-global-del` |
| `frontend/src/app/services/statistics.service.ts` | `statistic-get-all` polling (5 s, shared) |
| `frontend/src/app/interceptors/kea.interceptor.ts` | Attaches `Authorization: Basic` header; forces logout on 401 |
| `frontend/src/app/reservations/reservations.component.ts` | Host reservations CRUD |
| `frontend/src/app/reservations/reservations.component.html` | |
| `frontend/src/app/reservations/reservations.component.css` | |
| `frontend/src/app/subnets/subnets.component.ts` | Subnet management |
| `frontend/src/app/subnets/subnets.component.html` | |
| `frontend/src/app/subnets/subnets.component.css` | |
| `frontend/src/app/options/options.component.ts` | Global DHCP options management |
| `frontend/src/app/options/options.component.html` | |
| `frontend/src/app/options/options.component.css` | |
| `frontend/src/app/statistics/statistics.component.ts` | Per-subnet statistics view |
| `frontend/src/app/statistics/statistics.component.html` | |
| `frontend/src/app/statistics/statistics.component.css` | |

### Modified
| Path | Change |
|---|---|
| `frontend/src/environments/environment.ts` | Remove `apiUrl`/`wsUrl`, add `pollIntervalMs: 5000` |
| `frontend/proxy.conf.json` | Target `localhost:8000`, add `pathRewrite` |
| `frontend/src/app/services/auth.service.ts` | Basic Auth: `btoa()`, `sessionStorage` |
| `frontend/src/app/guards/auth.guard.ts` | Check `sessionStorage['kea_authed']` |
| `frontend/src/app/login/login.component.ts` | Password-only form |
| `frontend/src/app/login/login.component.html` | Remove username field |
| `frontend/src/app/dashboard/dashboard.component.ts` | Use ServerService + LeaseService; remove WS/conflict/log |
| `frontend/src/app/dashboard/dashboard.component.html` | Remove conflict detection + log panels |
| `frontend/src/app/pool/pool.component.ts` | Use LeaseService + StatisticsService |
| `frontend/src/app/layout/layout.component.html` | Add Reservations/Subnets/Options/Statistics nav; rename Pool→Leases; remove Settings |
| `frontend/src/app/app-routing.module.ts` | Add new routes; rename `/pool`→`/leases`; remove `/settings` |
| `frontend/src/app/app.module.ts` | Register new components; swap `AuthInterceptor`→`KeaInterceptor`; remove `SettingsComponent` |

### Deleted
| Path |
|---|
| `backend/` (entire directory) |
| `docker-compose.yml` |
| `.env` |
| `.env.example` |
| `frontend/src/app/interceptors/auth.interceptor.ts` |
| `frontend/src/app/services/dhcp.service.ts` |
| `frontend/src/app/settings/` (entire directory) |

---

## Task 1: Kea config files

**Files:**
- Create: `kea/kea-dhcp4.conf`
- Create: `kea/kea-ctrl-agent.conf`

- [ ] **Step 1: Create `kea/` directory and `kea-dhcp4.conf`**

```json
{
  "Dhcp4": {
    "interfaces-config": { "interfaces": ["*"] },
    "control-socket": {
      "socket-type": "unix",
      "socket-name": "/run/kea/kea4-ctrl-socket"
    },
    "lease-database": {
      "type": "mysql",
      "host": "127.0.0.1",
      "name": "kea",
      "user": "kea",
      "password": "keapass"
    },
    "hosts-database": {
      "type": "mysql",
      "host": "127.0.0.1",
      "name": "kea",
      "user": "kea",
      "password": "keapass"
    },
    "config-control": {
      "config-databases": [{
        "type": "mysql",
        "host": "127.0.0.1",
        "name": "kea",
        "user": "kea",
        "password": "keapass"
      }]
    },
    "server-tag": "dhcp-admin",
    "hooks-libraries": [
      { "library": "/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_lease_cmds.so" },
      { "library": "/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_host_cmds.so" },
      { "library": "/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_subnet_cmds.so" },
      { "library": "/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_stat_cmds.so" },
      { "library": "/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_cb_cmds.so" }
    ],
    "loggers": [{
      "name": "kea-dhcp4",
      "output_options": [{ "output": "/var/log/kea/kea-dhcp4.log" }],
      "severity": "INFO"
    }]
  }
}
```

- [ ] **Step 2: Create `kea/kea-ctrl-agent.conf`**

```json
{
  "Control-agent": {
    "http-host": "127.0.0.1",
    "http-port": 8000,
    "authentication": {
      "type": "basic",
      "realm": "kea-control-agent",
      "clients": [
        { "user": "kea-api", "password": "changeme" }
      ]
    },
    "control-sockets": {
      "dhcp4": {
        "socket-type": "unix",
        "socket-name": "/run/kea/kea4-ctrl-socket"
      }
    },
    "loggers": [{
      "name": "kea-ctrl-agent",
      "output_options": [{ "output": "/var/log/kea/kea-ctrl-agent.log" }],
      "severity": "INFO"
    }]
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add kea/
git commit -m "feat(kea): add kea-dhcp4 and kea-ctrl-agent config templates"
```

---

## Task 2: MySQL init script

**Files:**
- Create: `kea/init-mysql.sh`

- [ ] **Step 1: Create `kea/init-mysql.sh`**

```bash
#!/usr/bin/env bash
set -e

echo "==> Creating MySQL database and user..."
sudo mysql <<'SQL'
CREATE DATABASE IF NOT EXISTS kea;
CREATE USER IF NOT EXISTS 'kea'@'127.0.0.1' IDENTIFIED BY 'keapass';
GRANT ALL PRIVILEGES ON kea.* TO 'kea'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

echo "==> Initialising Kea schema..."
kea-admin db-init mysql -u kea -p keapass -n kea -h 127.0.0.1

echo "==> Done. Kea MySQL database is ready."
```

- [ ] **Step 2: Mark executable and commit**

```bash
chmod +x kea/init-mysql.sh
git add kea/init-mysql.sh
git commit -m "feat(kea): add MySQL initialisation script"
```

---

## Task 3: nginx config

**Files:**
- Create: `nginx/dhcp-admin.conf`

- [ ] **Step 1: Create `nginx/dhcp-admin.conf`**

```nginx
server {
    listen 443 ssl;
    ssl_certificate     /etc/ssl/certs/kea-admin.crt;
    ssl_certificate_key /etc/ssl/private/kea-admin.key;

    root /var/www/dhcp-admin;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:8000/;
        proxy_pass_header  Authorization;
        proxy_set_header   Host $host;
        proxy_read_timeout 30s;
    }
}

server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

- [ ] **Step 2: Commit**

```bash
git add nginx/
git commit -m "feat(nginx): add dhcp-admin site config with HTTPS + Kea CA proxy"
```

---

## Task 4: Ubuntu install guide

**Files:**
- Create: `docs/ubuntu-install.md`

- [ ] **Step 1: Create `docs/ubuntu-install.md`**

```markdown
# Ubuntu Installation Guide

## Prerequisites

Ubuntu 22.04 or 24.04 LTS. Run all commands as a user with `sudo` access.

## 1. Install packages

```bash
# Add ISC Kea 2.6 repository
curl -1sLf 'https://dl.cloudsmith.io/public/isc/kea-2-6/setup.deb.sh' | sudo bash

sudo apt install -y \
  isc-kea-dhcp4-server \
  isc-kea-ctrl-agent \
  isc-kea-admin \
  isc-kea-hooks \
  mysql-server \
  nginx \
  nodejs npm
```

## 2. Set up MySQL

```bash
sudo bash kea/init-mysql.sh
```

## 3. Configure Kea

```bash
sudo cp kea/kea-dhcp4.conf /etc/kea/kea-dhcp4.conf
sudo cp kea/kea-ctrl-agent.conf /etc/kea/kea-ctrl-agent.conf
```

Edit `/etc/kea/kea-ctrl-agent.conf` and change the `password` field under `clients` to a strong password.

## 4. Generate TLS certificate

```bash
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/ssl/private/kea-admin.key \
  -out /etc/ssl/certs/kea-admin.crt \
  -subj "/CN=dhcp-admin"
```

## 5. Configure nginx

```bash
sudo cp nginx/dhcp-admin.conf /etc/nginx/sites-available/dhcp-admin
sudo ln -s /etc/nginx/sites-available/dhcp-admin /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Build and deploy the frontend

```bash
cd frontend
npm install
npm run build
sudo mkdir -p /var/www/dhcp-admin
sudo cp -r dist/frontend/* /var/www/dhcp-admin/
```

## 7. Start services

```bash
sudo systemctl enable --now mysql
sudo systemctl enable --now isc-kea-dhcp4-server
sudo systemctl enable --now isc-kea-ctrl-agent
sudo systemctl enable --now nginx
```

## 8. Verify

```bash
systemctl status isc-kea-dhcp4-server
systemctl status isc-kea-ctrl-agent
# Test CA is reachable (replace PASSWORD with value from kea-ctrl-agent.conf)
curl -s -u kea-api:PASSWORD http://127.0.0.1:8000/ \
  -d '{"command":"status-get","service":["dhcp4"]}' | python3 -m json.tool
```

Open `https://<server-ip>` in a browser. Accept the self-signed certificate warning.
Log in with password `changeme` (or whatever you set in `kea-ctrl-agent.conf`).

## Notes

- Hook library path (`/usr/lib/x86_64-linux-gnu/kea/hooks/`) is correct for Ubuntu x86_64.
  On ARM64, replace with `/usr/lib/aarch64-linux-gnu/kea/hooks/`.
- MySQL credentials (`keapass`) should be changed in both `kea-dhcp4.conf` and `init-mysql.sh`
  before production use.
- To change the admin password: edit `clients[0].password` in `/etc/kea/kea-ctrl-agent.conf`
  and restart: `sudo systemctl restart isc-kea-ctrl-agent`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/ubuntu-install.md
git commit -m "docs: add Ubuntu installation guide for Kea native setup"
```

---

## Task 5: Environment & dev proxy

**Files:**
- Modify: `frontend/src/environments/environment.ts`
- Modify: `frontend/proxy.conf.json`

- [ ] **Step 1: Replace `frontend/src/environments/environment.ts`**

```typescript
export const environment = {
  production:    false,
  pollIntervalMs: 5000
};
```

- [ ] **Step 2: Replace `frontend/proxy.conf.json`**

```json
{
  "/api": {
    "target":      "http://localhost:8000",
    "secure":      false,
    "changeOrigin": true,
    "pathRewrite": { "^/api": "" }
  }
}
```

This strips the `/api` prefix before forwarding to Kea CA, matching nginx's behaviour.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/environments/environment.ts frontend/proxy.conf.json
git commit -m "feat(frontend): update environment and dev proxy for Kea CA"
```

---

## Task 6: Auth service rewrite

**Files:**
- Modify: `frontend/src/app/services/auth.service.ts`

- [ ] **Step 1: Replace `auth.service.ts`**

```typescript
import { Injectable }  from '@angular/core';
import { HttpClient }  from '@angular/common/http';
import { Router }      from '@angular/router';
import { map, tap }    from 'rxjs/operators';
import { Observable }  from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly AUTHED_KEY = 'kea_authed';
  private readonly TOKEN_KEY  = 'kea_token';

  constructor(private http: HttpClient, private router: Router) {}

  login(password: string): Observable<void> {
    const token = btoa(`kea-api:${password}`);
    return this.http.post<unknown[]>(
      '/api/',
      { command: 'status-get', service: ['dhcp4'] },
      { headers: { Authorization: `Basic ${token}` } }
    ).pipe(
      tap(() => {
        sessionStorage.setItem(this.TOKEN_KEY,  token);
        sessionStorage.setItem(this.AUTHED_KEY, 'true');
      }),
      map(() => void 0)
    );
  }

  logout(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.AUTHED_KEY);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return sessionStorage.getItem(this.AUTHED_KEY) === 'true';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/services/auth.service.ts
git commit -m "feat(auth): replace JWT auth with Kea Basic Auth credential store"
```

---

## Task 7: Kea interceptor

**Files:**
- Create: `frontend/src/app/interceptors/kea.interceptor.ts`

- [ ] **Step 1: Create `kea.interceptor.ts`**

```typescript
import { Injectable }                                   from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler,
         HttpErrorResponse }                            from '@angular/common/http';
import { catchError }                                   from 'rxjs/operators';
import { throwError }                                   from 'rxjs';
import { AuthService }                                  from '../services/auth.service';

@Injectable()
export class KeaInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler) {
    const token = this.auth.getToken();
    if (token) {
      req = req.clone({ setHeaders: { Authorization: `Basic ${token}` } });
    }
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) this.auth.logout();
        return throwError(() => err);
      })
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/interceptors/kea.interceptor.ts
git commit -m "feat(auth): add KeaInterceptor for Basic Auth header + 401 logout"
```

---

## Task 8: Auth guard update

**Files:**
- Modify: `frontend/src/app/guards/auth.guard.ts`

- [ ] **Step 1: Replace `auth.guard.ts`**

```typescript
import { inject }        from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { Router }        from '@angular/router';
import { AuthService }   from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  router.navigate(['/login']);
  return false;
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/guards/auth.guard.ts
git commit -m "feat(auth): update authGuard to check sessionStorage kea_authed"
```

---

## Task 9: Base KeaService + shared types

**Files:**
- Create: `frontend/src/app/services/kea.service.ts`

- [ ] **Step 1: Create `kea.service.ts`**

```typescript
import { Injectable }  from '@angular/core';
import { HttpClient }  from '@angular/common/http';
import { Observable }  from 'rxjs';
import { map }         from 'rxjs/operators';

export interface KeaResponse<T = unknown> {
  result:     number;
  text:       string;
  arguments?: T;
}

export interface KeaLease {
  'ip-address': string;
  'hw-address': string;
  hostname:     string;
  cltt:         number;
  'valid-lft':  number;
  'subnet-id':  number;
  state:        number;
}

export interface KeaReservation {
  'hw-address': string;
  'ip-address': string;
  hostname:     string;
  'subnet-id':  number;
}

export interface KeaOption {
  name:   string;
  data:   string;
  code?:  number;
  space?: string;
}

export interface KeaSubnet {
  id:               number;
  subnet:           string;
  pools:            { pool: string }[];
  'option-data':    KeaOption[];
  'valid-lifetime'?: number;
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

export function keaLeaseToLease(kl: KeaLease): Lease {
  return {
    ip:         kl['ip-address'],
    mac:        kl['hw-address'],
    hostname:   kl.hostname ?? '',
    assignedAt: new Date(kl.cltt * 1000).toISOString(),
    expiry:     new Date((kl.cltt + kl['valid-lft']) * 1000).toISOString()
  };
}

@Injectable({ providedIn: 'root' })
export class KeaService {
  constructor(private http: HttpClient) {}

  command<T>(
    command: string,
    args:    Record<string, unknown> = {},
    service: string[] = ['dhcp4']
  ): Observable<KeaResponse<T>> {
    const body: Record<string, unknown> = { command, service };
    if (Object.keys(args).length) body['arguments'] = args;
    return this.http.post<KeaResponse<T>[]>('/api/', body).pipe(
      map(responses => {
        const r = responses[0];
        if (r.result !== 0 && r.result !== 3) {
          throw new Error(r.text || 'Kea command failed');
        }
        return r;
      })
    );
  }
}
```

Note: `result: 3` means "empty" (no items found) — this is a success case for list commands.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/services/kea.service.ts
git commit -m "feat(services): add KeaService base client + shared types"
```

---

## Task 10: ServerService

**Files:**
- Create: `frontend/src/app/services/server.service.ts`

- [ ] **Step 1: Create `server.service.ts`**

```typescript
import { Injectable }         from '@angular/core';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { switchMap, map, catchError, shareReplay } from 'rxjs/operators';
import { of }                 from 'rxjs';
import { KeaService }         from './kea.service';

export interface ServerStatus {
  running: boolean;
  pid?:    number;
}

@Injectable({ providedIn: 'root' })
export class ServerService {
  private runningSubject = new BehaviorSubject<boolean>(true);
  readonly running$ = this.runningSubject.asObservable();

  readonly config$: Observable<Record<string, unknown>> = timer(0, 5000).pipe(
    switchMap(() =>
      this.kea.command<{ Dhcp4: Record<string, unknown> }>('config-get').pipe(
        catchError(() => of({ result: 0, text: '', arguments: { Dhcp4: {} } }))
      )
    ),
    map(r => (r.arguments?.['Dhcp4'] as Record<string, unknown>) ?? {}),
    shareReplay(1)
  );

  constructor(private kea: KeaService) {
    this.kea.command<{ pid: number; sockets: { ready: number } }>('status-get')
      .pipe(catchError(() => of(null)))
      .subscribe(r => {
        if (r) this.runningSubject.next((r.arguments?.sockets?.ready ?? 0) > 0);
      });
  }

  enable(): Observable<void> {
    return this.kea.command('dhcp-enable').pipe(
      map(() => { this.runningSubject.next(true); })
    );
  }

  disable(): Observable<void> {
    return this.kea.command('dhcp-disable').pipe(
      map(() => { this.runningSubject.next(false); })
    );
  }

  writeConfig(): Observable<void> {
    return this.kea.command('config-write').pipe(map(() => void 0));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/services/server.service.ts
git commit -m "feat(services): add ServerService for Kea enable/disable/config-get"
```

---

## Task 11: LeaseService

**Files:**
- Create: `frontend/src/app/services/lease.service.ts`

- [ ] **Step 1: Create `lease.service.ts`**

```typescript
import { Injectable }  from '@angular/core';
import { Observable }  from 'rxjs';
import { map }         from 'rxjs/operators';
import { KeaService, KeaLease, Lease, keaLeaseToLease } from './kea.service';

@Injectable({ providedIn: 'root' })
export class LeaseService {
  constructor(private kea: KeaService) {}

  getAll(): Observable<Lease[]> {
    return this.kea.command<{ leases: KeaLease[] }>('lease4-get-all').pipe(
      map(r => (r.arguments?.leases ?? []).map(keaLeaseToLease))
    );
  }

  delete(ipAddress: string): Observable<void> {
    return this.kea.command('lease4-del', { 'ip-address': ipAddress }).pipe(
      map(() => void 0)
    );
  }

  wipe(subnetId: number): Observable<void> {
    return this.kea.command('lease4-wipe', { 'subnet-id': subnetId }).pipe(
      map(() => void 0)
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/services/lease.service.ts
git commit -m "feat(services): add LeaseService (lease4-get-all, lease4-del)"
```

---

## Task 12: ReservationService

**Files:**
- Create: `frontend/src/app/services/reservation.service.ts`

- [ ] **Step 1: Create `reservation.service.ts`**

```typescript
import { Injectable }  from '@angular/core';
import { Observable }  from 'rxjs';
import { map }         from 'rxjs/operators';
import { KeaService, KeaReservation } from './kea.service';

@Injectable({ providedIn: 'root' })
export class ReservationService {
  constructor(private kea: KeaService) {}

  getPage(subnetId: number, from = 0, limit = 200): Observable<KeaReservation[]> {
    return this.kea.command<{ hosts: KeaReservation[]; count: number }>(
      'reservation-get-page',
      { 'subnet-id': subnetId, 'source-index': 0, from, limit }
    ).pipe(
      map(r => r.arguments?.hosts ?? [])
    );
  }

  add(reservation: KeaReservation): Observable<void> {
    return this.kea.command('reservation-add', { reservation }).pipe(
      map(() => void 0)
    );
  }

  delete(subnetId: number, hwAddress: string): Observable<void> {
    return this.kea.command('reservation-del', {
      'subnet-id':       subnetId,
      'identifier-type': 'hw-address',
      'identifier':      hwAddress
    }).pipe(map(() => void 0));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/services/reservation.service.ts
git commit -m "feat(services): add ReservationService (host_cmds)"
```

---

## Task 13: SubnetService

**Files:**
- Create: `frontend/src/app/services/subnet.service.ts`

- [ ] **Step 1: Create `subnet.service.ts`**

```typescript
import { Injectable }  from '@angular/core';
import { Observable }  from 'rxjs';
import { map }         from 'rxjs/operators';
import { KeaService, KeaSubnet } from './kea.service';

const REMOTE = { type: 'mysql' };
const SERVER_TAGS = ['dhcp-admin'];

@Injectable({ providedIn: 'root' })
export class SubnetService {
  constructor(private kea: KeaService) {}

  getAll(): Observable<KeaSubnet[]> {
    return this.kea.command<{ Dhcp4: { subnet4: KeaSubnet[] } }>('config-get').pipe(
      map(r => r.arguments?.['Dhcp4']?.['subnet4'] ?? [])
    );
  }

  set(subnet: KeaSubnet): Observable<void> {
    return this.kea.command('remote-subnet4-set', {
      remote:       REMOTE,
      'server-tags': SERVER_TAGS,
      subnets:      [subnet]
    }).pipe(map(() => void 0));
  }

  deleteById(id: number): Observable<void> {
    return this.kea.command('remote-subnet4-del-by-id', {
      remote:       REMOTE,
      'server-tags': SERVER_TAGS,
      subnets:      [{ id }]
    }).pipe(map(() => void 0));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/services/subnet.service.ts
git commit -m "feat(services): add SubnetService (subnet_cmds + cb_cmds)"
```

---

## Task 14: OptionService

**Files:**
- Create: `frontend/src/app/services/option.service.ts`

- [ ] **Step 1: Create `option.service.ts`**

```typescript
import { Injectable }  from '@angular/core';
import { Observable }  from 'rxjs';
import { map }         from 'rxjs/operators';
import { KeaService, KeaOption } from './kea.service';

const REMOTE = { type: 'mysql' };
const SERVER_TAGS = ['dhcp-admin'];

@Injectable({ providedIn: 'root' })
export class OptionService {
  constructor(private kea: KeaService) {}

  getGlobalAll(): Observable<KeaOption[]> {
    return this.kea.command<{ options: KeaOption[] }>(
      'remote-option4-global-get-all',
      { remote: REMOTE, 'server-tags': SERVER_TAGS }
    ).pipe(map(r => r.arguments?.options ?? []));
  }

  setGlobal(options: KeaOption[]): Observable<void> {
    return this.kea.command('remote-option4-global-set', {
      remote:       REMOTE,
      'server-tags': SERVER_TAGS,
      options
    }).pipe(map(() => void 0));
  }

  deleteGlobal(code: number): Observable<void> {
    return this.kea.command('remote-option4-global-del', {
      remote:       REMOTE,
      'server-tags': SERVER_TAGS,
      options:      [{ code }]
    }).pipe(map(() => void 0));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/services/option.service.ts
git commit -m "feat(services): add OptionService for global DHCP options (cb_cmds)"
```

---

## Task 15: StatisticsService

**Files:**
- Create: `frontend/src/app/services/statistics.service.ts`

- [ ] **Step 1: Create `statistics.service.ts`**

```typescript
import { Injectable }     from '@angular/core';
import { Observable }     from 'rxjs';
import { map, shareReplay, switchMap, catchError } from 'rxjs/operators';
import { timer, of }      from 'rxjs';
import { KeaService }     from './kea.service';
import { environment }    from '../../environments/environment';

export type KeaStats = Record<string, [[number, string]]>;

export function statValue(stats: KeaStats, name: string): number {
  return stats[name]?.[0]?.[0] ?? 0;
}

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  readonly stats$: Observable<KeaStats> = timer(0, environment.pollIntervalMs).pipe(
    switchMap(() =>
      this.kea.command<KeaStats>('statistic-get-all').pipe(
        catchError(() => of({ result: 0, text: '', arguments: {} as KeaStats }))
      )
    ),
    map(r => r.arguments ?? {}),
    shareReplay(1)
  );

  constructor(private kea: KeaService) {}
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/services/statistics.service.ts
git commit -m "feat(services): add StatisticsService with 5s shared polling"
```

---

## Task 16: Login component update

**Files:**
- Modify: `frontend/src/app/login/login.component.ts`
- Modify: `frontend/src/app/login/login.component.html`

- [ ] **Step 1: Replace `login.component.ts`**

```typescript
import { Component }     from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router }        from '@angular/router';
import { AuthService }   from '../services/auth.service';

@Component({
  selector:    'app-login',
  templateUrl: './login.component.html',
  styleUrls:   ['./login.component.css']
})
export class LoginComponent {
  form = this.fb.group({
    password: ['', Validators.required]
  });

  loading = false;
  error   = '';
  showPw  = false;

  constructor(
    private fb:     FormBuilder,
    private auth:   AuthService,
    private router: Router
  ) {}

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error   = '';
    this.auth.login(this.form.value.password!).subscribe({
      next:  () => this.router.navigate(['/dashboard']),
      error: (e) => {
        this.error   = e.status === 401 ? 'Invalid password' : 'Connection failed — is Kea running?';
        this.loading = false;
      }
    });
  }
}
```

- [ ] **Step 2: Replace `login.component.html`**

```html
<div class="auth-wrap">
  <div class="auth-frame">

    <div class="sys-ident">
      <div class="sys-logo">
        <span class="logo-bracket">[</span>
        <span class="logo-icon">⬡</span>
        <span class="logo-bracket">]</span>
      </div>
      <div class="sys-name">DHCP MANAGEMENT SYSTEM</div>
      <div class="sys-sub">NETWORK CONTROL INTERFACE · KEA 2.6</div>
    </div>

    <div class="panel auth-panel">
      <div class="panel-head">
        <span><i class="bi bi-lock panel-head-icon"></i>AUTHENTICATION REQUIRED</span>
        <span class="auth-status-dot"></span>
      </div>
      <div class="panel-body">

        <div *ngIf="error" class="auth-error mb-3">
          <span class="err-marker">ERR</span> {{ error }}
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label class="field-label">Password</label>
            <div class="field-prompt-wrap">
              <span class="field-prompt">&gt;</span>
              <input formControlName="password"
                     [type]="showPw ? 'text' : 'password'"
                     class="field-input field-prompt-input"
                     placeholder="••••••••"
                     autocomplete="current-password">
              <button type="button" class="pw-toggle" (click)="showPw = !showPw" tabindex="-1">
                <i class="bi" [class.bi-eye]="!showPw" [class.bi-eye-slash]="showPw"></i>
              </button>
            </div>
          </div>

          <div class="auth-actions mt-4">
            <button type="submit" class="pbtn pbtn-amber w-full" [disabled]="form.invalid || loading">
              <span *ngIf="loading" class="spin spin-sm"></span>
              <i *ngIf="!loading" class="bi bi-arrow-right-circle"></i>
              {{ loading ? 'AUTHENTICATING…' : 'AUTHENTICATE' }}
            </button>
          </div>
        </form>

      </div>
    </div>

    <div class="auth-footer">
      <span>SYS·READY</span>
      <span class="footer-sep">·</span>
      <span>UDP:67</span>
      <span class="footer-sep">·</span>
      <span>KEA·CA:8000</span>
    </div>

  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/login/
git commit -m "feat(login): password-only login using Kea Basic Auth"
```

---

## Task 17: Dashboard component rewrite

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard.component.ts`
- Modify: `frontend/src/app/dashboard/dashboard.component.html`

- [ ] **Step 1: Replace `dashboard.component.ts`**

```typescript
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
```

- [ ] **Step 2: Replace `dashboard.component.html`**

```html
<div class="dash-grid">

  <!-- Server Control -->
  <div class="panel area-control">
    <div class="panel-head">
      <span><i class="bi bi-power panel-head-icon"></i>SERVER CONTROL</span>
      <span [class]="'status-pill ' + (running ? 'running' : 'stopped')">
        <span class="status-dot"></span>{{ running ? 'RUNNING' : 'STOPPED' }}
      </span>
    </div>
    <div class="panel-body">
      <div class="mt-4">
        <button class="pbtn w-full"
                [class.pbtn-green]="!running"
                [class.pbtn-red]="running"
                [disabled]="actionLoading"
                (click)="toggleServer()">
          <span *ngIf="actionLoading" class="spin"></span>
          <i *ngIf="!actionLoading && !running" class="bi bi-play-fill"></i>
          <i *ngIf="!actionLoading && running"  class="bi bi-stop-fill"></i>
          {{ actionLoading ? 'PLEASE WAIT…' : (running ? 'DISABLE DHCP' : 'ENABLE DHCP') }}
        </button>
      </div>
    </div>
  </div>

  <!-- Active Config -->
  <div class="panel area-info">
    <div class="panel-head">
      <span><i class="bi bi-info-circle panel-head-icon"></i>ACTIVE CONFIG</span>
    </div>
    <div class="panel-body">
      <div class="kv-row"><span class="kv-key">Subnets</span>     <span class="kv-val">{{ subnets.length }}</span></div>
      <div class="kv-row"><span class="kv-key">Active Leases</span><span class="kv-val">{{ assignedNow }}</span></div>
      <div class="kv-row" style="border-bottom:none">
        <span class="kv-key">Lease Time</span>
        <span class="kv-val">{{ leaseTime }}s</span>
      </div>
    </div>
  </div>

  <!-- Active Leases -->
  <div class="panel area-leases">
    <div class="panel-head">
      <span><i class="bi bi-hdd-network panel-head-icon"></i>ACTIVE LEASES</span>
      <span class="badge-count">{{ leases.length }}</span>
    </div>
    <div class="leases-toolbar">
      <div class="filter-tabs">
        <button class="filter-tab" [class.active]="activeTypeFilter === 'ALL'"     (click)="activeTypeFilter = 'ALL'">ALL</button>
        <button class="filter-tab" [class.active]="activeTypeFilter === 'Mobile'"  (click)="activeTypeFilter = 'Mobile'">MOBILE</button>
        <button class="filter-tab" [class.active]="activeTypeFilter === 'Desktop'" (click)="activeTypeFilter = 'Desktop'">DESKTOP</button>
        <button class="filter-tab" [class.active]="activeTypeFilter === 'Network'" (click)="activeTypeFilter = 'Network'">NETWORK</button>
        <button class="filter-tab" [class.active]="activeTypeFilter === 'IoT'"     (click)="activeTypeFilter = 'IoT'">IOT</button>
      </div>
      <input class="field-input lease-search"
             [value]="leaseSearch"
             (input)="leaseSearch = $any($event.target).value"
             placeholder="SEARCH IP / MAC / HOST…">
    </div>
    <div style="overflow-x:auto">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:36px"></th>
            <th>IP Address</th>
            <th>MAC Address</th>
            <th>Manufacturer</th>
            <th>Hostname</th>
            <th>Assigned</th>
            <th>Expires</th>
            <th>Health</th>
            <th style="width:56px"></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let lease of filteredLeases">
            <td class="val-device-icon">
              <i [class]="'bi ' + typeIconFor(lease.mac, lease.hostname)"
                 [style.color]="typeColorFor(lease.mac, lease.hostname)"></i>
            </td>
            <td class="val-ip">{{ lease.ip }}</td>
            <td class="val-mac">{{ lease.mac }}</td>
            <td>
              <span [class]="'vendor-badge vendor-' + vendorColorKey(lease.mac)">
                {{ vendorFor(lease.mac) }}
              </span>
            </td>
            <td>{{ lease.hostname || '—' }}</td>
            <td style="color:var(--text-dim);font-size:0.72rem">{{ formatTime(lease.assignedAt) }}</td>
            <td style="color:var(--text-dim);font-size:0.72rem">{{ formatExpiry(lease.expiry) }}</td>
            <td>
              <div class="health-bar-track" [title]="(leaseHealthPct(lease) | number:'1.0-0') + '% remaining'">
                <div class="health-bar-fill"
                     [style.width.%]="leaseHealthPct(lease)"
                     [style.background]="leaseHealthColor(leaseHealthPct(lease))"></div>
              </div>
            </td>
            <td>
              <button class="pbtn pbtn-icon" (click)="releaseLease(lease.ip)" title="Release lease">
                <i class="bi bi-x-lg"></i>
              </button>
            </td>
          </tr>
          <tr *ngIf="!filteredLeases.length" class="empty-row">
            <td colspan="9">
              <i class="bi bi-inbox" style="margin-right:8px"></i>
              {{ leases.length ? 'NO MATCHING LEASES' : 'NO ACTIVE LEASES' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

</div>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/dashboard/
git commit -m "feat(dashboard): rewrite to use ServerService + LeaseService; remove WS/conflict/log"
```

---

## Task 18: Pool component → Leases page

**Files:**
- Modify: `frontend/src/app/pool/pool.component.ts`

The pool page keeps its device analytics charts. Only the data source changes from `DhcpService` to `LeaseService` + `StatisticsService`.

- [ ] **Step 1: Replace `pool.component.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/pool/pool.component.ts
git commit -m "feat(pool): switch from DhcpService to LeaseService + StatisticsService"
```

---

## Task 19: ReservationsComponent

**Files:**
- Create: `frontend/src/app/reservations/reservations.component.ts`
- Create: `frontend/src/app/reservations/reservations.component.html`
- Create: `frontend/src/app/reservations/reservations.component.css`

- [ ] **Step 1: Create `reservations.component.ts`**

```typescript
import { Component, OnInit }   from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ReservationService }  from '../services/reservation.service';
import { SubnetService }        from '../services/subnet.service';
import { KeaReservation, KeaSubnet } from '../services/kea.service';

@Component({
  selector:    'app-reservations',
  templateUrl: './reservations.component.html',
  styleUrls:   ['./reservations.component.css']
})
export class ReservationsComponent implements OnInit {
  reservations: KeaReservation[] = [];
  subnets:      KeaSubnet[]      = [];
  loading   = false;
  saving    = false;
  error     = '';
  showForm  = false;
  selectedSubnetId = 0;

  form = this.fb.group({
    subnetId:  [0, [Validators.required, Validators.min(1)]],
    hwAddress: ['', [Validators.required, Validators.pattern(/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/)]],
    ipAddress: ['', [Validators.required, Validators.pattern(/^\d{1,3}(\.\d{1,3}){3}$/)]],
    hostname:  ['']
  });

  constructor(
    private reservSvc:  ReservationService,
    private subnetSvc:  SubnetService,
    private fb:         FormBuilder
  ) {}

  ngOnInit() {
    this.subnetSvc.getAll().subscribe({
      next: subnets => {
        this.subnets = subnets;
        if (subnets.length) {
          this.selectedSubnetId = subnets[0].id;
          this.loadReservations();
        }
      }
    });
  }

  loadReservations() {
    if (!this.selectedSubnetId) return;
    this.loading = true;
    this.reservSvc.getPage(this.selectedSubnetId).subscribe({
      next:  r => { this.reservations = r; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  selectSubnet(id: number) {
    this.selectedSubnetId = id;
    this.loadReservations();
  }

  add() {
    if (this.form.invalid) return;
    this.saving = true;
    this.error  = '';
    const v = this.form.value;
    const reservation: KeaReservation = {
      'subnet-id':  Number(v.subnetId),
      'hw-address': v.hwAddress!.toLowerCase(),
      'ip-address': v.ipAddress!,
      hostname:     v.hostname || ''
    };
    this.reservSvc.add(reservation).subscribe({
      next: () => {
        this.saving   = false;
        this.showForm = false;
        this.form.reset({ subnetId: this.selectedSubnetId });
        this.loadReservations();
      },
      error: (e) => {
        this.error  = e.message || 'Failed to add reservation';
        this.saving = false;
      }
    });
  }

  delete(r: KeaReservation) {
    if (!confirm(`Delete reservation for ${r['hw-address']} (${r['ip-address']})?`)) return;
    this.reservSvc.delete(r['subnet-id'], r['hw-address']).subscribe({
      next: () => this.loadReservations(),
      error: (e) => alert(e.message || 'Delete failed')
    });
  }
}
```

- [ ] **Step 2: Create `reservations.component.html`**

```html
<div class="page-wrap">

  <div class="panel">
    <div class="panel-head">
      <span><i class="bi bi-bookmark-star panel-head-icon"></i>HOST RESERVATIONS</span>
      <button class="pbtn pbtn-sm pbtn-amber" (click)="showForm = !showForm">
        <i class="bi" [class.bi-plus-lg]="!showForm" [class.bi-x-lg]="showForm"></i>
        {{ showForm ? 'CANCEL' : 'ADD RESERVATION' }}
      </button>
    </div>

    <!-- Subnet selector -->
    <div class="panel-toolbar" *ngIf="subnets.length">
      <span class="toolbar-label">SUBNET:</span>
      <button *ngFor="let s of subnets"
              class="filter-tab"
              [class.active]="selectedSubnetId === s.id"
              (click)="selectSubnet(s.id)">
        {{ s.subnet }}
      </button>
    </div>

    <!-- Add form -->
    <div class="panel-body" *ngIf="showForm">
      <div *ngIf="error" class="alert-error mb-3">
        <span class="err-marker">ERR</span> {{ error }}
      </div>
      <form [formGroup]="form" (ngSubmit)="add()">
        <div class="config-form-grid">
          <div class="field">
            <label class="field-label">Subnet</label>
            <select formControlName="subnetId" class="field-input">
              <option *ngFor="let s of subnets" [value]="s.id">{{ s.subnet }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">MAC Address</label>
            <input formControlName="hwAddress" class="field-input" placeholder="aa:bb:cc:dd:ee:ff">
          </div>
          <div class="field">
            <label class="field-label">Reserved IP</label>
            <input formControlName="ipAddress" class="field-input" placeholder="192.168.1.50">
          </div>
          <div class="field">
            <label class="field-label">Hostname (optional)</label>
            <input formControlName="hostname" class="field-input" placeholder="mydevice">
          </div>
        </div>
        <div class="flex gap-3 mt-3">
          <button type="submit" class="pbtn pbtn-amber pbtn-sm" [disabled]="form.invalid || saving">
            <span *ngIf="saving" class="spin spin-sm"></span>
            <i *ngIf="!saving" class="bi bi-floppy"></i>
            {{ saving ? 'SAVING…' : 'SAVE' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Table -->
    <div style="overflow-x:auto">
      <div *ngIf="loading" class="loading-row">LOADING…</div>
      <table class="data-table" *ngIf="!loading">
        <thead>
          <tr>
            <th>MAC Address</th>
            <th>Reserved IP</th>
            <th>Hostname</th>
            <th>Subnet ID</th>
            <th style="width:56px"></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of reservations">
            <td class="val-mac">{{ r['hw-address'] }}</td>
            <td class="val-ip">{{ r['ip-address'] }}</td>
            <td>{{ r.hostname || '—' }}</td>
            <td>{{ r['subnet-id'] }}</td>
            <td>
              <button class="pbtn pbtn-icon" (click)="delete(r)" title="Delete reservation">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
          <tr *ngIf="!reservations.length" class="empty-row">
            <td colspan="5"><i class="bi bi-inbox" style="margin-right:8px"></i>NO RESERVATIONS</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

</div>
```

- [ ] **Step 3: Create `reservations.component.css`**

```css
.page-wrap          { padding: 20px; }
.panel-toolbar      { display:flex; align-items:center; gap:8px; padding:8px 16px; border-bottom:1px solid var(--border); }
.toolbar-label      { font-size:0.7rem; color:var(--text-dim); letter-spacing:.06em; }
.loading-row        { padding:24px; text-align:center; color:var(--text-dim); font-size:0.8rem; }
.config-form-grid   { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
.alert-error        { background:rgba(232,64,64,0.1); border:1px solid rgba(232,64,64,0.3);
                      border-radius:4px; padding:8px 12px; font-size:0.82rem; }
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/reservations/
git commit -m "feat(reservations): add ReservationsComponent with CRUD"
```

---

## Task 20: SubnetsComponent

**Files:**
- Create: `frontend/src/app/subnets/subnets.component.ts`
- Create: `frontend/src/app/subnets/subnets.component.html`
- Create: `frontend/src/app/subnets/subnets.component.css`

- [ ] **Step 1: Create `subnets.component.ts`**

```typescript
import { Component, OnInit }   from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { SubnetService }        from '../services/subnet.service';
import { KeaSubnet }            from '../services/kea.service';

@Component({
  selector:    'app-subnets',
  templateUrl: './subnets.component.html',
  styleUrls:   ['./subnets.component.css']
})
export class SubnetsComponent implements OnInit {
  subnets: KeaSubnet[] = [];
  loading = false;
  saving  = false;
  error   = '';
  showForm = false;

  form = this.fb.group({
    id:         [null as number | null, [Validators.required, Validators.min(1)]],
    subnet:     ['', [Validators.required, Validators.pattern(/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/)]],
    poolStart:  ['', [Validators.required, Validators.pattern(/^\d{1,3}(\.\d{1,3}){3}$/)]],
    poolEnd:    ['', [Validators.required, Validators.pattern(/^\d{1,3}(\.\d{1,3}){3}$/)]],
    router:     ['', Validators.pattern(/^\d{1,3}(\.\d{1,3}){3}$/)],
    dns:        [''],
    leaseTime:  [86400, [Validators.required, Validators.min(60)]]
  });

  constructor(private subnetSvc: SubnetService, private fb: FormBuilder) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.subnetSvc.getAll().subscribe({
      next:  s => { this.subnets = s; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    this.error  = '';
    const v = this.form.value;
    const optionData = [];
    if (v.router)   optionData.push({ name: 'routers',             data: v.router });
    if (v.dns)      optionData.push({ name: 'domain-name-servers', data: v.dns });

    const subnet: KeaSubnet = {
      id:               v.id!,
      subnet:           v.subnet!,
      pools:            [{ pool: `${v.poolStart} - ${v.poolEnd}` }],
      'option-data':    optionData,
      'valid-lifetime': v.leaseTime!
    };

    this.subnetSvc.set(subnet).subscribe({
      next: () => {
        this.saving   = false;
        this.showForm = false;
        this.form.reset({ leaseTime: 86400 });
        this.load();
      },
      error: (e) => { this.error = e.message || 'Save failed'; this.saving = false; }
    });
  }

  delete(id: number, cidr: string) {
    if (!confirm(`Delete subnet ${cidr}? All leases in this subnet will be affected.`)) return;
    this.subnetSvc.deleteById(id).subscribe({
      next:  () => this.load(),
      error: (e) => alert(e.message || 'Delete failed')
    });
  }

  getPool(subnet: KeaSubnet): string {
    return subnet.pools?.[0]?.pool ?? '—';
  }

  getOption(subnet: KeaSubnet, name: string): string {
    return subnet['option-data']?.find(o => o.name === name)?.data ?? '—';
  }
}
```

- [ ] **Step 2: Create `subnets.component.html`**

```html
<div class="page-wrap">
  <div class="panel">
    <div class="panel-head">
      <span><i class="bi bi-diagram-3 panel-head-icon"></i>SUBNETS</span>
      <button class="pbtn pbtn-sm pbtn-amber" (click)="showForm = !showForm">
        <i class="bi" [class.bi-plus-lg]="!showForm" [class.bi-x-lg]="showForm"></i>
        {{ showForm ? 'CANCEL' : 'ADD SUBNET' }}
      </button>
    </div>

    <!-- Add form -->
    <div class="panel-body" *ngIf="showForm">
      <div *ngIf="error" class="alert-error mb-3"><span class="err-marker">ERR</span> {{ error }}</div>
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="config-form-grid">
          <div class="field">
            <label class="field-label">Subnet ID (integer)</label>
            <input formControlName="id" type="number" class="field-input" placeholder="1">
          </div>
          <div class="field">
            <label class="field-label">Subnet CIDR</label>
            <input formControlName="subnet" class="field-input" placeholder="192.168.1.0/24">
          </div>
          <div class="field">
            <label class="field-label">Pool Start</label>
            <input formControlName="poolStart" class="field-input" placeholder="192.168.1.100">
          </div>
          <div class="field">
            <label class="field-label">Pool End</label>
            <input formControlName="poolEnd" class="field-input" placeholder="192.168.1.200">
          </div>
          <div class="field">
            <label class="field-label">Router / Gateway</label>
            <input formControlName="router" class="field-input" placeholder="192.168.1.1">
          </div>
          <div class="field">
            <label class="field-label">DNS Servers (comma-separated)</label>
            <input formControlName="dns" class="field-input" placeholder="8.8.8.8, 8.8.4.4">
          </div>
          <div class="field">
            <label class="field-label">Lease Time (seconds)</label>
            <input formControlName="leaseTime" type="number" class="field-input">
          </div>
        </div>
        <div class="flex gap-3 mt-3">
          <button type="submit" class="pbtn pbtn-amber pbtn-sm" [disabled]="form.invalid || saving">
            <span *ngIf="saving" class="spin spin-sm"></span>
            <i *ngIf="!saving" class="bi bi-floppy"></i>
            {{ saving ? 'SAVING…' : 'SAVE SUBNET' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Table -->
    <div style="overflow-x:auto">
      <div *ngIf="loading" class="loading-row">LOADING…</div>
      <table class="data-table" *ngIf="!loading">
        <thead>
          <tr>
            <th>ID</th><th>Subnet</th><th>Pool Range</th>
            <th>Router</th><th>DNS</th><th>Lease Time</th>
            <th style="width:56px"></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let s of subnets">
            <td>{{ s.id }}</td>
            <td class="val-ip">{{ s.subnet }}</td>
            <td style="font-size:0.78rem;color:var(--text-dim)">{{ getPool(s) }}</td>
            <td>{{ getOption(s, 'routers') }}</td>
            <td style="font-size:0.78rem">{{ getOption(s, 'domain-name-servers') }}</td>
            <td>{{ s['valid-lifetime'] ?? '—' }}s</td>
            <td>
              <button class="pbtn pbtn-icon" (click)="delete(s.id, s.subnet)" title="Delete subnet">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
          <tr *ngIf="!subnets.length" class="empty-row">
            <td colspan="7"><i class="bi bi-inbox" style="margin-right:8px"></i>NO SUBNETS CONFIGURED</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Create `subnets.component.css`**

```css
.page-wrap        { padding: 20px; }
.config-form-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
.loading-row      { padding:24px; text-align:center; color:var(--text-dim); font-size:0.8rem; }
.alert-error      { background:rgba(232,64,64,0.1); border:1px solid rgba(232,64,64,0.3);
                    border-radius:4px; padding:8px 12px; font-size:0.82rem; }
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/subnets/
git commit -m "feat(subnets): add SubnetsComponent with add/delete via cb_cmds"
```

---

## Task 21: OptionsComponent

**Files:**
- Create: `frontend/src/app/options/options.component.ts`
- Create: `frontend/src/app/options/options.component.html`
- Create: `frontend/src/app/options/options.component.css`

- [ ] **Step 1: Create `options.component.ts`**

```typescript
import { Component, OnInit }   from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { OptionService }        from '../services/option.service';
import { KeaOption }            from '../services/kea.service';

const COMMON_OPTIONS: { name: string; placeholder: string }[] = [
  { name: 'routers',              placeholder: '192.168.1.1' },
  { name: 'domain-name-servers',  placeholder: '8.8.8.8, 8.8.4.4' },
  { name: 'domain-name',          placeholder: 'example.com' },
  { name: 'ntp-servers',          placeholder: '192.168.1.1' },
  { name: 'broadcast-address',    placeholder: '192.168.1.255' },
];

@Component({
  selector:    'app-options',
  templateUrl: './options.component.html',
  styleUrls:   ['./options.component.css']
})
export class OptionsComponent implements OnInit {
  options:      KeaOption[] = [];
  commonOptions = COMMON_OPTIONS;
  loading  = false;
  saving   = false;
  error    = '';
  showForm = false;

  form = this.fb.group({
    name:    ['', Validators.required],
    data:    ['', Validators.required],
    customName: ['']
  });

  get nameValue(): string { return this.form.value.name || ''; }

  constructor(private optionSvc: OptionService, private fb: FormBuilder) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.optionSvc.getGlobalAll().subscribe({
      next:  o => { this.options = o; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    this.error  = '';
    const v = this.form.value;
    const name = v.name === 'custom' ? v.customName! : v.name!;
    this.optionSvc.setGlobal([{ name, data: v.data! }]).subscribe({
      next: () => {
        this.saving   = false;
        this.showForm = false;
        this.form.reset();
        this.load();
      },
      error: (e) => { this.error = e.message || 'Save failed'; this.saving = false; }
    });
  }

  delete(option: KeaOption) {
    if (!option.code) { alert('Cannot delete option without a code.'); return; }
    if (!confirm(`Delete global option "${option.name}"?`)) return;
    this.optionSvc.deleteGlobal(option.code).subscribe({
      next:  () => this.load(),
      error: (e) => alert(e.message || 'Delete failed')
    });
  }
}
```

- [ ] **Step 2: Create `options.component.html`**

```html
<div class="page-wrap">
  <div class="panel">
    <div class="panel-head">
      <span><i class="bi bi-toggles panel-head-icon"></i>GLOBAL DHCP OPTIONS</span>
      <button class="pbtn pbtn-sm pbtn-amber" (click)="showForm = !showForm">
        <i class="bi" [class.bi-plus-lg]="!showForm" [class.bi-x-lg]="showForm"></i>
        {{ showForm ? 'CANCEL' : 'ADD OPTION' }}
      </button>
    </div>

    <div class="panel-body" *ngIf="showForm">
      <div *ngIf="error" class="alert-error mb-3"><span class="err-marker">ERR</span> {{ error }}</div>
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="config-form-grid">
          <div class="field">
            <label class="field-label">Option Name</label>
            <select formControlName="name" class="field-input">
              <option value="">-- select --</option>
              <option *ngFor="let o of commonOptions" [value]="o.name">{{ o.name }}</option>
              <option value="custom">Custom…</option>
            </select>
          </div>
          <div class="field" *ngIf="nameValue === 'custom'">
            <label class="field-label">Custom Option Name</label>
            <input formControlName="customName" class="field-input" placeholder="option-name">
          </div>
          <div class="field">
            <label class="field-label">Value</label>
            <input formControlName="data" class="field-input"
                   [placeholder]="commonOptions | optionPlaceholder:nameValue">
          </div>
        </div>
        <div class="flex gap-3 mt-3">
          <button type="submit" class="pbtn pbtn-amber pbtn-sm" [disabled]="form.invalid || saving">
            <span *ngIf="saving" class="spin spin-sm"></span>
            <i *ngIf="!saving" class="bi bi-floppy"></i>
            {{ saving ? 'SAVING…' : 'SAVE OPTION' }}
          </button>
        </div>
      </form>
    </div>

    <div style="overflow-x:auto">
      <div *ngIf="loading" class="loading-row">LOADING…</div>
      <table class="data-table" *ngIf="!loading">
        <thead>
          <tr><th>Option Name</th><th>Value</th><th>Code</th><th style="width:56px"></th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let o of options">
            <td>{{ o.name }}</td>
            <td style="color:var(--text-bright)">{{ o.data }}</td>
            <td style="color:var(--text-dim);font-size:0.78rem">{{ o.code ?? '—' }}</td>
            <td>
              <button class="pbtn pbtn-icon" (click)="delete(o)" title="Delete option">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
          <tr *ngIf="!options.length" class="empty-row">
            <td colspan="4"><i class="bi bi-inbox" style="margin-right:8px"></i>NO GLOBAL OPTIONS SET</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
```

Note: the `optionPlaceholder` pipe used in the template requires a small pipe. Replace that binding with a simple method call instead — in the `.ts` file add:

```typescript
getPlaceholder(name: string): string {
  return this.commonOptions.find(o => o.name === name)?.placeholder ?? '';
}
```

And in the HTML change `[placeholder]="commonOptions | optionPlaceholder:nameValue"` to `[placeholder]="getPlaceholder(nameValue)"`.

- [ ] **Step 3: Update `options.component.html` placeholder binding**

Replace the `[placeholder]` line in the Value field:
```html
<input formControlName="data" class="field-input"
       [placeholder]="getPlaceholder(nameValue)">
```

- [ ] **Step 4: Create `options.component.css`**

```css
.page-wrap        { padding: 20px; }
.config-form-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:12px; }
.loading-row      { padding:24px; text-align:center; color:var(--text-dim); font-size:0.8rem; }
.alert-error      { background:rgba(232,64,64,0.1); border:1px solid rgba(232,64,64,0.3);
                    border-radius:4px; padding:8px 12px; font-size:0.82rem; }
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/options/
git commit -m "feat(options): add OptionsComponent for global DHCP options CRUD"
```

---

## Task 22: StatisticsComponent

**Files:**
- Create: `frontend/src/app/statistics/statistics.component.ts`
- Create: `frontend/src/app/statistics/statistics.component.html`
- Create: `frontend/src/app/statistics/statistics.component.css`

- [ ] **Step 1: Create `statistics.component.ts`**

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription }   from 'rxjs';
import { StatisticsService, KeaStats, statValue } from '../services/statistics.service';
import { SubnetService }   from '../services/subnet.service';
import { KeaSubnet }       from '../services/kea.service';

interface SubnetStat {
  id:         number;
  subnet:     string;
  total:      number;
  assigned:   number;
  declined:   number;
  available:  number;
  utilPct:    number;
}

@Component({
  selector:    'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls:   ['./statistics.component.css']
})
export class StatisticsComponent implements OnInit, OnDestroy {
  stats:       KeaStats     = {};
  subnets:     KeaSubnet[]  = [];
  subnetStats: SubnetStat[] = [];

  private sub!: Subscription;

  constructor(
    private statsSvc:  StatisticsService,
    private subnetSvc: SubnetService
  ) {}

  ngOnInit() {
    this.subnetSvc.getAll().subscribe(s => this.subnets = s);
    this.sub = this.statsSvc.stats$.subscribe(s => {
      this.stats = s;
      this.buildSubnetStats();
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  get pktReceived():  number { return statValue(this.stats, 'pkt4-received'); }
  get pktSent():      number { return statValue(this.stats, 'pkt4-sent'); }
  get totalDeclined(): number { return statValue(this.stats, 'declined-addresses'); }

  private buildSubnetStats() {
    this.subnetStats = this.subnets.map(s => {
      const total    = statValue(this.stats, `subnet[${s.id}].total-addresses`);
      const assigned = statValue(this.stats, `subnet[${s.id}].assigned-addresses`);
      const declined = statValue(this.stats, `subnet[${s.id}].declined-addresses`);
      const available = Math.max(0, total - assigned);
      const utilPct  = total > 0 ? (assigned / total) * 100 : 0;
      return { id: s.id, subnet: s.subnet, total, assigned, declined, available, utilPct };
    });
  }

  utilColor(pct: number): string {
    if (pct < 60) return '#3de89a';
    if (pct < 85) return '#ddb83a';
    return '#e84040';
  }
}
```

- [ ] **Step 2: Create `statistics.component.html`**

```html
<div class="page-wrap">

  <!-- Global stats -->
  <div class="panel mb-4">
    <div class="panel-head">
      <span><i class="bi bi-bar-chart-line panel-head-icon"></i>GLOBAL STATISTICS</span>
    </div>
    <div class="panel-body">
      <div class="stats-row">
        <div class="stat-block">
          <div class="stat-value">{{ pktReceived }}</div>
          <div class="stat-label">PACKETS RECEIVED</div>
        </div>
        <div class="stat-block">
          <div class="stat-value v-green">{{ pktSent }}</div>
          <div class="stat-label">PACKETS SENT</div>
        </div>
        <div class="stat-block">
          <div class="stat-value" [style.color]="totalDeclined > 0 ? 'var(--red)' : 'var(--text-bright)'">
            {{ totalDeclined }}
          </div>
          <div class="stat-label">DECLINED</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Per-subnet stats -->
  <div class="panel">
    <div class="panel-head">
      <span><i class="bi bi-diagram-3 panel-head-icon"></i>PER-SUBNET UTILISATION</span>
    </div>
    <div class="panel-body" *ngIf="subnetStats.length; else noSubnets">
      <div *ngFor="let s of subnetStats" class="subnet-stat-row">
        <div class="subnet-info">
          <span class="subnet-cidr">{{ s.subnet }}</span>
          <span class="subnet-counts">
            {{ s.assigned }}/{{ s.total }} assigned · {{ s.available }} available
            <span *ngIf="s.declined > 0" style="color:var(--red)"> · {{ s.declined }} declined</span>
          </span>
        </div>
        <div class="util-track">
          <div class="util-fill"
               [style.width.%]="s.utilPct"
               [style.background]="utilColor(s.utilPct)">
          </div>
        </div>
        <div class="util-pct" [style.color]="utilColor(s.utilPct)">
          {{ s.utilPct | number:'1.0-0' }}%
        </div>
      </div>
    </div>
    <ng-template #noSubnets>
      <div class="panel-body" style="color:var(--text-dim);font-size:0.82rem">
        No subnets configured yet — add one in the SUBNETS page.
      </div>
    </ng-template>
  </div>

</div>
```

- [ ] **Step 3: Create `statistics.component.css`**

```css
.page-wrap         { padding: 20px; }
.mb-4              { margin-bottom: 16px; }
.stats-row         { display:flex; gap:24px; flex-wrap:wrap; }
.stat-block        { flex:1; min-width:140px; }
.stat-value        { font-size:2rem; font-weight:700; color:var(--text-bright); font-family:var(--font-mono); }
.stat-value.v-green { color:var(--green); }
.stat-label        { font-size:0.68rem; color:var(--text-dim); letter-spacing:.08em; margin-top:4px; }
.subnet-stat-row   { display:grid; grid-template-columns:1fr 200px 48px; gap:12px;
                     align-items:center; padding:10px 0; border-bottom:1px solid var(--border); }
.subnet-stat-row:last-child { border-bottom:none; }
.subnet-cidr       { font-family:var(--font-mono); color:var(--text-bright); font-size:0.88rem; }
.subnet-counts     { display:block; font-size:0.72rem; color:var(--text-dim); margin-top:2px; }
.util-track        { height:6px; background:var(--border); border-radius:3px; overflow:hidden; }
.util-fill         { height:100%; border-radius:3px; transition:width .4s; }
.util-pct          { font-size:0.78rem; font-family:var(--font-mono); text-align:right; }
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/statistics/
git commit -m "feat(statistics): add StatisticsComponent with per-subnet utilisation"
```

---

## Task 23: Layout nav update

**Files:**
- Modify: `frontend/src/app/layout/layout.component.html`

- [ ] **Step 1: Replace `layout.component.html`**

```html
<div class="app-shell" [class.sidebar-collapsed]="collapsed">

  <nav class="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-logo">
        <span class="logo-bracket">[</span>⬡<span class="logo-bracket">]</span>
      </span>
      <span class="sidebar-title">DHCP CTRL</span>
    </div>

    <ul class="nav-list">
      <li>
        <a class="nav-item" routerLink="/dashboard" routerLinkActive="active">
          <i class="bi bi-speedometer2 nav-icon"></i>
          <span class="nav-label">DASHBOARD</span>
        </a>
      </li>
      <li>
        <a class="nav-item" routerLink="/leases" routerLinkActive="active">
          <i class="bi bi-hdd-stack nav-icon"></i>
          <span class="nav-label">LEASES</span>
        </a>
      </li>
      <li>
        <a class="nav-item" routerLink="/reservations" routerLinkActive="active">
          <i class="bi bi-bookmark-star nav-icon"></i>
          <span class="nav-label">RESERVATIONS</span>
        </a>
      </li>
      <li>
        <a class="nav-item" routerLink="/subnets" routerLinkActive="active">
          <i class="bi bi-diagram-3 nav-icon"></i>
          <span class="nav-label">SUBNETS</span>
        </a>
      </li>
      <li>
        <a class="nav-item" routerLink="/options" routerLinkActive="active">
          <i class="bi bi-toggles nav-icon"></i>
          <span class="nav-label">OPTIONS</span>
        </a>
      </li>
      <li>
        <a class="nav-item" routerLink="/statistics" routerLinkActive="active">
          <i class="bi bi-bar-chart-line nav-icon"></i>
          <span class="nav-label">STATISTICS</span>
        </a>
      </li>
    </ul>

    <div class="sidebar-footer">
      <button class="nav-item nav-logout" (click)="auth.logout()">
        <i class="bi bi-box-arrow-right nav-icon"></i>
        <span class="nav-label">LOGOUT</span>
      </button>
    </div>

    <button class="sidebar-toggle" (click)="toggleSidebar()">
      <i [class]="collapsed ? 'bi bi-chevron-right' : 'bi bi-chevron-left'"></i>
    </button>
  </nav>

  <main class="main-content">
    <router-outlet></router-outlet>
  </main>

</div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/layout/layout.component.html
git commit -m "feat(layout): add Reservations/Subnets/Options/Statistics nav; remove Settings"
```

---

## Task 24: App routing update

**Files:**
- Modify: `frontend/src/app/app-routing.module.ts`

- [ ] **Step 1: Replace `app-routing.module.ts`**

```typescript
import { NgModule }              from '@angular/core';
import { RouterModule, Routes }  from '@angular/router';
import { LoginComponent }        from './login/login.component';
import { LayoutComponent }       from './layout/layout.component';
import { DashboardComponent }    from './dashboard/dashboard.component';
import { PoolComponent }         from './pool/pool.component';
import { ReservationsComponent } from './reservations/reservations.component';
import { SubnetsComponent }      from './subnets/subnets.component';
import { OptionsComponent }      from './options/options.component';
import { StatisticsComponent }   from './statistics/statistics.component';
import { authGuard }             from './guards/auth.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '',             redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',   component: DashboardComponent },
      { path: 'leases',      component: PoolComponent },
      { path: 'reservations', component: ReservationsComponent },
      { path: 'subnets',     component: SubnetsComponent },
      { path: 'options',     component: OptionsComponent },
      { path: 'statistics',  component: StatisticsComponent },
      { path: '**',          redirectTo: 'dashboard' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/app-routing.module.ts
git commit -m "feat(routing): add new routes; rename /pool→/leases; remove /settings"
```

---

## Task 25: App module update

**Files:**
- Modify: `frontend/src/app/app.module.ts`

- [ ] **Step 1: Replace `app.module.ts`**

```typescript
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
```

- [ ] **Step 2: Verify the build compiles**

```bash
cd frontend && npm run build -- --watch=false 2>&1 | tail -20
```

Expected: `Build at: ... - Hash: ... - Time: ...ms` with no TypeScript errors.

If build fails, fix errors before committing (common issues: missing import, wrong property name).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/app.module.ts
git commit -m "feat(module): register new components, swap AuthInterceptor→KeaInterceptor"
```

---

## Task 26: Cleanup — delete old files

- [ ] **Step 1: Delete the Node.js backend**

```bash
rm -rf backend/
```

- [ ] **Step 2: Delete docker-compose and env files**

```bash
rm docker-compose.yml .env .env.example
```

- [ ] **Step 3: Delete old frontend files**

```bash
rm frontend/src/app/interceptors/auth.interceptor.ts
rm frontend/src/app/services/dhcp.service.ts
rm -rf frontend/src/app/settings/
```

- [ ] **Step 4: Verify build still passes**

```bash
cd frontend && npm run build -- --watch=false 2>&1 | tail -10
```

Expected: clean build, no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove Node.js backend, docker-compose, old interceptor, settings"
```

---

## Spec Coverage Self-Check

| Spec requirement | Implemented in |
|---|---|
| Kea 2.6.x apt install + systemd | Task 1–4 |
| MySQL lease DB | Task 1 (kea-dhcp4.conf) |
| MySQL hosts DB | Task 1 |
| MySQL config backend (CB) | Task 1 + Task 13 (SubnetService, OptionService) |
| All 5 open-source hooks | Task 1 (kea-dhcp4.conf hooks-libraries) |
| Kea CA Basic Auth | Task 1 (kea-ctrl-agent.conf) |
| nginx HTTPS proxy | Task 3 |
| AuthService Basic Auth | Task 6 |
| KeaInterceptor | Task 7 |
| authGuard sessionStorage | Task 8 |
| KeaService base client | Task 9 |
| ServerService (enable/disable/config-get) | Task 10 |
| LeaseService (lease4-get-all/del) | Task 11 |
| ReservationService | Task 12 |
| SubnetService | Task 13 |
| OptionService | Task 14 |
| StatisticsService 5s polling | Task 15 |
| Login password-only | Task 16 |
| Dashboard without WS/conflict/log | Task 17 |
| Pool page uses LeaseService | Task 18 |
| ReservationsComponent | Task 19 |
| SubnetsComponent | Task 20 |
| OptionsComponent | Task 21 |
| StatisticsComponent | Task 22 |
| Layout new nav links | Task 23 |
| Routing updates | Task 24 |
| Module update | Task 25 |
| Delete backend, docker, settings | Task 26 |
| Ubuntu install guide | Task 4 |
