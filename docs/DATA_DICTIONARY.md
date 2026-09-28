# DATA DICTIONARY

**Project**: Vendor Reconciliation & Match Exception Engine
**Database**: SAP CAP CDS (`db/schema.cds`)
**Underlying Engine**: SQLite (Development) / SAP HANA Cloud (Target Production)
**Date**: 2026-09-28

---

## 1. ENTITY DEFINITIONS & SAP FIELD MAPPINGS

### 1.1 `VendorDocLines` (Ingested Vendor Statement Lines)
Represents individual invoice line items extracted from the vendor-submitted billing statement.

| Field Name | Type | Key | Mandatory | SAP Mapping (Target) | Description |
|---|---|---|---|---|---|
| `ID` | `UUID` | Yes | Yes | N/A | Primary Key |
| `statementUploadId` | `UUID` | No | Yes | N/A | Foreign key to `StatementUploads` |
| `vendorInvoiceNo` | `String(50)` | No | Yes | `RBKP-XBLNR` / `BKPF-XBLNR` | Vendor reference invoice number |
| `invoiceDate` | `Date` | No | Yes | `RBKP-BLDAT` / `BKPF-BLDAT` | Invoice issuance date |
| `invoiceAmount` | `Decimal(15,2)`| No | Yes | `RBKP-RMWWR` / `BSEG-DMBTR` | Gross invoice amount in transaction currency |
| `currency` | `String(5)` | No | Yes | `RBKP-WAERS` / `BKPF-WAERS` | ISO currency code (e.g., INR, USD) |
| `poReference` | `String(50)` | No | No | `RSEG-EBELN` / `EKKO-EBELN` | Purchase Order number |
| `poItem` | `String(10)` | No | No | `RSEG-EBELP` / `EKPO-EBELP` | Purchase Order line item |
| `gstTdsAmount` | `Decimal(15,2)`| No | No | `BSEG-QSSKZ` / Withholding | Statutory deductions / GST withheld |
| `paymentReference`| `String(50)` | No | No | `PAYR-CHECT` / Bank UTR | Payment UTR reference |
| `irn` | `String(64)` | No | No | E-Invoice IRN Hash | 64-character Invoice Reference Number |
| `sourceVendorCode`| `String(20)` | No | Yes | `LFA1-LIFNR` | Vendor / Supplier Business Partner Code |
| `approvedForPayment`| `Boolean` | No | Yes | `BSEG-ZLSPR` (Cleared) | AP approval status flag |
| `paymentStatus` | `String(20)` | No | Yes | `REGUP-VBLNR` status | Status: `UNPAID`, `PROPOSED`, `PAID` |

---

### 1.2 `VendorLedgerItems` (Internal SAP AP Ledger)
Represents financial accounting entries from the buyer's internal General Ledger / Sub-ledger (`BSEG`/`BKPF`).

| Field Name | Type | Key | Mandatory | SAP Mapping | Description |
|---|---|---|---|---|---|
| `ID` | `UUID` | Yes | Yes | N/A | Primary Key |
| `supplier` | `String(20)` | No | Yes | `LFA1-LIFNR` / `BUT000` | SAP Vendor / Supplier Business Partner |
| `companyCode` | `String(10)` | No | Yes | `T001-BUKRS` | SAP Company Code (e.g., `1000`) |
| `accountingDocument`| `String(20)`| No | Yes | `BKPF-BELNR` | SAP 10-digit Financial Document Number |
| `fiscalYear` | `String(4)` | No | No | `BKPF-GJAHR` | SAP Fiscal Year (e.g., `2026`) |
| `documentDate` | `Date` | No | Yes | `BKPF-BLDAT` | Document creation date |
| `postingDate` | `Date` | No | Yes | `BKPF-BUDAT` | Financial posting date |
| `amountInTransCrcy`| `Decimal(15,2)`| No | Yes | `BSEG-WRBTR` | Line item amount in transaction currency |
| `transactionCurrency`| `String(5)`| No | Yes | `BKPF-WAERS` | Currency code |
| `clearingDocument`| `String(20)` | No | No | `BSEG-AUGBL` | SAP Clearing Document (if cleared) |
| `isCleared` | `Boolean` | No | Yes | Derived from `AUGBL` | True if payment/clearing has occurred |

