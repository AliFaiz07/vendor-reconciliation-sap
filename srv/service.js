const cds = require("@sap/cds");
const fs = require("fs");
const path = require("path");

module.exports = cds.service.impl(async function () {
  const { Vendors, Invoices, Payments } = this.entities;
  const dataDir = path.join(__dirname, "..", "data");

  function parseCsv(fileName) {
    const filePath = path.join(dataDir, fileName);
    const text = fs.readFileSync(filePath, "utf8").trim();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = lines[0].split(",").map((h) => h.trim());

    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      return Object.fromEntries(
        headers.map((header, index) => [header, values[index] || ""]),
      );
    });
  }

  function mapRows(rows, entity) {
    return rows.map((row) => {
      if (entity === Vendors) {
        return {
          vendor_id: row.vendor_id,
          name: row.name,
          contact: row.contact,
          email: row.email,
        };
      }

      if (entity === Invoices) {
        return {
          invoice_id: row.invoice_id,
          vendor_id: row.vendor_id,
          amount: parseFloat(row.amount),
          date: row.date,
          status: row.status,
        };
      }

      return {
        payment_id: row.payment_id,
        invoice_id: row.invoice_id,
        amount: parseFloat(row.amount),
        date: row.date,
        method: row.method,
      };
    });
  }

  this.on("READ", Vendors, async () =>
    mapRows(parseCsv("vendors.csv"), Vendors),
  );
  this.on("READ", Invoices, async () =>
    mapRows(parseCsv("invoices.csv"), Invoices),
  );
  this.on("READ", Payments, async () =>
    mapRows(parseCsv("payments.csv"), Payments),
  );
});
