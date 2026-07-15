# Demo Guide: Persona Registration, Login, & Functioning Flows

This guide outlines the step-by-step registration, login, and business functioning flow for every system persona. Use this to demonstrate user onboarding, secure authentication, and role-based action isolation.

---

## 📡 Core API Base URL
When running the server (`npm run watch`), the API endpoint is:
`http://localhost:4004/api/v1`

---

## 1. PR Indenter (Purchase Requisition Creator)
* **Business Role**: `PR`
* **Purpose**: Creates purchase requisitions for materials. Restricted from viewing financials or vendor statements.

### Step A: Registration
* **Endpoint**: `/register` (POST)
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "username": "demo_pr_user",
    "email": "pr.demo@company.com",
    "password": "admin",
    "fullName": "PR Indenter (Demo)",
    "businessRole": "PR"
  }
  ```
* **Expected Response**: `"Registered"`

### Step B: Login
* **Endpoint**: `/login` (POST)
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "username": "demo_pr_user",
    "password": "admin"
  }
  ```

![PR Indenter Login](file:///C:/Users/ali/OneDrive - Abhiyanta India Solutions Pvt Ltd/Pictures/Screenshots/Screenshot%202026-07-15%20170051.png)

* **Expected Response**:
  ```json
  {
    "ID": "894e7ed9-7105-47a0-af14-a7044c359b94",
    "username": "demo_pr_user",
    "email": "pr.demo@company.com",
    "fullName": "PR Indenter (Demo)",
    "businessRole": "PR",
    "vendorCode": null
  }
  ```

### Step C: Functioning (Actions)
Once logged in, the PR Indenter can submit a new purchase requisition:
* **Endpoint**: `/createPR` (POST)
* **Headers**:
  ```http
  Content-Type: application/json
  x-user-role: PR
  ```
* **Request Body**:
  ```json
  {
    "material": "High Tensile Bolts 12mm",
    "qty": 200,
    "amount": 40000
  }
  ```
* **Expected Response**:
  ```json
  {
    "value": "{\"prId\":\"<Generated_PR_UUID>\",\"prNumber\":\"PR-0000001\"}"
  }
  ```

---

## 2. PO Officer (Purchase Order Approver & Generator)
* **Business Role**: `PO`
* **Purpose**: Reviews pending requisitions, approves them, maps them to vendors, and generates formal POs.

### Step A: Registration
* **Endpoint**: `/register` (POST)
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "username": "demo_po_user",
    "email": "po.demo@company.com",
    "password": "admin",
    "fullName": "PO Officer (Demo)",
    "businessRole": "PO"
  }
  ```
* **Expected Response**: `"Registered"`

### Step B: Login
* **Endpoint**: `/login` (POST)
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "username": "demo_po_user",
    "password": "admin"
  }
  ```

![PO Officer Login](file:///C:/Users/ali/OneDrive - Abhiyanta India Solutions Pvt Ltd/Pictures/Screenshots/Screenshot%202026-07-15%20170127.png)

* **Expected Response**:
  ```json
  {
    "ID": "23d650b9-2df8-4aa7-ae0c-5ecb9132aa50",
    "username": "demo_po_user",
    "email": "po.demo@company.com",
    "fullName": "PO Officer (Demo)",
    "businessRole": "PO",
    "vendorCode": null
  }
  ```

### Step C: Functioning (Actions)
The PO Officer approves the PR, creates the PO, and sends it to the Vendor:
1. **Approve PR**:
   * **Endpoint**: `/approvePR` (POST)
   * **Headers**: `x-user-role: PO`
   * **Request Body**:
     ```json
     {
       "prId": "<PR_UUID_FROM_STEP_1>"
     }
     ```
2. **Convert to PO**:
   * **Endpoint**: `/createPO` (POST)
   * **Headers**: `x-user-role: PO`
   * **Request Body**:
     ```json
     {
       "prId": "<PR_UUID_FROM_STEP_1>",
       "purchaseOrder": "PO-45000099",
       "supplier": "V-1001"
     }
     ```
3. **Dispatch PO to Vendor**:
   * **Endpoint**: `/sendPOToVendor` (POST)
   * **Headers**: `x-user-role: PO`
   * **Request Body**:
     ```json
     {
       "poId": "<PO_UUID_FROM_SUBSTEP_2>"
     }
     ```

---

## 3. Vendor (Supplier Portal Account)
* **Business Role**: `VENDOR` (or `AR`)
* **Purpose**: External role. Vendor logs in to see their specific POs, mark dispatch status, upload bills, and view matched lines.
* **Row-Level Security**: Isolated strictly to their own `vendorCode`.

### Step A: Registration
* **Endpoint**: `/register` (POST)
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "username": "V-1001",
    "email": "portal.v1001@vendor.com",
    "password": "admin",
    "fullName": "Sigma Supplier Portal",
    "businessRole": "VENDOR",
    "vendorCode": "V-1001"
  }
  ```

### Step B: Login
* **Endpoint**: `/login` (POST)
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "username": "V-1001",
    "password": "admin"
  }
  ```

### Step C: Functioning (Actions)
1. **Dispatch PO Goods**:
   * **Endpoint**: `/dispatchGoods` (POST)
   * **Headers**:
     ```http
     x-user-role: Vendor
     x-user-vendor: V-1001
     ```
   * **Request Body**:
     ```json
     {
       "poId": "<PO_UUID_FROM_STEP_2>"
     }
     ```
