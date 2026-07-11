// TC004: Invoice Price Higher than PO (PO=100, Invoice=110)
async function evaluateTC004(vendorLine, poRecord, grirRow) {
  if (!poRecord) return null;
  const poAmount = poRecord.poAmount;
  const basicAmount = vendorLine.invoiceAmount - (vendorLine.gstTdsAmount || 0);
  
  if (basicAmount > poAmount) {
    const diff = basicAmount - poAmount;
    const diffPct = (diff / poAmount) * 100;
    
    // In our Excel workbook, the tolerance for PO 4501220040 is 2.0%.
    // Invoices at or above 2.00% price variance block (triggering block R).
    if (diffPct < 2.00) {
      return { code: 'MATCHED/PRICE-TOLERANCE', rule: 'TC004_PRICE_TOLERANCE', businessRole: 'AP', delta: diff };
    } else {
      return { code: 'UNMATCHED/PRICE-HIGH', rule: 'TC004_PRICE_HIGH', businessRole: 'MIRO', delta: diff };
    }
  }
  return null;
}

module.exports = { evaluateTC004 };
