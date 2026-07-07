const XLSX = require('xlsx');

// Sample workbooks (SAP_Ledger_Mock.xlsx, vendor statements) ship with a
// title row + blank row before the real header row. Plain
// XLSX.utils.sheet_to_json(sheet) assumes row 1 is the header, so it
// silently returns garbage. This scans for the row containing anchorCol
// and parses from there.
function parseSheet(sheet, anchorCol) {
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const headerIdx = rows.findIndex(r => Array.isArray(r) && r.includes(anchorCol));
  if (headerIdx === -1) return [];
  const headers = rows[headerIdx];
  return rows.slice(headerIdx + 1)
    .filter(r => r.some(c => c !== null && c !== undefined && c !== ''))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]]).filter(([h]) => h)));
}

module.exports = { parseSheet };
