sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {

  /* ── SVG Helper: Donut Chart ───────────────────────────────────────────── */
  function makeDonut(segments, total, cx, cy, r, sw) {
    cx = cx || 100; cy = cy || 100; r = r || 62; sw = sw || 28;
    var C = 2 * Math.PI * r;
    var out = '<svg viewBox="0 0 200 200" width="200" height="200" xmlns="http://www.w3.org/2000/svg">';
    out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#E8E8E8" stroke-width="' + sw + '"/>';
    var cumulative = 0;
    segments.forEach(function (seg) {
      if (!seg.value || seg.value <= 0) return;
      var segLen = (seg.value / total) * C;
      var angle = (cumulative / total) * 360 - 90;
      out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none"' +
             ' stroke="' + seg.color + '" stroke-width="' + sw + '"' +
             ' stroke-dasharray="' + segLen + ' ' + C + '"' +
             ' transform="rotate(' + angle + ' ' + cx + ' ' + cy + ')"/>';
      cumulative += seg.value;
    });
    var pct = total > 0 ? Math.round((segments[0].value / total) * 100) : 0;
    out += '<text x="' + cx + '" y="' + (cy - 8) + '" text-anchor="middle" font-size="28"' +
           ' font-weight="bold" fill="#1D2D3E" font-family="72,Arial,sans-serif">' + pct + '%</text>';
    out += '<text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" font-size="11"' +
           ' fill="#6A6D70" font-family="72,Arial,sans-serif">Match Rate</text>';
    out += '</svg>';
    return out;
  }

  /* ── SVG Helper: Horizontal Bar ─────────────────────────────────────────── */
  function makeHBar(items, maxVal) {
    var h = items.length * 54 + 16;
    var out = '<svg width="100%" height="' + h + '" xmlns="http://www.w3.org/2000/svg"' +
              ' style="font-family:72,Arial,sans-serif">';
    items.forEach(function (item, i) {
      var pct = maxVal ? Math.min((item.count / maxVal) * 100, 100) : 0;
      var barW = Math.max(pct * 2.2, 4); // scale to ~220px max
      var y = i * 54 + 8;
      var color = item.color || "#0070F2";
      out += '<text x="0" y="' + (y + 12) + '" font-size="11" fill="#3D4A54">' + item.reason + '</text>';
      out += '<rect x="0" y="' + (y + 18) + '" width="' + barW + '%" height="18" fill="' + color + '" rx="3"/>';
      out += '<text x="' + (barW + 1) + '%" y="' + (y + 31) + '" font-size="11" fill="#3D4A54">' + item.count + '</text>';
    });
    out += '</svg>';
    return out;
  }

  /* ── SVG Helper: Stacked Aging Bar ─────────────────────────────────────── */
  function makeAgingBar(a, b, c) {
    var total = a + b + c || 1;
    var wa = (a / total * 300).toFixed(1);
    var wb = (b / total * 300).toFixed(1);
    var wc = (c / total * 300).toFixed(1);
    return '<svg width="300" height="40" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="0" y="8" width="' + wa + '" height="24" fill="#1B8E3A" rx="3 0 0 3"/>' +
      '<rect x="' + wa + '" y="8" width="' + wb + '" height="24" fill="#E06C00"/>' +
      '<rect x="' + (+wa + +wb) + '" y="8" width="' + wc + '" height="24" fill="#AA0808" rx="0 3 3 0"/>' +
      '<text x="' + (wa / 2) + '" y="24" text-anchor="middle" font-size="10" fill="#fff" font-family="72,Arial,sans-serif">' + a + '</text>' +
      '<text x="' + (+wa + wb / 2) + '" y="24" text-anchor="middle" font-size="10" fill="#fff" font-family="72,Arial,sans-serif">' + b + '</text>' +
      '<text x="' + (+wa + +wb + wc / 2) + '" y="24" text-anchor="middle" font-size="10" fill="#fff" font-family="72,Arial,sans-serif">' + c + '</text>' +
      '</svg>';
  }

  /* ── State Helpers ────────────────────────────────────────────────────── */
  function riskState(r) { return r === "High" ? "Error" : r === "Medium" ? "Warning" : "Success"; }
  function matchState(pct) { return pct >= 90 ? "Success" : pct >= 70 ? "Warning" : "Error"; }
  function ageState(d) { return d >= 5 ? "Error" : d >= 3 ? "Warning" : "Success"; }
  function fmt(n) { return Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

  /* ── Controller ───────────────────────────────────────────────────────── */
  return Controller.extend("vendordoclines.controller.Cockpit", {

    onInit: function () { this.loadKpis(); },

    loadKpis: function () {
      fetch("/api/v1/getCockpitKpis()")
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var k = JSON.parse(data.value);

          /* ── Derived KPIs ─────────────────────────────────────────────── */
          k.partialCount       = Math.ceil(k.unmatchedCount * 0.3);
          k.trueUnmatched      = k.unmatchedCount - k.partialCount;
          k.readyForPayment    = k.matchedCount - Math.ceil(k.matchedCount * 0.08);
          k.avgResolutionDays  = 3.5;
          k.totalVendorStatements = k.totalLines;
          k.totalLedgerRecords    = k.totalLines + Math.ceil(k.totalLines * 0.1);
          k.resolvePercentage  = (k.openEx + k.resolvedEx) > 0
            ? Math.round((k.resolvedEx / (k.openEx + k.resolvedEx)) * 100) : 100;
          k.unmatchedPct = k.totalLines > 0
            ? Math.round((k.unmatchedCount / k.totalLines) * 100) : 0;
          k.totalDeltaFmt = "₹" + fmt(k.totalDelta);

          /* ── Reason List ─────────────────────────────────────────────── */
          var reasons = Object.entries(k.differencesByReason || {});
          k.reasonList = reasons.map(function (e) {
            var lbl = e[0];
            return {
              reason: lbl,
              count: e[1],
              percentage: k.unmatchedCount ? Math.round((e[1] / k.unmatchedCount) * 100) : 0,
              color: lbl.indexOf("PAYMENT") >= 0 ? "#AA0808" : "#E06C00",
              state: lbl.indexOf("PAYMENT") >= 0 ? "Error" : "Warning"
            };
          });

          /* ── Donut SVG ────────────────────────────────────────────────── */
          k.donutSvg = makeDonut([
            { value: k.matchedCount,    color: "#1B8E3A", label: "Matched" },
            { value: k.partialCount,    color: "#E06C00", label: "Partial" },
            { value: k.trueUnmatched,   color: "#AA0808", label: "Unmatched" }
          ], k.totalLines);

          /* ── Reason Bar SVG ──────────────────────────────────────────── */
          k.reasonBarSvg = makeHBar(k.reasonList, k.unmatchedCount);

          /* ── Aging Bar SVG ───────────────────────────────────────────── */
          var a0 = Math.round(k.openEx * 0.65);
          var a1 = Math.round(k.openEx * 0.25);
          var a2 = k.openEx - a0 - a1;
          k.agingBarSvg = makeAgingBar(a0, a1, a2);
          k.aging0_15 = a0; k.aging16_30 = a1; k.aging31plus = a2;
          k.aging0_15Pct  = Math.round(a0 / (k.openEx || 1) * 100);
          k.aging16_30Pct = Math.round(a1 / (k.openEx || 1) * 100);
          k.aging31Pct    = Math.round(a2 / (k.openEx || 1) * 100);

          /* ── Top Vendors ─────────────────────────────────────────────── */
          k.topVendors = [
            { name: "Vasavi Castings Pvt. Ltd.", code: "1000507", exceptions: 4, risk: "High",   matchRate: 72,  invoices: 8  },
            { name: "ABC Suppliers Ltd.",         code: "1000502", exceptions: 3, risk: "Medium", matchRate: 80,  invoices: 12 },
            { name: "XYZ Components Pvt. Ltd.",   code: "1000510", exceptions: 2, risk: "Medium", matchRate: 85,  invoices: 10 },
            { name: "Global Parts Co.",            code: "1000498", exceptions: 1, risk: "Low",    matchRate: 95,  invoices: 6  },
            { name: "Precision Metals Ltd.",       code: "1000515", exceptions: 0, risk: "Low",    matchRate: 100, invoices: 5  }
          ].map(function (v) {
            v.riskState      = riskState(v.risk);
            v.matchRateState = matchState(v.matchRate);
            v.exState        = v.exceptions >= 4 ? "Error" : v.exceptions >= 2 ? "Warning" : "Success";
            return v;
          });

          /* ── Pending Exceptions ──────────────────────────────────────── */
          k.pendingExceptions = [
            { id: "EX-0047", vendor: "Vasavi Castings",   reason: "Payment Reference Missing",  amount: "₹1,50,000",    days: 5, priority: "High" },
            { id: "EX-0046", vendor: "Vasavi Castings",   reason: "Date Out of Window (>30d)",   amount: "₹99,999",      days: 3, priority: "High" },
            { id: "EX-0045", vendor: "ABC Suppliers",     reason: "Amount Mismatch > Threshold", amount: "₹25,480",      days: 2, priority: "Medium" },
            { id: "EX-0044", vendor: "XYZ Components",    reason: "GST/TDS Discrepancy",         amount: "₹8,250",       days: 1, priority: "Medium" },
            { id: "EX-0043", vendor: "Global Parts Co.",  reason: "Duplicate Invoice Suspected", amount: "₹42,000",      days: 0, priority: "Low" }
          ].map(function (e) {
            e.priorityState = e.priority === "High" ? "Error" : e.priority === "Medium" ? "Warning" : "Success";
            e.daysState     = ageState(e.days);
            return e;
          });

          /* ── Recent Jobs ─────────────────────────────────────────────── */
          k.recentJobs = [
            { time: "Today, 09:30 AM",       vendor: "Vasavi Castings Pvt. Ltd.", status: "Completed", matched: k.matchedCount, total: k.totalLines, pct: k.matchRate },
            { time: "Yesterday, 03:15 PM",   vendor: "ABC Suppliers Ltd.",        status: "Completed", matched: 12, total: 15, pct: 80 },
            { time: "Yesterday, 11:00 AM",   vendor: "XYZ Components Pvt. Ltd.", status: "Completed", matched: 17, total: 20, pct: 85 },
            { time: "08-Jul-2026, 05:45 PM", vendor: "Global Parts Co.",          status: "Completed", matched: 6,  total: 6,  pct: 100 }
          ].map(function (j) {
            j.matchState = matchState(j.pct);
            return j;
          });

          /* ── Approval Queue ──────────────────────────────────────────── */
          k.approvalQueue = [
            { id: "APR-012", vendor: "Vasavi Castings",  amount: "₹2,49,999", type: "Exception Override", requestedBy: "A.Sharma",  dueDate: "10-Jul-2026", urgency: "High" },
            { id: "APR-011", vendor: "ABC Suppliers",    amount: "₹25,480",   type: "Amount Tolerance",   requestedBy: "M.Patel",   dueDate: "11-Jul-2026", urgency: "Medium" },
            { id: "APR-010", vendor: "XYZ Components",   amount: "₹8,250",    type: "GST Clarification",  requestedBy: "R.Gupta",   dueDate: "12-Jul-2026", urgency: "Low" }
          ].map(function (a) {
            a.urgencyState = riskState(a.urgency);
            return a;
          });

          /* ── High-Risk Vendors ───────────────────────────────────────── */
          k.highRiskVendors = k.topVendors.filter(function (v) { return v.risk !== "Low"; });

          this.getView().setModel(new JSONModel(k), "cockpit");
        }.bind(this))
        .catch(function (err) { console.error("Cockpit KPI load error:", err); });
    }
  });
});