---

### 1.3 `MatchResults` (Reconciliation Engine Outcomes)
Consolidated result linking statement lines to SAP ledger items.

| Field Name | Type | Key | Mandatory | Description |
|---|---|---|---|---|
| `ID` | `UUID` | Yes | Yes | Primary Key |
| `vendorDocLine_ID` | `UUID` | No | No | FK to `VendorDocLines` (null for reverse check) |
| `ledgerItem_ID` | `UUID` | No | No | FK to `VendorLedgerItems` (null for missing in SAP) |
| `outcomeCode` | `String(40)` | No | Yes | Outcome code: `MATCHED`, `MATCHED/3WAY`, `UNMATCHED/*`, `MISSING_IN_STATEMENT` |
| `amountDelta` | `Decimal(15,2)`| No | Yes | Absolute variance amount between statement & SAP |
| `matchRuleApplied` | `String(50)` | No | Yes | Rule identifier (e.g., `RULE_INVOICE_EXACT`, `REVERSE_CHECK`) |
| `businessRole` | `String(20)` | No | Yes | Persona assigned: `AP`, `FINANCE`, `GR`, `PO`, `BILLING` |
| `invoiceNo` | `String(50)` | No | Yes | Reference invoice number |
| `reason` | `String(500)`| No | No | Human-readable explanation of outcome |

---

### 1.4 `Exceptions` (Actionable Discrepancies)
Discrepancy items requiring operational investigation and sign-off.

| Field Name | Type | Key | Mandatory | Description |
|---|---|---|---|---|
| `ID` | `UUID` | Yes | Yes | Primary Key |
| `matchResult_ID` | `UUID` | No | Yes | FK to `MatchResults` |
| `invoiceNo` | `String(50)` | No | Yes | Invoice number under review |
| `outcomeCode` | `String(40)` | No | Yes | Discrepancy code |
| `status` | `String(20)` | No | Yes | Lifecycle: `OPEN`, `ASSIGNED`, `IN_REVIEW`, `RESOLVED`, `DISPUTED` |
| `priority` | `String(5)` | No | Yes | Priority level: `P1` (Critical), `P2` (Medium), `P3` (Low) |
| `assignedTo` | `String(50)` | No | No | User/role assigned to resolve exception |
| `ageInDays` | `Integer` | No | Yes | Aging calculated from invoice date |
| `msmeAlert` | `Boolean` | No | Yes | True if vendor is MSME (45-day statutory compliance) |
| `recommendedAction`| `String(500)`| No | No | Actionable guidance for the resolving persona |

---

### 1.5 `VendorMaster` (Supplier Business Partner)
Master data entity representing registered suppliers.

| Field Name | Type | SAP Mapping | Description |
|---|---|---|---|
| `businessPartner` | `String(20)` | `BUT000-PARTNER` / `LFA1-LIFNR` | Business Partner / Vendor Code |
| `businessPartnerName` | `String(100)`| `BUT000-NAME_ORG1` | Vendor Legal Entity Name |
| `taxNumber1` | `String(20)` | `LFA1-STCD1` | Vendor GSTIN (India) |
| `pan` | `String(10)` | `J_1IPANNO` | Permanent Account Number (PAN) |
| `isMsme` | `Boolean` | Custom attribute | MSME registration status |
| `paymentTerms` | `String(10)` | `LFB1-ZTERM` | SAP Payment terms (e.g. `NT30`, `NT45`) |

---

### 1.6 Additional Entities
* **`GrirSnapshot`**: Mirrors SAP `MR11` GR/IR balances (`purchaseOrder`, `poItem`, `goodsReceiptQty`, `invoicedQuantity`, `grirAmount`).
* **`PurchaseOrders`**: Mirrors SAP `ME23N` PO line items (`purchaseOrder`, `poItem`, `poQty`, `poAmount`, `supplier`).
* **`PurchaseRequisitions`**: Mirrors SAP `ME53N` PR headers & items (`prNumber`, `material`, `qty`, `amount`, `status`).
* **`Gstr2bInvoices`**: Government GSTN portal auto-drafted ITC register.
* **`WorkflowHistory`**: Full audit trail of status transitions per exception.
* **`AuditLog`**: System-level ledger of all data modifications and matching executions.
