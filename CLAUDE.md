# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Node.js Express API frontend talks to Kea DHCP server via Kea Control Agent. Angular SPA is the admin UI.

```
kea/
  kea-dhcp4.conf          Kea DHCP4 server config (MySQL lease/host DB, hooks)
  kea-ctrl-agent.conf     Kea Control Agent (HTTP API at 127.0.0.1:8000, Basic auth)

backend/          Node.js Express API + WebSocket server (legacy — being replaced by Kea)
  dhcp/
    packet.js     RFC 2131/2132 packet parser & builder
    pool.js       IP address pool and lease tracking
    server.js     DHCPServer EventEmitter class
    detector.js   Conflict detection — 4-strategy fallback chain
  server.js       Express HTTP API + WebSocket server

frontend/         Angular 16 SPA
  src/app/
    login/        Login page
    dashboard/    Main admin panel (status, controls, leases, logs)
    services/     auth.service.ts, dhcp.service.ts, kea.service.ts
    guards/       authGuard (JWT expiry check)
    interceptors/ AuthInterceptor (JWT Bearer), KeaInterceptor (Basic auth to Kea)
```

## Installing MySQL (Ubuntu)

```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl enable --now mysql
sudo mysql_secure_installation   # set root password, remove test DB
```

### Create Kea database and user
```sql
-- run as: sudo mysql
CREATE DATABASE kea;
CREATE USER 'kea'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON kea.* TO 'kea'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Initialize Kea schema
```bash
sudo kea-admin db-init mysql -u kea -p REPLACE_WITH_STRONG_PASSWORD -n kea
```
`kea-admin` ships with the `kea` package and applies the correct DDL for leases, hosts, and config tables.

Update the three `password` fields in `kea/kea-dhcp4.conf` with the password used above.

---

## Installing Kea (Ubuntu)

```bash
sudo apt update
sudo apt install kea
```

**Do not** use the ISC CloudSmith repo — requires paid subscription. `apt` provides free open-source build.

Hook library paths in `kea/kea-dhcp4.conf` (`/usr/lib/x86_64-linux-gnu/kea/hooks/...`) are correct for Ubuntu x86_64. On ARM64 Ubuntu, replace with `/usr/lib/aarch64-linux-gnu/kea/hooks/`.

## Running the Project

### Kea DHCP4 server
```bash
sudo kea-dhcp4 -c /path/to/DHCP\ server/kea/kea-dhcp4.conf
```
Requires root — binds UDP port 67.

### Kea Control Agent
```bash
kea-ctrl-agent -c /path/to/DHCP\ server/kea/kea-ctrl-agent.conf
```
Listens on `127.0.0.1:8000`. Credentials in `kea-ctrl-agent.conf` under `clients`.

### Backend (legacy Node.js)
```bash
cd backend
npm install
sudo node server.js        # sudo required — DHCP binds UDP port 67
npm run dev                # nodemon watch mode (also requires sudo)
```

Default credentials: `admin` / `admin123`  
All env vars: `ADMIN_PASSWORD`, `JWT_SECRET`, `PORT`, `SERVER_IP`, `SUBNET_MASK`, `ROUTER`, `DNS`, `POOL_START`, `POOL_END`, `LEASE_TIME`.

### Frontend
```bash
cd frontend
npm install
npm start                  # ng serve with proxy to localhost:3000
npm run build              # production build → dist/
```
Open http://localhost:4200. There is no test suite configured in either package.

## Architecture Notes

### Kea data flow
Angular's `KeaService` sends JSON commands to Kea Control Agent (`127.0.0.1:8000`) via HTTP POST to `/api/`. `KeaInterceptor` attaches `Authorization: Basic <token>` to every request. Kea Control Agent forwards commands over a Unix socket (`/run/kea/kea4-ctrl-socket`) to `kea-dhcp4`.

Kea command envelope:
```json
{ "command": "<cmd>", "service": ["dhcp4"], "arguments": { ... } }
```
Response is an array; `result: 0` = success, `result: 3` = empty (not an error). `KeaService.command()` throws on any other result code.

Frontend polls Kea for leases/stats on an interval (`pollIntervalMs` from `environment.ts`) — no WebSocket push from Kea.

### Legacy Node.js data flow
`DHCPServer` (`backend/dhcp/server.js`) extends `EventEmitter` and emits four events: `log`, `leaseUpdate`, `started`, `stopped`. The Express layer (`backend/server.js`) subscribes to these and broadcasts them to all connected WebSocket clients via `broadcast()`.

WebSocket messages follow a typed envelope: `{ type: 'connected' | 'status' | 'leases' | 'log', data: ... }`. On connection the server sends `connected` with the full `getStatus()` snapshot; subsequent updates are incremental. The frontend's `DhcpService.messages$` is a plain `Subject` — components subscribe directly and must unsubscribe on destroy.

### REST API surface
All routes except `POST /api/auth/login` require a `Bearer <token>` header.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Returns JWT (24 h expiry) |
| GET | `/api/dhcp/status` | Full status snapshot |
| POST | `/api/dhcp/start` | Start DHCP server |
| POST | `/api/dhcp/stop` | Stop DHCP server |
| POST | `/api/dhcp/detect` | Run conflict detection |
| PUT | `/api/dhcp/config` | Update config (stops + restarts if running) |
| DELETE | `/api/dhcp/leases/:mac` | Release a lease by MAC |

### IP pool allocation order
`pool.js` tries: (1) renew existing lease for the MAC, (2) honor the client's requested IP if free and in range, (3) next available IP from pool start. Expired leases are cleaned lazily on every `getLeases()` / `getStats()` call — there is no background timer.

### Conflict detection strategy chain
`detector.js` tries four strategies in order, returning on first success:
1. UDP broadcast DISCOVER on port 68 — most accurate, needs root
2. `nmap --script broadcast-dhcp-discover` — requires nmap installed
3. `dhcping` — requires dhcping installed
4. `ss`/`netstat` port-67 check — only detects local processes

If all strategies fail (e.g. permission denied, Docker bridge), the result includes a `warning` string explaining why the scan may be inaccurate.

### Auth
JWT tokens are stored in `localStorage` under key `dhcp_token`. `AuthService.isLoggedIn()` decodes the JWT payload client-side to check `exp` — no server round-trip. The WebSocket connection passes the token as a query param (`?token=...`); the server validates it on upgrade and closes with code 1008 on failure.

### Key constraints
- Binding UDP port 67 requires root/sudo on Linux and macOS. Conflict detection (port 68) has the same requirement.
- `updateConfig()` stops and restarts the DHCP server and recreates the IP pool, discarding all current leases.
- The backend keeps at most 300 log entries in memory; the dashboard caps the displayed list at 200.
- The dev proxy (`frontend/proxy.conf.json`) forwards `/api` to `localhost:3000`. The WebSocket URL is hardcoded to `ws://localhost:3000` in `environment.ts` and must be changed for production.
