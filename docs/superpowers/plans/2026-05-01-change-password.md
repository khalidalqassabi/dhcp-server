# Change Password Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the admin to change their password from `/settings`, persisted in `data/credentials.json`, with immediate invalidation of all sessions via a `passwordVersion` counter in JWT tokens.

**Architecture:** Backend stores credentials in a JSON file (atomic write) and embeds `passwordVersion` in every token. `requireAuth` rejects tokens whose version is stale. A simple in-memory rate limiter (no new dependency) blocks brute-force on the change-password endpoint. The Angular `/settings` page handles the form with a live strength indicator and redirects to login on success.

**Tech Stack:** Node.js (fs, path — stdlib), bcryptjs (already present), jsonwebtoken (already present), Angular 16 ReactiveFormsModule (already imported).

---

## Note on Tests

No test suite is configured (see CLAUDE.md). Verification steps use `curl` for backend and Angular build + browser for frontend.

---

## File Map

| File | Change |
|------|--------|
| `backend/server.js` | Add `fs`/`path`, `loadCredentials()`, `saveCredentials()`, rate limiter, updated `requireAuth`, updated login, new change-password endpoint |
| `docker-compose.yml` | Add `backend-data` named volume |
| `frontend/src/app/services/auth.service.ts` | Add `changePassword()` method |
| `frontend/src/app/app.module.ts` | Declare `SettingsComponent` |
| `frontend/src/app/app-routing.module.ts` | Add `/settings` route |
| `frontend/src/app/settings/settings.component.ts` | New — form logic + password strength |
| `frontend/src/app/settings/settings.component.html` | New — settings page template |
| `frontend/src/app/settings/settings.component.css` | New — page styles |
| `frontend/src/app/dashboard/dashboard.component.html` | Add SETTINGS button to topbar |

---

### Task 1: Backend — credentials persistence + updated auth

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Replace the top of `backend/server.js` with the new version**

Replace the entire content of `backend/server.js` with:

