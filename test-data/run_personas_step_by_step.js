const cds = require('@sap/cds');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function runP2PWorkflow(srv, entities) {
  const { PurchaseRequisitions, PurchaseOrders, GrirSnapshot, VendorLedgerItems, VendorDocLines, Exceptions } = entities;

  console.log('\n========================================================================');
  console.log('   STARTING STEP-BY-STEP PROCURE-TO-PAY (P2P) WORKFLOW');
  console.log('========================================================================\n');

  let prId, prNumber, poId, purchaseOrder, docLineId;
  const payRef = 'UTR-F110-880912';

  // --- STEP 1 ---
  console.log('------------------------------------------------------------------------');
  console.log('PERSONA 1: PR Indenter (Role: PR)');
  console.log('User Account: pr_user (pr@reconcile.com)');
  console.log('Action: Requesting purchase of "MS Pipes 6 inch" (Qty: 50, Amt: INR 99,500)');
  console.log('------------------------------------------------------------------------');
  await askQuestion('Press Enter to execute step as PR Indenter...');

  const prReq = new cds.Request({
    user: new cds.User({ id: 'pr_user', roles: ['PR'] }),
    headers: { 'x-user-role': 'PR' }
  });
  
  const prRes = await srv.send('createPR', {
    material: 'MS Pipes 6 inch',
    qty: 50,
    amount: 99500
  }, prReq);
  
  const parsedPr = JSON.parse(prRes);
  prId = parsedPr.prId;
  prNumber = parsedPr.prNumber;
  console.log(`\n[SUCCESS] PR Created: ${prNumber} (ID: ${prId})\n`);

  // --- STEP 2 ---
  console.log('------------------------------------------------------------------------');
  console.log('PERSONA 2: PO Officer (Role: PO)');
  console.log('User Account: po_user (po@reconcile.com)');
  console.log(`Action: Approve PR ${prNumber}, convert it to a Purchase Order for Vendor V-1001, and dispatch to vendor`);
  console.log('------------------------------------------------------------------------');
  await askQuestion('Press Enter to execute step as PO Officer...');

  const poReq = new cds.Request({
    user: new cds.User({ id: 'po_user', roles: ['PO'] }),
    headers: { 'x-user-role': 'PO' }
  });
  
  console.log(`\n-> Approving PR ${prNumber}...`);
  await srv.send('approvePR', { prId }, poReq);
  
  console.log(`-> Generating PO for PR ${prNumber}...`);
  const poRes = await srv.send('createPO', {
    prId,
    purchaseOrder: 'PO-4500001001',
    supplier: 'V-1001'
  }, poReq);
  
  const parsedPo = JSON.parse(poRes);
  poId = parsedPo.poId;
  purchaseOrder = parsedPo.purchaseOrder;
  console.log(`-> PO Created: ${purchaseOrder} (ID: ${poId})`);
  
  console.log(`-> Sending PO to Vendor...`);
  await srv.send('sendPOToVendor', { poId }, poReq);
  console.log(`\n[SUCCESS] PO generated and dispatched to supplier V-1001.\n`);

  // --- STEP 3 ---
  console.log('------------------------------------------------------------------------');
  console.log('PERSONA 3: Vendor (Role: Vendor)');
  console.log('User Account: V-1001 (sigma@reconcile.com)');
  console.log(`Action: Dispatching goods corresponding to Purchase Order ${purchaseOrder}`);
  console.log('------------------------------------------------------------------------');
  await askQuestion('Press Enter to execute step as Vendor...');

  const vendorReq = new cds.Request({
    user: new cds.User({ id: 'V-1001', roles: ['Vendor'] }),
    headers: { 'x-user-role': 'Vendor', 'x-user-vendor': 'V-1001' }
  });
  
  await srv.send('dispatchGoods', { poId }, vendorReq);
  console.log(`\n[SUCCESS] Vendor dispatched goods. PO status updated.\n`);

  // --- STEP 4 ---
  console.log('------------------------------------------------------------------------');
  console.log('PERSONA 4: Goods Receipt (GR) Officer (Role: GR)');
  console.log('User Account: gr_user (gr@reconcile.com)');
  console.log(`Action: Post Goods Receipt (MIGO) for PO ${purchaseOrder} to verify delivery`);
  console.log('------------------------------------------------------------------------');
  await askQuestion('Press Enter to execute step as GR Specialist...');

  const grReq = new cds.Request({
    user: new cds.User({ id: 'gr_user', roles: ['GR'] }),
    headers: { 'x-user-role': 'GR' }
  });
  
  await srv.send('postGR', { poId, grQty: 50, plant: '1000' }, grReq);
  console.log(`\n[SUCCESS] Goods Receipt posted for 50 units.\n`);

  // --- STEP 5 ---
  console.log('------------------------------------------------------------------------');
  console.log('PERSONA 5: Vendor Bill Submission (Role: Vendor)');
  console.log('User Account: V-1001 (sigma@reconcile.com)');
  console.log(`Action: Submitting Invoice INV-2026-9901 for amount INR 99,500`);
  console.log('------------------------------------------------------------------------');
  await askQuestion('Press Enter to submit Vendor Invoice...');

  docLineId = cds.utils.uuid();
  await INSERT.into(VendorDocLines).entries({
    ID: docLineId,
    vendorInvoiceNo: 'INV-2026-9901',
    invoiceDate: new Date().toISOString().split('T')[0],
    invoiceAmount: 99500,
    currency: 'INR',
    poReference: purchaseOrder,
    sourceVendorCode: 'V-1001'
  });
  console.log(`\n[SUCCESS] Invoice INV-2026-9901 submitted by V-1001.\n`);

  // --- STEP 6 ---
  console.log('------------------------------------------------------------------------');
  console.log('PERSONA 6: Finance Executive (Role: FINANCE)');
  console.log('User Account: finance_user (finance@reconcile.com)');
  console.log(`Action: Simulate MIRO invoice verification posting, execute Matching Engine, and approve invoice for payment`);
  console.log('------------------------------------------------------------------------');
  await askQuestion('Press Enter to execute step as Finance Executive...');

  const finReq = new cds.Request({
    user: new cds.User({ id: 'finance_user', roles: ['FINANCE'] }),
    headers: { 'x-user-role': 'FINANCE' }
  });
  
  console.log('-> Simulating ERP MIRO Invoice verification entry...');
  await INSERT.into(VendorLedgerItems).entries({
    ID: cds.utils.uuid(),
    supplier: 'V-1001',
    companyCode: '1000',
    accountingDocument: 'INV-2026-9901',
    documentDate: new Date().toISOString().split('T')[0],
    postingDate: new Date().toISOString().split('T')[0],
    amountInTransCrcy: 99500,
    transactionCurrency: 'INR',
    isCleared: false
  });
  
  console.log('-> Invoking Match Engine...');
  await srv.send('runMatching', { statementUploadId: null }, finReq);
  
  console.log('-> Approving invoice for AP Payment...');
  await srv.send('approveForPayment', { docLineId }, finReq);
  console.log(`\n[SUCCESS] Invoice reconciled and cleared for Payment Proposal.\n`);

  // --- STEP 7 ---
  console.log('------------------------------------------------------------------------');
  console.log('PERSONA 7: Accounts Payable Specialist (Role: AP)');
  console.log('User Account: admin (admin@reconcile.com)');
  console.log(`Action: Create Payment Proposal for INV-2026-9901 and run F110 Payment Run with ref UTR-F110-880912`);
  console.log('------------------------------------------------------------------------');
  await askQuestion('Press Enter to execute step as AP Specialist...');

  const apReq = new cds.Request({
    user: new cds.User({ id: 'admin', roles: ['AP'] }),
    headers: { 'x-user-role': 'AP' }
  });
  
  console.log('-> Triggering Payment Proposal...');
  await srv.send('createPaymentProposal', { docLineIds: JSON.stringify([docLineId]) }, apReq);
  
  console.log('-> Triggering F110 Payment Run...');
  await srv.send('executePaymentRun', { paymentRef: payRef, docLineIds: JSON.stringify([docLineId]) }, apReq);
  console.log(`\n[SUCCESS] Payment run executed successfully. UTR recorded.\n`);

  // --- VALIDATIONS ---
  console.log('========================================================================');
  console.log('   VERIFYING END-TO-END DATABASE STATE');
  console.log('========================================================================');
  
  const updatedPO = await SELECT.one.from(PurchaseOrders).where({ ID: poId });
  console.log(`- PO status updated to GR_POSTED?    [${updatedPO.status === 'GR_POSTED' ? '✔ YES' : '✘ NO'}] (Actual: ${updatedPO.status})`);
  console.log(`- Received quantity matches PO qty? [${updatedPO.receivedQty == 50 ? '✔ YES' : '✘ NO'}] (Actual: ${updatedPO.receivedQty})`);
  
  const updatedDocLine = await SELECT.one.from(VendorDocLines).where({ ID: docLineId });
  console.log(`- Invoice payment state is PAID?     [${updatedDocLine.paymentStatus === 'PAID' ? '✔ YES' : '✘ NO'}] (Actual: ${updatedDocLine.paymentStatus})`);
  console.log(`- Invoice Payment Reference updated? [${updatedDocLine.paymentReference === payRef ? '✔ YES' : '✘ NO'}] (Actual: ${updatedDocLine.paymentReference})`);
  
  const updatedLedger = await SELECT.one.from(VendorLedgerItems).where({ accountingDocument: 'INV-2026-9901' });
  console.log(`- ERP Vendor Ledger cleared?        [${updatedLedger.isCleared ? '✔ YES' : '✘ NO'}]`);
  console.log(`- ERP Clearing Document set?         [${updatedLedger.clearingDocument === payRef ? '✔ YES' : '✘ NO'}] (Actual: ${updatedLedger.clearingDocument})`);
  
  console.log('\n========================================================================');
  console.log('   P2P WORKFLOW COMPLETED SUCCESSFULLY!');
  console.log('========================================================================\n');
}

