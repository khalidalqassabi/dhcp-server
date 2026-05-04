# Kea DHCP4 Full Migration — Ubuntu Native Install Design Spec

## Overview

Replace the custom Node.js DHCP backend with **ISC Kea 2.6.x** installed natively on Ubuntu Linux via `apt`. Kea runs as systemd services alongside MySQL 8 and nginx. The Angular frontend is expanded to expose Kea's full capabilities: lease management, host reservations, multiple subnets, per-subnet DHCP options, and live statistics.

Authentication uses **Kea Control Agent's built-in HTTP Basic Auth**, proxied through nginx over HTTPS. No Node.js remains in the stack.

---

## Architecture

```
Browser (Angular SPA)
    │  HTTPS :443
    ▼
nginx  (Ubuntu systemd)
    ├─ serves Angular static build  (/var/www/dhcp-admin/)
    └─ /api/*  →  http://127.0.0.1:8000/   (passes Authorization header)
                                │
                                ▼
kea-ctrl-agent  (systemd, :8000, HTTP Basic Auth enabled, loopback only)
                                │  Unix socket: /run/kea/kea4-ctrl-socket
                                ▼
kea-dhcp4  (systemd, UDP :67)
    ├─ Hooks: lease_cmds · host_cmds · subnet_cmds · stat_cmds · cb_cmds
    └─ MySQL  ──  leases · host_reservations · config backend (CB)
                                │
                                ▼
MySQL 8  (systemd, :3306, loopback only)
    └─ database: kea
```

**Key constraints:**
- Kea CA binds `127.0.0.1:8000` only — never reachable directly from the network
- nginx is the only public listener (443 + 80→443 redirect)
- Node.js, JWT, WebSocket, and Docker are fully removed

---

## Ubuntu Installation

### Add ISC Kea 2.6 repository and install packages

```bash
curl -1sLf 'https://dl.cloudsmith.io/public/isc/kea-2-6/setup.deb.sh' | sudo bash
sudo apt install -y \
  isc-kea-dhcp4-server \
  isc-kea-ctrl-agent \
  isc-kea-admin \
  isc-kea-hooks \
  mysql-server \
  nginx
```

### MySQL initialisation (one-time)

```bash
sudo mysql -e "
  CREATE DATABASE kea;
  CREATE USER 'kea'@'127.0.0.1' IDENTIFIED BY 'keapass';
  GRANT ALL PRIVILEGES ON kea.* TO 'kea'@'127.0.0.1';
  FLUSH PRIVILEGES;
"
sudo kea-admin db-init mysql -u kea -p keapass -n kea -h 127.0.0.1
```

`kea-admin db-init` creates all Kea schema tables: `lease4`, `hosts`, `dhcp4_options`, and the config-backend tables.

### Self-signed TLS certificate (one-time)

```bash
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/ssl/private/kea-admin.key \
  -out /etc/ssl/certs/kea-admin.crt \
  -subj "/CN=dhcp-admin"
```

### Service start order

1. `mysql` — must be running before Kea connects
2. `isc-kea-dhcp4-server` — loads hooks, connects to MySQL, binds UDP :67
3. `isc-kea-ctrl-agent` — opens Unix socket to dhcp4, listens on :8000
4. `nginx` — serves frontend, proxies `/api/`

---

## Kea Configuration

### `/etc/kea/kea-dhcp4.conf`

Minimal bootstrap config. After the first run, all subnets and options are managed through the MySQL config backend via the API — the file itself is not edited again.

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
    ]
  }
}
```

### `/etc/kea/kea-ctrl-agent.conf`

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
    }
  }
}
```

---

## nginx Configuration

### `/etc/nginx/sites-available/dhcp-admin`

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
        proxy_pass http://127.0.0.1:8000/;
        proxy_pass_header Authorization;
    }
}

server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

