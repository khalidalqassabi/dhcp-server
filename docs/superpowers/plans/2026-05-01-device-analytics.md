# Device Analytics & Leases UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an SVG device-analytics panel (manufacturer donut + device-type bars) and enrich the leases table with type icons, vendor badges, health bars, filter tabs, and a search box.

**Architecture:** Pure Angular 16 — three files modified, zero new dependencies. All chart data computed by `get` accessors on `DashboardComponent` that re-run automatically whenever `leases` is replaced by a WebSocket update. The leases table switches its `*ngFor` to a `filteredLeases` getter that applies both type-filter and search simultaneously.

**Tech Stack:** Angular 16, TypeScript, pure SVG + CSS (no charting library), Bootstrap Icons (already loaded via CDN in index.html).

---

## File Map

| File | What changes |
|------|-------------|
| `frontend/src/app/dashboard/dashboard.component.ts` | New type, constants, getters, helper methods |
| `frontend/src/app/dashboard/dashboard.component.css` | New grid area, chart styles, badge, health bar, toolbar |
| `frontend/src/app/dashboard/dashboard.component.html` | New analytics panel, updated leases section |

No other files touched. No backend changes.

---

## Note on Tests

`CLAUDE.md` documents that there is no test suite configured. TDD steps are replaced with: write code → run `npm start` → verify in browser at http://localhost:4200.

---

### Task 1: Add TypeScript logic to DashboardComponent

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard.component.ts`

- [ ] **Step 1: Add module-level constants above the `@Component` decorator**

Open `frontend/src/app/dashboard/dashboard.component.ts`. After the last `import` line and before `@Component(...)`, insert:

```typescript
export type DeviceType = 'Mobile' | 'Desktop' | 'Network' | 'IoT' | 'Unknown';

const DONUT_C = 2 * Math.PI * 56; // circumference for r=56 ≈ 351.86

const CHART_COLORS = ['#5ac4b0', '#3de89a', '#ddb83a', '#e84040', '#a78bfa', '#8a7845'];

const TYPE_COLORS: Record<DeviceType, string> = {
  Mobile:  '#5ac4b0',
  Desktop: '#3de89a',
  Network: '#ddb83a',
  IoT:     '#a78bfa',
  Unknown: '#8a7845',
};

const TYPE_ICONS: Record<DeviceType, string> = {
  Mobile:  'bi-phone',
  Desktop: 'bi-laptop',
  Network: 'bi-router',
  IoT:     'bi-cpu',
  Unknown: 'bi-question-circle',
};
```

- [ ] **Step 2: Add new component properties** 

Inside the `DashboardComponent` class body, after the existing `configSaved = false;` line, add:

```typescript
  activeTypeFilter: DeviceType | 'ALL' = 'ALL';
  leaseSearch = '';
```

- [ ] **Step 3: Add `deviceTypeFor()` method**

Add inside the class, after the `vendorFor()` method:

```typescript
  deviceTypeFor(mac: string, hostname: string): DeviceType {
    const h = (hostname || '').toLowerCase();
    if (/iphone|ipad|android|mobile|pixel|galaxy/.test(h)) return 'Mobile';
    if (/macbook|imac|desktop|laptop|\bpc\b|win/.test(h))  return 'Desktop';
    if (/router|access-point|gateway|switch|cisco|unifi|ap-/.test(h)) return 'Network';
    if (/raspberry|arduino|esp|iot|cam|printer/.test(h))   return 'IoT';
    if (/\bpi\b/.test(h))  return 'IoT';
    if (/\bmac\b/.test(h)) return 'Desktop';

    const v = this.vendorFor(mac);
    if (/Apple|Samsung|Huawei|Xiaomi|OnePlus|Sony/i.test(v))              return 'Mobile';
    if (/Cisco|TP-Link|Netgear|Ubiquiti|MikroTik|D-Link|Aruba/i.test(v)) return 'Network';
    if (/Raspberry|Arduino/i.test(v))                                      return 'IoT';

    return 'Unknown';
  }

  typeIconFor(mac: string, hostname: string): string {
    return TYPE_ICONS[this.deviceTypeFor(mac, hostname)];
  }

  typeColorFor(mac: string, hostname: string): string {
    return TYPE_COLORS[this.deviceTypeFor(mac, hostname)];
  }

  vendorColorKey(mac: string): string {
    const v = this.vendorFor(mac);
    if (/Apple/i.test(v))                          return 'cyan';
    if (/Samsung/i.test(v))                        return 'green';
    if (/Cisco|TP-Link|Netgear|Ubiquiti/i.test(v)) return 'amber';
    if (/Huawei|Xiaomi/i.test(v))                  return 'purple';
    return 'dim';
  }