```javascript
const express    = require('express');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const http       = require('http');
const WebSocket  = require('ws');
const fs         = require('fs');
const path       = require('path');
const DHCPServer = require('./dhcp/server');
const { detectConflicts } = require('./dhcp/detector');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const JWT_SECRET = process.env.JWT_SECRET || 'dhcp-secret-change-in-prod';
const PORT       = process.env.PORT || 3000;
const CREDS_PATH = path.join(__dirname, 'data', 'credentials.json');

// ── Credentials persistence ────────────────────────────────────────────────────
function loadCredentials() {
  try {
    return JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  } catch {
    const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 12);
    const initial = { passwordHash, passwordVersion: 1 };
    saveCredentials(initial);
    return initial;
  }
}

function saveCredentials(data) {
  fs.mkdirSync(path.dirname(CREDS_PATH), { recursive: true });
  const tmp = CREDS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
  fs.renameSync(tmp, CREDS_PATH);
}

let creds = loadCredentials();

// ── Rate limiter (change-password brute-force protection) ──────────────────────
const rateLimiter = { failCount: 0, lockedUntil: 0 };

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.passwordVersion !== creds.passwordVersion)
      return res.status(401).json({ error: 'Session expired, please log in again' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── DHCP server instance ───────────────────────────────────────────────────────
const dhcp = new DHCPServer({
  serverIp:   process.env.SERVER_IP   || '192.168.1.1',
  subnetMask: process.env.SUBNET_MASK || '255.255.255.0',
  router:     process.env.ROUTER      || '192.168.1.1',
  dns:        (process.env.DNS || '8.8.8.8,8.8.4.4').split(','),
  poolStart:  process.env.POOL_START  || '192.168.1.100',
  poolEnd:    process.env.POOL_END    || '192.168.1.200',
  leaseTime:  parseInt(process.env.LEASE_TIME || '86400', 10)
});

// ── WebSocket broadcast ────────────────────────────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

dhcp.on('log',         entry  => broadcast({ type: 'log',    data: entry }));
dhcp.on('leaseUpdate', leases => broadcast({ type: 'leases', data: leases }));
dhcp.on('started',     ()     => broadcast({ type: 'status', data: { running: true  } }));
dhcp.on('stopped',     ()     => broadcast({ type: 'status', data: { running: false } }));

wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url?.split('?')[1]);
  const token  = params.get('token');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.passwordVersion !== creds.passwordVersion)
      return ws.close(1008, 'Session expired');
    ws.send(JSON.stringify({ type: 'connected', data: dhcp.getStatus() }));
  } catch {
    ws.close(1008, 'Unauthorized');
  }
});

// ── REST routes ────────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'username and password required' });

  if (username !== 'admin' || !bcrypt.compareSync(password, creds.passwordHash))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { username, passwordVersion: creds.passwordVersion },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.json({ token, username });
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  if (Date.now() < rateLimiter.lockedUntil) {
    const retryAfter = Math.ceil((rateLimiter.lockedUntil - Date.now()) / 1000);
    return res.status(429).json({
      error: `Too many failed attempts. Try again in ${retryAfter} seconds.`
    });
  }

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'currentPassword and newPassword required' });
  if (newPassword.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters' });

  if (!bcrypt.compareSync(currentPassword, creds.passwordHash)) {
    rateLimiter.failCount++;
    if (rateLimiter.failCount >= 5)
      rateLimiter.lockedUntil = Date.now() + 15 * 60 * 1000;
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  creds = {
    passwordHash:    bcrypt.hashSync(newPassword, 12),
    passwordVersion: creds.passwordVersion + 1,
  };
  saveCredentials(creds);
  rateLimiter.failCount  = 0;
  rateLimiter.lockedUntil = 0;
  res.json({ success: true });
});

app.get('/api/dhcp/status', requireAuth, (_req, res) => {
  res.json(dhcp.getStatus());
});

app.post('/api/dhcp/start', requireAuth, async (_req, res) => {
  try {
    await dhcp.start();
    res.json({ success: true, message: 'DHCP server started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dhcp/stop', requireAuth, async (_req, res) => {
  try {
    await dhcp.stop();
    res.json({ success: true, message: 'DHCP server stopped' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dhcp/detect', requireAuth, async (_req, res) => {
  try {
    const result = await detectConflicts(dhcp.config.serverIp);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/dhcp/config', requireAuth, async (req, res) => {
  try {
    await dhcp.updateConfig(req.body);
    res.json({ success: true, config: dhcp.config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/dhcp/leases/:mac', requireAuth, (req, res) => {
  dhcp.pool.release(decodeURIComponent(req.params.mac));
  broadcast({ type: 'leases', data: dhcp.pool.getLeases() });
  res.json({ success: true });
});

// ── Start HTTP/WS server ───────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n┌─────────────────────────────────────────────┐`);
  console.log(`│  DHCP Server API running on port ${PORT}        │`);
  console.log(`│  Default credentials: admin / admin123       │`);
  console.log(`│  ⚠️  Binding UDP port 67 requires sudo/root  │`);
  console.log(`└─────────────────────────────────────────────┘\n`);
});
```

- [ ] **Step 2: Verify the backend starts without errors**

```bash
cd "/Users/khalidalqassabi/DHCP server/backend"
node server.js
```

Expected: prints the startup banner, creates `data/credentials.json`. Press Ctrl+C to stop.

- [ ] **Step 3: Verify credentials file was created**

```bash
cat "/Users/khalidalqassabi/DHCP server/backend/data/credentials.json"
```

Expected output (hash will differ):
```json
{"passwordHash":"$2a$12$...","passwordVersion":1}
```

- [ ] **Step 4: Verify login returns a token with passwordVersion**

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -m json.tool
```

Expected: JSON with `token` field. Decode the middle section of the token (base64):
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool
```

Expected: `"passwordVersion": 1` in the payload.

- [ ] **Step 5: Commit**

```bash
cd "/Users/khalidalqassabi/DHCP server"
git add backend/server.js
git commit -m "feat(backend): add credentials persistence, passwordVersion, change-password endpoint"
```

---

### Task 2: Docker — add backend-data volume

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add volume to docker-compose.yml**

In `docker-compose.yml`, add `volumes:` under `dhcp-backend` and a top-level `volumes:` block.

Find the `dhcp-backend` service block. After the `networks:` line of that service, add:

```yaml
    volumes:
      - backend-data:/app/data
```

Then at the very end of the file, after the existing `networks:` block, add:

```yaml
volumes:
  backend-data:
