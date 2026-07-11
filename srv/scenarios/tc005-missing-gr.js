// TC005: Missing GR — Invoice received but no Goods Receipt booked
async function evaluateTC005(vendorLine, poRecord, grirRow) {
  if (poRecord) {
    const grQty = grirRow ? Number(grirRow.goodsReceiptQty) : 0;
    if (!grirRow || grQty === 0) {
      const delta = Math.abs(Number(vendorLine.invoiceAmount));
      return { code: 'UNMATCHED/GR-PENDING', rule: 'TC005_MISSING_GR', businessRole: 'GR', delta };
    }
  }
  return null;
}

module.exports = { evaluateTC005 };
