const XLSX = require('xlsx');
const cds = require('@sap/cds');
const { parseSheet } = require('./xlsx-utils');

const log = cds.log('seed-handler');

module.exports = (srv) => {
  /**
   * Action handler to seed SAP mock master data from an Excel file
   */
  srv.on('seedSapMockData', async (req) => {
    try {
      const { fileBase64 } = req.data;
      if (!fileBase64) return req.error(400, 'Mock file data is missing.');

      const workbook = XLSX.read(Buffer.from(fileBase64, 'base64'), { type: 'buffer' });

      // Validate sheet existence
      if (!workbook.Sheets['VendorMaster']) return req.error(400, "Required sheet 'VendorMaster' not found in Excel workbook.");
      if (!workbook.Sheets['GrirSnapshot']) return req.error(400, "Required sheet 'GrirSnapshot' not found in Excel workbook.");
      if (!workbook.Sheets['VendorLedgerItems']) return req.error(400, "Required sheet 'VendorLedgerItems' not found in Excel workbook.");

      const ledgerSheet = parseSheet(workbook.Sheets['VendorLedgerItems'], 'Supplier');
      const grirSheet   = parseSheet(workbook.Sheets['GrirSnapshot'], 'PurchaseOrder');
      const masterSheet = parseSheet(workbook.Sheets['VendorMaster'], 'BusinessPartner');
      const poSheet     = workbook.Sheets['PurchaseOrders'] ? parseSheet(workbook.Sheets['PurchaseOrders'], 'PurchaseOrder') : [];

      const { VendorLedgerItems, GrirSnapshot, VendorMaster, PurchaseOrders, Users } = cds.entities;

      log.info(`Received mock data: ${ledgerSheet.length} ledger, ${grirSheet.length} GR/IR, ${masterSheet.length} vendor, ${poSheet.length} PO rows.`);

      // Execute database operations atomically in a transaction block
      await cds.tx(req).run(async (tx) => {
        log.info('Clearing old mock tables...');
        await tx.run(DELETE.from(VendorLedgerItems));
        await tx.run(DELETE.from(GrirSnapshot));
        await tx.run(DELETE.from(VendorMaster));
        await tx.run(DELETE.from(PurchaseOrders));
        await tx.run(DELETE.from(Users));

        log.info('Seeding default users...');
        const crypto = require('crypto');
        const hash = (pw) => crypto.createHash('sha256').update(pw).digest('hex');
        await tx.run(INSERT.into(Users).entries([
          {
            ID: cds.utils.uuid(),
            username: 'admin',
            email: 'admin@reconcile.com',
            passwordHash: hash('admin'),
            fullName: 'AP Manager (Admin)',
            businessRole: 'AP'
          },
          {
            ID: cds.utils.uuid(),
            username: 'gr_user',
            email: 'gr@reconcile.com',
            passwordHash: hash('admin'),
            fullName: 'GR Specialist',
            businessRole: 'GR'
          },
          {
            ID: cds.utils.uuid(),
            username: 'miro_user',
            email: 'miro@reconcile.com',
            passwordHash: hash('admin'),
            fullName: 'MIRO Verifier',
            businessRole: 'MIRO'
          }
        ]));

        log.info('Seeding VendorMaster table...');
        await tx.run(INSERT.into(VendorMaster).entries(masterSheet.map(row => ({
          ID: cds.utils.uuid(),
          businessPartner: String(row.BusinessPartner),
          businessPartnerName: row.BusinessPartnerName,
          taxNumber1: row.TaxNumber1,
          paymentTerms: row.PaymentTerms,
          currency: row.Currency,
          pan: row.Pan || null,
          state: row.State || null,
          tdsSection: row.TdsSection || null,
          isMsme: row.IsMsme === true || String(row.IsMsme).toLowerCase() === 'yes',
        }))));

        log.info('Seeding GrirSnapshot table...');
        await tx.run(INSERT.into(GrirSnapshot).entries(grirSheet.map(row => ({
          ID: cds.utils.uuid(),
          purchaseOrder: String(row.PurchaseOrder),
          purchaseOrderItem: String(row.PurchaseOrderItem),
          goodsReceiptQty: row.GoodsReceiptQty,
          invoicedQuantity: row.InvoicedQuantity,
          grirAmount: row.GrirAmount,
          plant: String(row.Plant),
          supplier: String(row.Supplier),
        }))));

        log.info('Seeding VendorLedgerItems table...');
        await tx.run(INSERT.into(VendorLedgerItems).entries(ledgerSheet.map(row => ({
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
        }))));

        if (poSheet.length) {
          log.info('Seeding PurchaseOrders table...');
          await tx.run(INSERT.into(PurchaseOrders).entries(poSheet.map(row => ({
            ID: cds.utils.uuid(),
            purchaseOrder: String(row.PurchaseOrder),
            poItem: String(row.PurchaseOrderItem || row.PoItem),
            poQty: row.PoQty || row.PurchaseOrderQty || 0,
            poAmount: row.PoAmount || row.PurchaseOrderAmount || 0,
            supplier: String(row.Supplier),
          }))));
        }
      });

      log.info('Transaction committed. Database seeded successfully.');
      return `Seeded: ${ledgerSheet.length} ledger items, ${grirSheet.length} GR/IR rows, ${masterSheet.length} vendors, ${poSheet.length} PO rows`;
    } catch (err) {
      log.error('Database seeding failed:', err);
      return req.error(500, `Seeding failed: ${err.message}`);
    }
  });
};