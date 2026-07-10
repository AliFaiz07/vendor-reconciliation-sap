// TC001: Standard 3-Way Match — PO Qty = GR Qty = Invoice Qty (all Pass)
async function evaluateTC001(vendorLine, poRecord, grirRow) {
  if (!poRecord || !grirRow) return null;
  const poQty = poRecord.poQty, grQty = grirRow.goodsReceiptQty, invQty = grirRow.invoicedQuantity;
  if (poQty === grQty && grQty === invQty) {
    return { code: 'MATCHED/3WAY', rule: 'TC001_STANDARD_MATCH', businessRole: 'AP' };
  }
  return null;
}

module.exports = { evaluateTC001 };