const XLSX = require('xlsx');
const cds = require('@sap/cds');
const { parseSheet } = require('./xlsx-utils');

module.exports = (srv) => {
  srv.on('seedSapMockData', async (req) => {
    const { fileBase64 } = req.data;
    const workbook = XLSX.read(Buffer.from(fileBase64, 'base64'), { type: 'buffer' });
    const { VendorLedgerItems, GrirSnapshot, VendorMaster } = cds.entities;

    const ledgerSheet = parseSheet(workbook.Sheets['VendorLedgerItems'], 'Supplier');
    const grirSheet   = parseSheet(workbook.Sheets['GrirSnapshot'], 'PurchaseOrder');
    const masterSheet = parseSheet(workbook.Sheets['VendorMaster'], 'BusinessPartner');

    await DELETE.from(VendorLedgerItems);
    await DELETE.from(GrirSnapshot);
    await DELETE.from(VendorMaster);

    await INSERT.into(VendorLedgerItems).entries(ledgerSheet.map(row => ({
      ID: cds.utils.uuid(),
      supplier: String(row.Supplier),
      companyCode: String(row.CompanyCode),
      accountingDocument: String(row.AccountingDocument),
      documentDate: row.DocumentDate,
      postingDate: row.PostingDate,
      amountInTransCrcy: row.AmountInTransCrcy,
      transactionCurrency: row.TransactionCurrency,
      clearingDocument: row.ClearingDocument || null,
      isCleared: !!row.ClearingDocument,
      taxAmount: row.TaxAmount || 0,
    })));

    await INSERT.into(GrirSnapshot).entries(grirSheet.map(row => ({
      ID: cds.utils.uuid(),
      purchaseOrder: String(row.PurchaseOrder),
      purchaseOrderItem: String(row.PurchaseOrderItem),
      goodsReceiptQty: row.GoodsReceiptQty,
      invoicedQuantity: row.InvoicedQuantity,
      grirAmount: row.GrirAmount,
      plant: String(row.Plant),
      supplier: String(row.Supplier),
    })));

    await INSERT.into(VendorMaster).entries(masterSheet.map(row => ({
      ID: cds.utils.uuid(),
      businessPartner: String(row.BusinessPartner),
      businessPartnerName: row.BusinessPartnerName,
      taxNumber1: row.TaxNumber1,
      paymentTerms: row.PaymentTerms,
      currency: row.Currency,
    })));

    return `Seeded: ${ledgerSheet.length} ledger items, ${grirSheet.length} GR/IR rows, ${masterSheet.length} vendors`;
  });
};