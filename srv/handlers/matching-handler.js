const cds = require('@sap/cds');
const { runMatchRulesForLine } = require('./matching-engine');
const { runScenarios } = require('../scenarios/registry');

module.exports = (srv) => {
  srv.on('runMatching', async (req) => {
    const { statementUploadId } = req.data;
    const { VendorDocLines, VendorLedgerItems, GrirSnapshot, PurchaseOrders, MatchResults, Exceptions, AuditLog } = cds.entities;

    await DELETE.from(MatchResults);
    await DELETE.from(Exceptions);

    let uploadId = statementUploadId;
    if (!uploadId) {
      const lastLine = await SELECT.one.from(VendorDocLines).orderBy('createdAt desc');
      if (!lastLine) return req.error(400, 'No statement lines found in the system. Please upload a statement first.');
      uploadId = lastLine.statementUploadId;
    }

    const lines = await SELECT.from(VendorDocLines).where({ statementUploadId: uploadId });

    for (const line of lines) {
      const candidates = await SELECT.from(VendorLedgerItems).where({ supplier: line.sourceVendorCode });
      const grirRow = line.poReference
        ? await SELECT.one.from(GrirSnapshot).where({ purchaseOrder: line.poReference })
        : null;
      const poRecord = line.poReference
        ? await SELECT.one.from(PurchaseOrders).where({ purchaseOrder: line.poReference })
        : null;

      const scenarioResult = await runScenarios(line, poRecord, grirRow);
      const baseOutcomes = await runMatchRulesForLine(line, candidates);
      const outcomes = scenarioResult ? [scenarioResult, ...baseOutcomes] : baseOutcomes;

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

        await INSERT.into(MatchResults).entries({
          ID: matchResultId,
          vendorDocLine_ID: line.ID,
          ledgerItem_ID: outcome.ledgerItemID || null,
          outcomeCode: outcome.code,
          amountDelta: outcome.delta || 0,
          matchRuleApplied: outcome.rule,
          businessRole: assignedRole,
        });

        if (outcome.code.startsWith('UNMATCHED') || outcome.code.includes('-DIFF') || outcome.code.includes('-PENDING')) {
          await INSERT.into(Exceptions).entries({
            ID: cds.utils.uuid(),
            matchResult_ID: matchResultId,
            outcomeCode: outcome.code,
            status: 'OPEN',
          });
        }

        await INSERT.into(AuditLog).entries({
          ID: cds.utils.uuid(),
          entityName: 'MatchResults',
          entityKey: line.ID,
          action: 'MATCH',
          performedBy: 'demo-user',
          afterValue: JSON.stringify(outcome),
          performedAt: new Date(),
        });
      }
    }
    return 'Matching completed';
  });

  srv.on('resolveException', async (req) => {
    const { exceptionId, note } = req.data;
    const { Exceptions } = cds.entities;
    await UPDATE(Exceptions, exceptionId).with({ status: 'RESOLVED', resolutionNote: note });
    return 'Resolved';
  });

  srv.on('reopenException', async (req) => {
    const { exceptionId } = req.data;
    const { Exceptions } = cds.entities;
    await UPDATE(Exceptions, exceptionId).with({ status: 'OPEN', resolutionNote: null });
    return 'Reopened';
  });
};