const cds = require('@sap/cds');
const log = cds.log('reconciliation-service');

module.exports = (srv) => {
  // Security Isolation Handler for row-level vendor isolation
  srv.before('READ', '*', (req) => {
    if (!req.target) return;
    
    const getHeader = (name) => {
      const headers = req.http?.req?.headers || req.headers || {};
      return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
    };
    
    const role = getHeader('x-user-role');
    const vendor = getHeader('x-user-vendor');
    
    if (role === 'Vendor' || role === 'AR' || role === 'BILLING' || role === 'VENDOR') {
      const activeVendor = vendor || (role === 'Vendor' ? null : vendor);
      if (activeVendor) {
        log.info(`Enforcing vendor isolation for vendor: ${activeVendor} on entity ${req.target.name}`);
        
        if (req.target.name === 'ReconciliationService.VendorDocLines') {
          req.query.where({ sourceVendorCode: activeVendor });
        } else if (req.target.name === 'ReconciliationService.VendorLedgerItems') {
          req.query.where({ supplier: activeVendor });
        } else if (req.target.name === 'ReconciliationService.StatementUploads') {
          req.query.where({ vendorCode: activeVendor });
        } else if (req.target.name === 'ReconciliationService.MatchResults') {
          req.query.where({ vendorDocLine: { sourceVendorCode: activeVendor } });
        } else if (req.target.name === 'ReconciliationService.Exceptions') {
          req.query.where({ matchResult: { vendorDocLine: { sourceVendorCode: activeVendor } } });
        } else if (req.target.name === 'ReconciliationService.GrirSnapshot') {
          req.query.where({ supplier: activeVendor });
        } else if (req.target.name === 'ReconciliationService.PurchaseOrders') {
          req.query.where({ supplier: activeVendor });
        }
      } else {
        log.warn(`Vendor role detected but no vendor code header found. Blocking read on ${req.target.name}`);
        req.query.where({ ID: 'BLOCK-ALL-UNAUTHORIZED' });
      }
    } else if (role === 'PR') {
      log.info(`Enforcing PR restrictions on entity ${req.target.name}`);
      if (req.target.name !== 'ReconciliationService.PurchaseRequisitions' && req.target.name !== 'ReconciliationService.PurchaseOrders') {
        req.query.where({ ID: 'BLOCK-ALL-UNAUTHORIZED' });
      }
    } else if (role === 'PO') {
      log.info(`Enforcing PO Officer restrictions on entity ${req.target.name}`);
      if (req.target.name !== 'ReconciliationService.PurchaseRequisitions' && 
          req.target.name !== 'ReconciliationService.PurchaseOrders' &&
          req.target.name !== 'ReconciliationService.VendorMaster') {
        req.query.where({ ID: 'BLOCK-ALL-UNAUTHORIZED' });
      }
    } else if (role === 'GR') {
      log.info(`Enforcing GR restrictions on entity ${req.target.name}`);
      if (req.target.name === 'ReconciliationService.Exceptions' || req.target.name === 'ReconciliationService.MatchResults') {
        req.query.where({ ID: 'BLOCK-ALL-UNAUTHORIZED' });
      }
    } else if (role === 'AP') {
      log.info(`Enforcing AP restrictions on entity ${req.target.name}`);
      if (req.target.name === 'ReconciliationService.VendorDocLines') {
        req.query.where({ approvedForPayment: true });
      }
    }
  });

  require('./handlers/auth-handler')(srv);
  require('./handlers/seed-handler')(srv);
  require('./handlers/upload-handler')(srv);
  require('./handlers/matching-handler')(srv);
  require('./handlers/kpi-handler')(srv);
  require('./handlers/p2p-handler')(srv);
};