// TC004: Invoice Price Higher than PO (PO=100, Invoice=110)
async function evaluateTC004(vendorLine, poRecord, grirRow) {
  if (!poRecord) return null;
  const poAmount = poRecord.poAmount;
  const invoiceAmount = vendorLine.invoiceAmount;
  
  if (invoiceAmount > poAmount) {
    const diff = invoiceAmount - poAmount;
    const diffPct = (diff / poAmount) * 100;
    
    if (diffPct <= 5) {
      // Within 5% tolerance limit
      return { code: 'MATCHED/PRICE-TOLERANCE', rule: 'TC004_PRICE_TOLERANCE', businessRole: 'AP' };
    } else {
      // Exceeds tolerance limit
      return { code: 'UNMATCHED/PRICE-HIGH', rule: 'TC004_PRICE_HIGH', businessRole: 'MIRO' };
    }
  }
  return null;
}

module.exports = { evaluateTC004 };
