# INTEGRATION ARCHITECTURE & SAP CONNECTIVITY SPECIFICATION

**Project**: Vendor Reconciliation & Match Exception Engine
**Target Environment**: SAP Business Technology Platform (BTP) Cloud Foundry / Kyma
**Date**: 2026-09-28

---

## 1. INTEGRATION PATTERNS: DEMO VS PRODUCTION

```
+─────────────────────────────────────────────────────────────+
|                         APPLICATION                         |
+─────────────────────────────────────────────────────────────+
                               |
                               v
                     [ SAP ADAPTER LAYER ]
                               |
             +-----------------+-----------------+
             |                                   |
             v                                   v
    +-----------------+                 +-----------------+
    |   MOCK ADAPTER  |                 |   SAP ADAPTER   |
    |  (Current Demo) |                 |  (Target BTP)   |
    +-----------------+                 +-----------------+
             |                                   |
             v                                   v
      Local SQLite DB                     SAP BTP Destination
    (Simulated Actions)                 + Cloud Connector (SCC)
                                                 |
                                                 v
                                        SAP S/4HANA / ECC
                                       (OData APIs & RFCs)
```

---

## 2. SAP BTP DESTINATIONS & INTEGRATION CONTRACTS

In production, the application will communicate with SAP S/4HANA via SAP BTP Destinations configured in the BTP Subaccount:

### 2.1 Destination: `S4HANA_BUSINESS_PARTNER`
* **Target System**: SAP S/4HANA On-Premise or Private Cloud
* **Proxy Type**: `OnPremise` (via SAP Cloud Connector)
* **Authentication**: `OAuth2SAMLBearerAssertion` or `PrincipalPropagation`
* **Target API**: `/sap/opu/odata/sap/API_BUSINESS_PARTNER`
* **Operations**:
  * `GET /A_BusinessPartner`: Retrieve vendor master records, GSTIN, PAN.
  * `GET /A_Supplier`: Retrieve vendor payment terms, bank details, withholding tax codes.

### 2.2 Destination: `S4HANA_PROCUREMENT`
* **Target API**: `/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV`
* **Operations**:
  * `GET /A_PurchaseOrder`: Query PO headers.
  * `GET /A_PurchaseOrderItem`: Query item details, ordered quantities, net prices.

### 2.3 Destination: `S4HANA_MATERIAL_DOCUMENT`
* **Target API**: `/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV`
* **Operations**:
  * `GET /A_MaterialDocumentHeader`: Query goods receipt history (`MIGO`).
  * `GET /A_MaterialDocumentItem`: Retrieve delivered quantities, delivery note references.

### 2.4 Destination: `S4HANA_SUPPLIER_INVOICE`
* **Target API**: `/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV`
* **Operations**:
  * `GET /A_SupplierInvoice`: Query posted invoice documents (`MIRO`).
  * `POST /A_SupplierInvoice`: Post approved supplier invoices (subject to client approval).

### 2.5 Destination: `S4HANA_FINANCIAL_STATUS`
* **Target API**: `/sap/opu/odata/sap/API_FINANCIALSTATUS_SRV`
* **Operations**:
  * Query AP open items, payment clearing status (`BSAK`), clearing document numbers.

---

## 3. INDIAN STATUTORY INTEGRATION (GSTN & E-INVOICE)

| Portal / Authority | Protocol | Sandbox Endpoint | Production Integration |
|---|---|---|---|
| **GSTN GSTR-2B API** | REST / JSON via GSP (GST Suvidha Provider) | `sandbox.gst.gov.in` | Monthly automated fetch of purchase register ITC data |
| **NIC e-Invoice Portal** | REST / JSON (Signed JWT) | `sandbox.einvoice6.gst.gov.in` | Real-time IRN verification & QR code validation |
| **UDYAM Registration** | REST API | Ministry of MSME API | Automated validation of MSME registration certificate |

---

## 4. SECURITY & CREDENTIAL MANAGEMENT
* **Zero Hardcoded Secrets**: No SAP passwords, client IDs, or API keys in source code.
* **Environment Configuration**: BTP Service Bindings (`VCAP_SERVICES`) provide credentials at runtime.
* **Encryption in Transit**: TLS 1.3 mandatory on all inbound and outbound endpoints.
