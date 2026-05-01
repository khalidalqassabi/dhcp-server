# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Two separate packages: a Node.js DHCP backend and an Angular frontend.

```
backend/          Node.js Express API + DHCP server (UDP port 67)
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
    services/     auth.service.ts, dhcp.service.ts (WebSocket + REST)
    guards/       authGuard (JWT expiry check)
    interceptors/ AuthInterceptor (attaches Bearer token)
```

## Running the Project

### Backend
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

### Data flow
`DHCPServer` (`backend/dhcp/server.js`) extends `EventEmitter` and emits four events: `log`, `leaseUpdate`, `started`, `stopped`. The Express layer (`backend/server.js`) subscribes to these and broadcasts them to all connected WebSocket clients via `broadcast()`.

WebSocket messages follow a typed envelope: `{ type: 'connected' | 'status' | 'leases' | 'log', data: ... }`. On connection the server sends `connected` with the full `getStatus()` snapshot; subsequent updates are incremental (`status` for running state, `leases` for lease list, `log` for individual log entries). The frontend's `DhcpService.messages$` is a plain `Subject` — components subscribe directly and must unsubscribe on destroy.

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
