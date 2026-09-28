# SAP PROCESS MAPPING & TRANSACTION REFERENCE

**Project**: Vendor Reconciliation & Match Exception Engine
**Standard**: SAP S/4HANA (also applicable to SAP ECC 6.0 EHP8)
**Date**: 2026-09-28
**Scope**: Procure-to-Pay (P2P), Invoice Verification, Vendor Accounting, Clearing, and Dispute Management.

---

## 1. END-TO-END PROCESS STEPS & SAP TRANSACTIONS

| Process Step | Real SAP Transaction | SAP Business Object | SAP Tables | Real SAP API / BAPI | App Implementation Status |
|---|---|---|---|---|---|
| **Purchase Requisition** | `ME51N` / `ME52N` / `ME53N` | `BUS2105` (PurchaseRequisition) | `EBAN`, `EBKN` | `API_PURCHASEREQUISITION_PROCESS_SRV` | `[DEMO SIMULATION]` `createPR`, `approvePR` |
| **Purchase Order** | `ME21N` / `ME22N` / `ME23N` | `BUS2012` (PurchaseOrder) | `EKKO`, `EKPO`, `EKET` | `API_PURCHASEORDER_PROCESS_SRV` | `[DEMO SIMULATION]` `createPO`, `sendPOToVendor` |
| **Goods Receipt (GR)** | `MIGO` (Mvt Type 101/102) | `BUS2017` (MaterialDocument) | `MKPF`, `MSEG` | `API_MATERIAL_DOCUMENT_SRV` | `[DEMO SIMULATION]` `postGR` → updates `GrirSnapshot` |
| **Vendor Invoice (MIRO)** | `MIRO` / `MIR6` / `FB60` | `BUS2081` (SupplierInvoice) | `RBKP`, `RSEG`, `BKPF` | `API_SUPPLIERINVOICE_PROCESS_SRV` | `[DEMO SIMULATION]` Seeded via Excel `VendorLedgerItems` |
| **GR/IR Clearing Account** | `MR11` (GR/IR Maintenance) | Financial Document | `BSIS_BC` / `BSAS_BC` | `BAPI_INCOMINGINVOICE_CREATE` | `[DEMO SIMULATION]` `GrirSnapshot` entity |
| **Vendor Statement Ingestion** | SAP Ariba / EDI 810 / Email | Custom Ingestion | Custom staging | Custom REST / OData | `[IMPLEMENTED]` `uploadStatement` (XLSX) |
| **Reconciliation Matching** | SAP Cash Application / Custom | Match Result | Custom staging | Custom Engine | `[IMPLEMENTED]` 2-Way Deterministic Rules + Consolidation |
| **Dispute Management** | SAP FSCM `UDM_DISPUTE` | `BUS2203` (DisputeCase) | `UDMCASEATTR00` | FSCM Dispute BAPIs | `[IMPLEMENTED]` `raiseDispute` + `WorkflowHistory` |
| **Payment Proposal** | `F110` (Proposal Run) | Payment Proposal | `REGUH`, `REGUP` | Bank Communication Mgmt (BCM) | `[DEMO SIMULATION]` `createPaymentProposal` |
| **Payment Run** | `F110` (Payment Posting) | Payment Document | `REGUH`, `BKPF`, `BSEG` | `API_FINANCIALSTATUS_SRV` | `[DEMO SIMULATION]` `executePaymentRun` |
| **Account Clearing** | `F-44` (Vendor Clear), `F-28` | Clearing Document | `BSAK` (Cleared items) | `POSTING_INTERFACE_CLEARING` | `[DEMO SIMULATION]` `isCleared=true` update |

---

## 2. DETAIL OF KEY SAP WORKFLOW INTEGRATIONS

### A. 3-Way Matching (PO - GR - Invoice)
* **SAP Standard Behavior**: When an invoice is processed in `MIRO`, SAP compares the quantity and price against the Purchase Order (`EKPO-MENGE`, `EKPO-NETPR`) and the Goods Receipt quantity (`MSEG-MENGE`).
  * If quantity exceeds GR: Payment block `R` (Quantity Variance) is set on the line item (`BSEG-ZLSPR = 'R'`).
  * If price exceeds tolerance: Price variance block `P` is set.
