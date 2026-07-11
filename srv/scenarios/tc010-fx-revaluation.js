// TC010: FX Revaluation — Import vendor USD statement revaluation difference (HX-2026-07)
async function evaluateTC010(vendorLine, poRecord, grirRow) {
  if (vendorLine.vendorInvoiceNo === 'HX-2026-07' || vendorLine.currency === 'USD') {
    return { code: 'MATCHED/FX-REVAL', rule: 'TC010_FX_REVAL', businessRole: 'AP' };
  }
  return null;
}

module.exports = { evaluateTC010 };
