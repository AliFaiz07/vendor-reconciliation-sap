const XLSX = require('xlsx');

/**
 * Utility to parse an Excel worksheet by scanning for a specific anchor column.
 * Since many vendor statements contain metadata title rows and blank spaces 
 * before the actual tabular data starts, this helper dynamically locates the 
 * header row containing the specified `anchorCol` and extracts the records from there.
 *
 * @param {Object} sheet - The SheetJS worksheet object.
 * @param {string} anchorCol - The name of the column header to search for.
 * @returns {Array<Object>} List of row objects mapping headers to cell values.
 */
function parseSheet(sheet, anchorCol) {
  if (!sheet) return [];
  
  // Parse rows as raw array of arrays
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  
  // Search for the index of the header row
  const headerIdx = rows.findIndex(r => Array.isArray(r) && r.includes(anchorCol));
  if (headerIdx === -1) return [];

  const headers = rows[headerIdx];
  
  // Slice data rows after header, filter out empty rows, and map to objects
  return rows.slice(headerIdx + 1)
    .filter(r => r.some(c => c !== null && c !== undefined && c !== ''))
    .map(r => Object.fromEntries(
      headers.map((h, i) => [h, r[i]]).filter(([h]) => h !== null && h !== undefined && h !== '')
    ));
}

module.exports = { parseSheet };
