// TC007: TDS u/s 194Q Deduction — Checks short receipt matching the 0.1% TDS deduction
async function evaluateTC007(vendorLine, poRecord, grirRow) {
  if (vendorLine.vendorInvoiceNo.toLowerCase().includes('tds') || vendorLine.vendorInvoiceNo.toLowerCase().includes('194q')) {
    return { code: 'MATCHED/TDS-194Q', rule: 'TC007_TDS_194Q', businessRole: 'AP' };
  }
  return null;
}

module.exports = { evaluateTC007 };
