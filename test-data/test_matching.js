const cds = require('@sap/cds');
const fs = require('fs');
const path = require('path');

async function main() {
  const project = path.resolve(__dirname, '..');
  process.chdir(project);

  console.log('1. Connecting to database...');
  const db = await cds.connect.to('db');

  console.log('2. Loading and compiling CDS models...');
  const csn = await cds.load(['db/schema.cds', 'srv/reconciliation-service.cds']);
  cds.model = cds.linked(csn);

  console.log('3. Serving ReconciliationService...');
  const cds_server = await cds.serve('ReconciliationService').from('srv/reconciliation-service.cds');
  
  // Read Mock SAP Ledger file
  const ledgerPath = path.join(__dirname, 'SAP_Ledger_Mock.xlsx');
  if (!fs.existsSync(ledgerPath)) {
    throw new Error('SAP_Ledger_Mock.xlsx not found at ' + ledgerPath);
  }
  const ledgerBase64 = fs.readFileSync(ledgerPath).toString('base64');
  
  console.log('4. Seeding SAP mock data...');
  const seedResult = await cds_server.send('seedSapMockData', { fileBase64: ledgerBase64 });
  console.log('Seed Result:', seedResult);
  
  // Read Mock Vendor Statement file
  const stmtPath = path.join(__dirname, 'Vendor_Statement_Mock.xlsx');
  if (!fs.existsSync(stmtPath)) {
    throw new Error('Vendor_Statement_Mock.xlsx not found at ' + stmtPath);
  }
  const stmtBase64 = fs.readFileSync(stmtPath).toString('base64');
  
  console.log('5. Uploading Vendor Statement...');
  const uploadResult = await cds_server.send('uploadStatement', { fileBase64: stmtBase64 });
  console.log('Upload Result (statementUploadId):', uploadResult);
  
  // Fetch results from database
  const { MatchResults, Exceptions, VendorDocLines } = cds.entities('vendorrecon.db');
  
  const results = await SELECT.from(MatchResults);
  const exceptions = await SELECT.from(Exceptions);
  const docLines = await SELECT.from(VendorDocLines);
  
  console.log(`\n=========================================`);
  console.log(`MATCH RESULTS SUMMARY (Total: ${results.length})`);
  console.log(`=========================================`);
  results.forEach((r, idx) => {
    const line = docLines.find(dl => dl.ID === r.vendorDocLine_ID);
    const invoiceNo = r.invoiceNo || 'N/A';
    const amount = line ? line.invoiceAmount : 0;
    console.log(`${idx + 1}. Document [${invoiceNo}] (Amt: ${amount}) -> Outcome: ${r.outcomeCode} | Rule: ${r.matchRuleApplied} | Role: ${r.businessRole} | Delta: ${r.amountDelta}`);
  });
  
  console.log(`\n=========================================`);
  console.log(`EXCEPTIONS RAISED (Total: ${exceptions.length})`);
  console.log(`=========================================`);
  exceptions.forEach((e, idx) => {
    const res = results.find(r => r.ID === e.matchResult_ID);
    const line = res ? docLines.find(dl => dl.ID === res.vendorDocLine_ID) : null;
    const invoiceNo = line ? line.vendorInvoiceNo : 'unknown';
    console.log(`${idx + 1}. Invoice [${invoiceNo}] -> Exception Status: ${e.status} | Reason Code: ${e.outcomeCode}`);
  });

  console.log('\nShutting down integration test server...');
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
