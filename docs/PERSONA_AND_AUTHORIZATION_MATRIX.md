# PERSONA AND AUTHORIZATION MATRIX

**Project**: Vendor Reconciliation & Match Exception Engine
**Date**: 2026-09-28
**Note**: All personas operate in DEMO MODE. No real SAP authorization (PFCG roles) is configured.

---

## PERSONA OVERVIEW

| Persona | System Role ID | Demo Login Key | Demo User |
|---|---|---|---|
| Accounts Payable Manager | `AP` | `admin` | Rahul Sharma |
| Finance Executive | `FINANCE` | `finance` | Priya Mehta |
| GR Specialist | `GR` | `gr_user` | Suresh Kumar |
| PO Officer | `PO` | `po_user` | Anita Desai |
| PR Indenter | `PR` | `pr_user` | Vikram Singh |
| Vendor (AR) | `AR` | `vendor_ar` | Sigma Components |
| Vendor (Billing) | `BILLING` | `vendor_billing` | Apex Steel |
| Supervisor / Auditor | `AP` | `supervisor` | Kavita Nair |

---

## PERSONA DETAILS

### 1. Accounts Payable Manager (AP)

**Responsibilities**:
- Seeds SAP mock data (ledger + vendor master)
- Oversees reconciliation cockpit KPIs
- Reviews open exceptions and approval queue
- Creates payment proposals and executes payment runs
- Manages overall AP operations

**Allowed Screens**:
- Home / Dashboard
- Finance/MIRO Workbench (full access)
- AP Payment Cockpit
- Reconciliation Cockpit (full KPIs)
- Audit Log (read-only)
- Administration

**Allowed Actions**:
- `seedSapMockData`, `uploadStatement`, `runMatching`
- `resolveException`, `reopenException`, `raiseDispute`, `assignException`
- `approveForPayment`, `createPaymentProposal`, `executePaymentRun`
- `resetDemo`
- `getCockpitKpis`
- Read: All entities (no vendor isolation)

**Approval Authority**:
- Can approve any exception
- Can execute payment runs (F110 simulation)

**Data Access**:
- All vendors, all company codes

---

### 2. Finance Executive (FINANCE / MIRO)

**Responsibilities**:
- Runs Invoice Verification (MIRO simulation)
- Uploads vendor statements
- Runs matching engine
- Verifies invoices against PO/GR
- Reviews blocked and pending invoices
- Approves invoices for payment

**Allowed Screens**:
- Home / Dashboard
- MIRO Workbench
- Reconciliation Workbench
- Exception view (MIRO-assigned exceptions)

**Allowed Actions**:
- `uploadStatement`, `runMatching`
- `resolveException` (for price/amount exceptions)
- `approveForPayment`
- `getCockpitKpis`
- Read: VendorDocLines, VendorLedgerItems, MatchResults, Exceptions, PurchaseOrders

**Data Access**:
- All vendors (no vendor isolation for Finance role)

---

### 3. GR Specialist (GR)

**Responsibilities**:
- Posts Goods Receipts (MIGO simulation)
- Resolves quantity mismatch exceptions
- Verifies physical goods received

**Allowed Screens**:
- Home / Dashboard
- GR Workbench
- Exception view (GR-assigned exceptions only)

**Allowed Actions**:
- `postGR` (creates GR records)
- `resolveException` (for GR-related exceptions)
- Read: PurchaseOrders, GrirSnapshot
- **Blocked**: Cannot read MatchResults, Exceptions (non-GR)

**Authorization Rules** (server-side):
- READ on Exceptions and MatchResults blocked by before-READ handler

**Data Access**:
- All POs across vendors (goods receipt is plant-side)

---

### 4. PO Officer (PO)

**Responsibilities**:
- Reviews and approves Purchase Requisitions
- Creates Purchase Orders
- Sends POs to vendors
- Manages supplier relationships

**Allowed Screens**:
- Home / Dashboard
- PO Dashboard
- PR Dashboard (to approve)

**Allowed Actions**:
- `approvePR`, `createPO`, `sendPOToVendor`
- Read: PurchaseRequisitions, PurchaseOrders, VendorMaster
- **Blocked**: Cannot read reconciliation or exception data

**Authorization Rules** (server-side):
- READ restricted to PurchaseRequisitions, PurchaseOrders, VendorMaster only

---

### 5. PR Indenter (PR)

**Responsibilities**:
- Creates Purchase Requisitions for material needs
- Tracks PR approval status

