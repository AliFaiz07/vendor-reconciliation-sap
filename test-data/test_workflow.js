const cds = require('@sap/cds');

async function main() {
  const db = await cds.connect.to('db');
  const csn = await cds.load(['db/schema.cds', 'srv/reconciliation-service.cds']);
  cds.model = cds.linked(csn);
  const cds_server = await cds.serve('ReconciliationService').from('srv/reconciliation-service.cds');

  const { Exceptions, WorkflowHistory } = cds.entities('vendorrecon.db');

  // Find an open exception
  const openEx = await SELECT.one.from(Exceptions).where({ status: 'OPEN' });
  if (!openEx) {
    console.log('No open exception found. Please seed the database first.');
    process.exit(0);
  }

  const exceptionId = openEx.ID;
  console.log(`Testing exception workflow transitions for Exception: ${exceptionId} (Current Status: ${openEx.status})`);

  // 1. Resolve exception
  console.log('1. Resolving exception with note: "Resolved by AP Manager"...');
  await cds_server.send('resolveException', { exceptionId, note: 'Resolved by AP Manager' });

  // Verify status
  let updatedEx = await SELECT.one.from(Exceptions).where({ ID: exceptionId });
  console.log(`-> Updated Status: ${updatedEx.status}`);

  // 2. Reopen exception
  console.log('2. Reopening exception...');
  await cds_server.send('reopenException', { exceptionId });

  // Verify status
  updatedEx = await SELECT.one.from(Exceptions).where({ ID: exceptionId });
  console.log(`-> Updated Status: ${updatedEx.status}`);

  // 3. Raise dispute
  console.log('3. Raising dispute with comment: "Amount is correct on our side"...');
  await cds_server.send('raiseDispute', { exceptionId, comment: 'Amount is correct on our side' });

  // Verify status
  updatedEx = await SELECT.one.from(Exceptions).where({ ID: exceptionId });
  console.log(`-> Updated Status: ${updatedEx.status}`);

  // Fetch workflow history
  const history = await SELECT.from(WorkflowHistory).where({ exceptionID: exceptionId }).orderBy('createdAt asc');
  console.log('\n=========================================');
  console.log(`WORKFLOW HISTORY FOR EXCEPTION: ${exceptionId}`);
  console.log('=========================================');
  history.forEach((h, idx) => {
    console.log(`${idx + 1}. [${h.timestamp}] Step: ${h.stepName} | Action: ${h.action} | Actor: ${h.actor} | Comment: ${h.comment}`);
  });

  process.exit(0);
}

main().catch(console.error);
