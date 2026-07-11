namespace vendorrecon.db;
using { cuid, managed } from '@sap/cds/common';

entity VendorLedgerItems : cuid, managed {
  supplier             : String(10);
  companyCode          : String(4);
  accountingDocument   : String(10);
  documentDate         : Date;
  postingDate          : Date;
  amountInTransCrcy    : Decimal(15,2);
  transactionCurrency  : String(3);
  clearingDocument     : String(10);
  isCleared            : Boolean;
  taxAmount            : Decimal(15,2);
}

entity GrirSnapshot : cuid, managed {
  purchaseOrder        : String(10);
  purchaseOrderItem    : String(5);
  goodsReceiptQty      : Decimal(13,3);
  invoicedQuantity     : Decimal(13,3);
  grirAmount           : Decimal(15,2);
  plant                : String(4);
  supplier             : String(10);
}

entity VendorMaster : cuid, managed {
  businessPartner      : String(10);
  businessPartnerName  : String(80);
  taxNumber1           : String(20);
  paymentTerms         : String(4);
  currency             : String(3);
  pan                  : String(10);
  state                : String(30);
  tdsSection           : String(10);
  isMsme               : Boolean;
}

entity VendorDocLines : cuid, managed {
  statementUploadId    : UUID;
  vendorInvoiceNo       : String(16);
  invoiceDate           : Date;
  invoiceAmount         : Decimal(15,2);
  currency              : String(3);
  poReference           : String(10);
  gstTdsAmount          : Decimal(15,2);
  paymentReference      : String(10);
  sourceVendorCode      : String(10);
  sourceGstin           : String(20);
  irn                   : String(64);
  irnStatus             : String(20);
  eWayBill              : String(20);
  gstr2bStatus          : String(20);
}

entity MatchResults : cuid, managed {
  vendorDocLine    : Association to VendorDocLines;
  ledgerItem       : Association to VendorLedgerItems;
  outcomeCode      : String(40);
  amountDelta      : Decimal(15,2);
  matchRuleApplied : String(40);
  businessRole     : String(30);
  invoiceNo        : String(30);
  reason           : String(255);
}
 
entity Exceptions : cuid, managed {
  matchResult      : Association to MatchResults;
  invoiceNo        : String(30);
  outcomeCode      : String(40);
  status           : String(20) default 'OPEN';
  recommendedAction : String(500);
  assignedTo       : String(80);
  sbpaInstanceId   : String(60);
  priority         : String(10);
  ageInDays        : Integer;
  msmeAlert        : Boolean;
}

entity AuditLog : cuid, managed {
  entityName     : String(40);
  entityKey      : String(60);
  action         : String(20);
  performedBy    : String(80);
  afterValue     : LargeString;
  performedAt    : Timestamp;
}

entity Users : cuid {
  username     : String(50);
  email        : String(100);
  passwordHash : String(200);
  fullName     : String(100);
  businessRole : String(30);
}

entity PurchaseOrders : cuid, managed {
  purchaseOrder : String(10);
  poItem        : String(5);
  poQty         : Decimal(13,3);
  poAmount      : Decimal(15,2);
  supplier      : String(10);
}