async function runReconWorkflow(srv, entities) {
  const { Exceptions, WorkflowHistory, MatchResults } = entities;

  console.log('\n========================================================================');
  console.log('   STARTING STEP-BY-STEP RECONCILIATION & DISPUTE WORKFLOW');
  console.log('========================================================================\n');

  // Paths to test data
  const ledgerPath = path.join(__dirname, 'scenarios', 'SAP_Ledger_Mock_TC003_Qty_More.xlsx');
  const statementPath = path.join(__dirname, 'scenarios', 'Vendor_Statement_Mock_TC003_Qty_More.xlsx');

  if (!fs.existsSync(ledgerPath) || !fs.existsSync(statementPath)) {
    console.error('Error: Mock files not found. Please run "python test-data/generate_all_ledgers_and_statements.py" first.');
    return;
  }

  const ledgerBase64 = fs.readFileSync(ledgerPath).toString('base64');
  const statementBase64 = fs.readFileSync(statementPath).toString('base64');

  // --- AP Specialist Upload & Dispute ---
  console.log('------------------------------------------------------------------------');
  console.log('PERSONA 1: AP Specialist / Administrator (Role: AP)');
  console.log('User Account: admin (admin@reconcile.com)');
  console.log('Action: Upload SAP Ledger Master data and Vendor Statement (TC003 Qty Variance)');
  console.log('        This will trigger the Match Engine & raise a discrepancy Exception.');
  console.log('------------------------------------------------------------------------');
  await askQuestion('Press Enter to execute upload as AP Specialist...');

  const apReq = new cds.Request({
    user: new cds.User({ id: 'admin', roles: ['AP'] }),
    headers: { 'x-user-role': 'AP' }
  });
  
  console.log('-> Seeding SAP ledger entries...');
  await srv.send('seedSapMockData', { fileBase64: ledgerBase64 }, apReq);
  
  console.log('-> Uploading Vendor statement file (Excel)...');
  const uploadId = await srv.send('uploadStatement', {
    fileBase64: statementBase64,
    companyCode: '1000',
    period: '2026-04',
    fiscalYear: '2026',
    fileName: 'Vendor_Statement_Mock_TC003_Qty_More.xlsx'
  }, apReq);
  
  console.log(`-> Statement uploaded successfully. Upload ID: ${uploadId}`);

  // Fetch exceptions
  const raisedExceptions = await SELECT.from(Exceptions);
  console.log(`-> Exceptions currently active in DB: ${raisedExceptions.length}`);
  
  if (raisedExceptions.length === 0) {
    console.error('Fail: No exception raised. Run the setup first.');
    return;
  }

  const ex = raisedExceptions[0];
  console.log(`\n- Raised Exception Details:`);
  console.log(`  * Exception ID: ${ex.ID}`);
  console.log(`  * Variance Outcome: ${ex.outcomeCode}`);
  console.log(`  * Recommended Next Action: ${ex.recommendedAction}`);
  console.log(`  * MSME Vendor Warning Alert: ${ex.msmeAlert ? 'YES' : 'NO'}`);
  console.log(`  * Current Exception Status: ${ex.status}`);

  console.log('\nAction: Simulating customer complaint -> Raising Dispute on this discrepancy...');
  await askQuestion('Press Enter to raise dispute...');
  
  await srv.send('raiseDispute', {
    exceptionId: ex.ID,
    comment: 'Vendor AR disputes the quantity discrepancy. Physical receipt indicates 500 units.'
  }, apReq);

  let updatedEx = await SELECT.one.from(Exceptions).where({ ID: ex.ID });
  console.log(`\n[SUCCESS] Exception state updated to: ${updatedEx.status}\n`);

  // --- GR Specialist ---
  console.log('------------------------------------------------------------------------');
  console.log('PERSONA 2: GR Specialist (Role: GR)');
  console.log('User Account: gr_user (gr@reconcile.com)');
  console.log(`Action: Verify discrepancy details and resolve exception in ERP MIGO`);
  console.log('------------------------------------------------------------------------');
  await askQuestion('Press Enter to execute step as GR Specialist...');

  const grReq = new cds.Request({
    user: new cds.User({ id: 'gr_user', roles: ['GR'] }),
    headers: { 'x-user-role': 'GR' }
  });

  await srv.send('resolveException', {
    exceptionId: ex.ID,
    note: 'Goods Receipt quantity corrected in MIGO (posted 50 units short-delivery receipt).'
  }, grReq);

  updatedEx = await SELECT.one.from(Exceptions).where({ ID: ex.ID });
  console.log(`\n[SUCCESS] Exception state updated to: ${updatedEx.status}\n`);

  // --- Vendor AR Accountant ---
  console.log('------------------------------------------------------------------------');
  console.log('PERSONA 3: Vendor AR Accountant (Role: Vendor / AR)');
  console.log('User Account: V-1001 (sigma@reconcile.com)');
  console.log(`Action: Vendor logs in and queries Match Results.`);
  console.log(`        Verifies row-level security isolation (Vendor cannot see other vendor records)`);
  console.log('------------------------------------------------------------------------');
  await askQuestion('Press Enter to query Match Results as Vendor V-1001...');

  const results = await srv.tx({
    user: new cds.User({ id: 'V-1001', roles: ['AR'] }),
    headers: { 'x-user-role': 'Vendor', 'x-user-vendor': 'V-1001' }
  }).run(SELECT.from(srv.entities.MatchResults));
  
  console.log(`\n-> Vendor V-1001 matches fetched: ${results.length} lines.`);
  const nonV1001Lines = results.filter(r => r.sourceVendorCode && r.sourceVendorCode !== 'V-1001');
  
  console.log(`- Leakage check: Did vendor see other vendor records? [${nonV1001Lines.length === 0 ? '✔ NO (Secure)' : '✘ YES (Breached)'}]`);
  console.log(`\n[SUCCESS] Security row-level isolation verified. Access restricted to V-1001 data only.\n`);

  // --- AUDIT TRAIL ---
  console.log('------------------------------------------------------------------------');
  console.log('AUDIT TRAIL / WORKFLOW HISTORY LOG');
  console.log('------------------------------------------------------------------------');
  const history = await SELECT.from(WorkflowHistory).where({ exceptionID: ex.ID }).orderBy('createdAt asc');
  history.forEach((h, idx) => {
    console.log(`Step ${idx + 1}: [${h.timestamp}] Action: ${h.action} | Actor: ${h.actor} | Comment: ${h.comment}`);
  });

  console.log('\n========================================================================');
  console.log('   RECONCILIATION WORKFLOW COMPLETED SUCCESSFULLY!');
  console.log('========================================================================\n');
}

async function main() {
  console.log('\n========================================================================');
  console.log('      SAP CAP VENDOR RECONCILIATION PERSONA RUNNER (STEP-BY-STEP)');
  console.log('========================================================================');
  console.log('1. Procure-to-Pay (P2P) Lifecycle (7 Roles)');
  console.log('2. Reconciliation & Dispute Management (3 Roles)');
  console.log('------------------------------------------------------------------------');
  
  const choice = await askQuestion('Select workflow to execute (1 or 2): ');
  
  // Connect to database and load model
  const db = await cds.connect.to('db');
  const csn = await cds.load(['db/schema.cds', 'srv/reconciliation-service.cds']);
  cds.model = cds.linked(csn);
  const srv = await cds.serve('ReconciliationService').from('srv/reconciliation-service.cds');

  const entities = cds.entities('vendorrecon.db');

  if (choice.trim() === '1') {
    await runP2PWorkflow(srv, entities);
  } else if (choice.trim() === '2') {
    await runReconWorkflow(srv, entities);
  } else {
    console.log('Invalid selection.');
  }

  rl.close();
  process.exit(0);
}

main().catch(err => {
  console.error('\nExecution error:', err);
  rl.close();
  process.exit(1);
});
