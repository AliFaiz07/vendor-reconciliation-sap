// TC006: GST 2B Gap — Vendor hasn't filed GSTR-1, creating ITC risk for buyer
async function evaluateTC006(vendorLine, poRecord, grirRow, candidates) {
  const cds = require('@sap/cds');
  const { Gstr2bInvoices } = cds.entities;
  
  if (Gstr2bInvoices) {
    const gstr2bItem = await SELECT.one.from(Gstr2bInvoices).where({
      invoiceNumber: vendorLine.vendorInvoiceNo
    });
    
    if (gstr2bItem) {
      if (gstr2bItem.filingStatus === 'NOT_FILED') {
        const delta = Math.abs(Number(vendorLine.invoiceAmount));
        return { code: 'UNMATCHED/GST-2B-GAP', rule: 'TC006_GST_2B_GAP', businessRole: 'BILLING', delta };
      }
      return null; // Found and filed, no gap
    }
  }

  // Fallback to statement status attribute if DB lookup is empty/missing
  if (vendorLine.gstr2bStatus === '2B Gap' || vendorLine.gstr2bStatus === '2B GAP' || (vendorLine.gstr2bStatus && vendorLine.gstr2bStatus.toLowerCase().includes('gap'))) {
    const delta = Math.abs(Number(vendorLine.invoiceAmount));
    return { code: 'UNMATCHED/GST-2B-GAP', rule: 'TC006_GST_2B_GAP', businessRole: 'BILLING', delta };
  }
  return null;
}

module.exports = { evaluateTC006 };
