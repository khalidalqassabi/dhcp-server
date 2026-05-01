# Device Analytics & Leases UI — Design Spec
**Date:** 2026-05-01  
**Status:** Approved

---

## Overview

Add a **DEVICE ANALYTICS** panel above the leases table and enhance the leases table itself with richer per-device information. All charts are pure SVG (no external dependencies). Device type is inferred from hostname first, then manufacturer name.

---

## 1. New `area-charts` Panel

### Position
A new full-width grid area (`area-charts`) inserted between the existing panels row and `area-leases` in `dashboard.component.html`.

### Layout
One panel (`DEVICE ANALYTICS`) split into two halves:
- **Left half** — Donut chart: device distribution by manufacturer
- **Right half** — Horizontal bar chart: device distribution by type

### Empty state
When `leases.length === 0`, both chart areas show a centered `— NO DATA —` message instead of the SVG.

---

## 2. Donut Chart (Manufacturer)

- SVG `viewBox="0 0 160 160"`, center `(80,80)`, outer radius `70`, inner radius `42`
- Each manufacturer is one arc segment drawn via `stroke-dasharray` / `stroke-dashoffset` on a circle path
- Up to **5 named manufacturers**; remaining grouped as **"Others"**
- Center label: total device count
- Legend below: colored dot + manufacturer name + count, arranged in a 2-column flex wrap
- Color palette (in order): `--cyan`, `--green`, `--amber`, `--red`, `#a78bfa` (purple), `--text-dim` (Others)

---

## 3. Horizontal Bar Chart (Device Type)

- Five fixed categories: **Mobile**, **Desktop**, **Network**, **IoT**, **Unknown**
- Each row: Bootstrap Icon + label (left) → animated bar (center) → percentage (right)
- Bar height: `10px`, border-radius `4px`, max-width 100% of container
- Color per type:
  - Mobile → `--cyan`
  - Desktop → `--green`
  - Network → `--amber`
  - IoT → `#a78bfa`
  - Unknown → `--text-dim`
- Icons: `bi-phone` Mobile, `bi-laptop` Desktop, `bi-router` Network, `bi-cpu` IoT, `bi-question-circle` Unknown

---

## 4. Device Type Inference Logic (`deviceTypeFor(mac, hostname)`)

Resolution order — first match wins:

1. **Hostname keywords** (case-insensitive):
   - `iphone | ipad | android | mobile | pixel | galaxy` → Mobile
   - `macbook | mac | imac | desktop | pc | win | laptop` → Desktop
   - `router | ap | access-point | gateway | switch | cisco | unifi` → Network
   - `raspberry | arduino | esp | pi | iot | cam | printer` → IoT

2. **Manufacturer name** (from `vendorFor(mac)`):
   - Apple, Samsung, Huawei, Xiaomi, OnePlus, Sony → Mobile
   - Cisco, TP-Link, Netgear, Ubiquiti, MikroTik, D-Link, Aruba → Network
   - Raspberry Pi Foundation, Arduino → IoT

3. Fallback → **Unknown**

Exposed as a method `deviceTypeFor(mac: string, hostname: string): DeviceType` on `DashboardComponent`. `DeviceType = 'Mobile' | 'Desktop' | 'Network' | 'IoT' | 'Unknown'`.

---

## 5. Computed Data Getters

Both are pure `get` accessors on the component — no extra Observables.

```typescript
get manufacturerData(): { label: string; count: number; pct: number }[]
// Returns top-5 manufacturers sorted descending + "Others" bucket if there are >5 distinct manufacturers.
// If ≤5 manufacturers, returns only those present (no "Others" entry).

get deviceTypeData(): { label: string; count: number; pct: number }[]
// Returns all 5 fixed DeviceType buckets, always in the same order
```

Both recalculate automatically whenever Angular's change detection runs (triggered by `leases` reassignment on WebSocket updates).

---

## 6. Leases Table Enhancements

### New column: Device Icon
- First column, before IP
- Renders the Bootstrap Icon for the device type (`bi-phone`, `bi-laptop`, etc.)
- Colored to match the type color

### Manufacturer badge
- Replace the plain text in the **Manufacturer** column with a styled `<span class="vendor-badge">`
- Background: semi-transparent tint from a fixed color map keyed by vendor name:
  - Apple → cyan, Samsung → green, Cisco/TP-Link/Netgear/Ubiquiti → amber, Huawei/Xiaomi → purple, all others → `--text-dim`
- Text: manufacturer name, uppercase, small font

### Lease Health bar
- New column **Health**, after **Expires**
- A small `6px`-tall progress bar showing remaining lease time as a fraction of total lease time
- Color: green (>50%) → amber (20–50%) → red (<20%)
- Tooltip: `X% remaining`

### Quick filter tabs
- Row of pill buttons above the table: `ALL · MOBILE · DESKTOP · NETWORK · IoT`
- Clicking a tab sets `activeTypeFilter` on the component; the `*ngFor` uses a `filteredLeases` getter
- Active tab highlighted with `--cyan` border and text

### Search box
- Text input above the table (right-aligned, next to filter tabs)
- Binds to `leaseSearch` string on the component
- `filteredLeases` getter filters by `ip`, `mac`, or `hostname` (case-insensitive substring match)
- Combined with type filter (both applied simultaneously)

---

## 7. Files Changed

| File | Change |
|------|--------|
| `dashboard.component.ts` | Add `deviceTypeFor()`, `manufacturerData`, `deviceTypeData`, `activeTypeFilter`, `leaseSearch`, `filteredLeases` |
| `dashboard.component.html` | Add `area-charts` panel, SVG charts, update leases table with new columns, filter tabs, search box |
| `dashboard.component.css` | Styles for chart panel, donut, bars, vendor badges, health bar, filter tabs, search input |

No new files. No new npm dependencies. No backend changes.

---

## 8. Constraints

- No external charting library — pure SVG + CSS
- Angular 16 change detection: leases array is **replaced** (not mutated) on each WebSocket update, so getters recalculate correctly
- The `filteredLeases` getter must be used in `*ngFor` instead of `leases` directly
- Manufacturer color map is a small constant object defined at the top of the component file
