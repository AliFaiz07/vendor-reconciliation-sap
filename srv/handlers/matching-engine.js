const TOLERANCE_AMOUNT = 1.00;
const TIMING_WINDOW_DAYS = 7;
const FUZZY_EDIT_DISTANCE = 2;

function cleanInvoiceNo(invNo) {
  if (!invNo) return '';
  return invNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function levenshtein(a, b) {
  if (!a || !b) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function daysBetween(d1, d2) { return (new Date(d1) - new Date(d2)) / 86400000; }

function matchInvoiceNumber(vendorLine, ledgerItem) {
  const vInv = vendorLine.vendorInvoiceNo || '';
  const lDoc = ledgerItem.accountingDocument || '';
  if (vInv === lDoc) return { code: 'MATCHED', rule: 'RULE_INVOICE_NO' };
  
  const vInvClean = cleanInvoiceNo(vInv);
  const lDocClean = cleanInvoiceNo(lDoc);
  if (vInvClean && lDocClean && (vInvClean === lDocClean || (vInvClean.length > 3 && lDocClean.endsWith(vInvClean)) || (lDocClean.length > 3 && vInvClean.endsWith(lDocClean)))) {
    return { code: 'MATCHED/NEAR-MATCH', rule: 'RULE_INVOICE_NO_CLEAN' };
  }

  const dist = levenshtein(vInv, lDoc);
  if (dist <= FUZZY_EDIT_DISTANCE) return { code: 'MATCHED/NEAR-MATCH', rule: 'RULE_INVOICE_NO_FUZZY' };
  return null;
}

function matchAmount(vendorLine, ledgerItem) {
  const delta = Math.abs(vendorLine.invoiceAmount - ledgerItem.amountInTransCrcy);
  if (delta === 0) return { code: 'MATCHED', rule: 'RULE_AMOUNT', delta: 0 };
  if (delta <= TOLERANCE_AMOUNT) return { code: 'MATCHED/ROUNDING', rule: 'RULE_AMOUNT_ROUNDING', delta };
  return { code: 'UNMATCHED/AMOUNT-DIFF', rule: 'RULE_AMOUNT', delta };
}

function matchCurrency(vendorLine, ledgerItem) {
  if (vendorLine.currency === ledgerItem.transactionCurrency) return { code: 'MATCHED', rule: 'RULE_CURRENCY' };
  return { code: 'UNMATCHED/FX-DIFF', rule: 'RULE_CURRENCY', blocking: true };
}

function matchDate(vendorLine, ledgerItem) {
  const daysDiff = Math.abs(daysBetween(vendorLine.invoiceDate, ledgerItem.documentDate));
  if (daysDiff === 0) return { code: 'MATCHED', rule: 'RULE_DATE' };
  if (daysDiff <= TIMING_WINDOW_DAYS) return { code: 'MATCHED/TIMING', rule: 'RULE_DATE', daysDiff };
  return { code: 'UNMATCHED/DATE-OUT-OF-WINDOW', rule: 'RULE_DATE' };
}

function matchPoReference(vendorLine, grirRow) {
  if (!vendorLine.poReference) return null;
  if (vendorLine.poReference !== grirRow?.purchaseOrder) return null;
  if (!grirRow.goodsReceiptQty || grirRow.goodsReceiptQty === 0) return { code: 'UNMATCHED/GR-PENDING', rule: 'RULE_PO_GR' };
  return { code: 'MATCHED', rule: 'RULE_PO_GR' };
}

function matchGstTds(vendorLine, ledgerTaxAmount) {
  if (vendorLine.gstTdsAmount == null) return null;
  const delta = Math.abs(vendorLine.gstTdsAmount - ledgerTaxAmount);
  if (delta === 0) return { code: 'MATCHED', rule: 'RULE_GST_TDS' };
  return { code: 'UNMATCHED/GST-DIFF', rule: 'RULE_GST_TDS', delta };
}

function matchPaymentReference(vendorLine, ledgerItem) {
  if (vendorLine.paymentReference && !ledgerItem.clearingDocument) return { code: 'UNMATCHED/PAYMENT-MISSING', rule: 'RULE_PAYMENT_REF' };
  return { code: 'MATCHED', rule: 'RULE_PAYMENT_REF' };
}

async function runMatchRulesForLine(vendorLine, candidates) {
  const results = [];
  for (const ledgerItem of candidates) {
    const r1 = matchInvoiceNumber(vendorLine, ledgerItem);
    if (!r1) continue;
    const r2 = matchAmount(vendorLine, ledgerItem);
    const r3 = matchCurrency(vendorLine, ledgerItem);
    if (r3.blocking) { results.push(r3); continue; }
    const r4 = matchDate(vendorLine, ledgerItem);
    const r6 = matchGstTds(vendorLine, ledgerItem.taxAmount);
    const r7 = matchPaymentReference(vendorLine, ledgerItem);
    results.push(...[r1, r2, r4, r6, r7].filter(Boolean).map(r => ({ ...r, ledgerItemID: ledgerItem.ID })));
  }
  return results.length ? results : [{ code: 'UNMATCHED', rule: 'NO_CANDIDATE' }];
}

module.exports = { runMatchRulesForLine, matchPoReference };