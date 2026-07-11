const fs = require('fs');
const path = require('path');

async function callAction(actionName, payload) {
  const url = `http://localhost:4004/api/v1/${actionName}`;
  console.log(`Sending POST request to ${url}...`);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Action ${actionName} failed (${response.status}): ${errText}`);
  }
  
  const data = await response.json();
  // OData actions return value inside a 'value' property
  return data.value;
}

async function queryEntity(entityName) {
  const url = `http://localhost:4004/api/v1/${entityName}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to query ${entityName}: ${response.statusText}`);
  }
  const data = await response.json();
  return data.value;
}

async function main() {
  console.log('1. Reading Excel mock files...');
  const ledgerPath = path.join(__dirname, 'SAP_Ledger_Mock.xlsx');
  const stmtPath = path.join(__dirname, 'Vendor_Statement_Mock.xlsx');
  
  const ledgerBase64 = fs.readFileSync(ledgerPath).toString('base64');
  const stmtBase64 = fs.readFileSync(stmtPath).toString('base64');
  
  console.log('2. Seeding database via OData action...');
  const seedResult = await callAction('seedSapMockData', { fileBase64: ledgerBase64 });
  console.log('Seed Result:', seedResult);
  
  console.log('3. Uploading statement via OData action...');
  const uploadResult = await callAction('uploadStatement', { fileBase64: stmtBase64 });
  console.log('Upload Result (statementUploadId):', uploadResult);
  
  console.log('4. Querying MatchResults and Exceptions from database...');
  const results = await queryEntity('MatchResults');
  const exceptions = await queryEntity('Exceptions');
  const docLines = await queryEntity('VendorDocLines');
  
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
    const invoiceNo = res && res.invoiceNo ? res.invoiceNo : 'N/A';
    console.log(`${idx + 1}. Document [${invoiceNo}] -> Exception Status: ${e.status} | Reason: ${e.outcomeCode} | Priority: ${e.priority} | MSME Warning: ${e.msmeAlert} | Age: ${e.ageInDays} days`);
  });

  console.log('\n5. Fetching KPI Dashboard stats...');
  const response = await fetch('http://localhost:4004/api/v1/getCockpitKpis()');
  if (!response.ok) {
    throw new Error(`Failed to fetch KPIs: ${response.statusText}`);
  }
  const kpiData = await response.json();
  const kpis = JSON.parse(kpiData.value);
  console.log(`\n=========================================`);
  console.log(`KPI DASHBOARD SUMMARY`);
  console.log(`=========================================`);
  console.log(`- Match Rate: ${kpis.matchRate}%`);
  console.log(`- Open Exceptions: ${kpis.openEx}`);
  console.log(`  * P1 (Critical): ${kpis.p1Count}`);
  console.log(`  * P2 (High): ${kpis.p2Count}`);
  console.log(`  * P3 (Medium): ${kpis.p3Count}`);
  console.log(`  * MSME Alerts: ${kpis.msmeAlertCount}`);
}

main().catch(console.error);
