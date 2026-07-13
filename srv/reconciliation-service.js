const cds = require('@sap/cds');
const log = cds.log('reconciliation-service');

module.exports = (srv) => {
  // Security Isolation Handler for row-level vendor isolation
  srv.before('READ', '*', (req) => {
    if (!req.target) return;
    
    const role = req.http?.req?.headers['x-user-role'];
    const vendor = req.http?.req?.headers['x-user-vendor'];
    
    if (role === 'Vendor' || role === 'AR' || role === 'BILLING') {
      if (vendor) {
        log.info(`Enforcing vendor isolation for vendor: ${vendor} on entity ${req.target.name}`);
        
        if (req.target.name === 'ReconciliationService.VendorDocLines') {
          req.query.where({ sourceVendorCode: vendor });
        } else if (req.target.name === 'ReconciliationService.VendorLedgerItems') {
          req.query.where({ supplier: vendor });
        } else if (req.target.name === 'ReconciliationService.StatementUploads') {
          req.query.where({ vendorCode: vendor });
        } else if (req.target.name === 'ReconciliationService.MatchResults') {
          req.query.where({ vendorDocLine: { sourceVendorCode: vendor } });
        } else if (req.target.name === 'ReconciliationService.Exceptions') {
          req.query.where({ matchResult: { vendorDocLine: { sourceVendorCode: vendor } } });
        } else if (req.target.name === 'ReconciliationService.GrirSnapshot') {
          req.query.where({ supplier: vendor });
        } else if (req.target.name === 'ReconciliationService.PurchaseOrders') {
          req.query.where({ supplier: vendor });
        }
      } else {
        log.warn(`Vendor role detected but no vendor code header found. Blocking read on ${req.target.name}`);
        req.query.where({ ID: 'BLOCK-ALL-UNAUTHORIZED' });
      }
    }
  });

  require('./handlers/auth-handler')(srv);
  require('./handlers/seed-handler')(srv);
  require('./handlers/upload-handler')(srv);
  require('./handlers/matching-handler')(srv);
  require('./handlers/kpi-handler')(srv);
};