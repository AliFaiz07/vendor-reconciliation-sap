// TC003: Invoice Quantity More than GR (PO=100, GR=80, Invoice=100)
async function evaluateTC003(vendorLine, poRecord, grirRow) {
  if (!poRecord || !grirRow) return null;
  const poQty = poRecord.poQty, grQty = grirRow.goodsReceiptQty, invQty = grirRow.invoicedQuantity;
  if (invQty > grQty && poQty > grQty) {
    return { code: 'UNMATCHED/QTY-MORE', rule: 'TC003_QTY_MORE_THAN_GR', businessRole: 'GR' };
  }
  return null;
}

module.exports = { evaluateTC003 };
