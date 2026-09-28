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

        // Track SAP ledger item IDs matched in forward pass (used for reverse reconciliation)
        const matchedLedgerIds = new Set();

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

          // ── BEST-RESULT CONSOLIDATION ────────────────────────────────────
          // Select exactly ONE outcome per statement line.
          // Priority order: Scenario > MATCHED exact > MATCHED/3WAY > MATCHED/* > UNMATCHED/*
          // This prevents a single invoice from appearing both matched and unmatched.
          let bestOutcome;
          if (scenarioResult) {
            bestOutcome = scenarioResult;
          } else {
            const rankOutcome = (code) => {
              if (code === 'MATCHED')          return 0;
              if (code === 'MATCHED/3WAY')     return 1;
              if (code === 'MATCHED/TDS-194Q') return 2;
              if (code.startsWith('MATCHED'))  return 3;
              if (code.includes('AMOUNT-DIFF')) return 5;
              if (code.includes('GR-PENDING')) return 6;
              if (code.startsWith('UNMATCHED')) return 7;
              return 8;
            };
            const sorted = [...baseOutcomes].sort((a, b) => rankOutcome(a.code) - rankOutcome(b.code));
            bestOutcome = sorted[0] || { code: 'UNMATCHED', rule: 'NO_CANDIDATE' };
          }

          // Track matched ledger item IDs for reverse reconciliation
          if (bestOutcome.ledgerItemID) {
            matchedLedgerIds.add(bestOutcome.ledgerItemID);
          }

          const outcome = bestOutcome;
          const matchResultId = cds.utils.uuid();

          let assignedRole = outcome.businessRole;
          if (!assignedRole) {
            if (outcome.rule === 'RULE_PO_GR' || outcome.code.includes('GR-PENDING')) {
              assignedRole = 'GR';
            } else if (outcome.rule === 'RULE_AMOUNT' || outcome.code.includes('AMOUNT-DIFF') || outcome.code.includes('PRICE-HIGH')) {
              assignedRole = 'FINANCE';   // MIRO workbench handles price/amount variances
            } else if (outcome.rule === 'RULE_GST_TDS' || outcome.code.includes('GST-DIFF') || outcome.code.includes('GST-2B-GAP')) {
              assignedRole = 'BILLING';   // GST/Tax handled by billing/finance vendor team
            } else if (outcome.code.includes('QTY-MORE') || outcome.code.includes('QTY-LESS')) {
              assignedRole = 'GR';        // Quantity issues go to warehouse/GR
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

          // Insert matching result (one per statement line — best outcome only)
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
          const isException = outcome.code.startsWith('UNMATCHED') || outcome.code.includes('-DIFF') || outcome.code.includes('-PENDING') || outcome.code.includes('-GAP') || outcome.code.includes('-MISSING') || outcome.code === 'UNMATCHED';

          if (isException) {
            const vendor = await tx.run(SELECT.one.from(VendorMaster).where({ businessPartner: line.sourceVendorCode }));

            let priority = 'P3';
            const p1Codes = ['UNMATCHED/QTY-MORE', 'UNMATCHED/PRICE-HIGH', 'UNMATCHED/GST-2B-GAP', 'UNMATCHED/GR-PENDING', 'UNMATCHED/CN-MISSING', 'UNMATCHED/AMOUNT-DIFF'];
            if (p1Codes.includes(outcome.code)) {
              priority = 'P1';
            } else if (outcome.code.includes('QTY-LESS') || outcome.code.includes('TIMING') || outcome.code.includes('FX')) {
              priority = 'P2';
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
              comment: `Exception auto-created: ${outcome.code} — ${getReason(outcome.code)}`,
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

        // ── REVERSE RECONCILIATION ─────────────────────────────────────────
        // Check SAP ledger items for the vendor(s) in this upload that were
        // NOT matched to any vendor statement line → flag as MISSING_IN_STATEMENT.
        //
        // This ensures two-way reconciliation:
        //   Forward:  Vendor Statement → SAP Ledger (implemented above)
        //   Reverse:  SAP Ledger → Vendor Statement (implemented here)
        log.info('Running reverse reconciliation (SAP → Vendor Statement)...');

        const vendorCodes = [...new Set(lines.map(l => l.sourceVendorCode).filter(Boolean))];

        for (const vendorCode of vendorCodes) {
          const allLedgerItems = await tx.run(SELECT.from(VendorLedgerItems).where({ supplier: vendorCode }));

          for (const ledgerItem of allLedgerItems) {
            if (matchedLedgerIds.has(ledgerItem.ID)) continue; // Already matched forward

            // This SAP ledger item has no corresponding vendor statement line
            const reverseResultId = cds.utils.uuid();
            await tx.run(INSERT.into('vendorrecon.db.MatchResults').entries(withManaged({
              ID: reverseResultId,
              vendorDocLine_ID: null,          // No vendor statement line
              ledgerItem_ID: ledgerItem.ID,
              outcomeCode: 'MISSING_IN_STATEMENT',
              amountDelta: Math.abs(ledgerItem.amountInTransCrcy || 0),
              matchRuleApplied: 'REVERSE_CHECK',
              businessRole: 'AP',
              invoiceNo: ledgerItem.accountingDocument || 'UNKNOWN',
              reason: `SAP accounting document ${ledgerItem.accountingDocument || 'unknown'} (₹${ledgerItem.amountInTransCrcy}) is not reflected in vendor statement.`
            }, req, MatchResults)));

            // Create exception for MISSING_IN_STATEMENT
            const reverseExId = cds.utils.uuid();
            await tx.run(INSERT.into('vendorrecon.db.Exceptions').entries(withManaged({
              ID: reverseExId,
              matchResult_ID: reverseResultId,
              invoiceNo: ledgerItem.accountingDocument || 'UNKNOWN',
              outcomeCode: 'MISSING_IN_STATEMENT',
              status: 'OPEN',
              priority: 'P2',
              ageInDays: ledgerItem.documentDate ? Math.max(0, Math.floor((new Date() - new Date(ledgerItem.documentDate)) / 86400000)) : 0,
              msmeAlert: false,
              assignedTo: 'AP',
              recommendedAction: `SAP document ${ledgerItem.accountingDocument} posted on ${ledgerItem.postingDate} is missing from vendor statement. Contact vendor AR to include in next statement.`
            }, req, Exceptions)));

            await tx.run(INSERT.into('vendorrecon.db.AuditLog').entries(withManaged({
              ID: cds.utils.uuid(),
              entityName: 'MatchResults',
              entityKey: ledgerItem.ID,
              action: 'REVERSE_MATCH',
              performedBy: req?.user?.id || 'system-engine',
              afterValue: JSON.stringify({ code: 'MISSING_IN_STATEMENT', ledgerDoc: ledgerItem.accountingDocument }),
              performedAt: new Date().toISOString(),
            }, req, AuditLog)));
          }
        }

        log.info('Reverse reconciliation complete.');
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

  /**
   * Assigns an exception to a specific user/role.
   * Transitions status from OPEN to ASSIGNED.
   */
  srv.on('assignException', async (req) => {
    try {
      const { exceptionId, assignedTo } = req.data;
      if (!exceptionId) return req.error(400, 'Exception ID is required.');
      if (!assignedTo) return req.error(400, 'assignedTo is required.');
      const { Exceptions, WorkflowHistory } = cds.entities;
      await cds.tx(req).run(async (tx) => {
        await tx.run(UPDATE(Exceptions, exceptionId).with({ status: 'ASSIGNED', assignedTo }));
        await tx.run(INSERT.into(WorkflowHistory).entries({
          ID: cds.utils.uuid(),
          exceptionID: exceptionId,
          stepName: 'Assignment',
          actor: req.user?.id || req.http?.req?.headers['x-user-role'] || 'system',
          action: 'ASSIGN',
          comment: `Assigned to ${assignedTo}`,
          timestamp: new Date().toISOString()
        }));
      });
      log.info(`Exception ${exceptionId} assigned to ${assignedTo}.`);
      return 'Assigned';
    } catch (err) {
      log.error('Failed to assign exception:', err);
      return req.error(500, `Assignment failed: ${err.message}`);
    }
  });

  /**
   * [DEMO] Reset Demo Data.
   * Clears all reconciliation runtime data. Preserves master data.
   * NEVER modifies or deletes real SAP data.
   */
  srv.on('resetDemo', async (req) => {
    try {
      log.info('[DEMO] Resetting demo data...');
      const { MatchResults, Exceptions, VendorDocLines, StatementUploads, WorkflowHistory, AuditLog } = cds.entities;
      await cds.tx(req).run(async (tx) => {
        await tx.run(DELETE.from(AuditLog));
        await tx.run(DELETE.from(WorkflowHistory));
        await tx.run(DELETE.from(Exceptions));
        await tx.run(DELETE.from(MatchResults));
        await tx.run(DELETE.from(VendorDocLines));
        await tx.run(DELETE.from(StatementUploads));
      });
      log.info('[DEMO] Reset complete. Master data preserved.');
      return JSON.stringify({
        status: 'RESET_COMPLETE',
        message: '[DEMO MODE] All reconciliation data has been reset. Vendor master, PO/GR data, and user accounts are preserved.',
        timestamp: new Date().toISOString(),
        cleared: ['AuditLog', 'WorkflowHistory', 'Exceptions', 'MatchResults', 'VendorDocLines', 'StatementUploads'],
        preserved: ['VendorMaster', 'GrirSnapshot', 'PurchaseOrders', 'PurchaseRequisitions', 'Gstr2bInvoices', 'Users']
      });
    } catch (err) {
      log.error('[DEMO] Reset failed:', err);
      return req.error(500, `Reset failed: ${err.message}`);
    }
  });
};
