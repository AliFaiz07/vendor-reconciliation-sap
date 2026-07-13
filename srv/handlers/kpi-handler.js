const cds = require('@sap/cds');

const log = cds.log('kpi-handler');

module.exports = (srv) => {
  /**
   * Function handler to fetch dashboard/cockpit KPIs for the reconciliation run.
   * Compiles totals, match rates, priority severity counts, and MSME warnings.
   */
  srv.on('getCockpitKpis', async (req) => {
    try {
      const { MatchResults, Exceptions, VendorDocLines, VendorMaster, StatementUploads } = cds.entities;
      
      log.info('Fetching MatchResults and Exceptions for KPI aggregation...');
      const results = await SELECT.from(MatchResults);
      const exceptions = await SELECT.from(Exceptions);
      const docLines = await SELECT.from(VendorDocLines);
      const vendors = await SELECT.from(VendorMaster);
      const uploads = await SELECT.from(StatementUploads).orderBy('createdAt desc').limit(5);

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

      const lineMap = new Map(docLines.map(l => [l.ID, l]));
      const resultMap = new Map(results.map(r => [r.ID, r]));
      const vendorMap = new Map(vendors.map(v => [v.businessPartner, v]));

      // 1. Dynamic Pending Exceptions
      const openExceptionsList = exceptions.filter(e => e.status === 'OPEN').slice(0, 5);
      const pendingExceptions = openExceptionsList.map(e => {
        const res = resultMap.get(e.matchResult_ID);
        const line = res ? lineMap.get(res.vendorDocLine_ID) : null;
        const vendorObj = line ? vendorMap.get(line.sourceVendorCode) : null;
        return {
          id: e.ID.slice(0, 8).toUpperCase(),
          vendor: vendorObj ? vendorObj.businessPartnerName : (line?.sourceVendorCode || 'Unknown'),
          reason: e.outcomeCode,
          amount: "₹" + Number(line?.invoiceAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          days: e.ageInDays || 0,
          priority: e.priority === 'P1' ? 'High' : (e.priority === 'P2' ? 'Medium' : 'Low'),
          recommendedAction: e.recommendedAction || 'Verify invoice details.'
        };
      });

      // 2. Dynamic Top Vendors
      const topVendors = vendors.map(v => {
        const vLines = docLines.filter(dl => dl.sourceVendorCode === v.businessPartner);
        const vLineIds = vLines.map(dl => dl.ID);
        const vResults = results.filter(r => vLineIds.includes(r.vendorDocLine_ID));
        
        const matched = vResults.filter(r => r.outcomeCode.startsWith('MATCHED')).length;
        const total = vLines.length;
        
        const vResultIds = vResults.map(r => r.ID);
        const openExs = exceptions.filter(e => vResultIds.includes(e.matchResult_ID) && e.status === 'OPEN').length;
        
        const matchRate = total ? Math.round((matched / total) * 100) : 100;
        const risk = openExs >= 3 ? 'High' : (openExs >= 1 ? 'Medium' : 'Low');
        
        return {
          name: v.businessPartnerName,
          code: v.businessPartner,
          exceptions: openExs,
          risk,
          matchRate,
          invoices: total
        };
      });

      // 3. Dynamic Recent Jobs
      const recentJobs = uploads.map(u => {
        const vendorObj = vendorMap.get(u.vendorCode);
        const uLines = docLines.filter(dl => dl.statementUploadId === u.ID);
        const uLineIds = uLines.map(dl => dl.ID);
        const uResults = results.filter(r => uLineIds.includes(r.vendorDocLine_ID));
        
        const matched = uResults.filter(r => r.outcomeCode.startsWith('MATCHED')).length;
        
        return {
          time: u.createdAt ? new Date(u.createdAt).toLocaleString('en-IN', { hour12: true }) : 'Today, 09:30 AM',
          vendor: vendorObj ? vendorObj.businessPartnerName : u.vendorCode,
          status: u.isActive ? 'Active' : 'Superseded',
          matched,
          total: uLines.length,
          pct: uLines.length ? Math.round((matched / uLines.length) * 100) : 100
        };
      });

      // 4. Dynamic Approval Queue
      const approvalQueue = exceptions.filter(e => e.status === 'OPEN' && e.priority === 'P1').slice(0, 3).map(e => {
        const res = resultMap.get(e.matchResult_ID);
        const line = res ? lineMap.get(res.vendorDocLine_ID) : null;
        const vendorObj = line ? vendorMap.get(line.sourceVendorCode) : null;
        return {
          id: e.ID.slice(0, 8).toUpperCase(),
          vendor: vendorObj ? vendorObj.businessPartnerName : (line?.sourceVendorCode || 'Unknown'),
          amount: "₹" + Number(line?.invoiceAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          type: e.outcomeCode,
          requestedBy: 'System',
          dueDate: '15-Jul-2026',
          urgency: 'High'
        };
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
        differencesByReason: byReason,
        pendingExceptions,
        topVendors,
        recentJobs,
        approvalQueue
      });
    } catch (err) {
      log.error('Failed to compute cockpit KPIs:', err);
      return req.error(500, `KPI calculation failed: ${err.message}`);
    }
  });
};