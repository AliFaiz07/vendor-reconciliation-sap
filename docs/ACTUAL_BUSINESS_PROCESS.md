# ACTUAL BUSINESS PROCESS — VENDOR RECONCILIATION

**Context**: Indian manufacturing company using SAP ECC/S4HANA
**Date**: 2026-09-28
**Note**: This document reflects the SAP P2P + Vendor Reconciliation process as implemented in this application (DEMO/MOCK). Fields marked `TO BE VERIFIED` require client confirmation.

---

## PROCESS OVERVIEW

```
Purchase Requisition (ME51N)
        ↓
Purchase Order (ME21N)
        ↓
Send PO to Supplier
        ↓
Supplier Dispatches Goods
        ↓
Goods Receipt (MIGO — MVMT 101)
        ↓
Supplier Issues Invoice (IRN via e-Invoice portal)
        ↓
Invoice Verification (MIRO / FB60)
        ↓
[Application] Upload Vendor Statement
        ↓
[Application] Run Reconciliation Engine
        ↓
Matched → Approve for Payment → F110 Payment Run
Unmatched → Exception Handling → Resolve → AP Payment
        ↓
Clearing (F-44 / F-28)
```

---

## STEP 1: PURCHASE REQUISITION

| Attribute | Value |
|---|---|
| SAP Transaction | ME51N |
| SAP Object | PurchaseRequisition |
| SAP Table | EBAN |
| Persona | PR Indenter |
| Status Flow | PENDING → APPROVED → PO_CREATED |
| Application Role | Local simulation — no SAP MM integration |
| Mock | YES — `createPR` action in CAP service |
| Input | Material description, Qty, Estimated Amount |
| Output | PR Number (PR-XXXXXX) |
| Approval | PO Officer approves via `approvePR` |
| TO BE VERIFIED | Material master, cost center, G/L account assignment |

---

## STEP 2: PURCHASE ORDER

| Attribute | Value |
|---|---|
| SAP Transaction | ME21N |
| SAP Object | PurchaseOrder |
| SAP Table | EKKO (header) + EKPO (item) |
| Persona | PO Officer |
| Status Flow | CREATED → APPROVED → SENT → DISPATCHED → GR_POSTED |
| Application Role | Local simulation — no SAP MM/SRM integration |
| Mock | YES — `createPO` action in CAP service |
| Input | PR ID, PO Number, Supplier (Vendor Code) |
| Output | PO Number (PO-4500XXXXXX) |
| Vendor Interaction | `sendPOToVendor` sets status to SENT |
| TO BE VERIFIED | Purchasing organization, purchasing group, payment terms, incoterms |

---

## STEP 3: GOODS RECEIPT

| Attribute | Value |
|---|---|
| SAP Transaction | MIGO (Movement Type 101) |
| SAP Object | MaterialDocument |
| SAP Table | MKPF (header) + MSEG (items) |
| Persona | GR Specialist (Warehouse) |
| Status Flow | PO SENT → DISPATCHED → GR_POSTED |
| Application Role | `postGR` action updates GrirSnapshot + PurchaseOrders |
| Mock | YES — no SAP GR document created |
| Input | PO ID, GR Quantity, Plant |
| Output | Updated GrirSnapshot (GR Qty, GR/IR Amount) |
| SAP Impact | In real SAP: creates GR document, updates GR/IR clearing account (GRIR) |
| TO BE VERIFIED | Plant assignment, storage location, batch management, quality inspection |

---

## STEP 4: VENDOR INVOICE (e-Invoice / MIRO)

| Attribute | Value |
|---|---|
| SAP Transaction | MIRO / FB60 |
| SAP Object | AccountingDocument (VendorInvoice) |
| SAP Table | BKPF (header) + BSEG (items) |
| Persona | Finance Executive |
| Application Role | Simulated via VendorLedgerItems seeding from Excel |
| Mock | YES — ledger loaded from SAP_Ledger_Mock.xlsx |
| Indian Compliance | e-Invoice (IRN) mandatory for businesses > ₹5Cr turnover |
| Input | Invoice Number, Amount, PO Reference, Tax (GST + TDS) |
| Output | Accounting document in VendorLedgerItems table |
| SAP Integration Required | Real MIRO API: `API_VENDOR_INVOICE_SRV` (S/4HANA) or BAPI_INCOMINGINVOICE_CREATE (ECC) |
| Real SAP Fields | BELNR (Accounting Doc), BUKRS (Company Code), LIFNR (Vendor), DMBTR (Amount), MWSKZ (Tax Code), WRBTR (Amount in transaction currency) |

---

## STEP 5: VENDOR STATEMENT UPLOAD

| Attribute | Value |
|---|---|
| Persona | Vendor (AR team) or Finance Executive |
| Action | Upload Excel statement via UI |
| Application | `uploadStatement` action parses XLSX, creates StatementUploads + VendorDocLines |
| Mock | DEMO — uses local Excel upload; real system would use vendor portal EDI, email, or API |
| Input | Excel file with invoice lines (InvoiceNo, Amount, PO Ref, GST, TDS, Date, IRN, eWayBill) |
| Output | `StatementUploads` record + `VendorDocLines` records |
| Statement Supersession | New upload for same vendor+period supersedes previous |

