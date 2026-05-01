# Kea DHCP Backend Migration — Design Spec

## Overview

Replace the custom Node.js DHCP backend with **Kea DHCP 2.x** + **Kea Control Agent** (REST API). The Angular frontend will call Kea's API directly through nginx proxy. No application-level backend remains.

## Motivation

- Kea is a mature, ISC-maintained DHCP server with a built-in REST API
- Eliminates custom DHCP packet parsing, lease tracking, and pool management code
- Reduces project surface area (no Node.js, JWT, WebSocket, custom auth)

---

## Architecture

```
Browser (Angular SPA)
    │  HTTP/JSON (Kea commands)
    ▼
nginx container (port 80)
    ├─ static frontend
    └─ /api → kea-ctrl-agent:8000
    │
    ▼
kea-ctrl-agent container (port 8000)
    │  Unix socket
    ▼
kea-dhcp4 container (UDP port 67, host network)
    ├─ /etc/kea/kea-dhcp4.conf  (config, mounted from ./kea/)
    └─ /var/lib/kea/             (lease database, named volume)
```

**Containers:**
- `kea-dhcp4` — DHCP server, runs in host network mode for broadcast access, `NET_ADMIN`+`NET_RAW` caps
- `kea-ctrl-agent` — REST endpoint on `:8000`, talks to dhcp4 via Unix socket shared volume
- `frontend` — nginx serving Angular build + reverse proxy to ctrl-agent

---

## Authentication

- No backend auth. Login is client-side only.
- `environment.ts` contains `adminPassword: '<value>'`.
- `LoginComponent` compares input to `environment.adminPassword`. On match, sets `localStorage['dhcp_authed'] = 'true'`.
- `authGuard` checks the localStorage flag.
- No JWT, no token refresh, no `AuthInterceptor`.
- Security relies on network-level controls (VPN/firewall).

---

## Data Flow: Polling Replaces WebSocket

Polling interval: **5 seconds** (configurable via `environment.pollIntervalMs`).

Components needing live data (`DashboardComponent`, `PoolComponent`) subscribe to a `DhcpService.status$` observable that wraps a `setInterval` loop. The service fans out to a single observable so multiple components don't multiply requests.

---

## API Translation

All requests are `POST /api/` with body `{"command": "<name>", "service": ["dhcp4"], "arguments": {...}}`.

| Frontend Operation | Kea Command(s) | Notes |
|---|---|---|
| Get full status | `config-get` + `lease4-get-all` + `statistic-get-all` | Combined client-side into the existing `DHCPStatus` shape |
| Start server | `dhcp-enable` | |
| Stop server | `dhcp-disable` | |
| Update config | `config-set` then `config-write` | `config-write` persists to disk |
| Release lease | `lease4-del` with `{ ip-address: "..." }` | |
| List leases | `lease4-get-all` | Mapped to existing `Lease[]` shape |

Kea returns `{result: 0, text: "...", arguments: {...}}` on success, `result != 0` on error.

---

## Removed Features

- **Conflict Detection** — Kea has no equivalent. Remove `CONFLICT DETECTION` panel from Dashboard, remove `detectConflicts()` from service.
- **System Log panel** — Kea logs to file/stdout, not exposed via API. Remove the `SYSTEM LOG` panel and related state.
- **Change Password** — No backend auth. Remove `SettingsComponent` form (or replace with a static info page showing nginx/network info). Decision: remove the entire SettingsComponent and its route.
- **JWT, WebSocket, AuthInterceptor** — All deleted with backend.

---

## Field Mapping

Kea `config-get` returns a `Dhcp4` object. Fields mapped to existing `DHCPConfig`:

| Frontend field | Kea path |
|---|---|
| `serverIp` | `subnet4[0].relay.ip-addresses[0]` or computed from interface |
| `subnetMask` | derived from `subnet4[0].subnet` (CIDR) |
| `router` | `subnet4[0].option-data` where `name = "routers"` |
| `dns` | `subnet4[0].option-data` where `name = "domain-name-servers"` |
| `poolStart` / `poolEnd` | `subnet4[0].pools[0].pool` (format: `"start - end"`) |
| `leaseTime` | `subnet4[0].valid-lifetime` |

