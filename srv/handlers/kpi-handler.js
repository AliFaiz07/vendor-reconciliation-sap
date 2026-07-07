const cds = require('@sap/cds');

module.exports = (srv) => {
  srv.on('getCockpitKpis', async () => {
    const { MatchResults, Exceptions } = cds.entities;
    const results = await SELECT.from(MatchResults);
    const exceptions = await SELECT.from(Exceptions);

    const totalLines = results.length;
    const matchedCount = results.filter(r => r.outcomeCode.startsWith('MATCHED')).length;
    const unmatchedCount = results.filter(r => r.outcomeCode.startsWith('UNMATCHED')).length;
    const exceptionCount = totalLines - matchedCount - unmatchedCount;
    const totalDelta = results.reduce((sum, r) => sum + parseFloat(r.amountDelta || 0), 0);

    const openEx = exceptions.filter(e => e.status === 'OPEN').length;
    const resolvedEx = exceptions.filter(e => e.status === 'RESOLVED').length;

    const byReason = {};
    results.filter(r => r.outcomeCode.startsWith('UNMATCHED')).forEach(r => {
      byReason[r.outcomeCode] = (byReason[r.outcomeCode] || 0) + 1;
    });

    return JSON.stringify({
      totalLines, matchedCount, unmatchedCount, exceptionCount, totalDelta,
      matchRate: totalLines ? Math.round((matchedCount / totalLines) * 100) : 0,
      openEx, resolvedEx,
      differencesByReason: byReason
    });
  });
};