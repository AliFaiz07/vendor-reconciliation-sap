# CLIENT DEMONSTRATION RUNBOOK

**Target Audience**: Executive Stakeholders, SAP Practice Leads, Procurement & AP Managers
**Demo Duration**: 10–12 Minutes
**Prerequisites**: Application running at `http://localhost:4004` (or LAN IP)
**Date**: 2026-09-28

---

## 1. STORYLINE OVERVIEW

```
  Step 1: Zero-Friction Entry   ──>   Step 2: Executive Cockpit   ──>   Step 3: Forward & Reverse Recon
        (AP Manager)                         (Dynamic KPIs)                      (Matched vs Gaps)
              │                                                                         │
              ▼                                                                         ▼
  Step 6: P2P & Payment Run    <──   Step 5: Operational Action  <──   Step 4: Switch Persona
   (F110 Demo Simulation)               (MIGO / GR Resolution)              (GR Specialist)
              │
              ▼
  Step 7: Reset Demo & Audit
    (Clean state restoration)
```

---

## 2. STEP-BY-STEP PRESENTATION SCRIPT

### Step 1: Zero-Friction Profile Selection (No Password)
* **Action**: Open `http://localhost:4004/webapp/index.html`.
* **Talk Track**: *"Notice our streamlined demo entry experience. No tedious registration, password resets, or authentication friction. We have pre-configured profiles for all eight enterprise personas."*
* **Click**: Click the **AP Manager (Rahul Sharma)** tile.
* **Result**: Instant login without credentials. Land on the unified Home Dashboard showing role badge and top-level KPIs.

### Step 2: Executive Reconciliation Cockpit
* **Action**: Click "Open your persona workbench" or navigate to **Cockpit**.
* **Talk Track**: *"This is our central AP Cockpit. Every metric on this screen is 100% computed from live data—there are no fake hardcoded numbers. We can see our exact match rate, partial matches, open exceptions broken down by reason, and real statutory aging distribution."*
* **Highlight**:
  * Point out the SVG Donut chart displaying Exact vs Partial vs Unmatched breakdown.
  * Point out the MSME Statutory alert banner reminding the team of the 45-day payment window.

### Step 3: Deep-Dive into Discrepancies & Evidence
* **Action**: Open the Pending Exceptions table. Select an item like `UNMATCHED/PRICE-HIGH` or `UNMATCHED/QTY-MORE`.
* **Talk Track**: *"Unlike traditional tools that simply flag an invoice as 'Failed', our engine provides structured business evidence: expected purchase order rate vs. invoiced vendor rate, the exact delta, and recommended remediation steps."*
* **Click**: Click **Assign Exception** and route to the **GR Specialist**.

### Step 4: Rapid Profile Switching (Under 3 Seconds)
* **Action**: In the header bar, click **Switch Profile**.
* **Talk Track**: *"During client reviews, you often need to show multiple sides of a workflow. In one click, we can pivot personas."*
* **Click**: Select **GR Specialist (Suresh Kumar)**.
* **Result**: UI seamlessly switches context to the Goods Receipt Specialist without re-authenticating or losing place.

### Step 5: Goods Receipt Resolution (MIGO Simulation)
* **Action**: Open the **GR Workbench**.
* **Talk Track**: *"The GR Specialist sees their assigned quantity discrepancy. They can verify the physical material document and post the simulated Goods Receipt (Movement Type 101)."*
* **Click**: Click **Post GR (MIGO Sim)**. The delivery quantity is synced with the GR/IR clearing account snapshot.

### Step 6: Payment Approval & F110 Run
* **Action**: Switch profile back to **AP Manager**. Open **AP Payment Cockpit**.
* **Talk Track**: *"Once exceptions are resolved, invoices enter the payment queue. We review approved invoices, generate a payment proposal, and execute the payment run."*
* **Highlight**: *"Notice the explicit badge: `[DEMO SIMULATION]`. We strictly distinguish local state transitions from live SAP banking postings to maintain enterprise credibility."*
* **Click**: Click **[DEMO] Execute Payment Run (F110 Sim)**. Invoices are marked `PAID` with a generated UTR number.

### Step 7: Immutable Audit Trail & Demo Reset
* **Action**: Show the Audit Log / Workflow History.
* **Action**: In the Home view header, click **Reset Demo**.
* **Talk Track**: *"At the end of a demonstration, clicking 'Reset Demo' instantly clears all runtime reconciliation data, exceptions, and temporary uploads, restoring the pristine master data without touching any real SAP records."*
* **Result**: Clean state ready for the next demonstration.
