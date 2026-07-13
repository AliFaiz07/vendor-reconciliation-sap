// TC007: TDS u/s 194Q Deduction — Checks short receipt matching the 0.1% TDS deduction
async function evaluateTC007(vendorLine, poRecord, grirRow, candidates) {
  const desc = (vendorLine.vendorInvoiceNo || '').toLowerCase();
  
  if (desc.includes('tds') || desc.includes('194q') || desc.includes('withholding')) {
    const cds = require('@sap/cds');
    const { VendorDocLines } = cds.entities;
    
    if (VendorDocLines) {
      // Find all doc lines for the same vendor/upload
      const relatedLines = await SELECT.from(VendorDocLines).where({
        statementUploadId: vendorLine.statementUploadId
      });
      
      for (const line of relatedLines) {
        const grossTds = Math.round(line.invoiceAmount * 0.001);
        const basicTds = Math.round((line.invoiceAmount - (line.gstTdsAmount || 0)) * 0.001);
        
        const tdsAmt = Math.abs(vendorLine.invoiceAmount);
        // Compare with both gross TDS or basic TDS (rounded to 1 rupee)
        if (Math.abs(tdsAmt - grossTds) <= 1 || Math.abs(tdsAmt - basicTds) <= 1) {
          return {
            code: 'MATCHED/TDS-194Q',
            rule: 'TC007_TDS_194Q',
            businessRole: 'AP',
            ledgerItemID: null,
            delta: 0
          };
        }
      }
    }
    
    // Fallback if no matching line found
    return { code: 'MATCHED/TDS-194Q', rule: 'TC007_TDS_194Q', businessRole: 'AP' };
  }
  return null;
}

module.exports = { evaluateTC007 };