```

The final `docker-compose.yml` should look like:

```yaml
services:

  dhcp-backend:
    build: ./backend
    container_name: dhcp-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
      - "67:67/udp"
    cap_add:
      - NET_ADMIN
      - NET_RAW
    env_file:
      - .env
    environment:
      - PORT=3000
      - SERVER_IP=${SERVER_IP:-192.168.1.1}
      - SUBNET_MASK=${SUBNET_MASK:-255.255.255.0}
      - ROUTER=${ROUTER:-192.168.1.1}
      - DNS=${DNS:-8.8.8.8,8.8.4.4}
      - POOL_START=${POOL_START:-192.168.1.100}
      - POOL_END=${POOL_END:-192.168.1.200}
      - LEASE_TIME=${LEASE_TIME:-86400}
    healthcheck:
      test: ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3000/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))\""]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    volumes:
      - backend-data:/app/data
    networks:
      - dhcp-net

  dhcp-frontend:
    build: ./frontend
    container_name: dhcp-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      dhcp-backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:80"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "5m"
        max-file: "2"
    networks:
      - dhcp-net

networks:
  dhcp-net:
    driver: bridge

volumes:
  backend-data:
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/khalidalqassabi/DHCP server"
git add docker-compose.yml
git commit -m "feat(docker): add backend-data volume for credentials persistence"
```

---

### Task 3: Frontend — AuthService + Module + Routing

**Files:**
- Modify: `frontend/src/app/services/auth.service.ts`
- Modify: `frontend/src/app/app.module.ts`
- Modify: `frontend/src/app/app-routing.module.ts`

- [ ] **Step 1: Add `changePassword()` to AuthService**

Open `frontend/src/app/services/auth.service.ts`. Add this method inside the class, after `isLoggedIn()`:

```typescript
  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post<{ success: boolean }>(
      `${environment.apiUrl}/auth/change-password`,
      { currentPassword, newPassword }
    );
  }
```

- [ ] **Step 2: Add `/settings` route to AppRoutingModule**

Replace the content of `frontend/src/app/app-routing.module.ts` with:

```typescript
import { NgModule }             from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent }       from './login/login.component';
import { DashboardComponent }   from './dashboard/dashboard.component';
import { SettingsComponent }    from './settings/settings.component';
import { authGuard }            from './guards/auth.guard';

const routes: Routes = [
  { path: '',         redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login',    component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent,  canActivate: [authGuard] },
  { path: '**',       redirectTo: 'dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
```

- [ ] **Step 3: Declare SettingsComponent in AppModule**

Replace the content of `frontend/src/app/app.module.ts` with:

```typescript
import { NgModule }            from '@angular/core';
import { BrowserModule }       from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule }   from './app-routing.module';
import { AppComponent }       from './app.component';
import { LoginComponent }     from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { SettingsComponent }  from './settings/settings.component';
import { AuthInterceptor }    from './interceptors/auth.interceptor';

@NgModule({
  declarations: [AppComponent, LoginComponent, DashboardComponent, SettingsComponent],
  imports:      [BrowserModule, AppRoutingModule, ReactiveFormsModule, HttpClientModule],
  providers:    [{ provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }],
  bootstrap:    [AppComponent]
})
export class AppModule {}
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/khalidalqassabi/DHCP server"
git add frontend/src/app/services/auth.service.ts \
        frontend/src/app/app-routing.module.ts \
        frontend/src/app/app.module.ts
git commit -m "feat(frontend): add changePassword(), settings route, declare SettingsComponent"
```

---

### Task 4: Frontend — SettingsComponent (3 files)

**Files:**
- Create: `frontend/src/app/settings/settings.component.ts`
- Create: `frontend/src/app/settings/settings.component.html`
- Create: `frontend/src/app/settings/settings.component.css`

- [ ] **Step 1: Create `settings.component.ts`**

```typescript
import { Component }      from '@angular/core';
import { FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService }    from '../services/auth.service';

@Component({
  selector:    'app-settings',
  templateUrl: './settings.component.html',
  styleUrls:   ['./settings.component.css']
})
export class SettingsComponent {
  loading  = false;
  success  = false;
  errorMsg = '';

  form = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword:     ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: this.passwordsMatch }
  );

  constructor(private fb: FormBuilder, public auth: AuthService) {}

  private passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const np = group.get('newPassword')?.value;
    const cp = group.get('confirmPassword')?.value;
    return np && cp && np !== cp ? { mismatch: true } : null;
  }

  passwordStrength(pw: string): 'weak' | 'fair' | 'strong' {
    if (!pw || pw.length < 8) return 'weak';
    if (
      pw.length >= 12 &&
      /[A-Z]/.test(pw) &&
      /[a-z]/.test(pw) &&
      /[0-9]/.test(pw)
    ) return 'strong';
    if (/[0-9]/.test(pw) || /[^a-zA-Z0-9]/.test(pw)) return 'fair';
    return 'weak';
  }

  get strengthLabel(): string {
    return this.passwordStrength(this.form.get('newPassword')?.value ?? '').toUpperCase();
  }

  get newPasswordValue(): string {
    return this.form.get('newPassword')?.value ?? '';
  }

  submit() {
    if (this.form.invalid || this.loading || this.success) return;
    this.loading  = true;
    this.errorMsg = '';
    const { currentPassword, newPassword } = this.form.value;
    this.auth.changePassword(currentPassword!, newPassword!).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        setTimeout(() => this.auth.logout(), 2000);
      },
      error: (e) => {
        this.loading  = false;
        this.errorMsg = e.error?.error || 'An error occurred';
      }
    });
  }
}
```

- [ ] **Step 2: Create `settings.component.html`**

```html
<!-- ── Top bar ────────────────────────────────────────────────────────── -->
<header class="topbar">
  <div class="topbar-left">
    <span class="topbar-logo">
      <span class="logo-bracket">[</span>⬡<span class="logo-bracket">]</span>
    </span>
    <span class="topbar-title">DHCP CONTROL</span>
    <span class="topbar-sep">·</span>
    <span style="font-size:0.8rem;color:var(--text-dim);letter-spacing:0.12em">
      ACCOUNT SETTINGS
    </span>
  </div>
  <div class="topbar-right">
    <button class="pbtn pbtn-ghost pbtn-sm" routerLink="/dashboard">
      <i class="bi bi-arrow-left"></i> BACK
    </button>
    <button class="pbtn pbtn-ghost pbtn-sm" (click)="auth.logout()">
      <i class="bi bi-box-arrow-right"></i> LOGOUT
    </button>
  </div>
