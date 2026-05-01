# Change Password Feature — Design Spec
**Date:** 2026-05-01  
**Status:** Approved

---

## Overview

Allow the admin user to change their password from a dedicated `/settings` page. The new password persists across Docker restarts via `data/credentials.json`. All active sessions are invalidated immediately using a `passwordVersion` counter embedded in JWT tokens.

---

## 1. Threat Model & Security Measures

| Threat | Mitigation |
|--------|-----------|
| Attacker reuses a stolen token after password change | `passwordVersion` in token must match current value; mismatch → 401 |
| Brute-force on `currentPassword` field | In-memory rate limiter: 5 failed attempts → 15-minute lockout |
| Weak new password | Server-side: minimum 8 characters; client-side: strength indicator |
| currentPassword bypassed | bcrypt.compareSync check required before any hash update |
| Credentials file missing | Auto-created from `ADMIN_PASSWORD` env var on first startup |
| Credentials file tampered | Hash verified by bcrypt on every login — tampering produces wrong hash → login fails |

---

## 2. Backend Changes

### 2.1 `data/credentials.json` (new file, git-ignored)

```json
{ "passwordHash": "<bcrypt hash>", "passwordVersion": 1 }
```

- Created automatically on first startup if missing, using `ADMIN_PASSWORD` env var (default `admin123`).
- Written atomically: write to `data/credentials.tmp` → `fs.renameSync` to `data/credentials.json`.
- `data/` directory is mounted as a Docker volume so changes persist.

### 2.2 Startup logic in `backend/server.js`

```
loadCredentials():
  if data/credentials.json exists → parse and return
  else → hash ADMIN_PASSWORD, write { passwordHash, passwordVersion: 1 }, return
```

`ADMIN` object is replaced by `loadCredentials()` call. The returned object is held in a module-level `let creds` variable so it can be updated without restarting.

### 2.3 `requireAuth` middleware — updated

After `jwt.verify` succeeds, add:
```
if (decoded.passwordVersion !== creds.passwordVersion)
  return res.status(401).json({ error: 'Session expired, please log in again' })
```

### 2.4 `POST /api/auth/login` — updated

Token payload gains `passwordVersion`:
```js
jwt.sign({ username, passwordVersion: creds.passwordVersion }, JWT_SECRET, { expiresIn: '24h' })
```

### 2.5 `POST /api/auth/change-password` (new endpoint)

**Auth:** `requireAuth` (valid token + correct passwordVersion required)

**Request body:**
```json
{ "currentPassword": "...", "newPassword": "..." }
```

**Validation:**
1. `currentPassword` and `newPassword` present → 400 if missing
2. `newPassword.length >= 8` → 400 if too short
3. `bcrypt.compareSync(currentPassword, creds.passwordHash)` → 401 if wrong (increments fail counter)
4. Rate limit: `failCount >= 5` within 15 min window → 429 with `retryAfter` seconds

**On success:**
1. Hash `newPassword` with bcrypt (saltRounds = 12)
2. Increment `creds.passwordVersion`
3. Write new credentials atomically to `data/credentials.json`
4. Update in-memory `creds`
5. Reset fail counter
6. Return `{ success: true }`

**Rate limiter (in-memory, no library):**
```js
const rateLimiter = { failCount: 0, lockedUntil: 0 };
```
- On each failed attempt: `failCount++`; if `failCount >= 5`: set `lockedUntil = Date.now() + 15*60*1000`
- On each request: if `Date.now() < lockedUntil` → 429
- On successful change: reset `failCount = 0`, `lockedUntil = 0`

### 2.6 `docker-compose.yml` — updated

Add volume for credentials persistence:
```yaml
dhcp-backend:
  volumes:
    - backend-data:/app/data

volumes:
  backend-data:
```

---

## 3. Frontend Changes

### 3.1 New files

| File | Purpose |
|------|---------|
| `frontend/src/app/settings/settings.component.ts` | Form logic, API call, password strength |
| `frontend/src/app/settings/settings.component.html` | Settings page template |
| `frontend/src/app/settings/settings.component.css` | Page styles |

### 3.2 Routing — `app-routing.module.ts`

Add route:
```ts
{ path: 'settings', component: SettingsComponent, canActivate: [authGuard] }
```

### 3.3 `AuthService` — new method

```ts
changePassword(currentPassword: string, newPassword: string) {
  return this.http.post<{ success: boolean }>(
    `${environment.apiUrl}/auth/change-password`,
    { currentPassword, newPassword }
  );
}
```

On `401` response from any API call (interceptor already attaches token): current behavior unchanged — user sees error.  
After successful `changePassword()`: component calls `auth.logout()` to clear token and redirect to `/login`.

### 3.4 Settings page layout

Single centered panel `ACCOUNT SETTINGS` matching dashboard theme:

```
[ Current Password    ] [••••••••        ]
[ New Password        ] [••••••••        ]
                         ████░░░░  FAIR
[ Confirm Password    ] [••••••••        ]

                         [ CHANGE PASSWORD ]

                         ✗ Error message here
```

**Password strength bar** (pure TS, no library):
- Weak (red): length < 8
- Fair (amber): length ≥ 8, has digit or special char
- Strong (green): length ≥ 12, has uppercase + lowercase + digit

**Client-side validation** (before API call):
- `newPassword.length >= 8`
- `newPassword === confirmPassword`

**On success:**
- Show `✓ PASSWORD CHANGED — REDIRECTING…` for 2 seconds
- Call `auth.logout()` (clears token, navigates to `/login`)

**On error:**
- Display `e.error?.error` message below the button

### 3.5 Dashboard topbar — `dashboard.component.html`

Add between existing content and LOGOUT button:
```html
<button class="pbtn pbtn-ghost pbtn-sm" routerLink="/settings">
  <i class="bi bi-gear"></i> SETTINGS
</button>
```

---

## 4. Files Changed / Created

| File | Change |
|------|--------|
| `backend/server.js` | loadCredentials(), updated requireAuth, updated login, new change-password endpoint, rate limiter |
| `backend/data/credentials.json` | Auto-created at runtime — add to `.gitignore` |
| `docker-compose.yml` | Add `backend-data` named volume |
| `frontend/src/app/settings/settings.component.ts` | New |
| `frontend/src/app/settings/settings.component.html` | New |
| `frontend/src/app/settings/settings.component.css` | New |
| `frontend/src/app/app-routing.module.ts` | Add `/settings` route |
| `frontend/src/app/app.module.ts` | Declare `SettingsComponent` |
| `frontend/src/app/services/auth.service.ts` | Add `changePassword()` |
| `frontend/src/app/dashboard/dashboard.component.html` | Add SETTINGS button in topbar |

---

## 5. Constraints

- bcrypt `saltRounds = 12` (balance between security and CPU time in container)
- Atomic file write prevents partial credentials on crash
- `passwordVersion` starts at 1; incrementing to 2 on first change invalidates all previously issued tokens
- The `data/` directory is created by Node.js if absent (`fs.mkdirSync` with `{ recursive: true }`)
- No new npm dependencies — uses only `fs`, `bcryptjs`, and `jsonwebtoken` already present
