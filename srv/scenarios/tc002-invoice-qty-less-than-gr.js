// TC002: Invoice Quantity Less than GR (PO=100, GR=100, Invoice=95)
async function evaluateTC002(vendorLine, poRecord, grirRow) {
  if (!poRecord || !grirRow) return null;
  const poQty = Number(poRecord.poQty), grQty = Number(grirRow.goodsReceiptQty), invQty = Number(grirRow.invoicedQuantity);
  if (poQty === grQty && invQty < grQty) {
    const poRate = Number(poRecord.poAmount) / poQty;
    const delta = (grQty - invQty) * poRate;
    return { code: 'MATCHED/QTY-LESS', rule: 'TC002_QTY_LESS_THAN_GR', businessRole: 'AP', delta };
  }
  return null;
}

module.exports = { evaluateTC002 };