```

- [ ] **Step 4: Add lease health helpers**

Add inside the class, after `vendorColorKey()`:

```typescript
  leaseHealthPct(lease: Lease): number {
    const now     = Date.now();
    const expiry  = new Date(lease.expiry).getTime();
    const start   = new Date(lease.assignedAt).getTime();
    const total   = expiry - start;
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, ((expiry - now) / total) * 100));
  }

  leaseHealthColor(pct: number): string {
    if (pct > 50) return '#3de89a';
    if (pct > 20) return '#ddb83a';
    return '#e84040';
  }
```

- [ ] **Step 5: Add `manufacturerData` getter**

Add inside the class, after `leaseHealthColor()`:

```typescript
  get manufacturerData(): { label: string; count: number; pct: number; color: string; dasharray: string; dashoffset: number }[] {
    if (!this.leases.length) return [];

    const counts = new Map<string, number>();
    for (const lease of this.leases) {
      const v = this.vendorFor(lease.mac) || 'Unknown';
      counts.set(v, (counts.get(v) || 0) + 1);
    }

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top    = sorted.slice(0, 5);
    const rest   = sorted.slice(5).reduce((s, [, c]) => s + c, 0);

    const entries: { label: string; count: number }[] = [
      ...top.map(([label, count]) => ({ label, count })),
      ...(rest > 0 ? [{ label: 'Others', count: rest }] : []),
    ];

    const total = this.leases.length;
    let cumulative = 0;

    return entries.map((e, i) => {
      const segLen   = (e.count / total) * DONUT_C;
      const dasharray  = `${segLen.toFixed(2)} ${(DONUT_C - segLen).toFixed(2)}`;
      const dashoffset = DONUT_C - cumulative;
      cumulative += segLen;
      return {
        label: e.label,
        count: e.count,
        pct:   (e.count / total) * 100,
        color: CHART_COLORS[i] ?? '#8a7845',
        dasharray,
        dashoffset,
      };
    });
  }
