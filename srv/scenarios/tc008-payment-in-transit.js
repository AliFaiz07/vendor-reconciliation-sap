// TC008: Payment in Transit — NEFT/RTGS UTR-referenced payment posted near statement date
async function evaluateTC008(vendorLine, poRecord, grirRow) {
  if (vendorLine.vendorInvoiceNo.toLowerCase().includes('utr') || vendorLine.vendorInvoiceNo.toLowerCase().includes('payment')) {
    return { code: 'MATCHED/TIMING', rule: 'TC008_PAYMENT_IN_TRANSIT', businessRole: 'AP' };
  }
  return null;
}

module.exports = { evaluateTC008 };
