using vendorrecon.db as db from '../db/schema';

service ReconciliationService @(path:'/api/v1') {
  entity VendorDocLines    as projection on db.VendorDocLines;
  entity VendorLedgerItems as projection on db.VendorLedgerItems;
  entity MatchResults      as projection on db.MatchResults;
  entity Exceptions        as projection on db.Exceptions;
  @readonly entity AuditLog as projection on db.AuditLog;
  entity StatementUploads  as projection on db.StatementUploads;
  entity WorkflowHistory   as projection on db.WorkflowHistory;
  entity Gstr2bInvoices    as projection on db.Gstr2bInvoices;

  action seedSapMockData(fileBase64: String) returns String;
  action uploadStatement(fileBase64: String, companyCode: String, period: String, fiscalYear: String, fileName: String) returns String;
  action runMatching(statementUploadId: UUID) returns String;
  action resolveException(exceptionId: UUID, note: String) returns String;
  action reopenException(exceptionId: UUID) returns String;
  action raiseDispute(exceptionId: UUID, comment: String) returns String;
  function getCockpitKpis() returns String;

  action register(username: String, email: String, password: String, fullName: String, businessRole: String, vendorCode: String) returns String;
  action login(username: String, password: String) returns String;
}