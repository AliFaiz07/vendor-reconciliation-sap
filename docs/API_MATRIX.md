# API MATRIX & ENDPOINT SPECIFICATION

**Service**: `ReconciliationService`
**Base Protocol**: OData V4 / REST
**Mount Path**: `/api/v1`
**Date**: 2026-09-28

---

## 1. ODATA V4 ENTITY SETS

| Entity Set | HTTP Methods | Read Role Restriction | Description |
|---|---|---|---|
| `/VendorDocLines` | `GET` | Row-filtered by `x-user-vendor` if vendor role | Ingested statement invoice line items |
| `/VendorLedgerItems` | `GET` | Row-filtered by `supplier = vendorCode` | Internal SAP vendor ledger line items |
| `/MatchResults` | `GET` | Joined filter on vendor statement lines | Consolidated reconciliation outcomes |
| `/Exceptions` | `GET` | Joined filter on vendor statement lines | Open and historical discrepancy records |
| `/StatementUploads` | `GET` | Filtered by `vendorCode` for vendor personas | Uploaded file batch metadata |
| `/WorkflowHistory` | `GET` | Open to all authenticated internal personas | Audit trail of exception transitions |
| `/Gstr2bInvoices` | `GET` | Internal finance roles only | Indian GST GSTR-2B compliance data |
| `/PurchaseRequisitions`| `GET` | PR, PO, AP personas | Simulated PR header and line items |
| `/PurchaseOrders` | `GET` | PO, GR, AP, Vendor (own POs) | Simulated PO line items |
| `/VendorMaster` | `GET` (Read-only) | All internal personas | Supplier master data, PAN, GSTIN |
| `/GrirSnapshot` | `GET` (Read-only) | GR, Finance, AP personas | SAP MR11 GR/IR balance snapshot |
| `/AuditLog` | `GET` (Read-only) | Supervisor / Auditor, AP Manager | Complete system immutable audit logs |

---

## 2. ACTIONS & FUNCTIONS (CUSTOM OPERATIONS)

| Operation | Type | Parameters | Response | Target SAP Reality |
|---|---|---|---|---|
| `demoLogin` | `Action` | `personaKey: String` | User profile JSON | `[DEMO ONLY]` Zero-friction profile switcher |
| `login` | `Action` | `username: String, password: String` | User profile JSON | `[DEMO MOCK]` Standard credential login |
| `register` | `Action` | Registration fields | `String` | `[DEMO MOCK]` Self-registration |
| `resetDemo` | `Action` | None | Reset summary JSON | `[DEMO ONLY]` Clears local SQLite data |
| `getCockpitKpis` | `Function` | None | Aggregated KPI JSON | Real dynamic aggregation on local DB |
| `seedSapMockData` | `Action` | `fileBase64: String` | Summary count | `[DEMO ONLY]` Seeds Excel master data |
| `uploadStatement` | `Action` | `fileBase64, companyCode, period...` | Upload ID | Ingestion pipeline (Production ready) |
| `runMatching` | `Action` | `statementUploadId: UUID` | Status string | 2-Way engine (Production ready) |
| `assignException` | `Action` | `exceptionId: UUID, assignedTo: String`| Status string | Exception assignment workflow |
| `resolveException`| `Action` | `exceptionId: UUID, note: String` | Status string | Exception resolution workflow |
| `reopenException` | `Action` | `exceptionId: UUID` | Status string | Reopening resolved exception |
| `raiseDispute` | `Action` | `exceptionId: UUID, comment: String` | Status string | FSCM Dispute workflow |
| `createPR` | `Action` | `material, qty, amount` | PR Number | `[DEMO SIMULATION]` Target ME51N |
| `approvePR` | `Action` | `prId: UUID` | Status string | `[DEMO SIMULATION]` Target ME54N |
| `createPO` | `Action` | `prId, purchaseOrder, supplier` | PO Number | `[DEMO SIMULATION]` Target ME21N |
| `sendPOToVendor` | `Action` | `poId: UUID` | Status string | `[DEMO SIMULATION]` Target EDI/Email |
| `dispatchGoods` | `Action` | `poId: UUID` | Status string | `[DEMO SIMULATION]` Target Vendor ASN |
| `postGR` | `Action` | `poId, grQty, plant` | Status string | `[DEMO SIMULATION]` Target MIGO (101) |
| `approveForPayment`| `Action`| `docLineId: UUID` | Status string | `[DEMO SIMULATION]` Target MIRO release |
| `createPaymentProposal`|`Action`|`docLineIds: String` | Status string | `[DEMO SIMULATION]` Target F110 Proposal|
| `executePaymentRun`| `Action`| `paymentRef, docLineIds` | Status string | `[DEMO SIMULATION]` Target F110 Posting |

---

## 3. REAL SAP INTEGRATION CONTRACT (TARGET PRODUCTION)

When transitioning from **Demo Mode** to **Real SAP Mode**, the adapters map the above actions directly to the following standard SAP OData services:

* **Supplier Master**: `API_BUSINESS_PARTNER` (`A_BusinessPartner`, `A_Supplier`)
* **Purchase Orders**: `API_PURCHASEORDER_PROCESS_SRV` (`A_PurchaseOrder`, `A_PurchaseOrderItem`)
* **Goods Receipts**: `API_MATERIAL_DOCUMENT_SRV` (`A_MaterialDocumentHeader`, `A_MaterialDocumentItem`)
* **Supplier Invoices**: `API_SUPPLIERINVOICE_PROCESS_SRV` (`A_SupplierInvoice`)
* **Payment Clearing**: SAP Bank Communication Management (BCM) / `API_FINANCIALSTATUS_SRV`
