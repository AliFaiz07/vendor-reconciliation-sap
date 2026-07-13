const cds = require('@sap/cds');
const { runMatchRulesForLine } = require('./matching-engine');
const { runScenarios } = require('../scenarios/registry');

const log = cds.log('matching-handler');

function getReason(code) {
  switch (code) {
    case 'MATCHED': return "Exact match by invoice number and amount.";
    case 'MATCHED/3WAY': return "Clean 3-way match (PO = GR = Invoice).";
    case 'MATCHED/ROUNDING': return "Matched within rounding tolerance limit.";
    case 'MATCHED/NEAR-MATCH': return "Matched by fuzzy invoice number comparison.";
    case 'MATCHED/TIMING': return "Payment posted in transit timing difference.";
    case 'MATCHED/TDS-194Q': return "Withholding tax TDS u/s 194Q correctly deducted.";
    case 'UNMATCHED/QTY-MORE': return "Invoice quantity exceeds Goods Receipt quantity (reversal/shortage).";
    case 'UNMATCHED/QTY-LESS': return "Invoice quantity is less than Goods Receipt quantity.";
    case 'UNMATCHED/PRICE-HIGH': return "Invoice price exceeds PO rate beyond tolerance limit.";
    case 'UNMATCHED/CN-MISSING': return "Credit Note issued by vendor is missing in buyer's ledger.";
    case 'UNMATCHED/GR-PENDING': return "Goods Receipt (GR) is pending at the buyer plant.";
    case 'UNMATCHED/GST-2B-GAP': return "Invoice missing in buyer GSTR-2B (vendor has not filed returns).";
    case 'UNMATCHED/AMOUNT-DIFF': return "Invoice amount mismatch exceeds tolerance limit.";
    default: return "No matching candidate found in buyer ledger.";
  }
}

function getRecommendedAction(code) {
  switch (code) {
    case 'UNMATCHED/QTY-MORE': return "Check short receipt. Reach out to stores/GRN team to verify physical receipt or reverse quantity.";
    case 'UNMATCHED/PRICE-HIGH': return "Review price discrepancy. Request credit note from the vendor or approve rate difference.";
    case 'UNMATCHED/CN-MISSING': return "Book Credit Note in buyer AP ledger.";
    case 'UNMATCHED/GR-PENDING': return "Post Goods Receipt in MIGO for the PO reference.";
    case 'UNMATCHED/GST-2B-GAP': return "Follow up with vendor to file GSTR-1; hold Input Tax Credit (ITC).";
    case 'UNMATCHED/AMOUNT-DIFF': return "Verify invoice amount against purchase order and ledger entry.";
    default: return "Verify invoice details with the vendor AR team.";
  }
}

function withManaged(entry, req, entity) {
  const user = req?.user?.id || 'system-engine';
  const now = new Date().toISOString();
  
  const base = {
    createdAt: now,
    createdBy: user,
    modifiedAt: now,
    modifiedBy: user,
    ...entry
  };
  
  const cleaned = {};
  for (const key in entity.elements) {
    const element = entity.elements[key];
    if (element.type === 'cds.Association' || element.virtual) continue;
    
    let val = base[key];
    if (typeof val === 'boolean') {
      val = val ? 1 : 0;
    }
    cleaned[key] = val === undefined ? null : val;
  }
  
  for (const key in base) {
    if (key.endsWith('_ID')) {
      cleaned[key] = base[key] === undefined ? null : base[key];
    }
  }
  
  return cleaned;
}

