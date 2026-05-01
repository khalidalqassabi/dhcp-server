# Pool Page & Collapsible Sidebar — Design Spec

## Overview

Add a new **POOL** page that houses IP pool statistics and device analytics charts, currently living in the Dashboard. Replace the per-page topbar with a shared collapsible sidebar navigation.

---

## Architecture

### Shared Layout Shell

Create `AppLayoutComponent` as a shell that renders the sidebar + `<router-outlet>`. All authenticated pages are children of this layout.

**Routing structure:**
```
/login        → LoginComponent          (no layout, standalone)
/             → redirect → /dashboard
/dashboard    → AppLayoutComponent > DashboardComponent
/pool         → AppLayoutComponent > PoolComponent
/settings     → AppLayoutComponent > SettingsComponent
**            → redirect → /dashboard
```

`authGuard` moves from individual routes to the `AppLayoutComponent` route so it applies to all children automatically.

---

## New Files

| File | Purpose |
|------|---------|
| `app/layout/layout.component.ts` | Shell component — holds sidebar state |
| `app/layout/layout.component.html` | Sidebar markup + `<router-outlet>` |
| `app/layout/layout.component.css` | Sidebar styles |
| `app/pool/pool.component.ts` | Pool page — subscribes to DhcpService |
| `app/pool/pool.component.html` | Pool stats + charts markup |
| `app/pool/pool.component.css` | Pool page styles |

---

## Sidebar

**Open state (220px):** Logo + label, nav links with text, logout button.  
**Collapsed state (56px):** Icons only, no text. Toggle button always visible.

Nav items:
- `bi-speedometer2` DASHBOARD → `/dashboard`
- `bi-hdd-stack` POOL → `/pool`
- `bi-gear` SETTINGS → `/settings`
- `bi-box-arrow-right` LOGOUT (bottom, calls `auth.logout()`)

Collapsed state persisted in `localStorage` key `dhcp_sidebar_collapsed`.

---

## POOL Page

**Content moved from Dashboard:**
- Stats row: TOTAL IPS · IN USE · AVAIL (with pool-bars)
- POOL UTILIZATION progress bar
- DEVICE ANALYTICS panel: Donut (by manufacturer) + Bar chart (by device type)

**Data source:** Same `DhcpService` WebSocket — `stats` and `leases` observables. No backend changes.

---

## Dashboard Changes

Remove from `dashboard.component.html`:
- `<div class="stats-row">` block
- `<div class="util-bar">` block  
- `<div class="panel area-charts">` block

Remove corresponding CSS from `dashboard.component.css` and unused TS properties/methods from `dashboard.component.ts` if they become exclusive to the pool page.

---

## Topbar Removal

The `<header class="topbar">` currently duplicated in `dashboard.component.html` and `settings.component.html` is removed from both. The sidebar replaces it entirely.

---

## CSS Layout

```
body / app-root
└── router-outlet
    ├── login (full screen, no sidebar)
    └── app-layout
        ├── .sidebar (fixed left, 220px or 56px)
        └── .main-content (margin-left matches sidebar width, transitions on collapse)
            └── router-outlet (dashboard / pool / settings)
```

The `.main-content` uses `margin-left` transition matching the sidebar width toggle to avoid content jump.
