# IMPLEMENTATION ASSUMPTIONS & VERIFICATION LOG

**Project**: Vendor Reconciliation & Match Exception Engine
**Standard**: SAP S/4HANA Cloud / On-Premise
**Date**: 2026-09-28

---

## 1. EXPLICIT SOURCE-OF-TRUTH CLASSIFICATION

Per Section 1 of the Master Prompt, all system behaviors and data attributes are classified strictly into one of the following statuses:

* `VERIFIED`: Confirmed against verified SAP documentation, standard BAPIs, or verified client processes.
* `DEMO ONLY`: Implemented for local client demonstration flows; requires replacement for production.
* `MOCK`: Synthesized test master data or simulated database state.
* `TO BE VERIFIED`: Requires formal validation from client SAP functional leads.
* `SAP INTEGRATION REQUIRED`: Target architecture mapped, but live RFC/OData connection pending BTP destination setup.

---

## 2. DETAILED ASSUMPTIONS LOG

| ID | Category | Assumption / Specification | Status | Impact & Production Requirement |
|---|---|---|---|---|
| `ASSUMP-01` | Authentication | Browser `sessionStorage` with `demoLogin` profile key is used for zero-friction demo. | `DEMO ONLY` | In production, must be replaced with SAP Cloud Identity Services (IAS) OAuth2/SAML. |
| `ASSUMP-02` | Authorization | Role enforcement uses `x-user-role` and `x-user-vendor` headers evaluated in CAP `before READ`. | `DEMO ONLY` | In production, roles and vendor assignments must be parsed from verified JWT claims. |
| `ASSUMP-03` | P2P Workflow | PR, PO, and GR creation actions modify local SQLite state machine only. | `DEMO SIMULATION` | In production, replace with calls to `API_PURCHASEREQUISITION_PROCESS_SRV` and `API_MATERIAL_DOCUMENT_SRV`. |
| `ASSUMP-04` | MIRO Posting | Invoice posting is simulated; document numbers are deterministically derived from ledger IDs. | `DEMO SIMULATION` | Requires BAPI `BAPI_INCOMINGINVOICE_CREATE` or S/4HANA Supplier Invoice API. |
| `ASSUMP-05` | Payment Run (F110)| Payment proposal and run mark SQLite lines as `PAID` with synthetic UTRs. | `DEMO SIMULATION` | In production, integrates with SAP Bank Communication Management (BCM) or F110 auto-payment. |
| `ASSUMP-06` | GST GSTR-2B | Indian GSTR-2B ITC register is seeded statically in `Gstr2bInvoices` table. | `MOCK` | Requires live GSTN GSP API connectivity or ASP data pipeline. |
| `ASSUMP-07` | TDS 194Q | Withholding tax threshold of ₹50 Lakhs and 0.1% rate is calculated via standard rule. | `VERIFIED` | Rule reflects Section 194Q of Indian Income Tax Act 1961. Target SAP uses Withholding Tax codes. |
| `ASSUMP-08` | MSME 45-day Rule | Vendors flagged with `isMsme = true` trigger auto-escalation to P1 priority. | `VERIFIED` | Complies with Section 15 of MSMED Act 2006. Production requires UDYAM certificate sync. |
| `ASSUMP-09` | Currencies | Primary currency is INR (₹) with single-currency matching; FX revaluation is rule TC010. | `TO BE VERIFIED` | Client must confirm if multi-currency triangulation (USD/EUR to INR) is required. |
| `ASSUMP-10` | Plant / Storage | Default plant is set to `1000`; storage location validation is bypassed. | `TO BE VERIFIED` | Client MM consultant must provide plant-storage location determination rules. |
| `ASSUMP-11` | Tolerance Limits | Price variance tolerance threshold is $\le 2\%$; amount variance tolerance is $\pm ₹1.00$. | `TO BE VERIFIED` | Client AP policy must confirm contract tolerance percentages. |

---

## 3. CLIENT VERIFICATION WORKSHOP AGENDA

Prior to initiating production deployment on SAP BTP, the following items must be formally ratified:

1. **Vendor Master Fields**: Confirmation of whether Business Partner (`BUT000`) or Classic Vendor (`LFA1`) is the primary master object.
2. **Tolerance Logic**: Exact tolerance keys configured in SAP IMG transaction `OMR6` (e.g., `PP` - Price Variance, `BD` - Small Differences).
3. **Dispute Management**: Confirmation of whether SAP FSCM Dispute Management (`UDM_DISPUTE`) is licensed and active.
4. **Bank Interface**: Format required for payment advice / DME files (e.g., ISO 20022 XML `pain.001` or country-specific flat files).
