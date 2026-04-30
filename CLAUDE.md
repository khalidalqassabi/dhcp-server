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
    detector.js   Conflict detection (broadcasts DISCOVER, listens for OFFERs)
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
```

Default credentials: `admin` / `admin123`  
Override via env vars: `ADMIN_PASSWORD`, `JWT_SECRET`, `SERVER_IP`, `POOL_START`, `POOL_END`, `LEASE_TIME`, `DNS`.

### Frontend
```bash
cd frontend
npm install
npm start                  # ng serve with proxy to localhost:3000
```
Open http://localhost:4200

## Architecture Notes

- The backend runs a real UDP DHCP server (port 67) alongside an HTTP API (port 3000). **Binding port 67 requires root/sudo** on Linux and macOS.
- The Angular frontend communicates with the backend via REST (`/api/*`) and a persistent WebSocket (`ws://localhost:3000`). Real-time lease and log updates are pushed over WebSocket — no polling.
- The proxy (`proxy.conf.json`) forwards `/api` requests to `localhost:3000` during development, avoiding CORS issues.
- `DHCPServer` in `backend/dhcp/server.js` extends `EventEmitter` and emits `log`, `leaseUpdate`, `started`, `stopped`. The Express layer (`server.js`) subscribes and broadcasts these events to all connected WebSocket clients.
- Conflict detection works by sending a broadcast DHCPDISCOVER and collecting any DHCPOFFER replies that come from a different IP than the configured `serverIp`. It requires the backend process to bind UDP port 68 (also privileged).
- JWT tokens are stored in `localStorage` and attached to every HTTP request by `AuthInterceptor`. Token expiry is checked client-side in `AuthService.isLoggedIn()`.