```

- [ ] **Step 6: Add `deviceTypeData` and `filteredLeases` getters**

Add inside the class, after `manufacturerData`:

```typescript
  get deviceTypeData(): { label: string; count: number; pct: number; color: string; icon: string }[] {
    const total  = this.leases.length;
    const types: DeviceType[] = ['Mobile', 'Desktop', 'Network', 'IoT', 'Unknown'];
    const counts = Object.fromEntries(types.map(t => [t, 0])) as Record<DeviceType, number>;
    for (const lease of this.leases) counts[this.deviceTypeFor(lease.mac, lease.hostname)]++;
    return types.map(t => ({
      label: t,
      count: counts[t],
      pct:   total ? (counts[t] / total) * 100 : 0,
      color: TYPE_COLORS[t],
      icon:  TYPE_ICONS[t],
    }));
  }

  get filteredLeases(): Lease[] {
    let result = this.leases;
    if (this.activeTypeFilter !== 'ALL') {
      result = result.filter(l => this.deviceTypeFor(l.mac, l.hostname) === this.activeTypeFilter);
    }
    const q = this.leaseSearch.toLowerCase().trim();
    if (q) {
      result = result.filter(l =>
        l.ip.includes(q) ||
        l.mac.toLowerCase().includes(q) ||
        (l.hostname ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }

  trackByLabel(_: number, item: { label: string }): string {
    return item.label;
  }
```

- [ ] **Step 7: Verify the TypeScript compiles**

```bash
cd "/Users/khalidalqassabi/DHCP server/frontend"
npx tsc --noEmit
```

Expected: no errors. If you see "Property 'leaseSearch' has no initializer" errors, confirm `leaseSearch = '';` was added in Step 2.

- [ ] **Step 8: Commit**

```bash
cd "/Users/khalidalqassabi/DHCP server"
git add frontend/src/app/dashboard/dashboard.component.ts
git commit -m "feat(dashboard): add device type inference, analytics getters, filtered leases"
```

---

### Task 2: Add CSS styles

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard.component.css`

- [ ] **Step 1: Update grid to add `area-charts` row**

In `dashboard.component.css`, replace the existing grid rules block:

```css
/* ── Dashboard grid ───────────────────────────────────────── */
.dash-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto auto auto;
  gap: 2px;
  padding: 2px;
  min-height: calc(100vh - 48px);
}

/* Grid area assignments */
.area-control { grid-column: 1; grid-row: 1; }
.area-detect  { grid-column: 2; grid-row: 1; }
.area-info    { grid-column: 3; grid-row: 1; }
.area-config  { grid-column: 1 / 3; grid-row: 2; }
.area-logs    { grid-column: 3; grid-row: 2; }
.area-leases  { grid-column: 1 / -1; grid-row: 3; }
```

with:

```css
/* ── Dashboard grid ───────────────────────────────────────── */
.dash-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto auto auto auto;
  gap: 2px;
  padding: 2px;
  min-height: calc(100vh - 48px);
}

/* Grid area assignments */
.area-control { grid-column: 1; grid-row: 1; }
.area-detect  { grid-column: 2; grid-row: 1; }
.area-info    { grid-column: 3; grid-row: 1; }
.area-config  { grid-column: 1 / 3; grid-row: 2; }
.area-logs    { grid-column: 3; grid-row: 2; }
.area-charts  { grid-column: 1 / -1; grid-row: 3; }
.area-leases  { grid-column: 1 / -1; grid-row: 4; }
```

- [ ] **Step 2: Add chart panel layout styles**

Append to `dashboard.component.css`:

```css
/* ── Chart panel layout ────────────────────────────────────── */
.chart-halves {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  min-height: 260px;
}

.chart-half {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.chart-half-title {
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-dim);
  align-self: flex-start;
}

.chart-no-data {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  font-size: 0.8rem;
  letter-spacing: 0.12em;
}
```

- [ ] **Step 3: Add donut chart styles**

Append to `dashboard.component.css`:

```css
/* ── Donut chart ───────────────────────────────────────────── */
.donut-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: 100%;
}

.donut-svg {
  width: 160px;
  height: 160px;
  flex-shrink: 0;
}

.donut-center-num {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 22px;
  font-weight: 700;
  fill: var(--text-bright);
}

.donut-center-label {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.14em;
  fill: var(--text-dim);
}

.donut-legend {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 20px;
  width: 100%;
  max-width: 280px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.76rem;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-name {
  color: var(--text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-count {
  color: var(--text-bright);
  font-weight: 600;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Add horizontal bar chart styles**

Append to `dashboard.component.css`:

```css
/* ── Horizontal bar chart ──────────────────────────────────── */
.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}

.bar-row {
  display: grid;
  grid-template-columns: 100px 1fr 44px;
  align-items: center;
  gap: 12px;
}

.bar-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.78rem;
  color: var(--text);
  white-space: nowrap;
}

.bar-track {
  height: 10px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.bar-pct {
  font-size: 0.76rem;
  font-weight: 600;
  text-align: right;
}
```

- [ ] **Step 5: Add vendor badge styles**

Append to `dashboard.component.css`:

```css
/* ── Vendor badge ──────────────────────────────────────────── */
.vendor-badge {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 7px;
  border: 1px solid;
  border-radius: 2px;
}

.vendor-cyan   { background: rgba(90,196,176,0.1);  color: #5ac4b0; border-color: rgba(90,196,176,0.3); }
.vendor-green  { background: rgba(61,232,154,0.1);  color: #3de89a; border-color: rgba(61,232,154,0.3); }
.vendor-amber  { background: rgba(221,184,58,0.1);  color: #ddb83a; border-color: rgba(221,184,58,0.3); }
.vendor-purple { background: rgba(167,139,250,0.1); color: #a78bfa; border-color: rgba(167,139,250,0.3); }
.vendor-dim    { background: rgba(138,120,69,0.1);  color: #8a7845; border-color: rgba(138,120,69,0.3); }
```

- [ ] **Step 6: Add health bar styles**

Append to `dashboard.component.css`:

```css
/* ── Lease health bar ──────────────────────────────────────── */
.health-bar-track {
  width: 60px;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
  cursor: default;
}

.health-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease, background 0.4s ease;
}
```

- [ ] **Step 7: Add leases toolbar, filter tabs, and search styles**

Append to `dashboard.component.css`:

```css
/* ── Leases toolbar (filter tabs + search) ─────────────────── */
.leases-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  gap: 12px;
  flex-wrap: wrap;
}

.filter-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.filter-tab {
  background: transparent;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 5px 12px;
  cursor: pointer;
  border: 1px solid var(--border-hi);
  color: var(--text-dim);
  transition: all 0.12s ease;
}

.filter-tab:hover {
  border-color: var(--amber-dim);
  color: var(--amber);
}

.filter-tab.active {
  border-color: #5ac4b0;
  color: #5ac4b0;
  background: rgba(90,196,176,0.06);
}

.lease-search {
  width: 220px;
  font-size: 0.78rem;
  padding: 5px 10px;
}
```

- [ ] **Step 8: Add device icon cell style and update responsive block**

Append to `dashboard.component.css`:

```css
/* ── Device type icon cell ─────────────────────────────────── */
.val-device-icon {
  text-align: center;
  font-size: 1rem;
  width: 36px;
}
```

Then in the existing `@media (max-width: 900px)` block, add `.area-charts` to the selector list that resets `grid-column` and `grid-row`:

Find this block:
```css
  .area-control,
  .area-detect,
  .area-info,
  .area-config,
  .area-logs,
  .area-leases {
    grid-column: 1;
    grid-row: auto;
  }
```

Replace with:
```css
  .area-control,
  .area-detect,
  .area-info,
  .area-config,
  .area-logs,
  .area-charts,
  .area-leases {
    grid-column: 1;
    grid-row: auto;
  }
  .chart-halves { grid-template-columns: 1fr; }
  .bar-row { grid-template-columns: 80px 1fr 36px; }
  .lease-search { width: 100%; }
```

- [ ] **Step 9: Commit**

```bash
cd "/Users/khalidalqassabi/DHCP server"
git add frontend/src/app/dashboard/dashboard.component.css
git commit -m "feat(dashboard): add analytics panel, vendor badge, health bar, and toolbar styles"
```

---

### Task 3: Update HTML template

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard.component.html`

- [ ] **Step 1: Add `area-charts` panel before `area-leases`**

In `dashboard.component.html`, find this comment line:
```html
  <!-- ── Full width: Active Leases ──────────────────────────────────── -->
```

Insert the entire analytics panel **above** that comment:

```html
  <!-- ── Full width: Device Analytics ──────────────────────────────── -->
  <div class="panel area-charts">
    <div class="panel-head">
      <span><i class="bi bi-bar-chart-line panel-head-icon"></i>DEVICE ANALYTICS</span>
      <span class="badge-count">{{ leases.length }} devices</span>
    </div>

    <div class="chart-halves">

      <!-- Donut: by manufacturer -->
      <div class="chart-half" style="border-right:1px solid var(--border)">
        <div class="chart-half-title">BY MANUFACTURER</div>

        <ng-container *ngIf="leases.length; else noDataDonut">
          <div class="donut-wrap">
            <svg class="donut-svg" viewBox="0 0 160 160">
              <!-- background ring -->
              <circle cx="80" cy="80" r="56" fill="none"
                      stroke="var(--border)" stroke-width="28"/>
              <!-- data segments -->
              <g transform="rotate(-90 80 80)">
                <circle *ngFor="let seg of manufacturerData; trackBy: trackByLabel"
                        cx="80" cy="80" r="56" fill="none"
                        [attr.stroke]="seg.color"
                        stroke-width="28"
                        [attr.stroke-dasharray]="seg.dasharray"
                        [attr.stroke-dashoffset]="seg.dashoffset"/>
              </g>
              <!-- center label -->
              <text x="80" y="76" text-anchor="middle" class="donut-center-num">{{ leases.length }}</text>
              <text x="80" y="92" text-anchor="middle" class="donut-center-label">DEVICES</text>
            </svg>

            <div class="donut-legend">
              <div *ngFor="let seg of manufacturerData; trackBy: trackByLabel" class="legend-item">
                <span class="legend-dot" [style.background]="seg.color"></span>
                <span class="legend-name">{{ seg.label }}</span>
                <span class="legend-count">{{ seg.count }}</span>
              </div>
            </div>
          </div>
        </ng-container>

        <ng-template #noDataDonut>
          <div class="chart-no-data">— NO DATA —</div>
        </ng-template>
      </div>

      <!-- Bars: by device type -->
      <div class="chart-half">
        <div class="chart-half-title">BY DEVICE TYPE</div>

        <ng-container *ngIf="leases.length; else noDataBars">
          <div class="bar-chart">
            <div *ngFor="let item of deviceTypeData; trackBy: trackByLabel" class="bar-row">
              <div class="bar-label">
                <i [class]="'bi ' + item.icon" [style.color]="item.color"></i>
                {{ item.label }}
              </div>
              <div class="bar-track">
                <div class="bar-fill"
                     [style.width.%]="item.pct"
                     [style.background]="item.color"
                     [style.box-shadow]="'0 0 6px ' + item.color + '60'">
                </div>
              </div>
              <div class="bar-pct" [style.color]="item.color">
                {{ item.pct | number:'1.0-0' }}%
              </div>
            </div>
          </div>
        </ng-container>

        <ng-template #noDataBars>
          <div class="chart-no-data">— NO DATA —</div>
        </ng-template>
      </div>

    </div>
  </div>

```

- [ ] **Step 2: Add filter toolbar inside the leases panel**

Find the `area-leases` panel. Its opening `<div style="overflow-x:auto">` wraps the table. Insert the toolbar **before** that `<div>`:

Find:
```html
    <div style="overflow-x:auto">
      <table class="data-table">
```

Replace with:
```html
    <!-- Toolbar: filter tabs + search -->
    <div class="leases-toolbar">
      <div class="filter-tabs">
        <button class="filter-tab" [class.active]="activeTypeFilter === 'ALL'"
                (click)="activeTypeFilter = 'ALL'">ALL</button>
        <button class="filter-tab" [class.active]="activeTypeFilter === 'Mobile'"
                (click)="activeTypeFilter = 'Mobile'">MOBILE</button>
        <button class="filter-tab" [class.active]="activeTypeFilter === 'Desktop'"
                (click)="activeTypeFilter = 'Desktop'">DESKTOP</button>
        <button class="filter-tab" [class.active]="activeTypeFilter === 'Network'"
                (click)="activeTypeFilter = 'Network'">NETWORK</button>
        <button class="filter-tab" [class.active]="activeTypeFilter === 'IoT'"
                (click)="activeTypeFilter = 'IoT'">IOT</button>
      </div>
      <input class="field-input lease-search"
             [value]="leaseSearch"
             (input)="leaseSearch = $any($event.target).value"
             placeholder="SEARCH IP / MAC / HOST…">
    </div>

    <div style="overflow-x:auto">
      <table class="data-table">
```

- [ ] **Step 3: Update leases table header**

Find the existing `<thead>` block:
```html
        <thead>
          <tr>
            <th>IP Address</th>
            <th>MAC Address</th>
            <th>Manufacturer</th>
            <th>Hostname</th>
            <th>Assigned</th>
            <th>Expires</th>
            <th style="width:56px"></th>
          </tr>
        </thead>
```

Replace with:
```html
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
```

- [ ] **Step 4: Update leases table body**

Find the existing `<tbody>` block:
```html
        <tbody>
          <tr *ngFor="let lease of leases">
            <td class="val-ip">{{ lease.ip }}</td>
            <td class="val-mac">{{ lease.mac }}</td>
            <td class="val-vendor">{{ vendorFor(lease.mac) }}</td>
            <td>{{ lease.hostname || '—' }}</td>
            <td style="color:var(--text-dim);font-size:0.72rem">{{ formatTime(lease.assignedAt) }}</td>
            <td style="color:var(--text-dim);font-size:0.72rem">{{ formatExpiry(lease.expiry) }}</td>
            <td>
              <button class="pbtn pbtn-icon"
                      (click)="releaseLease(lease.mac)"
                      title="Release lease">
                <i class="bi bi-x-lg"></i>
              </button>
            </td>
          </tr>
          <tr *ngIf="!leases.length" class="empty-row">
            <td colspan="7">
              <i class="bi bi-inbox" style="margin-right:8px"></i>NO ACTIVE LEASES
            </td>
          </tr>
        </tbody>
```

Replace with:
```html
        <tbody>
          <tr *ngFor="let lease of filteredLeases">
            <td class="val-device-icon">
              <i [class]="'bi ' + typeIconFor(lease.mac, lease.hostname)"
                 [style.color]="typeColorFor(lease.mac, lease.hostname)"></i>
            </td>
            <td class="val-ip">{{ lease.ip }}</td>
            <td class="val-mac">{{ lease.mac }}</td>
            <td>
              <span class="vendor-badge" [class]="'vendor-badge vendor-' + vendorColorKey(lease.mac)">
                {{ vendorFor(lease.mac) }}
              </span>
            </td>
            <td>{{ lease.hostname || '—' }}</td>
            <td style="color:var(--text-dim);font-size:0.72rem">{{ formatTime(lease.assignedAt) }}</td>
            <td style="color:var(--text-dim);font-size:0.72rem">{{ formatExpiry(lease.expiry) }}</td>
            <td>
              <div class="health-bar-track"
                   [title]="(leaseHealthPct(lease) | number:'1.0-0') + '% remaining'">
                <div class="health-bar-fill"
                     [style.width.%]="leaseHealthPct(lease)"
                     [style.background]="leaseHealthColor(leaseHealthPct(lease))">
                </div>
              </div>
            </td>
            <td>
              <button class="pbtn pbtn-icon"
                      (click)="releaseLease(lease.mac)"
                      title="Release lease">
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
```

- [ ] **Step 5: Verify in browser**

```bash
cd "/Users/khalidalqassabi/DHCP server/frontend"
npm start
```

Open http://localhost:4200 and verify:
1. `DEVICE ANALYTICS` panel appears between the existing panels and the leases table
2. When leases exist: donut chart renders with colored arcs and legend; bars show 5 device types
3. When no leases: both chart halves show `— NO DATA —`
4. Leases table first column shows a colored device type icon
5. Manufacturer column shows a colored badge (not plain text)
6. Health column shows a colored progress bar with tooltip on hover
7. Filter tabs above the table filter rows by device type; `ALL` shows everything
8. Search box filters by IP, MAC, and hostname simultaneously with the active type filter
9. The empty-row message says "NO MATCHING LEASES" when filters hide all rows

- [ ] **Step 6: Commit**

```bash
cd "/Users/khalidalqassabi/DHCP server"
git add frontend/src/app/dashboard/dashboard.component.html
git commit -m "feat(dashboard): add device analytics panel and enrich leases table"
```