2. **Submit Invoice Document**:
   * **Endpoint**: `/VendorDocLines` (POST)
   * **Headers**:
     ```http
     x-user-role: Vendor
     x-user-vendor: V-1001
     ```
   * **Request Body**:
     ```json
     {
       "vendorInvoiceNo": "INV-SIGMA-99",
       "invoiceDate": "2026-07-15",
       "invoiceAmount": 40000,
       "currency": "INR",
       "poReference": "PO-45000099",
       "sourceVendorCode": "V-1001"
     }
     ```

---

## 4. Goods Receipt Specialist (Warehouse / MIGO Clerk)
* **Business Role**: `GR`
* **Purpose**: Posts Goods Receipts and resolves physical quantity discrepancies.

### Step A: Registration
* **Endpoint**: `/register` (POST)
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "username": "demo_gr_user",
    "email": "gr.demo@company.com",
    "password": "admin",
    "fullName": "Warehouse GR Agent",
    "businessRole": "GR"
  }
  ```

### Step B: Login
* **Endpoint**: `/login` (POST)
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "username": "demo_gr_user",
    "password": "admin"
  }
  ```

### Step C: Functioning (Actions)
1. **Post GR (MIGO)**:
   * **Endpoint**: `/postGR` (POST)
   * **Headers**: `x-user-role: GR`
   * **Request Body**:
     ```json
     {
       "poId": "<PO_UUID_FROM_STEP_2>",
       "grQty": 200,
       "plant": "1000"
     }
     ```
2. **Resolve Quantity Discrepancy Exception**:
   * **Endpoint**: `/resolveException` (POST)
   * **Headers**: `x-user-role: GR`
   * **Request Body**:
     ```json
     {
       "exceptionId": "<Exception_UUID>",
       "note": "Quantities verified physically; corrections posted in ERP."
     }
     ```

---

## 5. Finance Executive (Invoice Auditor / MIRO Specialist)
* **Business Role**: `FINANCE`
* **Purpose**: Performs invoice clearing simulations (MIRO), initiates matching algorithms, and clears/approves lines for payment.

### Step A: Registration
* **Endpoint**: `/register` (POST)
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "username": "demo_finance_user",
    "email": "fin.demo@company.com",
    "password": "admin",
    "fullName": "Finance Auditor",
    "businessRole": "FINANCE"
  }
  ```

### Step B: Login
* **Endpoint**: `/login` (POST)
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "username": "demo_finance_user",
    "password": "admin"
  }
  ```

### Step C: Functioning (Actions)
1. **Simulate MIRO Entry (Post to Ledger)**:
   * **Endpoint**: `/VendorLedgerItems` (POST)
   * **Headers**: `x-user-role: FINANCE`
   * **Request Body**:
     ```json
     {
       "supplier": "V-1001",
       "companyCode": "1000",
       "accountingDocument": "INV-SIGMA-99",
       "documentDate": "2026-07-15",
       "postingDate": "2026-07-15",
       "amountInTransCrcy": 40000,
       "transactionCurrency": "INR",
       "isCleared": false
     }
     ```
2. **Execute Reconciliation Matching**:
   * **Endpoint**: `/runMatching` (POST)
   * **Headers**: `x-user-role: FINANCE`
   * **Request Body**: `{}`

![Reconciliation Matching Run](file:///C:/Users/ali/OneDrive - Abhiyanta India Solutions Pvt Ltd/Pictures/Screenshots/Screenshot%202026-07-15%20170409.png)
3. **Approve Cleared Invoice for AP Payment**:
   * **Endpoint**: `/approveForPayment` (POST)
   * **Headers**: `x-user-role: FINANCE`
   * **Request Body**:
     ```json
     {
       "docLineId": "<INVOICE_DOCLINE_UUID>"
     }
     ```

---

## 6. Accounts Payable Manager (Admin / Controller)
* **Business Role**: `AP`
* **Purpose**: General controller. Oversees uploads, raises disputes on pending invoices, prepares payment proposals, and triggers final UTR-clearing payments.

### Step A: Registration
* **Endpoint**: `/register` (POST)
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "username": "demo_ap_user",
    "email": "ap.demo@company.com",
    "password": "admin",
    "fullName": "Accounts Payable Controller",
    "businessRole": "AP"
  }
  ```

### Step B: Login
* **Endpoint**: `/login` (POST)
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "username": "demo_ap_user",
    "password": "admin"
  }
  ```

### Step C: Functioning (Actions)
1. **Raise Exception Dispute**:
   * **Endpoint**: `/raiseDispute` (POST)
   * **Headers**: `x-user-role: AP`
   * **Request Body**:
     ```json
     {
       "exceptionId": "<Exception_UUID>",
       "comment": "Audit discrepancy. Dispute initiated."
     }
     ```
2. **Create Payment Proposal**:
   * **Endpoint**: `/createPaymentProposal` (POST)
   * **Headers**: `x-user-role: AP`
   * **Request Body**:
     ```json
     {
       "docLineIds": "[\"<INVOICE_DOCLINE_UUID>\"]"
     }
     ```
3. **Execute Payment Run**:
   * **Endpoint**: `/executePaymentRun` (POST)
   * **Headers**: `x-user-role: AP`
   * **Request Body**:
     ```json
     {
       "paymentRef": "UTR-F110-XYZ",
       "docLineIds": "[\"<INVOICE_DOCLINE_UUID>\"]"
     }
     ```
