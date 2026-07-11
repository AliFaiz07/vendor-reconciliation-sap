const cds = require('@sap/cds');

const log = cds.log('kpi-handler');

module.exports = (srv) => {
  /**
   * Function handler to fetch dashboard/cockpit KPIs for the reconciliation run.
   * Compiles totals, match rates, priority severity counts, and MSME warnings.
   */
  srv.on('getCockpitKpis', async (req) => {
    try {
      const { MatchResults, Exceptions } = cds.entities;
      
      log.info('Fetching MatchResults and Exceptions for KPI aggregation...');
      const results = await SELECT.from(MatchResults);
      const exceptions = await SELECT.from(Exceptions);

      const totalLines = results.length;
      const matchedCount = results.filter(r => r.outcomeCode.startsWith('MATCHED')).length;
      const unmatchedCount = results.filter(r => r.outcomeCode.startsWith('UNMATCHED')).length;
      const exceptionCount = totalLines - matchedCount - unmatchedCount;
      const totalDelta = results.reduce((sum, r) => sum + parseFloat(r.amountDelta || 0), 0);

      const openEx = exceptions.filter(e => e.status === 'OPEN').length;
      const resolvedEx = exceptions.filter(e => e.status === 'RESOLVED').length;

      const p1Count = exceptions.filter(e => e.status === 'OPEN' && e.priority === 'P1').length;
      const p2Count = exceptions.filter(e => e.status === 'OPEN' && e.priority === 'P2').length;
      const p3Count = exceptions.filter(e => e.status === 'OPEN' && e.priority === 'P3').length;
      const msmeAlertCount = exceptions.filter(e => e.status === 'OPEN' && (e.msmeAlert === true || e.msmeAlert === 1)).length;

      const byReason = {};
      results.filter(r => r.outcomeCode.startsWith('UNMATCHED') || r.outcomeCode.includes('-DIFF') || r.outcomeCode.includes('-GAP')).forEach(r => {
        byReason[r.outcomeCode] = (byReason[r.outcomeCode] || 0) + 1;
      });

      log.info(`KPI aggregation complete. Match rate is ${totalLines ? Math.round((matchedCount / totalLines) * 100) : 0}%.`);

      return JSON.stringify({
        totalLines, 
        matchedCount, 
        unmatchedCount, 
        exceptionCount, 
        totalDelta,
        matchRate: totalLines ? Math.round((matchedCount / totalLines) * 100) : 0,
        openEx, 
        resolvedEx,
        p1Count, 
        p2Count, 
        p3Count, 
        msmeAlertCount,
        differencesByReason: byReason
      });
    } catch (err) {
      log.error('Failed to compute cockpit KPIs:', err);
      return req.error(500, `KPI calculation failed: ${err.message}`);
    }
  });
};