**Allowed Screens**:
- Home / Dashboard
- PR Dashboard

**Allowed Actions**:
- `createPR`
- Read: PurchaseRequisitions, PurchaseOrders (own only)
- **Blocked**: Cannot read any financial or reconciliation data

**Authorization Rules** (server-side):
- READ restricted to PurchaseRequisitions and PurchaseOrders only

---

### 6. Vendor (AR) / Vendor (Billing)

**Responsibilities**:
- Uploads vendor billing statement for reconciliation
- Views reconciliation results for their invoices
- Raises disputes on rejected invoices
- Views payment status

**Allowed Screens**:
- Vendor Portal
- AR Dashboard / Billing Dashboard

**Allowed Actions**:
- `uploadStatement` (own vendorCode only)
- `raiseDispute` (own exceptions only)
- Read: VendorDocLines (own only), StatementUploads (own only)
- **Blocked**: Cannot read other vendors' data

**Authorization Rules** (server-side):
- Row-level isolation: `x-user-vendor` header enforced for all entity reads
- VendorDocLines filtered by `sourceVendorCode = vendorCode`
- VendorLedgerItems filtered by `supplier = vendorCode`
- StatementUploads filtered by `vendorCode = vendorCode`
- Exceptions filtered to own vendor's match results

**⚠ Security Note (Demo)**:
- In DEMO mode, vendorCode comes from `x-user-vendor` HTTP header set by frontend
- In PRODUCTION: must come from validated JWT token claim

---

### 7. Supervisor / Auditor

**Responsibilities**:
- Read-only access to all reconciliation data
- Reviews audit trail
- Monitors system-wide KPIs
- No ability to modify data

**Allowed Screens**:
- All dashboards (read-only)
- Audit Log
- KPI Cockpit

**Allowed Actions**:
- Read: All entities (no vendor isolation, same as AP)
- **Cannot**: Execute any write actions (resolve, assign, pay, etc.)

**Note**: In this implementation, Supervisor uses `AP` businessRole. A dedicated `AUDITOR` role should be added for stricter read-only enforcement. `TO BE VERIFIED` with client.

---

## AUTHORIZATION MATRIX

| Action | AP | FINANCE | GR | PO | PR | AR/BILLING | Supervisor |
|---|---|---|---|---|---|---|---|
| seedSapMockData | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| uploadStatement | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (own) | ❌ |
| runMatching | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| resolveException | ✅ | ✅ | ✅ (GR) | ❌ | ❌ | ❌ | ❌ |
| reopenException | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| raiseDispute | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (own) | ❌ |
| assignException | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| createPR | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| approvePR | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| createPO | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| sendPOToVendor | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| dispatchGoods | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| postGR | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| approveForPayment | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| createPaymentProposal | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| executePaymentRun | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| resetDemo | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| getCockpitKpis | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Read: All Entities | ✅ | ✅ | ⚠ Limited | ⚠ Limited | ⚠ Limited | ⚠ Own only | ✅ Read-only |

---

## VENDOR ISOLATION RULES

Applied server-side in `reconciliation-service.js` `before('READ', '*')` handler:

| Entity | Filter Applied for AR/BILLING Role |
|---|---|
| VendorDocLines | `sourceVendorCode = vendorCode` |
| VendorLedgerItems | `supplier = vendorCode` |
| StatementUploads | `vendorCode = vendorCode` |
| MatchResults | Via join to VendorDocLines |
| Exceptions | Via join to MatchResults → VendorDocLines |
| PurchaseOrders | `supplier = vendorCode` |

---

## DEMO PERSONA PROFILES (Quick Reference)

```
Persona Key     Role      Name                   Purpose
───────────────────────────────────────────────────────────
admin           AP        Rahul Sharma           AP cockpit, payment run, admin
finance         FINANCE   Priya Mehta            MIRO, matching, invoice verification
gr_user         GR        Suresh Kumar           Goods receipt posting, GR exceptions
po_user         PO        Anita Desai            Purchase orders, supplier management
pr_user         PR        Vikram Singh           Purchase requisitions
vendor_ar       AR        Sigma Components       Vendor invoice submission, disputes
vendor_billing  BILLING   Apex Steel             Vendor statement upload, recon view
supervisor      AP        Kavita Nair            Read-only audit, KPI monitoring
```

---

*DEMO MODE: All personas use demo login (no password required). Role enforcement is based on HTTP header `x-user-role` sent by frontend. For production, this must be replaced with JWT-based server-side validation.*