---

## STEP 6: RECONCILIATION ENGINE

| Attribute | Value |
|---|---|
| Persona | Finance Executive / AP Manager |
| Action | `runMatching` |
| Direction | Forward: Vendor Statement → SAP Ledger; Reverse: SAP Ledger → Vendor Statement |
| Outcome Codes | MATCHED, MATCHED/3WAY, MATCHED/NEAR-MATCH, MATCHED/ROUNDING, MATCHED/TIMING, MATCHED/TDS-194Q, UNMATCHED/*, MISSING_IN_STATEMENT |
| Rules | Invoice No match, Amount match (±₹1 tolerance), Currency, Date (±7 days), PO/GR, GST/TDS, Payment Ref |
| Scenarios | 10 pre-defined test cases (TC001–TC010) |
| Consolidation | One outcome per statement line (best-result wins) |
| Mock | Matching engine runs REAL business logic on MOCK SAP data |

---

## STEP 7: EXCEPTION MANAGEMENT

| Attribute | Value |
|---|---|
| Persona | Finance / AP / GR / Vendor (based on exception type) |
| Status Flow | OPEN → ASSIGNED → IN_REVIEW → RESOLVED (also DISPUTED, REOPENED) |
| Current Implementation | OPEN → ASSIGNED → RESOLVED / OPEN → DISPUTED / RESOLVED → OPEN (reopen) |
| Routing | Exception businessRole determines responsible persona |
| Exception Types | Price mismatch (→ MIRO), Qty mismatch (→ GR), GST gap (→ Finance/Vendor), Payment missing (→ AP) |
| Actions | resolveException, reopenException, raiseDispute, assignException |

---

## STEP 8: PAYMENT APPROVAL

| Attribute | Value |
|---|---|
| SAP Transaction | F110 (Automatic Payment Run) |
| SAP Object | PaymentDocument |
| SAP Table | REGUH (payment header) + REGUP (payment items) |
| Persona | Accounts Payable Manager |
| Status Flow | UNPAID → APPROVED → PROPOSED → PAID |
| Application | `approveForPayment` → `createPaymentProposal` → `executePaymentRun` |
| Mock | YES — DEMO SIMULATION only; no SAP FI integration |
| Real SAP | Would post to SAP clearing account, issue bank transfer |
| TO BE VERIFIED | Bank determination, house bank, payment method, DME format, bank communication |
| Label | **[DEMO SIMULATION — Not real SAP F110]** |

---

## STEP 9: CLEARING

| Attribute | Value |
|---|---|
| SAP Transaction | F-44 (Manual), F110 (Auto) |
| SAP Object | ClearingDocument |
| Persona | Accounts Payable |
| Application | `executePaymentRun` sets `isCleared=true` and `clearingDocument=paymentRef` on VendorLedgerItems |
| Mock | YES — simulated clearing in local DB |
| Label | **[DEMO SIMULATION — Not real SAP clearing]** |

---

## GST (INDIA-SPECIFIC)

| Item | Description | Status |
|---|---|---|
| GSTR-2B | Buyer's monthly purchase register from GSTN | MOCK — static data seeded |
| ITC Eligibility | Invoice must appear in GSTR-2B to claim Input Tax Credit | Checked via `Gstr2bInvoices` table |
| GST Mismatch | TC006 scenario — UNMATCHED/GST-2B-GAP when invoice not in 2B | DEMO logic implemented |
| GSTIN | 15-character GST Identification Number | Stored in `sourceGstin` (VendorDocLines) and `taxNumber1` (VendorMaster) |
| HSN Code | Harmonized System Nomenclature code | Stored in `hsnCode` field |
| Place of Supply | State code determining IGST vs CGST/SGST | Stored in `placeOfSupply` field |
| e-Invoice IRN | Invoice Reference Number from IRP (Invoice Registration Portal) | Stored in `irn` field |
| Real Integration | GSTN API (sandbox available at sandbox.einvoice6.gst.gov.in) | TO BE VERIFIED |

---

## TDS (INDIA-SPECIFIC)

| Item | Description | Status |
|---|---|---|
| TDS Section 194Q | Buyer deducts TDS at 0.1% on purchases > ₹50L from MSME vendors | MOCK logic in TC007 |
| TDS Amount | Validated against `gstTdsAmount` field in vendor statement | DEMO only |
| PAN | Permanent Account Number — required for TDS | Stored in `VendorMaster.pan` |
| Real Integration | SAP TDS configuration (Withholding Tax) — J1INCHLN transaction | TO BE VERIFIED |

---

## MSME FLAGS

| Item | Description | Status |
|---|---|---|
| MSME Alert | Payment to MSME vendors must be cleared within 45 days (MSMED Act 2006) | DEMO flag in `VendorMaster.isMsme` |
| Alert Trigger | Exception created with `msmeAlert = true` for MSME vendors with exceptions | Implemented |
| Real Integration | MSME registration number from UDYAM portal | TO BE VERIFIED |

---

*All SAP transactions listed are standard SAP ECC / S4HANA. None are called directly by this application in its current DEMO state.*