</header>

<!-- ── Settings panel ─────────────────────────────────────────────────── -->
<div class="settings-wrap">
  <div class="panel settings-panel">
    <div class="panel-head">
      <span><i class="bi bi-shield-lock panel-head-icon"></i>CHANGE PASSWORD</span>
    </div>
    <div class="panel-body">

      <div *ngIf="success" class="alert-ok mb-3">
        <div class="alert-tag-ok">✓ SUCCESS</div>
        Password changed — redirecting to login…
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()">

        <div class="field">
          <label class="field-label">Current Password</label>
          <input type="password"
                 formControlName="currentPassword"
                 class="field-input"
                 autocomplete="current-password"
                 placeholder="Enter current password">
        </div>

        <div class="field">
          <label class="field-label">New Password</label>
          <input type="password"
                 formControlName="newPassword"
                 class="field-input"
                 autocomplete="new-password"
                 placeholder="Minimum 8 characters">
          <div *ngIf="newPasswordValue" class="strength-wrap mt-2">
            <div class="strength-track">
              <div class="strength-fill" [class]="'strength-' + passwordStrength(newPasswordValue)"></div>
            </div>
            <span class="strength-label"
                  [class]="'strength-text-' + passwordStrength(newPasswordValue)">
              {{ strengthLabel }}
            </span>
          </div>
        </div>

        <div class="field">
          <label class="field-label">Confirm New Password</label>
          <input type="password"
                 formControlName="confirmPassword"
                 class="field-input"
                 autocomplete="new-password"
                 placeholder="Repeat new password">
          <div *ngIf="form.hasError('mismatch') && form.get('confirmPassword')?.dirty"
               class="field-error">
            Passwords do not match
          </div>
        </div>

        <div *ngIf="errorMsg" class="alert-conflict mt-3">
          <div class="alert-tag-red">ERROR</div>
          {{ errorMsg }}
        </div>

        <div class="mt-4">
          <button type="submit"
                  class="pbtn pbtn-amber w-full"
                  [disabled]="form.invalid || loading || success">
            <span *ngIf="loading"  class="spin"></span>
            <i    *ngIf="!loading" class="bi bi-key"></i>
            {{ loading ? 'SAVING…' : 'CHANGE PASSWORD' }}
          </button>
        </div>

      </form>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Create `settings.component.css`**

