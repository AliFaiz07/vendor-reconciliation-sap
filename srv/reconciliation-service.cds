using vendorrecon.db as db from '../db/schema';

service ReconciliationService @(path:'/api/v1') {
  entity VendorDocLines    as projection on db.VendorDocLines;
  entity VendorLedgerItems as projection on db.VendorLedgerItems;
  entity MatchResults      as projection on db.MatchResults;
  entity Exceptions        as projection on db.Exceptions;
  @readonly entity AuditLog as projection on db.AuditLog;

  action seedSapMockData(fileBase64: String) returns String;
  action uploadStatement(fileBase64: String) returns String;
  action runMatching(statementUploadId: UUID) returns String;
  action resolveException(exceptionId: UUID, note: String) returns String;
  action reopenException(exceptionId: UUID) returns String;
  function getCockpitKpis() returns String;
}