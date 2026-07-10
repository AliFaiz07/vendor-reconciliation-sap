const XLSX = require('xlsx');
const cds = require('@sap/cds');
const { parseSheet } = require('./xlsx-utils');

module.exports = (srv) => {
  srv.on('uploadStatement', async (req) => {
    const { fileBase64 } = req.data;
    const workbook = XLSX.read(Buffer.from(fileBase64, 'base64'), { type: 'buffer' });
    const sheet = parseSheet(workbook.Sheets[workbook.SheetNames[0]], 'VendorCode');
    const { VendorDocLines, VendorMaster } = cds.entities;

    if (!sheet.length) return req.error(400, 'No rows found in uploaded file');

    const vendorCode = String(sheet[0].VendorCode);
    const vendor = await SELECT.one.from(VendorMaster).where({ businessPartner: vendorCode });
    if (!vendor) return req.error(400, `Vendor '${vendorCode}' not found in master data — run Seed Data first with a matching VendorMaster sheet`);

    await DELETE.from(VendorDocLines);

    const statementUploadId = cds.utils.uuid();
    const lines = sheet.map(row => ({
      ID: cds.utils.uuid(),
      statementUploadId,
      vendorInvoiceNo: String(row.VendorInvoiceNo),
      invoiceDate: row.InvoiceDate,
      invoiceAmount: row.InvoiceAmount,
      currency: row.Currency,
      poReference: row.PoReference ? String(row.PoReference) : null,
      gstTdsAmount: row.GstTdsAmount || null,
      paymentReference: row.PaymentReference ? String(row.PaymentReference) : null,
      sourceVendorCode: vendorCode,
      sourceGstin: String(row.Gstin),
    }));
    await INSERT.into(VendorDocLines).entries(lines);
    await srv.emit('runMatching', { statementUploadId });
    return statementUploadId;
  });
};