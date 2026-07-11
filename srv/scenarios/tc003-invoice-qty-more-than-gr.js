// TC003: Invoice Quantity More than GR (PO=100, GR=80, Invoice=100)
async function evaluateTC003(vendorLine, poRecord, grirRow) {
  if (!poRecord || !grirRow) return null;
  const poQty = Number(poRecord.poQty), grQty = Number(grirRow.goodsReceiptQty), invQty = Number(grirRow.invoicedQuantity);
  if (invQty > grQty && poQty > grQty) {
    const poRate = Number(poRecord.poAmount) / poQty;
    const delta = (invQty - grQty) * poRate;
    return { code: 'UNMATCHED/QTY-MORE', rule: 'TC003_QTY_MORE_THAN_GR', businessRole: 'GR', delta };
  }
  return null;
}

module.exports = { evaluateTC003 };