Kea `lease4-get-all` returns `leases[]` with: `ip-address`, `hw-address`, `hostname`, `cltt` (client last transmission time), `valid-lft`. Mapped to `Lease`:
- `ip` ← `ip-address`
- `mac` ← `hw-address`
- `hostname` ← `hostname`
- `assignedAt` ← `new Date(cltt * 1000).toISOString()`
- `expiry` ← `new Date((cltt + valid-lft) * 1000).toISOString()`

Pool stats derived in service: `total = pool size`, `used = leases.length`, `available = total - used`.

---

## File Changes

### Created
- `kea/kea-dhcp4.conf` — initial DHCP config (subnet, pool, lease time, control socket path)
- `kea/kea-ctrl-agent.conf` — exposes HTTP listener on `0.0.0.0:8000`, control socket pointer
- `docs/superpowers/specs/2026-05-02-kea-backend-migration-design.md` — this file

### Replaced
- `docker-compose.yml` — three services: `kea-dhcp4`, `kea-ctrl-agent`, `frontend`. Named volumes for `kea-data` and `kea-sockets`.
- `frontend/nginx.conf` — `/api` proxies POST to `http://kea-ctrl-agent:8000/`. Remove `/ws` block.
- `frontend/src/app/services/dhcp.service.ts` — sends Kea commands, polls every 5s, removes WebSocket logic.
- `frontend/src/app/services/auth.service.ts` — simple password check against `environment.adminPassword`.
- `frontend/src/app/guards/auth.guard.ts` — checks `localStorage['dhcp_authed']`.
- `frontend/src/app/dashboard/dashboard.component.html` — remove `CONFLICT DETECTION` and `SYSTEM LOG` panels.
- `frontend/src/app/dashboard/dashboard.component.ts` — remove conflict/log state, switch to polling subscription.
- `frontend/src/app/pool/pool.component.ts` — switch from WebSocket to polling subscription.
- `frontend/src/app/app-routing.module.ts` — remove `/settings` route.
- `frontend/src/app/app.module.ts` — remove `SettingsComponent`, `HTTP_INTERCEPTORS`, `AuthInterceptor`.
- `frontend/src/environments/environment.ts` — add `adminPassword` and `pollIntervalMs`. Remove `apiUrl` (use relative `/api`). Remove `wsUrl`.

### Deleted
- `backend/` — entire directory
- `.env` and `.env.example` — backend-only config
- `frontend/src/app/interceptors/auth.interceptor.ts`
- `frontend/src/app/settings/` — entire directory
- `frontend/src/app/layout/layout.component.html` — remove `SETTINGS` nav link
- `frontend/proxy.conf.json` — proxy now happens in nginx; for `ng serve` dev, update to point to `kea-ctrl-agent` or document running compose stack

---

## Kea Configuration

### `kea/kea-dhcp4.conf` (template)
```json
{
  "Dhcp4": {
    "interfaces-config": { "interfaces": [ "*" ] },
    "control-socket": {
      "socket-type": "unix",
      "socket-name": "/run/kea/kea4-ctrl-socket"
    },
    "lease-database": {
      "type": "memfile",
      "persist": true,
      "name": "/var/lib/kea/dhcp4.leases"
    },
    "valid-lifetime": 86400,
    "subnet4": [{
      "id": 1,
      "subnet": "192.168.1.0/24",
      "pools": [{ "pool": "192.168.1.100 - 192.168.1.200" }],
      "option-data": [
        { "name": "routers", "data": "192.168.1.1" },
        { "name": "domain-name-servers", "data": "8.8.8.8, 8.8.4.4" }
      ]
    }]
  }
}
```

### `kea/kea-ctrl-agent.conf`
```json
{
  "Control-agent": {
    "http-host": "0.0.0.0",
    "http-port": 8000,
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

## CORS / Proxy

The frontend never calls `kea-ctrl-agent` directly across origins. nginx proxies `/api/*` to `http://kea-ctrl-agent:8000/`, stripping the `/api` prefix. Kea Control Agent accepts POST at `/`.

---

## Out of Scope

- HTTPS termination (assumed handled upstream if needed)
- Multi-user auth, role-based access
- High availability or Kea HA failover config
- Logs UI (deferred — could later read `/var/log/kea/` via a dedicated sidecar)