* **Application Mapping**:
  * Evaluated via `TC001_STANDARD_MATCH` (3-way match pass).
  * Variances generate `UNMATCHED/QTY-MORE`, `UNMATCHED/PRICE-HIGH`, or `UNMATCHED/GR-PENDING`.
  * Assigned to respective persona: `GR` for quantities, `FINANCE` for price tolerances.

### B. GR/IR Clearing Account (MR11)
* **SAP Standard Behavior**: `GR/IR` is an interim balance sheet liability account. Goods receipt credits GR/IR (`WRX`), invoice receipt debits GR/IR. If quantity or amount differences remain unresolved at period close, `MR11` writes off variances.
* **Application Mapping**:
  * Represented by `GrirSnapshot` (`goodsReceiptQty`, `invoicedQuantity`, `grirAmount`).
  * Displayed in GR Workbench to highlight delivered items pending vendor invoice.

### C. Automatic Payment Program (F110)
* **SAP Standard Behavior**: Selects open AP items (`BSEG-BSTAT = ' '`, `BSEG-AUGBL = ''`), evaluates due dates (`BSEG-ZFBDT` + payment terms), groups payments by vendor/bank, and creates payment proposals (`REGUP`).
* **Application Mapping**:
  * Step 1: `approveForPayment` (releases blocked invoice).
  * Step 2: `createPaymentProposal` (`paymentStatus = 'PROPOSED'`).
  * Step 3: `executePaymentRun` (`paymentStatus = 'PAID'`, assigns UTR payment reference).
  * **Clear labeling**: Marked as `[DEMO SIMULATION]` in UI and API responses.

---

## 3. INDIAN STATUTORY LOCALIZATION (INDIA GST & TDS)

| Statutory Requirement | SAP Solution | Application Implementation | Reality Label |
|---|---|---|---|
| **GSTR-2B Matching** | Tax reconciliation tool / ASP integration | Match vendor GSTIN + Invoice in `Gstr2bInvoices` | `[DEMO MOCK]` Seeded static GST data |
| **Input Tax Credit (ITC)** | Section 16(2)(aa) of CGST Act | Rule `TC006_GST_GAP`: checks `Gstr2bInvoices` | `[DEMO LOGIC]` Flags `UNMATCHED/GST-2B-GAP` |
| **TDS under Sec 194Q** | Withholding tax code in `J1INCHLN` / Vendor Master | Rule `TC007_TDS_DIFFERENCE`: 0.1% on purchase > 50L | `[DEMO LOGIC]` Verifies `gstTdsAmount` |
| **MSME 45-day Rule** | Section 15 & 16 of MSMED Act 2006 | `VendorMaster.isMsme = true` triggers high-priority alert | `[IMPLEMENTED]` Auto-flags P1 priority for MSME |
| **e-Invoicing (IRN)** | SAP Document and Reporting Compliance (DRC) | Ingestion parses `irn` (64-char hash) | `[TO BE VERIFIED]` Real GSTN sandbox API required |

---

## 4. BOUNDARY DEFINITION: REAL SAP VS DEMO SIMULATION

```
┌─────────────────────────────────────────────────────────────┐
│                    VENDOR RECONCILIATION APP                │
├─────────────────────────────────────────────────────────────┤
│  REAL LOGIC (Production Ready):                             │
│    • Deterministic 2-Way Reconciliation Engine              │
│    • Best-Result Consolidation                              │
│    • Exception Lifecycle & Role-Based Workflows             │
│    • Multi-Persona Role-Based Dashboards                    │
│    • Audit Logging & Workflow History                       │
│    • Dynamic KPI Aggregation                                │
├─────────────────────────────────────────────────────────────┤
│  ADAPTER BOUNDARY (Currently Mock / Simulated):             │
│    • Master Data: SQLite tables (target: S/4HANA OData)     │
│    • PO/GR/MIRO: In-memory simulation (target: MM/FI APIs)  │
│    • Payment F110: Local state update (target: BCM / F110)  │
│    • GSTR-2B: Static tables (target: GSTN API / ASP)        │
└─────────────────────────────────────────────────────────────┘
```

*Every non-connected SAP transaction is marked with `[DEMO SIMULATION]` or `[SAP INTEGRATION REQUIRED]` throughout application code, controllers, and documentation.*
