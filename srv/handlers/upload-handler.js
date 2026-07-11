const XLSX = require('xlsx');
const cds = require('@sap/cds');
const { parseSheet } = require('./xlsx-utils');

const log = cds.log('upload-handler');

module.exports = (srv) => {
  /**
   * Action handler to upload and parse vendor Statement of Account (SoA) Excel file,
   * then trigger the matching run.
   */
  srv.on('uploadStatement', async (req) => {
    try {
      const { fileBase64 } = req.data;
      if (!fileBase64) return req.error(400, 'Statement file data is missing.');

      const workbook = XLSX.read(Buffer.from(fileBase64, 'base64'), { type: 'buffer' });
      
      if (!workbook.SheetNames.length) return req.error(400, 'Uploaded Excel workbook is empty.');
      
      const sheet = parseSheet(workbook.Sheets[workbook.SheetNames[0]], 'VendorCode');
      const { VendorDocLines, VendorMaster } = cds.entities;

      if (!sheet.length) {
        return req.error(400, "No rows found in the uploaded statement. Please ensure the columns match the template (including 'VendorCode').");
      }

      const vendorCode = String(sheet[0].VendorCode);
      log.info(`Processing statement upload for vendor: ${vendorCode}`);

      const vendor = await SELECT.one.from(VendorMaster).where({ businessPartner: vendorCode });
      if (!vendor) {
        return req.error(400, `Vendor '${vendorCode}' not found in the master database. Please seed the database first with matching vendor master records.`);
      }

      const statementUploadId = cds.utils.uuid();
      const lines = sheet.map((row, idx) => {
        return {
          ID: cds.utils.uuid(),
          statementUploadId,
          vendorInvoiceNo: row.VendorInvoiceNo ? String(row.VendorInvoiceNo) : `GEN-${cds.utils.uuid().slice(0, 8)}`,
          invoiceDate: row.InvoiceDate || null,
          invoiceAmount: row.InvoiceAmount || 0,
          currency: row.Currency || 'INR',
          poReference: row.PoReference ? String(row.PoReference) : null,
          gstTdsAmount: row.GstTdsAmount || null,
          paymentReference: row.PaymentReference ? String(row.PaymentReference) : null,
          sourceVendorCode: vendorCode,
          sourceGstin: row.Gstin ? String(row.Gstin) : null,
          irn: row.Irn || null,
          irnStatus: row.IrnStatus || null,
          eWayBill: row.EwayBill || null,
          gstr2bStatus: row.Gstr2bStatus || null,
        };
      }).filter(line => line !== null);

      log.info(`Parsed ${lines.length} statement items for matching.`);

      // Execute operations within an OData database transaction
      await cds.tx(req).run(async (tx) => {
        log.info('Clearing old statement items...');
        await tx.run(DELETE.from(VendorDocLines));
        
        log.info('Saving new statement lines to the database...');
        await tx.run(INSERT.into(VendorDocLines).entries(lines));
      });

      log.info(`Statement saved successfully under Upload ID: ${statementUploadId}. Triggering matching engine event...`);
      // Emit event asynchronously
      await srv.emit('runMatching', { statementUploadId });

      return statementUploadId;
    } catch (err) {
      log.error('Failed to upload and parse statement:', err);
      return req.error(500, `Upload failed: ${err.message}`);
    }
  });
};