```css
.settings-wrap {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 48px 16px;
  min-height: calc(100vh - 48px);
}

.settings-panel {
  width: 100%;
  max-width: 480px;
}

/* ── Strength bar ──────────────────────────────────────────── */
.strength-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.strength-track {
  flex: 1;
  height: 4px;
  background: var(--border);
}

.strength-fill {
  height: 100%;
  transition: width 0.3s ease, background 0.3s ease;
}

.strength-weak   { width: 33%;  background: var(--red);   box-shadow: 0 0 6px rgba(232,64,64,0.5); }
.strength-fair   { width: 66%;  background: var(--amber); box-shadow: 0 0 6px rgba(221,184,58,0.5); }
.strength-strong { width: 100%; background: var(--green); box-shadow: 0 0 6px rgba(61,232,154,0.5); }

.strength-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  flex-shrink: 0;
  min-width: 44px;
}

.strength-text-weak   { color: var(--red); }
.strength-text-fair   { color: var(--amber); }
.strength-text-strong { color: var(--green); }

/* ── Validation error ──────────────────────────────────────── */
.field-error {
  font-size: 0.72rem;
  color: var(--red);
  margin-top: 5px;
  letter-spacing: 0.06em;
}
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/khalidalqassabi/DHCP server"
git add frontend/src/app/settings/
git commit -m "feat(settings): add SettingsComponent with password strength indicator"
```

---

### Task 5: Frontend — Dashboard topbar SETTINGS button

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard.component.html`

- [ ] **Step 1: Add SETTINGS button to topbar**

In `dashboard.component.html`, find this line:

```html
    <button class="pbtn pbtn-ghost pbtn-sm" (click)="auth.logout()">
```

Insert the SETTINGS button **before** it:

```html
    <button class="pbtn pbtn-ghost pbtn-sm" routerLink="/settings">
      <i class="bi bi-gear"></i> SETTINGS
    </button>
```

- [ ] **Step 2: Build to verify no TypeScript/template errors**

```bash
cd "/Users/khalidalqassabi/DHCP server/frontend"
npx ng build --configuration development 2>&1 | tail -15
```

Expected: `Browser application bundle generation complete.` with no errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/khalidalqassabi/DHCP server"
git add frontend/src/app/dashboard/dashboard.component.html
git commit -m "feat(dashboard): add SETTINGS button to topbar"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Restart Docker with the new backend**

```bash
cd "/Users/khalidalqassabi/DHCP server"
docker compose up --build -d 2>&1 | tail -10
```

Expected: both containers start, backend healthy.

- [ ] **Step 2: Verify change-password endpoint with curl**

```bash
# Get a valid token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Change password
curl -s -X POST http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"currentPassword":"admin123","newPassword":"NewPass123!"}' | python3 -m json.tool
```

Expected: `{"success": true}`

- [ ] **Step 3: Verify old token is now rejected**

```bash
curl -s http://localhost:3000/api/dhcp/status \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected: `{"error": "Session expired, please log in again"}`

- [ ] **Step 4: Verify login works with new password**

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"NewPass123!"}' | python3 -m json.tool
```

Expected: JSON with a new `token`.

- [ ] **Step 5: Reset password back to admin123 for dev convenience**

```bash
curl -s -X POST http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(curl -s -X POST http://localhost:3000/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"NewPass123!"}' | \
    python3 -c 'import sys,json; print(json.load(sys.stdin)[\"token\"])')" \
  -d '{"currentPassword":"NewPass123!","newPassword":"admin123"}' | python3 -m json.tool
```

Expected: `{"success": true}`

- [ ] **Step 6: Browser test**

Open http://localhost — log in → click SETTINGS in topbar → fill form → click CHANGE PASSWORD → verify redirect to login page.

- [ ] **Step 7: Test rate limiter**

```bash
TOKEN2=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

for i in 1 2 3 4 5 6; do
  echo "Attempt $i:"
  curl -s -X POST http://localhost:3000/api/auth/change-password \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN2" \
    -d '{"currentPassword":"wrong","newPassword":"NewPass123!"}' | python3 -m json.tool
done
```

Expected: attempts 1-4 return `{"error": "Current password is incorrect"}`, attempt 5 onwards returns `{"error": "Too many failed attempts. Try again in ... seconds."}`.
