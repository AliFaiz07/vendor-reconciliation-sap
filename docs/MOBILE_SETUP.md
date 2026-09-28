# MOBILE SETUP & TESTING RUNBOOK

**Target Viewports**:
* Mobile Portrait: `390 × 844` (iPhone 12/13/14/15/16)
* Tablet Portrait: `768 × 1024` (iPad Mini / Air)
* Desktop: `1440 × 900`+
**Date**: 2026-09-28

---

## 1. LOCAL NETWORK SETUP (ACCESS FROM PHYSICAL MOBILE DEVICE)

To test the application on a physical phone or tablet over local Wi-Fi:

### Step 1: Find Local Host Machine IP
In PowerShell:
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -like "*Wi-Fi*" -or $_.InterfaceAlias -like "*Ethernet*" } | Select-Object IPAddress
```
*Example IP*: `192.168.1.45`

### Step 2: Ensure CAP Binds to `0.0.0.0`
Start the server listening on all network interfaces:
```bash
npx cds serve --port 4004 --host 0.0.0.0
```

### Step 3: Open Mobile Browser
Connect the phone to the **same Wi-Fi network** and navigate to:
```
http://192.168.1.45:4004/webapp/index.html
```

---

## 2. MOBILE RESPONSIVE ADAPTATIONS IMPLEMENTED

1. **Persona Tile Auto-Wrapping**:
   * Desktop: 4 columns of tiles.
   * Mobile ($< 600\text{px}$): Single column or 2-column flex-wrap with `min-width: 140px`.
2. **Dense Data Tables**:
   * Desktop: Full multi-column view with PO reference, IRN, UTR, and amounts.
   * Mobile: Responsive horizontal scroll container enabled via `.sapUiSizeCompact .sapMTable .sapMListTbl`.
3. **Cockpit Header Collapse**:
   * Desktop: Inline title and global action buttons (Switch Profile, Reset Demo, Logout).
   * Mobile ($< 768\text{px}$): Flex direction switches to column layout to prevent header button clipping.
4. **SVG Charts**:
   * Donut chart rendered with relative `viewBox="0 0 200 200"` ensuring auto-scaling on any screen width without overflow.
   * Horizontal bar charts dynamically adjust to container width (`width="100%"`).

---

## 3. VERIFICATION CHECKLIST (MOBILE VIEWPORT 390×844)

* [x] **Profile Selection**: Tiles fit comfortably without horizontal body scroll.
* [x] **Profile Switcher Popover**: Fits within $340\text{px}$ viewport width.
* [x] **Cockpit KPIs**: Donut chart and KPI tiles stack cleanly.
* [x] **Action Modals**: Dialogs for "Reset Demo" and "Logout" scale to mobile viewport.
* [x] **Touch Targets**: Minimum button height of $44\text{px}$ adhered to per SAP Fiori Touch Guidelines.
