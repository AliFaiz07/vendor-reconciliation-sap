const cds = require('@sap/cds');

async function main() {
  console.log('=== STARTING E2E PROCURE-TO-PAY WORKFLOW TEST ===\n');

  // Connect to database and load model
  const db = await cds.connect.to('db');
  const csn = await cds.load(['db/schema.cds', 'srv/reconciliation-service.cds']);
  cds.model = cds.linked(csn);
  const srv = await cds.serve('ReconciliationService').from('srv/reconciliation-service.cds');

  const { PurchaseRequisitions, PurchaseOrders, GrirSnapshot, VendorLedgerItems, VendorDocLines, Exceptions } = cds.entities('vendorrecon.db');

  // 1. PR Indenter Persona
  console.log('--- STEP 1: PR Indenter (PR Role) ---');
  const prReq = new cds.Request({
    user: new cds.User({ id: 'pr_user', roles: ['PR'] }),
    headers: { 'x-user-role': 'PR' }
  });
  
  const prRes = await srv.send('createPR', {
    material: 'MS Pipes 6 inch',
    qty: 50,
    amount: 99500
  }, prReq);
  
  const { prId, prNumber } = JSON.parse(prRes);
  console.log(`-> PR Created: ${prNumber} (ID: ${prId})`);
  
  // 2. PO Officer Persona
  console.log('\n--- STEP 2: PO Officer (PO Role) ---');
  const poReq = new cds.Request({
    user: new cds.User({ id: 'po_user', roles: ['PO'] }),
    headers: { 'x-user-role': 'PO' }
  });
  
  console.log(`-> Approving PR ${prNumber}...`);
  await srv.send('approvePR', { prId }, poReq);
  
  console.log(`-> Generating PO for PR ${prNumber}...`);
  const poRes = await srv.send('createPO', {
    prId,
    purchaseOrder: 'PO-4500001001',
    supplier: 'V-1001'
  }, poReq);
  
  const { poId, purchaseOrder } = JSON.parse(poRes);
  console.log(`-> PO Created: ${purchaseOrder} (ID: ${poId})`);
  
  console.log(`-> Sending PO to Vendor...`);
  await srv.send('sendPOToVendor', { poId }, poReq);
  
  // 3. Vendor Persona
  console.log('\n--- STEP 3: Vendor (VENDOR Role) ---');
  const vendorReq = new cds.Request({
    user: new cds.User({ id: 'V-1001', roles: ['Vendor'] }),
    headers: { 'x-user-role': 'Vendor', 'x-user-vendor': 'V-1001' }
  });
  
  console.log(`-> Vendor V-1001 dispatches goods for ${purchaseOrder}...`);
  await srv.send('dispatchGoods', { poId }, vendorReq);
  
  // 4. GR Officer Persona
  console.log('\n--- STEP 4: GR Officer (GR Role) ---');
  const grReq = new cds.Request({
    user: new cds.User({ id: 'gr_user', roles: ['GR'] }),
    headers: { 'x-user-role': 'GR' }
  });
  
  console.log(`-> Posting Goods Receipt (MIGO) for ${purchaseOrder}...`);
  await srv.send('postGR', { poId, grQty: 50, plant: '1000' }, grReq);
  console.log(`-> GR Posted successfully.`);
  
  // 5. Vendor submits invoice
  console.log('\n--- STEP 5: Vendor Submits Invoice ---');
  const docLineId = cds.utils.uuid();
  await INSERT.into(VendorDocLines).entries({
    ID: docLineId,
    vendorInvoiceNo: 'INV-2026-9901',
    invoiceDate: '2026-07-15',
    invoiceAmount: 99500,
    currency: 'INR',
    poReference: purchaseOrder,
    sourceVendorCode: 'V-1001'
  });
  console.log(`-> Invoice INV-2026-9901 submitted by V-1001.`);
  
  // 6. Finance Executive matches and clears invoice for payment
  console.log('\n--- STEP 6: Finance Executive (FINANCE Role) ---');
  const finReq = new cds.Request({
    user: new cds.User({ id: 'finance_user', roles: ['FINANCE'] }),
    headers: { 'x-user-role': 'FINANCE' }
  });
  
  // Simulate MIRO posting by creating a matching VendorLedgerItem
  console.log('-> Simulating MIRO Posting...');
  await INSERT.into(VendorLedgerItems).entries({
    ID: cds.utils.uuid(),
    supplier: 'V-1001',
    companyCode: '1000',
    accountingDocument: 'INV-2026-9901',
    documentDate: '2026-07-15',
    postingDate: '2026-07-15',
    amountInTransCrcy: 99500,
    transactionCurrency: 'INR',
    isCleared: false
  });
  
  console.log('-> Running Matching Engine...');
  await srv.send('runMatching', { statementUploadId: null }, finReq);
  
  console.log('-> Approving invoice for AP Payment...');
  await srv.send('approveForPayment', { docLineId }, finReq);
  
  // 7. AP Specialist executes Payment Proposal & payment run
  console.log('\n--- STEP 7: Accounts Payable (AP Role) ---');
  const apReq = new cds.Request({
    user: new cds.User({ id: 'ap_user', roles: ['AP'] }),
    headers: { 'x-user-role': 'AP' }
  });
  
  console.log('-> Creating Payment Proposal...');
  await srv.send('createPaymentProposal', { docLineIds: JSON.stringify([docLineId]) }, apReq);
  
  console.log('-> Executing F110 Payment Run...');
  const payRef = 'UTR-F110-880912';
  await srv.send('executePaymentRun', { paymentRef: payRef, docLineIds: JSON.stringify([docLineId]) }, apReq);
  
  // 8. Validations
  console.log('\n--- STEP 8: Validations ---');
  const updatedPO = await SELECT.one.from(PurchaseOrders).where({ ID: poId });
  console.log(`-> PO Status: ${updatedPO.status} (Expected: GR_POSTED)`);
  console.log(`-> PO Received Qty: ${updatedPO.receivedQty} (Expected: 50)`);
  
  const updatedDocLine = await SELECT.one.from(VendorDocLines).where({ ID: docLineId });
  console.log(`-> Invoice Payment Status: ${updatedDocLine.paymentStatus} (Expected: PAID)`);
  console.log(`-> Invoice Payment Ref: ${updatedDocLine.paymentReference} (Expected: ${payRef})`);
  
  const updatedLedger = await SELECT.one.from(VendorLedgerItems).where({ accountingDocument: 'INV-2026-9901' });
  console.log(`-> Ledger Item Cleared: ${updatedLedger.isCleared ? 'YES' : 'NO'} (Expected: YES)`);
  console.log(`-> Ledger Clearing Doc: ${updatedLedger.clearingDocument} (Expected: ${payRef})`);
  
  if (updatedPO.status === 'GR_POSTED' && updatedDocLine.paymentStatus === 'PAID' && updatedLedger.isCleared) {
    console.log('\n=== E2E PROCURE-TO-PAY WORKFLOW TEST COMPLETED SUCCESSFULLY (100% GREEN) ===');
    process.exit(0);
  } else {
    console.error('\nE2E Validation Failed!');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\nE2E TEST FAILED:', err);
  process.exit(1);
});
