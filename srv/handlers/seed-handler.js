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
      const { VendorLedgerItems, GrirSnapshot, VendorMaster, PurchaseOrders, Users, Gstr2bInvoices } = cds.entities;

      await cds.tx(req).run(async (tx) => {
        let seededSummary = [];

        // 1. VendorMaster
        if (workbook.Sheets['VendorMaster']) {
          const masterSheet = parseSheet(workbook.Sheets['VendorMaster'], 'BusinessPartner');
          if (masterSheet.length) {
            await tx.run(DELETE.from(VendorMaster));
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
            seededSummary.push(`${masterSheet.length} vendors`);
          }
        }

        // 2. GrirSnapshot
        if (workbook.Sheets['GrirSnapshot']) {
          const grirSheet = parseSheet(workbook.Sheets['GrirSnapshot'], 'PurchaseOrder');
          if (grirSheet.length) {
            await tx.run(DELETE.from(GrirSnapshot));
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
            seededSummary.push(`${grirSheet.length} GR/IR rows`);
          }
        }

        // 3. VendorLedgerItems
        if (workbook.Sheets['VendorLedgerItems']) {
          const ledgerSheet = parseSheet(workbook.Sheets['VendorLedgerItems'], 'Supplier');
          if (ledgerSheet.length) {
            await tx.run(DELETE.from(VendorLedgerItems));
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
            seededSummary.push(`${ledgerSheet.length} ledger items`);
          }
        }

        // 4. PurchaseOrders
        const poSheet = workbook.Sheets['PurchaseOrders'] ? parseSheet(workbook.Sheets['PurchaseOrders'], 'PurchaseOrder') : [];
        if (poSheet.length) {
          await tx.run(DELETE.from(PurchaseOrders));
          await tx.run(INSERT.into(PurchaseOrders).entries(poSheet.map(row => ({
            ID: cds.utils.uuid(),
            purchaseOrder: String(row.PurchaseOrder),
            poItem: String(row.PurchaseOrderItem || row.PoItem),
            poQty: row.PoQty || row.PurchaseOrderQty || 0,
            poAmount: row.PoAmount || row.PurchaseOrderAmount || 0,
            supplier: String(row.Supplier),
          }))));
          seededSummary.push(`${poSheet.length} PO rows`);
        }

        // Always seed default users and GSTR-2B
        await tx.run(DELETE.from(Users));
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
            fullName: 'MIRO Agent',
            businessRole: 'MIRO'
          },
          {
            ID: cds.utils.uuid(),
            username: 'V-1001',
            email: 'sigma@reconcile.com',
            passwordHash: hash('admin'),
            fullName: 'Sigma Component AR',
            businessRole: 'AR',
            vendorCode: 'V-1001'
          }
        ]));

        await tx.run(DELETE.from(Gstr2bInvoices));
        await tx.run(INSERT.into(Gstr2bInvoices).entries([
          {
            ID: cds.utils.uuid(),
            supplierGstin: '27AAACS1210B1Z5',
            invoiceNumber: 'INV-22418',
            invoiceDate: '2026-04-02',
            invoiceAmount: 1469100.00,
            taxAmount: 224100.00,
            filingStatus: 'FILED',
            filingDate: '2026-05-10'
          },
          {
            ID: cds.utils.uuid(),
            supplierGstin: '27AAACS1210B1Z5',
            invoiceNumber: 'INV-22440',
            invoiceDate: '2026-04-09',
            invoiceAmount: 386656.50,
            taxAmount: 58981.50,
            filingStatus: 'FILED',
            filingDate: '2026-05-10'
          },
          {
            ID: cds.utils.uuid(),
            supplierGstin: '27AAACS1210B1Z5',
            invoiceNumber: 'INV-22461',
            invoiceDate: '2026-04-14',
            invoiceAmount: 247800.00,
            taxAmount: 37800.00,
            filingStatus: 'FILED',
            filingDate: '2026-05-10'
          },
          {
            ID: cds.utils.uuid(),
            supplierGstin: '24AADCD4521F1Z3',
            invoiceNumber: 'INV-22475',
            invoiceDate: '2026-04-16',
            invoiceAmount: 89208.00,
            taxAmount: 9558.00,
            filingStatus: 'FILED',
            filingDate: '2026-05-10'
          },
          {
            ID: cds.utils.uuid(),
            supplierGstin: '24AADCD4521F1Z3',
            invoiceNumber: 'INV-22482',
            invoiceDate: '2026-04-18',
            invoiceAmount: 9912.00,
            taxAmount: 1062.00,
            filingStatus: 'NOT_FILED',
            filingDate: null
          }
        ]));
        seededSummary.push('default users', 'GSTR-2B compliance data');
        
        log.info('Transaction committed. Database seeded successfully.');
        req.reply(`Seeded: ${seededSummary.join(', ')}`);
      });
    } catch (err) {
      log.error('Database seeding failed:', err);
      return req.error(500, `Seeding failed: ${err.message}`);
    }
  });
};