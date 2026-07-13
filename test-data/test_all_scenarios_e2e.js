const cds = require('@sap/cds');
const fs = require('fs');
const path = require('path');

const scenariosDir = path.join(__dirname, 'scenarios');

const testCases = [
  {
    id: 'TC001',
    name: 'Standard Match',
    vendor: 'V-1002',
    ledgerFile: 'SAP_Ledger_Mock_TC001_Standard_Match.xlsx',
    statementFile: 'Vendor_Statement_Mock_TC001_Standard_Match.xlsx',
    expectedOutcome: 'MATCHED'
  },
  {
    id: 'TC002',
    name: 'Invoice Qty Less than GR',
    vendor: 'V-1004',
    ledgerFile: 'SAP_Ledger_Mock_TC002_Qty_Less.xlsx',
    statementFile: 'Vendor_Statement_Mock_TC002_Qty_Less.xlsx',
    expectedOutcome: 'MATCHED/QTY-LESS'
  },
  {
    id: 'TC003',
    name: 'Invoice Qty More than GR',
    vendor: 'V-1001',
    ledgerFile: 'SAP_Ledger_Mock_TC003_Qty_More.xlsx',
    statementFile: 'Vendor_Statement_Mock_TC003_Qty_More.xlsx',
    expectedOutcome: 'UNMATCHED/QTY-MORE'
  },
  {
    id: 'TC004',
    name: 'Invoice Price Higher than PO',
    vendor: 'V-1001',
    ledgerFile: 'SAP_Ledger_Mock_TC004_Price_High.xlsx',
    statementFile: 'Vendor_Statement_Mock_TC004_Price_High.xlsx',
    expectedOutcome: 'UNMATCHED/PRICE-HIGH'
  },
  {
    id: 'TC005',
    name: 'Missing GR Reference',
    vendor: 'V-1001',
    ledgerFile: 'SAP_Ledger_Mock_TC005_Missing_GR.xlsx',
    statementFile: 'Vendor_Statement_Mock_TC005_Missing_GR.xlsx',
    expectedOutcome: 'UNMATCHED/GR-PENDING'
  },
  {
    id: 'TC006',
    name: 'GST 2B Gap Check',
    vendor: 'V-1002',
    ledgerFile: 'SAP_Ledger_Mock_TC006_GST_2B_Gap.xlsx',
    statementFile: 'Vendor_Statement_Mock_TC006_GST_2B_Gap.xlsx',
    expectedOutcome: 'UNMATCHED/GST-2B-GAP'
  },
  {
    id: 'TC007',
    name: 'TDS Section 194Q Withholding',
    vendor: 'V-1001',
    ledgerFile: 'SAP_Ledger_Mock_TC007_TDS_194Q.xlsx',
    statementFile: 'Vendor_Statement_Mock_TC007_TDS_194Q.xlsx',
    expectedOutcome: 'MATCHED/TDS-194Q'
  },
  {
    id: 'TC008',
    name: 'Payment UTR in Transit',
    vendor: 'V-1001',
    ledgerFile: 'SAP_Ledger_Mock_TC008_Payment_Transit.xlsx',
    statementFile: 'Vendor_Statement_Mock_TC008_Payment_Transit.xlsx',
    expectedOutcome: 'MATCHED/TIMING'
  },
  {
    id: 'TC009',
    name: 'Credit Note Missing Check',
    vendor: 'V-1001',
    ledgerFile: 'SAP_Ledger_Mock_TC009_Credit_Note_Missing.xlsx',
    statementFile: 'Vendor_Statement_Mock_TC009_Credit_Note_Missing.xlsx',
    expectedOutcome: 'UNMATCHED/CN-MISSING'
  },
  {
    id: 'TC010',
    name: 'FX Revaluation',
    vendor: 'V-1005',
    ledgerFile: 'SAP_Ledger_Mock_TC010_FX_Revaluation.xlsx',
    statementFile: 'Vendor_Statement_Mock_TC010_FX_Revaluation.xlsx',
    expectedOutcome: 'MATCHED'
  }
];

async function main() {
  console.log('===============================================================');
  console.log('   STARTING AUTOMATED E2E BATCH TEST FOR ALL 10 TEST CASES');
  console.log('===============================================================\n');

  // Connect to database and load model
  const db = await cds.connect.to('db');
  const csn = await cds.load(['db/schema.cds', 'srv/reconciliation-service.cds']);
  cds.model = cds.linked(csn);
  const srv = await cds.serve('ReconciliationService').from('srv/reconciliation-service.cds');

  const { MatchResults, Exceptions } = cds.entities('vendorrecon.db');

  let passedCount = 0;
  let failedCount = 0;

  const apReq = new cds.Request({
    user: new cds.User({ id: 'admin', roles: ['AP'] }),
    headers: { 'x-user-role': 'AP' }
  });

  for (const tc of testCases) {
    console.log(`[${tc.id}] Testing Use Case: ${tc.name}...`);
    
    // Read files
    const ledgerPath = path.join(scenariosDir, tc.ledgerFile);
    const stmtPath = path.join(scenariosDir, tc.statementFile);
    
    if (!fs.existsSync(ledgerPath) || !fs.existsSync(stmtPath)) {
      console.error(`  -> Fail: Excel mock files not found for ${tc.id}`);
      failedCount++;
      continue;
    }
    
    const ledgerBase64 = fs.readFileSync(ledgerPath).toString('base64');
    const stmtBase64 = fs.readFileSync(stmtPath).toString('base64');
    
    try {
      // 1. Seed Ledger and Master Data
      await srv.send('seedSapMockData', { fileBase64: ledgerBase64 }, apReq);
      
      // 2. Upload statement (runs matching automatically)
      const uploadId = await srv.send('uploadStatement', {
        fileBase64: stmtBase64,
        companyCode: '1000',
        period: '2026-04',
        fiscalYear: '2026',
        fileName: tc.statementFile
      }, apReq);
      
      // 3. Query match results for the active upload context
      const docLines = await srv.run(
        SELECT.from(srv.entities.VendorDocLines).where({ statementUploadId: uploadId })
      );
      const lineIds = docLines.map(l => l.ID);
      
      const results = await srv.run(
        SELECT.from(srv.entities.MatchResults).where({ vendorDocLine_ID: { in: lineIds } })
      );
      
      if (results.length === 0) {
        console.error(`  -> Fail: No match results found for upload context!`);
        failedCount++;
        continue;
      }
      
      // We look for a line matching the expected outcome code pattern
      const matchedRow = results.find(r => r.outcomeCode.startsWith(tc.expectedOutcome) || r.outcomeCode === tc.expectedOutcome);
      
      if (matchedRow) {
        console.log(`  -> Pass: Match result has expected outcome code "${matchedRow.outcomeCode}" (Rule: ${matchedRow.matchRuleApplied})`);
        passedCount++;
      } else {
        console.error(`  -> Fail: Expected outcome code starts with "${tc.expectedOutcome}", but found actual outcomes: ${JSON.stringify(results.map(r => r.outcomeCode))}`);
        failedCount++;
      }
      
    } catch (err) {
      console.error(`  -> Fail: Error during execution of ${tc.id}:`, err.message);
      failedCount++;
    }
    console.log();
  }

  console.log('===============================================================');
  console.log(` BATCH TEST RUN COMPLETE: Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('===============================================================');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal batch E2E runner error:', err);
  process.exit(1);
});
