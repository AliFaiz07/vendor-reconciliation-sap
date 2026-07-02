Vendor Recon — CAP + CDS + UI5 Starter

This workspace now uses a minimal CAP service backed by CSV data and a simple UI5 Fiori-style UI to explore three tables: `vendors`, `invoices`, and `payments`.

Run locally:

```bash
npm install
npx cds-serve
```

Open http://127.0.0.1:4004 in your browser.

Key files:

- srv/service.cds — CDS model for the three entities.
- srv/service.js — custom handler that loads the CSV files for read operations.
- app/webapp — minimal UI5 shell and sample views.
- data/\*.csv — sample CSV data for the three tables.

Next steps:

- Add annotations and richer Fiori layouts.
- Add more OData queries and UI actions.
- Replace the CSV-backed reads with a database when needed.
