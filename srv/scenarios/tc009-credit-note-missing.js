// TC009: Credit Note Missing — CN issued by vendor but not yet booked in buyer's ledger
async function evaluateTC009(vendorLine, poRecord, grirRow, candidates) {
  const isCreditNote = vendorLine.invoiceAmount < 0 || 
                       (vendorLine.vendorInvoiceNo && (vendorLine.vendorInvoiceNo.startsWith('CN-') || vendorLine.vendorInvoiceNo.startsWith('CN')));
  
  if (isCreditNote) {
    const hasLedgerMatch = candidates && candidates.some(c => 
      Math.abs(Math.abs(c.amountInTransCrcy) - Math.abs(vendorLine.invoiceAmount)) <= 1.00
    );
    if (!hasLedgerMatch) {
      const delta = Math.abs(Number(vendorLine.invoiceAmount));
      return { code: 'UNMATCHED/CN-MISSING', rule: 'TC009_CN_MISSING', businessRole: 'AP', delta };
    }
  }
  return null;
}

module.exports = { evaluateTC009 };
