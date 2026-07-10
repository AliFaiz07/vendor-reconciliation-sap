// TC002: Invoice Quantity Less than GR (PO=100, GR=100, Invoice=95)
async function evaluateTC002(vendorLine, poRecord, grirRow) {
  if (!poRecord || !grirRow) return null;
  const poQty = poRecord.poQty, grQty = grirRow.goodsReceiptQty, invQty = grirRow.invoicedQuantity;
  if (poQty === grQty && invQty < grQty) {
    return { code: 'MATCHED/QTY-LESS', rule: 'TC002_QTY_LESS_THAN_GR', businessRole: 'AP' };
  }
  return null;
}

module.exports = { evaluateTC002 };
