sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
  "use strict";

  /* ── SVG Helper: Donut Chart ───────────────────────────────────────────── */
  function makeDonut(segments, total, cx, cy, r, sw) {
    cx = cx || 100; cy = cy || 100; r = r || 62; sw = sw || 28;
    var C = 2 * Math.PI * r;
    var out = '<svg viewBox="0 0 200 200" width="200" height="200" xmlns="http://www.w3.org/2000/svg">';
    out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#E8E8E8" stroke-width="' + sw + '"/>';
    var cumulative = 0;
    segments.forEach(function (seg) {
      if (!seg.value || seg.value <= 0) return;
      var segLen = (seg.value / (total || 1)) * C;
      var angle = ((cumulative / (total || 1)) * 360) - 90;
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
    if (!items || items.length === 0) {
      return '<svg width="100%" height="40" xmlns="http://www.w3.org/2000/svg"><text x="0" y="24" font-size="12" fill="#888">No exceptions found</text></svg>';
    }
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
    var total = a + b + c;
    if (total === 0) {
      return '<svg width="300" height="40" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="8" width="300" height="24" fill="#E8E8E8" rx="3"/><text x="150" y="24" text-anchor="middle" font-size="10" fill="#6A6D70">0 Open Exceptions</text></svg>';
    }
    var wa = ((a / total) * 300).toFixed(1);
    var wb = ((b / total) * 300).toFixed(1);
    var wc = ((c / total) * 300).toFixed(1);
    return '<svg width="300" height="40" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="0" y="8" width="' + wa + '" height="24" fill="#1B8E3A" rx="3"/>' +
      '<rect x="' + wa + '" y="8" width="' + wb + '" height="24" fill="#E06C00"/>' +
      '<rect x="' + (+wa + +wb) + '" y="8" width="' + wc + '" height="24" fill="#AA0808" rx="3"/>' +
      '<text x="' + (wa / 2) + '" y="24" text-anchor="middle" font-size="10" fill="#fff" font-family="72,Arial,sans-serif">' + (a > 0 ? a : '') + '</text>' +
      '<text x="' + (+wa + wb / 2) + '" y="24" text-anchor="middle" font-size="10" fill="#fff" font-family="72,Arial,sans-serif">' + (b > 0 ? b : '') + '</text>' +
      '<text x="' + (+wa + +wb + wc / 2) + '" y="24" text-anchor="middle" font-size="10" fill="#fff" font-family="72,Arial,sans-serif">' + (c > 0 ? c : '') + '</text>' +
      '</svg>';
  }

  /* ── State Helpers ────────────────────────────────────────────────────── */
  function riskState(r) { return r === "High" ? "Error" : r === "Medium" ? "Warning" : "Success"; }
  function matchState(pct) { return pct >= 90 ? "Success" : pct >= 70 ? "Warning" : "Error"; }
  function ageState(d) { return d >= 30 ? "Error" : d >= 15 ? "Warning" : "Success"; }
  function fmt(n) { return Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

  /* ── Controller ───────────────────────────────────────────────────────── */
  return Controller.extend("vendordoclines.controller.Cockpit", {

    onInit: function () {
      try {
        var router = this.getOwnerComponent().getRouter();
        router.getRoute("main").attachPatternMatched(this.loadKpis, this);
      } catch (err) {
        console.warn("Router not available during Cockpit onInit");
      }
      this.loadKpis();
    },

    loadKpis: function () {
      var that = this;
      fetch("/api/v1/getCockpitKpis()")
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var k = JSON.parse(data.value);

          /* ── Actual Backend-Derived KPIs (No Fake Overrides) ─────────── */
          k.exactMatchedCount  = k.exactMatchedCount || (k.matchedCount || 0);
          k.partialCount       = k.partialMatchedCount || 0;
          k.trueUnmatched      = k.unmatchedCount || 0;
          k.readyForPayment    = k.matchedCount || 0;
          k.avgResolutionDays  = k.avgResolutionDays !== undefined ? k.avgResolutionDays : 0;
          k.totalVendorStatements = k.totalVendorStatements || 0;
          k.totalLedgerRecords    = k.totalLines || 0;
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
              color: lbl.indexOf("PAYMENT") >= 0 ? "#AA0808" : (lbl.indexOf("GST") >= 0 ? "#E06C00" : "#0070F2"),
              state: lbl.indexOf("PAYMENT") >= 0 ? "Error" : "Warning"
            };
          });

          /* ── Donut SVG ────────────────────────────────────────────────── */
          k.donutSvg = makeDonut([
            { value: k.exactMatchedCount, color: "#1B8E3A", label: "Exact Matched" },
            { value: k.partialCount,      color: "#E06C00", label: "Partial Match" },
            { value: k.trueUnmatched,     color: "#AA0808", label: "Unmatched" }
          ], k.totalLines);

          /* ── Reason Bar SVG ──────────────────────────────────────────── */
          k.reasonBarSvg = makeHBar(k.reasonList, k.unmatchedCount);

          /* ── Aging Bar SVG (Real Data from Backend) ───────────────────── */
          var a0 = k.aging0_15 !== undefined ? k.aging0_15 : 0;
          var a1 = k.aging16_30 !== undefined ? k.aging16_30 : 0;
          var a2 = k.aging31plus !== undefined ? k.aging31plus : 0;
          k.agingBarSvg = makeAgingBar(a0, a1, a2);
          k.aging0_15 = a0; k.aging16_30 = a1; k.aging31plus = a2;
          k.aging0_15Pct  = k.openEx ? Math.round(a0 / k.openEx * 100) : 0;
          k.aging16_30Pct = k.openEx ? Math.round(a1 / k.openEx * 100) : 0;
          k.aging31Pct    = k.openEx ? Math.round(a2 / k.openEx * 100) : 0;

          /* ── Top Vendors (Real Data from Backend) ─────────────────────── */
          var rawVendors = k.topVendors || [];
          k.topVendors = rawVendors.map(function (v) {
            v.riskState      = riskState(v.risk);
            v.matchRateState = matchState(v.matchRate);
            v.exState        = v.exceptions >= 4 ? "Error" : v.exceptions >= 2 ? "Warning" : "Success";
            return v;
          });

          /* ── Pending Exceptions (Real Data from Backend) ─────────────── */
          var rawEx = k.pendingExceptions || [];
          k.pendingExceptions = rawEx.map(function (e) {
            e.priorityState = e.priority === "High" ? "Error" : e.priority === "Medium" ? "Warning" : "Success";
            e.daysState     = ageState(e.days);
            return e;
          });

          /* ── Recent Jobs (Real Data from Backend) ────────────────────── */
          var rawJobs = k.recentJobs || [];
          k.recentJobs = rawJobs.map(function (j) {
            j.matchState = matchState(j.pct);
            return j;
          });

          /* ── Approval Queue (Real Data from Backend) ─────────────────── */
          var rawApprovals = k.approvalQueue || [];
          k.approvalQueue = rawApprovals.map(function (a) {
            a.urgencyState = riskState(a.urgency);
            return a;
          });

          /* ── Apply Model ─────────────────────────────────────────────── */
          var oModel = that.getView().getModel("cockpit");
          if (!oModel) {
            oModel = new JSONModel(k);
            that.getView().setModel(oModel, "cockpit");
          } else {
            oModel.setData(k);
          }
        })
        .catch(function (err) {
          console.error("Cockpit KPI fetch error:", err);
        });
    },

    onRefresh: function () {
      this.loadKpis();
    },

    onNavToReconcile: function () {
      this.getOwnerComponent().getRouter().navTo("workbench");
    },

    onNavToExceptions: function () {
      this.getOwnerComponent().getRouter().navTo("workbench");
    },

    onNavToVendor: function (oEvent) {
      var bindingContext = oEvent.getSource().getBindingContext("cockpit");
      if (bindingContext) {
        var vendorCode = bindingContext.getProperty("code");
        this.getOwnerComponent().getRouter().navTo("workbench", { vendor: vendorCode });
      }
    }
  });
});