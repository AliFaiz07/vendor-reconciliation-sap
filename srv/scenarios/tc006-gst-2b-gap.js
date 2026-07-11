// TC006: GST 2B Gap — Vendor hasn't filed GSTR-1, creating ITC risk for buyer
async function evaluateTC006(vendorLine, poRecord, grirRow) {
  if (vendorLine.gstr2bStatus === '2B Gap' || vendorLine.gstr2bStatus === '2B GAP' || (vendorLine.gstr2bStatus && vendorLine.gstr2bStatus.toLowerCase().includes('gap'))) {
    const delta = Math.abs(Number(vendorLine.invoiceAmount));
    return { code: 'UNMATCHED/GST-2B-GAP', rule: 'TC006_GST_2B_GAP', businessRole: 'BILLING', delta };
  }
  return null;
}

module.exports = { evaluateTC006 };