Enable with:
```bash
sudo ln -s /etc/nginx/sites-available/dhcp-admin /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## Authentication

**Flow:**
1. Login page: user enters password (username is fixed as `kea-api`)
2. `AuthService` computes `btoa('kea-api:' + password)` and stores it in `sessionStorage['kea_token']`
3. `KeaInterceptor` attaches `Authorization: Basic <token>` to every request to `/api/`
4. Any HTTP 401 response forces logout and clears sessionStorage
5. `authGuard` checks `sessionStorage['kea_authed']` — no JWT decode needed

**Removed vs current stack:**
- No JWT, no `jwt.verify()`, no `passwordVersion`
- No WebSocket auth handshake
- `AuthInterceptor` → `KeaInterceptor` (same pattern, Basic Auth header)
- `SettingsComponent` removed — password changed in `/etc/kea/kea-ctrl-agent.conf`

---

## Frontend: New Pages & Services

### Routes

| Route | Component | Status |
|---|---|---|
| `/dashboard` | `DashboardComponent` | Updated |
| `/leases` | `LeasesComponent` | Updated |
| `/reservations` | `ReservationsComponent` | **New** |
| `/subnets` | `SubnetsComponent` | **New** |
| `/options` | `OptionsComponent` | **New** |
| `/statistics` | `StatisticsComponent` | **New** |

### Services

| Service | Responsibility |
|---|---|
| `KeaService` | Base: `POST /api/` with `{command, service, arguments}`, handles 401 |
| `LeaseService` | `lease4-get-all`, `lease4-del`, `lease4-add`, `lease4-wipe` |
| `ReservationService` | `reservation-get-page`, `reservation-add`, `reservation-del`, `reservation-get` |
| `SubnetService` | `subnet4-list`, `remote-subnet4-set`, `remote-subnet4-del` |
| `OptionService` | `remote-option4-global-get-all`, `remote-option4-global-set`, `remote-option4-subnet-set` |
| `StatisticsService` | `statistic-get-all`, polls every 5 s, `shareReplay(1)` shared observable |
| `ServerService` | `dhcp-enable`, `dhcp-disable`, `config-get`, `config-write` |

**Polling:** `StatisticsService` and `ServerService` poll every 5 s via `setInterval`, exposed as shared observables. Multiple components subscribe without multiplying HTTP requests.

### Deleted from frontend
- `dhcp.service.ts` (replaced by the service split above)
- `auth.interceptor.ts` (replaced by `kea.interceptor.ts`)
- `settings/` directory and route
- WebSocket connect/disconnect logic
- JWT decode in `auth.service.ts`
- Conflict detection panel in `DashboardComponent`
- System log panel in `DashboardComponent`

---

## Kea API Command Reference

All requests: `POST /api/` with `{"command": "...", "service": ["dhcp4"], "arguments": {...}}`.  
Success response: `{"result": 0, "text": "...", "arguments": {...}}`.

### Server Control (built-in)

| Operation | Command |
|---|---|
| Get full config | `config-get` |
| Enable DHCP | `dhcp-enable` |
| Disable DHCP | `dhcp-disable` |
| Write config to disk | `config-write` |

### Leases (`lease_cmds` hook)

| Operation | Command | Key Arguments |
|---|---|---|
| List all leases | `lease4-get-all` | — |
| Delete lease by IP | `lease4-del` | `ip-address` |
| Add lease | `lease4-add` | `ip-address`, `hw-address`, `subnet-id` |
| Wipe subnet leases | `lease4-wipe` | `subnet-id` |

### Host Reservations (`host_cmds` hook)

| Operation | Command | Key Arguments |
|---|---|---|
| List reservations (paged) | `reservation-get-page` | `subnet-id`, `from`, `source-index`, `limit` |
| Add reservation | `reservation-add` | `hw-address`, `ip-address`, `hostname`, `subnet-id` |
| Delete reservation | `reservation-del` | `subnet-id`, `identifier-type`, `identifier` |
| Get one reservation | `reservation-get` | `subnet-id`, `identifier-type`, `identifier` |

### Subnets (`subnet_cmds` + `cb_cmds` hooks)

| Operation | Command | Key Arguments |
|---|---|---|
| List all subnets | `subnet4-list` | — |
| Add / update subnet | `remote-subnet4-set` | `subnet` object with `id`, `subnet`, `pools`, `option-data` |
| Delete subnet | `remote-subnet4-del` | `id` |

### DHCP Options (`cb_cmds` hook)

| Operation | Command | Key Arguments |
|---|---|---|
| Get all global options | `remote-option4-global-get-all` | — |
| Set global option | `remote-option4-global-set` | `options[]` with `code`/`name`, `data` |
| Set per-subnet option | `remote-option4-subnet-set` | `subnet-id`, `options[]` |

### Statistics (`stat_cmds` hook)

| Operation | Command |
|---|---|
| Get all statistics | `statistic-get-all` |
| Reset all statistics | `statistic-reset` |

---

## Lease → Frontend Field Mapping

Kea `lease4-get-all` returns per-lease objects mapped to the existing `Lease` interface:

| Frontend field | Kea field | Notes |
|---|---|---|
| `ip` | `ip-address` | |
| `mac` | `hw-address` | |
| `hostname` | `hostname` | |
| `assignedAt` | `cltt` | `new Date(cltt * 1000).toISOString()` |
| `expiry` | `cltt + valid-lft` | `new Date((cltt + valid-lft) * 1000).toISOString()` |

Pool stats derived client-side: `total` = pool size, `used` = `leases.length`, `available` = `total - used`.

---

## File Changes Summary

### Created
- `kea/kea-dhcp4.conf` — Kea DHCP4 config (committed as template; deployed to `/etc/kea/`)
- `kea/kea-ctrl-agent.conf` — Control Agent with Basic Auth
- `kea/init-mysql.sh` — MySQL init script (one-time setup)
- `nginx/dhcp-admin.conf` — nginx site config
- `docs/ubuntu-install.md` — step-by-step installation guide for Ubuntu
- `frontend/src/app/reservations/` — ReservationsComponent
- `frontend/src/app/subnets/` — SubnetsComponent
- `frontend/src/app/options/` — OptionsComponent
- `frontend/src/app/statistics/` — StatisticsComponent
- `frontend/src/app/interceptors/kea.interceptor.ts`
- `frontend/src/app/services/kea.service.ts`
- `frontend/src/app/services/lease.service.ts`
- `frontend/src/app/services/reservation.service.ts`
- `frontend/src/app/services/subnet.service.ts`
- `frontend/src/app/services/option.service.ts`
- `frontend/src/app/services/statistics.service.ts`
- `frontend/src/app/services/server.service.ts`

### Replaced
- `frontend/src/app/services/auth.service.ts` — Basic Auth credential store
- `frontend/src/app/guards/auth.guard.ts` — checks `sessionStorage['kea_authed']`
- `frontend/src/app/app-routing.module.ts` — adds new routes, removes `/settings`
- `frontend/src/app/app.module.ts` — registers new components/services, removes old
- `frontend/src/environments/environment.ts` — adds `pollIntervalMs: 5000`; removes `wsUrl`, `apiUrl`
- `frontend/src/app/dashboard/dashboard.component.*` — removes conflict/log panels, uses `ServerService`
- `frontend/src/app/dashboard/leases/*` (or pool page) — uses `LeaseService`
- `frontend/proxy.conf.json` — target changed to `http://127.0.0.1:8000`, `/ws` block removed

### Deleted
- `backend/` — entire directory
- `frontend/src/app/interceptors/auth.interceptor.ts`
- `frontend/src/app/settings/` — entire directory
- `docker-compose.yml`
- `.env`, `.env.example`

---

## Out of Scope

- HTTPS with a CA-signed certificate (self-signed is sufficient for admin LAN use)
- Kea HA (high-availability failover)
- DDNS integration
- Multi-user / role-based access
- Log streaming UI (Kea logs to `/var/log/kea/` or journald; a future sidecar could expose this)
