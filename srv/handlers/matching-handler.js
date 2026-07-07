const cds = require('@sap/cds');
const { runMatchRulesForLine } = require('./matching-engine');

module.exports = (srv) => {
  srv.on('runMatching', async (req) => {
    const { statementUploadId } = req.data;
    const { VendorDocLines, VendorLedgerItems, GrirSnapshot, MatchResults, Exceptions, AuditLog } = cds.entities;

    await DELETE.from(MatchResults);
    await DELETE.from(Exceptions);

    const lines = await SELECT.from(VendorDocLines).where({ statementUploadId });

    for (const line of lines) {
      const candidates = await SELECT.from(VendorLedgerItems).where({ supplier: line.sourceVendorCode });
      const grirRow = line.poReference
        ? await SELECT.one.from(GrirSnapshot).where({ purchaseOrder: line.poReference })
        : null;
      const outcomes = await runMatchRulesForLine(line, candidates, grirRow);

      for (const outcome of outcomes) {
        const matchResultId = cds.utils.uuid();
        await INSERT.into(MatchResults).entries({
          ID: matchResultId,
          vendorDocLine_ID: line.ID,
          outcomeCode: outcome.code,
          amountDelta: outcome.delta || 0,
          matchRuleApplied: outcome.rule,
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