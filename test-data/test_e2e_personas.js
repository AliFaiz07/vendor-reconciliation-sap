const cds = require('@sap/cds');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('=== STARTING END-TO-END PERSONA & USE CASE TEST ===\n');

  // Connect to database and load model
  const db = await cds.connect.to('db');
  const csn = await cds.load(['db/schema.cds', 'srv/reconciliation-service.cds']);
  cds.model = cds.linked(csn);
  const srv = await cds.serve('ReconciliationService').from('srv/reconciliation-service.cds');

  const { Exceptions, WorkflowHistory, MatchResults } = cds.entities('vendorrecon.db');

  // Paths to test data
  const ledgerPath = path.join(__dirname, 'scenarios', 'SAP_Ledger_Mock_TC003_Qty_More.xlsx');
  const statementPath = path.join(__dirname, 'scenarios', 'Vendor_Statement_Mock_TC003_Qty_More.xlsx');

  if (!fs.existsSync(ledgerPath) || !fs.existsSync(statementPath)) {
    console.error('Error: Mock files not found. Please run the generation script first.');
    process.exit(1);
  }

  const ledgerBase64 = fs.readFileSync(ledgerPath).toString('base64');
  const statementBase64 = fs.readFileSync(statementPath).toString('base64');

  // =========================================================================
  // 1. PERSONA: AP Manager / Administrator (AP Role)
  // =========================================================================
  console.log('--- PERSONA 1: AP Specialist / Administrator ---');
  console.log('Action: Uploading SAP ERP Master Data & Mock Ledger...');
  
  // Emulate AP Specialist Request context
  const apReq = new cds.Request({
    user: new cds.User({ id: 'admin', roles: ['AP'] }),
    headers: { 'x-user-role': 'AP' }
  });
  
  // Seed database
  await srv.send('seedSapMockData', { fileBase64: ledgerBase64 }, apReq);
  console.log('-> SAP mock data seeded successfully.');

  console.log('\nAction: Uploading Vendor Statement...');
  const uploadId = await srv.send('uploadStatement', {
    fileBase64: statementBase64,
    companyCode: '1000',
    period: '2026-04',
    fiscalYear: '2026',
    fileName: 'Vendor_Statement_Mock_TC003_Qty_More.xlsx'
  }, apReq);
  
  console.log(`-> Statement uploaded successfully. Upload ID: ${uploadId}`);

  // Fetch raised exceptions
  const raisedExceptions = await SELECT.from(Exceptions);
  console.log(`-> Total exceptions raised: ${raisedExceptions.length}`);
  
  if (raisedExceptions.length === 0) {
    console.error('E2E Fail: Expected exception to be raised for Qty More variance!');
    process.exit(1);
  }

  const ex = raisedExceptions[0];
  console.log(`-> Exception Raised ID: ${ex.ID}`);
  console.log(`-> Outcome Code: ${ex.outcomeCode}`);
  console.log(`-> Recommended Action: ${ex.recommendedAction}`);
  console.log(`-> MSME Alert Flag: ${ex.msmeAlert ? 'YES' : 'NO'}`);
  console.log(`-> Status: ${ex.status}`);

  console.log('\nAction: Raising Dispute on the exception (simulating customer call/AR dispute)...');
  await srv.send('raiseDispute', {
    exceptionId: ex.ID,
    comment: 'Vendor AR disputes the quantity discrepancy. Physical receipt indicates 500 units.'
  }, apReq);

  let updatedEx = await SELECT.one.from(Exceptions).where({ ID: ex.ID });
  console.log(`-> Updated Exception Status: ${updatedEx.status}`);
  if (updatedEx.status !== 'DISPUTED') {
    console.error('E2E Fail: Expected exception status to be DISPUTED!');
    process.exit(1);
  }

  // =========================================================================
  // 2. PERSONA: Goods Receipt (GR) Specialist (GR Role)
  // =========================================================================
  console.log('\n--- PERSONA 2: GR Specialist ---');
  console.log('Action: Simulating GR Specialist logging in to verify quantity exceptions...');
  
  const grReq = new cds.Request({
    user: new cds.User({ id: 'gr_user', roles: ['GR'] }),
    headers: { 'x-user-role': 'GR' }
  });

  console.log('Action: Resolving quantity discrepancy (updating Goods Receipt in MIGO)...');
  await srv.send('resolveException', {
    exceptionId: ex.ID,
    note: 'Goods Receipt quantity corrected in MIGO (posted 50 units short-delivery receipt).'
  }, grReq);

  updatedEx = await SELECT.one.from(Exceptions).where({ ID: ex.ID });
  console.log(`-> Updated Exception Status: ${updatedEx.status}`);
  if (updatedEx.status !== 'RESOLVED') {
    console.error('E2E Fail: Expected exception status to be RESOLVED!');
    process.exit(1);
  }

  // =========================================================================
  // 3. PERSONA: Vendor AR Accountant (AR Role / External Security Isolation)
  // =========================================================================
  console.log('\n--- PERSONA 3: Vendor AR Accountant (V-1001) ---');
  console.log('Action: Simulating external vendor login to query matched lines...');

  const results = await srv.tx({
    user: new cds.User({ id: 'V-1001', roles: ['AR'] }),
    headers: { 'x-user-role': 'Vendor', 'x-user-vendor': 'V-1001' }
  }).run(SELECT.from(srv.entities.MatchResults));
  console.log(`-> Vendor V-1001 matches fetched: ${results.length} lines.`);
  
  const nonV1001Lines = results.filter(r => r.sourceVendorCode && r.sourceVendorCode !== 'V-1001');
  if (nonV1001Lines.length > 0) {
    console.error('E2E Fail: Security row-level isolation breached! Vendor saw data from other vendors.');
    process.exit(1);
  }
  console.log('-> Security row-level isolation VERIFIED. No leaking of foreign vendor records.');

  // =========================================================================
  // 4. VERIFY WORKFLOW HISTORY AUDIT TRAIL
  // =========================================================================
  console.log('\n--- WORKFLOW AUDIT TRAIL LOG ---');
  const history = await SELECT.from(WorkflowHistory).where({ exceptionID: ex.ID }).orderBy('createdAt asc');
  history.forEach((h, idx) => {
    console.log(`Step ${idx + 1}: [${h.timestamp}] Action: ${h.action} | Actor: ${h.actor} | Comment: ${h.comment}`);
  });

  console.log('\n=== E2E PERSONA & USE CASE TEST COMPLETED SUCCESSFULLY (100% GREEN) ===');
  process.exit(0);
}

main().catch(err => {
  console.error('\nE2E TEST FAILED:', err);
  process.exit(1);
});
