using vendorrecon.db as db from '../db/schema';

service ReconciliationService @(path:'/api/v1') {

  // ── Core Reconciliation Entities ────────────────────────────────────────
  entity VendorDocLines       as projection on db.VendorDocLines;
  entity VendorLedgerItems    as projection on db.VendorLedgerItems;
  entity MatchResults         as projection on db.MatchResults;
  entity Exceptions           as projection on db.Exceptions;
  @readonly entity AuditLog   as projection on db.AuditLog;
  entity StatementUploads     as projection on db.StatementUploads;
  entity WorkflowHistory      as projection on db.WorkflowHistory;
  entity Gstr2bInvoices       as projection on db.Gstr2bInvoices;

  // ── P2P Entities ─────────────────────────────────────────────────────────
  entity PurchaseRequisitions as projection on db.PurchaseRequisitions;
  entity PurchaseOrders       as projection on db.PurchaseOrders;

  // ── Master Data (Read-Only) ───────────────────────────────────────────────
  @readonly entity VendorMaster   as projection on db.VendorMaster;
  @readonly entity GrirSnapshot   as projection on db.GrirSnapshot;

  // ── Seed / Data Actions ──────────────────────────────────────────────────
  // [DEMO SIMULATION] Seeds mock SAP ledger data from Excel file
  action seedSapMockData(fileBase64: String) returns String;

  // ── Statement & Matching Actions ─────────────────────────────────────────
  action uploadStatement(
    fileBase64:  String,
    companyCode: String,
    period:      String,
    fiscalYear:  String,
    fileName:    String
  ) returns String;

  action runMatching(statementUploadId: UUID) returns String;

  // ── Exception Actions ────────────────────────────────────────────────────
  action resolveException(exceptionId: UUID, note: String)            returns String;
  action reopenException(exceptionId: UUID)                           returns String;
  action raiseDispute(exceptionId: UUID, comment: String)             returns String;
  action assignException(exceptionId: UUID, assignedTo: String)       returns String;

  // ── KPI ──────────────────────────────────────────────────────────────────
  function getCockpitKpis() returns String;

  // ── Authentication ────────────────────────────────────────────────────────
  // [DEMO] Zero-friction demo persona login — no password required
  action demoLogin(personaKey: String) returns String;
  // Standard credential login
  action login(username: String, password: String) returns String;
  // User registration (not needed in demo mode — use demoLogin instead)
  action register(
    username:     String,
    email:        String,
    password:     String,
    fullName:     String,
    businessRole: String,
    vendorCode:   String
  ) returns String;

  // ── [DEMO] Reset Action ───────────────────────────────────────────────────
  // Clears all reconciliation runtime data. NEVER touches SAP data.
  action resetDemo() returns String;

  // ── P2P Workflow Actions (DEMO SIMULATION — no SAP integration) ───────────
  // [DEMO] Simulates SAP ME51N Purchase Requisition creation
  action createPR(material: String, qty: Decimal(13,3), amount: Decimal(15,2)) returns String;
  // [DEMO] Simulates SAP PR approval
  action approvePR(prId: UUID) returns String;
  // [DEMO] Simulates SAP ME21N Purchase Order creation
  action createPO(prId: UUID, purchaseOrder: String, supplier: String) returns String;
  // [DEMO] Simulates PO dispatch to vendor
  action sendPOToVendor(poId: UUID) returns String;
  // [DEMO] Simulates vendor dispatching goods
  action dispatchGoods(poId: UUID) returns String;
  // [DEMO] Simulates SAP MIGO Goods Receipt posting (Movement Type 101)
  action postGR(poId: UUID, grQty: Decimal(13,3), plant: String) returns String;
  // [DEMO] Simulates Finance approval for AP payment
  action approveForPayment(docLineId: UUID) returns String;
  // [DEMO] Simulates SAP F110 Payment Proposal creation
  action createPaymentProposal(docLineIds: String) returns String;
  // [DEMO] Simulates SAP F110 Automatic Payment Run execution
  action executePaymentRun(paymentRef: String, docLineIds: String) returns String;
}