module.exports = (srv) => {
  /**
   * Action handler to run the matching and reconciliation engine.
   * Compares the uploaded Vendor Statement lines (VendorDocLines) against 
   * the internal Buyer Ledger (VendorLedgerItems) and GR/IR Snapshot.
   */
  srv.on('runMatching', async (req) => {
    try {
      const { statementUploadId } = req.data;
      const { VendorDocLines, VendorLedgerItems, GrirSnapshot, PurchaseOrders, MatchResults, Exceptions, AuditLog, VendorMaster, WorkflowHistory } = cds.entities;

      let uploadId = statementUploadId;
      if (!uploadId) {
        log.info('No statementUploadId provided. Retrieving the latest upload context...');
        const lastLine = await SELECT.one.from(VendorDocLines).orderBy('createdAt desc');
        if (!lastLine) {
          return req.error(400, 'No statement lines found in the database. Please upload a statement first.');
        }
        uploadId = lastLine.statementUploadId;
      }

      log.info(`Executing matching engine for upload: ${uploadId}`);
      const lines = await SELECT.from(VendorDocLines).where({ statementUploadId: uploadId });
      log.info(`Loaded ${lines.length} statement lines to match.`);
      const lineIds = lines.map(l => l.ID);

      // Wrap matching results generation in a database transaction block
      await cds.tx(req).run(async (tx) => {
        log.info('Clearing previous match results and exceptions for this upload context...');
        if (lineIds.length > 0) {
          const matchingResults = await tx.run(SELECT.from(MatchResults).where({ vendorDocLine_ID: { in: lineIds } }));
          const resultIds = matchingResults.map(r => r.ID);
          if (resultIds.length > 0) {
            await tx.run(DELETE.from(Exceptions).where({ matchResult_ID: { in: resultIds } }));
            await tx.run(DELETE.from(MatchResults).where({ ID: { in: resultIds } }));
          }
        }

        for (const line of lines) {
          const candidates = await tx.run(SELECT.from(VendorLedgerItems).where({ supplier: line.sourceVendorCode }));
          const grirRow = line.poReference
            ? await tx.run(SELECT.one.from(GrirSnapshot).where({ purchaseOrder: line.poReference }))
            : null;
          const poRecord = line.poReference
            ? await tx.run(SELECT.one.from(PurchaseOrders).where({ purchaseOrder: line.poReference }))
            : null;

          // Run Scenario checks first (credit notes, timing, TDS, etc.)
          const scenarioResult = await runScenarios(line, poRecord, grirRow, candidates);
          // Run standard candidates matching
          const baseOutcomes = await runMatchRulesForLine(line, candidates);
          // Prioritize scenario matches exclusively if they exist
          const outcomes = scenarioResult ? [scenarioResult] : baseOutcomes;

          for (const outcome of outcomes) {
            const matchResultId = cds.utils.uuid();
            
            let assignedRole = outcome.businessRole;
            if (!assignedRole) {
              if (outcome.rule === 'RULE_PO_GR' || outcome.code.includes('GR-PENDING')) {
                assignedRole = 'GR';
              } else if (outcome.rule === 'RULE_AMOUNT' || outcome.code.includes('AMOUNT-DIFF')) {
                assignedRole = 'MIRO';
              } else if (outcome.rule === 'RULE_GST_TDS' || outcome.code.includes('GST-DIFF')) {
                assignedRole = 'BILLING';
              } else {
                assignedRole = 'AP';
              }
            }

            const invoiceNo = line.vendorInvoiceNo;

            // Determine amount delta
            let amountDelta = 0;
            if (outcome.delta != null) {
              amountDelta = Math.abs(outcome.delta);
            } else if (outcome.code && (outcome.code.startsWith('UNMATCHED') || outcome.code.includes('-DIFF') || outcome.code.includes('-PENDING') || outcome.code.includes('-GAP') || outcome.code.includes('-MISSING') || outcome.code === 'UNMATCHED')) {
              amountDelta = Math.abs(line.invoiceAmount);
            }

            // Insert matching results
            await tx.run(INSERT.into('vendorrecon.db.MatchResults').entries(withManaged({
              ID: matchResultId,
              vendorDocLine_ID: line.ID,
              ledgerItem_ID: outcome.ledgerItemID || null,
              outcomeCode: outcome.code,
              amountDelta: amountDelta,
              matchRuleApplied: outcome.rule,
              businessRole: assignedRole,
              invoiceNo: invoiceNo,
              reason: getReason(outcome.code)
            }, req, MatchResults)));
 
            // If unmatched or exception, create an open exception record
            if (outcome.code.startsWith('UNMATCHED') || outcome.code.includes('-DIFF') || outcome.code.includes('-PENDING') || outcome.code.includes('-GAP') || outcome.code.includes('-MISSING') || outcome.code === 'UNMATCHED') {
              const vendor = await tx.run(SELECT.one.from(VendorMaster).where({ businessPartner: line.sourceVendorCode }));
              
              let priority = 'P3';
              if (outcome.code === 'UNMATCHED/QTY-MORE' || 
                  outcome.code === 'UNMATCHED/PRICE-HIGH' || 
                  outcome.code === 'UNMATCHED/GST-2B-GAP' || 
                  outcome.code === 'UNMATCHED/GR-PENDING' ||
                  outcome.code === 'UNMATCHED/CN-MISSING' ||
                  outcome.code === 'UNMATCHED/AMOUNT-DIFF') {
                priority = 'P1';
              }
              
              let ageInDays = 0;
              if (line.invoiceDate) {
                ageInDays = Math.max(0, Math.floor((new Date() - new Date(line.invoiceDate)) / 86400000));
              }
              
              const msmeAlert = !!(vendor && (vendor.isMsme === true || vendor.isMsme === 1));
              
              const exceptionId = cds.utils.uuid();
              await tx.run(INSERT.into('vendorrecon.db.Exceptions').entries(withManaged({
                ID: exceptionId,
                matchResult_ID: matchResultId,
                invoiceNo: invoiceNo,
                outcomeCode: outcome.code,
                status: 'OPEN',
                priority,
                ageInDays,
                msmeAlert,
                recommendedAction: getRecommendedAction(outcome.code)
              }, req, Exceptions)));

              await tx.run(INSERT.into('vendorrecon.db.WorkflowHistory').entries(withManaged({
                ID: cds.utils.uuid(),
                exceptionID: exceptionId,
                stepName: 'Intake/Match',
                actor: 'system-engine',
                action: 'CREATE',
                comment: 'Exception automatically created by matching engine',
                timestamp: new Date().toISOString()
              }, req, WorkflowHistory)));
            }
 
            // Write matching audit log
            await tx.run(INSERT.into('vendorrecon.db.AuditLog').entries(withManaged({
              ID: cds.utils.uuid(),
              entityName: 'MatchResults',
              entityKey: line.ID,
              action: 'MATCH',
              performedBy: req?.user?.id || 'system-engine',
              afterValue: JSON.stringify(outcome),
              performedAt: new Date().toISOString(),
            }, req, AuditLog)));
          }
        }
      });

      log.info('Matching cycle completed successfully. Transaction committed.');
      return 'Matching completed';
    } catch (err) {
      log.error('Matching engine cycle execution failed:', err);
      if (typeof req.error === 'function') {
        return req.error(500, `Matching failed: ${err.message}`);
      }
      throw err;
    }
  });

  srv.on('resolveException', async (req) => {
    try {
      const { exceptionId, note } = req.data;
      if (!exceptionId) return req.error(400, 'Exception ID is required.');
      
      const { Exceptions, WorkflowHistory } = cds.entities;
      
      await cds.tx(req).run(async (tx) => {
        await tx.run(UPDATE(Exceptions, exceptionId).with({ status: 'RESOLVED' }));
        
        await tx.run(INSERT.into(WorkflowHistory).entries({
          ID: cds.utils.uuid(),
          exceptionID: exceptionId,
          stepName: 'Resolution',
          actor: req.user?.id || req.http?.req?.headers['x-user-role'] || 'AP_Specialist',
          action: 'RESOLVE',
          comment: note || 'Resolved by user',
          timestamp: new Date().toISOString()
        }));
      });
      
      log.info(`Exception ${exceptionId} resolved successfully.`);
      return 'Resolved';
    } catch (err) {
      log.error('Failed to resolve exception:', err);
      return req.error(500, `Resolution failed: ${err.message}`);
    }
  });
 
  srv.on('reopenException', async (req) => {
    try {
      const { exceptionId } = req.data;
      if (!exceptionId) return req.error(400, 'Exception ID is required.');
      
      const { Exceptions, WorkflowHistory } = cds.entities;
      
      await cds.tx(req).run(async (tx) => {
        await tx.run(UPDATE(Exceptions, exceptionId).with({ status: 'OPEN' }));
        
        await tx.run(INSERT.into(WorkflowHistory).entries({
          ID: cds.utils.uuid(),
          exceptionID: exceptionId,
          stepName: 'Reopen',
          actor: req.user?.id || req.http?.req?.headers['x-user-role'] || 'AP_Specialist',
          action: 'REOPEN',
          comment: 'Exception reopened for re-investigation',
          timestamp: new Date().toISOString()
        }));
      });
      
      log.info(`Exception ${exceptionId} reopened successfully.`);
      return 'Reopened';
    } catch (err) {
      log.error('Failed to reopen exception:', err);
      return req.error(500, `Reopening failed: ${err.message}`);
    }
  });

  srv.on('raiseDispute', async (req) => {
    try {
      const { exceptionId, comment } = req.data;
      if (!exceptionId) return req.error(400, 'Exception ID is required.');
      
      const { Exceptions, WorkflowHistory } = cds.entities;
      
      await cds.tx(req).run(async (tx) => {
        await tx.run(UPDATE(Exceptions, exceptionId).with({ status: 'DISPUTED' }));
        
        await tx.run(INSERT.into(WorkflowHistory).entries({
          ID: cds.utils.uuid(),
          exceptionID: exceptionId,
          stepName: 'Dispute',
          actor: req.user?.id || req.http?.req?.headers['x-user-vendor'] || 'Vendor_AR',
          action: 'DISPUTE',
          comment: comment || 'Dispute raised by vendor',
          timestamp: new Date().toISOString()
        }));
      });
      
      log.info(`Dispute raised on exception ${exceptionId} successfully.`);
      return 'Disputed';
    } catch (err) {
      log.error('Failed to raise dispute:', err);
      return req.error(500, `Dispute failed: ${err.message}`);
    }
  });
};