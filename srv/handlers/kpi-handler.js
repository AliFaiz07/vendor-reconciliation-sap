const cds = require('@sap/cds');

const log = cds.log('kpi-handler');

module.exports = (srv) => {
  /**
   * Function handler to fetch dashboard/cockpit KPIs for the reconciliation run.
   * Compiles totals, match rates, priority severity counts, aging, and MSME warnings.
   * ALL DATA IS DYNAMICALLY COMPUTED FROM THE DATABASE — NO HARDCODED METRICS.
   */
  srv.on('getCockpitKpis', async (req) => {
    try {
      const { MatchResults, Exceptions, VendorDocLines, VendorMaster, StatementUploads, WorkflowHistory } = cds.entities;

      log.info('Fetching MatchResults, Exceptions, and Workflow for KPI aggregation...');
      const results = await SELECT.from(MatchResults);
      const exceptions = await SELECT.from(Exceptions);
      const docLines = await SELECT.from(VendorDocLines);
      const vendors = await SELECT.from(VendorMaster);
      const uploads = await SELECT.from(StatementUploads).orderBy('createdAt desc').limit(5);
      const history = await SELECT.from(WorkflowHistory);

      const totalLines = results.length;

      // Exact vs Partial matches
      const exactMatchedCount = results.filter(r => r.outcomeCode === 'MATCHED' || r.outcomeCode === 'MATCHED/3WAY').length;
      const partialMatchedCount = results.filter(r => r.outcomeCode.startsWith('MATCHED') && r.outcomeCode !== 'MATCHED' && r.outcomeCode !== 'MATCHED/3WAY').length;
      const matchedCount = exactMatchedCount + partialMatchedCount;
      const unmatchedCount = results.filter(r => r.outcomeCode.startsWith('UNMATCHED') || r.outcomeCode === 'MISSING_IN_STATEMENT' || r.outcomeCode.includes('-DIFF') || r.outcomeCode.includes('-GAP')).length;
      const exceptionCount = exceptions.length;
      const totalDelta = results.reduce((sum, r) => sum + parseFloat(r.amountDelta || 0), 0);

      const openEx = exceptions.filter(e => e.status === 'OPEN' || e.status === 'ASSIGNED' || e.status === 'IN_REVIEW').length;
      const resolvedEx = exceptions.filter(e => e.status === 'RESOLVED').length;
      const disputedEx = exceptions.filter(e => e.status === 'DISPUTED').length;

      const p1Count = exceptions.filter(e => e.status === 'OPEN' && e.priority === 'P1').length;
      const p2Count = exceptions.filter(e => e.status === 'OPEN' && e.priority === 'P2').length;
      const p3Count = exceptions.filter(e => e.status === 'OPEN' && e.priority === 'P3').length;
      const msmeAlertCount = exceptions.filter(e => e.status === 'OPEN' && (e.msmeAlert === true || e.msmeAlert === 1)).length;

      // Real Aging buckets based on actual ageInDays
      const openExceptions = exceptions.filter(e => e.status === 'OPEN');
      const aging0_15 = openExceptions.filter(e => (e.ageInDays || 0) <= 15).length;
      const aging16_30 = openExceptions.filter(e => (e.ageInDays || 0) > 15 && (e.ageInDays || 0) <= 30).length;
      const aging31plus = openExceptions.filter(e => (e.ageInDays || 0) > 30).length;

      // Real Average resolution days from WorkflowHistory
      let avgResolutionDays = 0;
      const resolvedExceptionsWithHist = [];
      const createEvents = new Map();
      history.forEach(h => {
        if (h.action === 'CREATE') {
          createEvents.set(h.exceptionID, new Date(h.timestamp));
        }
      });
      history.forEach(h => {
        if (h.action === 'RESOLVE' && createEvents.has(h.exceptionID)) {
          const createTime = createEvents.get(h.exceptionID);
          const resolveTime = new Date(h.timestamp);
          const diffDays = Math.max(0.1, (resolveTime - createTime) / 86400000);
          resolvedExceptionsWithHist.push(diffDays);
        }
      });
      if (resolvedExceptionsWithHist.length > 0) {
        const sum = resolvedExceptionsWithHist.reduce((a, b) => a + b, 0);
        avgResolutionDays = Number((sum / resolvedExceptionsWithHist.length).toFixed(1));
      } else {
        avgResolutionDays = 0;
      }

      const byReason = {};
      results.filter(r => r.outcomeCode.startsWith('UNMATCHED') || r.outcomeCode.includes('-DIFF') || r.outcomeCode.includes('-GAP') || r.outcomeCode === 'MISSING_IN_STATEMENT').forEach(r => {
        byReason[r.outcomeCode] = (byReason[r.outcomeCode] || 0) + 1;
      });

      const lineMap = new Map(docLines.map(l => [l.ID, l]));
      const resultMap = new Map(results.map(r => [r.ID, r]));
      const vendorMap = new Map(vendors.map(v => [v.businessPartner, v]));

      // 1. Dynamic Pending Exceptions (real data from DB)
      const openExceptionsList = exceptions.filter(e => e.status === 'OPEN').slice(0, 10);
      const pendingExceptions = openExceptionsList.map(e => {
        const res = resultMap.get(e.matchResult_ID);
        const line = res ? lineMap.get(res.vendorDocLine_ID) : null;
        const vendorObj = line ? vendorMap.get(line.sourceVendorCode) : null;
        return {
          id: e.ID.slice(0, 8).toUpperCase(),
          vendor: vendorObj ? vendorObj.businessPartnerName : (line?.sourceVendorCode || 'Unknown'),
          vendorCode: line?.sourceVendorCode || null,
          reason: e.outcomeCode,
          amount: "₹" + Number(line?.invoiceAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          rawAmount: Number(line?.invoiceAmount || 0),
          days: e.ageInDays || 0,
          priority: e.priority === 'P1' ? 'High' : (e.priority === 'P2' ? 'Medium' : 'Low'),
          recommendedAction: e.recommendedAction || 'Verify invoice details.'
        };
      });

      // 2. Dynamic Top Vendors (computed from master + statement lines)
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
      }).filter(v => v.invoices > 0 || v.exceptions > 0);

      // 3. Dynamic Recent Jobs
      const recentJobs = uploads.map(u => {
        const vendorObj = vendorMap.get(u.vendorCode);
        const uLines = docLines.filter(dl => dl.statementUploadId === u.ID);
        const uLineIds = uLines.map(dl => dl.ID);
        const uResults = results.filter(r => uLineIds.includes(r.vendorDocLine_ID));

        const matched = uResults.filter(r => r.outcomeCode.startsWith('MATCHED')).length;

        return {
          id: u.ID.slice(0, 8),
          time: u.createdAt ? new Date(u.createdAt).toLocaleString('en-IN', { hour12: true }) : 'N/A',
          vendor: vendorObj ? vendorObj.businessPartnerName : (u.vendorCode || 'All Vendors'),
          status: u.isActive ? 'Active' : 'Superseded',
          matched,
          total: uLines.length,
          pct: uLines.length ? Math.round((matched / uLines.length) * 100) : 100
        };
      });

      // 4. Dynamic Approval Queue (Dynamic Due Date based on real invoice/payment terms)
      const approvalQueue = exceptions.filter(e => e.status === 'OPEN' && e.priority === 'P1').slice(0, 5).map(e => {
        const res = resultMap.get(e.matchResult_ID);
        const line = res ? lineMap.get(res.vendorDocLine_ID) : null;
        const vendorObj = line ? vendorMap.get(line.sourceVendorCode) : null;

        // Compute realistic dynamic due date from invoiceDate + 30 days
        let dueDateStr = 'Due in 7 days';
        if (line && line.invoiceDate) {
          const invDate = new Date(line.invoiceDate);
          const dueDate = new Date(invDate.getTime() + 30 * 86400000);
          dueDateStr = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        } else {
          const d = new Date(Date.now() + 7 * 86400000);
          dueDateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        }

        return {
          id: e.ID.slice(0, 8).toUpperCase(),
          vendor: vendorObj ? vendorObj.businessPartnerName : (line?.sourceVendorCode || 'Unknown'),
          amount: "₹" + Number(line?.invoiceAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          type: e.outcomeCode,
          requestedBy: e.assignedTo || 'Reconciliation Engine',
          dueDate: dueDateStr,
          urgency: 'High'
        };
      });

      log.info(`KPI aggregation complete: totalLines=${totalLines}, matched=${matchedCount}, unmatched=${unmatchedCount}, openEx=${openEx}`);

      return JSON.stringify({
        totalLines,
        matchedCount,
        exactMatchedCount,
        partialMatchedCount,
        unmatchedCount,
        exceptionCount,
        totalDelta,
        matchRate: totalLines ? Math.round((matchedCount / totalLines) * 100) : 0,
        openEx,
        resolvedEx,
        disputedEx,
        p1Count,
        p2Count,
        p3Count,
        msmeAlertCount,
        aging0_15,
        aging16_30,
        aging31plus,
        avgResolutionDays,
        totalVendorStatements: uploads.length,
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