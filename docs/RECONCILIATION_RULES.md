# RECONCILIATION RULES & MATCHING ENGINE SPECIFICATION

**Project**: Vendor Reconciliation & Match Exception Engine
**Author**: SAP Solution Architect & Engine Core Team
**Date**: 2026-09-28
**Architecture**: 2-Way Deterministic Matching with Best-Result Consolidation

---

## 1. MATCHING PRINCIPLES

1. **Deterministic & Explainable**: Rules are strict mathematical and business checks. No opaque black-box AI makes arbitrary financial pairings.
2. **Two-Way Reconciliation**:
   * **Forward Reconciliation**: Vendor Billing Statement $\rightarrow$ Internal SAP Sub-ledger.
   * **Reverse Reconciliation**: Internal SAP Sub-ledger $\rightarrow$ Vendor Billing Statement (detects omissions in supplier statements).
3. **Best-Result Consolidation**: Each statement line produces **exactly ONE** consolidated outcome. Conflicting outcomes are strictly prohibited.
4. **Tolerance-Aware**: Configurable price/amount variances ($\pm ₹1.00$ default) and date windows ($\pm 7$ days default).

---

## 2. RECONCILIATION DIMENSIONS

| Dimension | Vendor Statement Source | SAP System Comparison | Tolerance / Logic |
|---|---|---|---|
| **Vendor Identity** | `sourceVendorCode` | `LFA1-LIFNR` / `VendorMaster` | Exact match |
| **Invoice Reference** | `vendorInvoiceNo` | `BKPF-XBLNR` (Reference Document) | Exact or normalized alphanumeric |
| **Gross Amount** | `invoiceAmount` | `BSEG-WRBTR` / `BSEG-DMBTR` | $\le ₹1.00$ tolerance |
| **Currency** | `currency` | `BKPF-WAERS` | ISO code exact match |
| **Posting Date** | `invoiceDate` | `BKPF-BLDAT` (Document Date) | $\pm 7$ days window |
| **PO & Item** | `poReference` / `poItem` | `EKPO-EBELN` / `EBELP` | Order existence & item link |
| **3-Way Quantity** | Invoiced quantity | `GrirSnapshot` (`goodsReceiptQty`) | PO Qty = GR Qty = Inv Qty |
| **GST ITC (India)** | `vendorInvoiceNo` + GSTIN | `Gstr2bInvoices` | Mandatory presence in GSTR-2B |
| **TDS Sec 194Q** | `gstTdsAmount` | 0.1% on purchase value | Withholding compliance check |
| **Payment Status** | `paymentReference` | `BSEG-AUGBL` (Clearing Doc) | Checks if cleared or in transit |

---

## 3. ENGINE EXECUTION PIPELINE

```
                 Statement Ingestion (XLSX)
                            │
                            ▼
              Forward Matching Iteration (Line-by-Line)
                            │
       ┌────────────────────┴────────────────────┐
       ▼                                         ▼
1. Scenario Evaluation (TC001-TC010)   2. Base Rules Evaluation
       │                                         │
       └────────────────────┬────────────────────┘
                            │
                            ▼
                Best-Result Consolidation
            (Scenario > Exact > Variant > Unmatched)
                            │
                            ▼
            Persist Consolidated MatchResult (1 per line)
                            │
                            ▼
        Generate Actionable Exception (if Unmatched)
                            │
                            ▼
              Reverse Reconciliation Pass
        (Scan SAP ledger items not matched in forward)
                            │
                            ▼
     Flag Unmatched SAP items as MISSING_IN_STATEMENT
                            │
                            ▼
                Audit Logging & History
```

---

## 4. CONSOLIDATION PRIORITY HIERARCHY

When multiple rules evaluate against candidate records, the following ranking determines the winning result:

| Rank | Outcome Code | Category | Action Required |
|---|---|---|---|
| **0** | `MATCHED` | Full Exact Match | Auto-approved for payment proposal |
| **1** | `MATCHED/3WAY` | 3-Way Match Passed | Ready for MIRO clearing & payment |
| **2** | `MATCHED/TDS-194Q` | Statutory Match | Cleared with withholding record |
| **3** | `MATCHED/ROUNDING` | Partial Match | Within $\pm ₹5.00$ rounding tolerance |
| **4** | `MATCHED/TIMING` | Partial Match | Date within extended window ($\le 30$ days) |
| **5** | `UNMATCHED/AMOUNT-DIFF` | Discrepancy | Routed to Finance/MIRO for debit/credit note |
| **6** | `UNMATCHED/GR-PENDING` | Discrepancy | Routed to GR Specialist / Warehouse |
| **7** | `UNMATCHED/GST-2B-GAP` | Compliance Gap | Routed to Vendor AR to upload to GSTN |
| **8** | `UNMATCHED/NO-CANDIDATE`| Missing in SAP | Routed to AP to verify invoice receipt |
| **9** | `MISSING_IN_STATEMENT` | Missing in Vendor | Routed to Vendor to review unbilled postings |

---

## 5. STANDARD SCENARIOS (TC001 - TC010)

| Scenario ID | Name | Trigger Condition | Outcome Code | Assignee |
|---|---|---|---|---|
| **TC001** | Standard 3-Way Match | PO Qty = GR Qty = Inv Qty & Price Matches | `MATCHED/3WAY` | AP Manager |
| **TC002** | Quantity Difference | Delivered Qty < Invoiced Qty | `UNMATCHED/QTY-LESS` | GR Specialist |
| **TC003** | Excess Quantity | Invoiced Qty > PO Qty | `UNMATCHED/QTY-MORE` | GR Specialist |
| **TC004** | Price Variance | Invoice Unit Price > PO Price ($> 2\%$) | `UNMATCHED/PRICE-HIGH` | Finance / MIRO |
| **TC005** | Missing GR | PO exists, Invoice received, GR not posted | `UNMATCHED/GR-PENDING` | GR Specialist |
| **TC006** | GST 2B Gap | Invoice not appearing in GSTR-2B register | `UNMATCHED/GST-2B-GAP` | Vendor AR |
| **TC007** | TDS Sec 194Q | Withholding tax calculation variance | `MATCHED/TDS-194Q` | Finance |
| **TC008** | Payment in Transit | SAP posted payment, UTR not on statement | `MATCHED/PAYMENT-TRANSIT`| Accounts Payable|
| **TC009** | Credit Note Missing | Return posted in SAP, no CN from vendor | `UNMATCHED/CN-MISSING` | Vendor AR |
| **TC010** | FX Revaluation | Exchange rate fluctuation on foreign PO | `MATCHED/FX-ROUNDING` | Finance |

---

## 6. REVERSE RECONCILIATION SPECIFICATION

* **Trigger**: Executed automatically upon completion of the forward loop.
* **Scope**: Evaluates all `VendorLedgerItems` for the target vendor and company code.
* **Logic**:
  $$\text{Unmatched SAP Items} = \{ \text{LedgerItem } l \mid l.\text{ID} \notin \text{MatchedLedgerIDs} \}$$
* **Outcome**:
  * Record created in `MatchResults` with `outcomeCode = 'MISSING_IN_STATEMENT'`.
  * Exception generated with `priority = 'P2'` assigned to `AP`.
  * Preserves completeness of audit ledger.
