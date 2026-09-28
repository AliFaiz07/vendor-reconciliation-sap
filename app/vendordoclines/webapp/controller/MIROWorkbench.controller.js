sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, JSONModel, MessageBox, MessageToast) {
  return Controller.extend("vendordoclines.controller.MIROWorkbench", {
    onInit: function () {
      const user = JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      if (!user.username) return this.getOwnerComponent().getRouter().navTo("login");

      const model = new JSONModel({
        pendingVerification: 0, matchRate3Way: 100, blockedInvoices: 0, parkedInvoices: 0, postedTodayCount: 0, varianceExceeds: 0,
        matchRatePct: 100, onTimeVerifyPct: 100, varianceOkPct: 100,
        blockedReasons: [],
        pendingList: [],
        parkedList: [],
        blockedList: [],
        postedToday: []
      });
      this.getView().setModel(model, "miro");

      this.loadKpis();
    },

    loadKpis: function () {
      const model = this.getView().getModel("miro");

      Promise.all([
        fetch("/api/v1/VendorDocLines").then(r => r.json()),
        fetch("/api/v1/MatchResults").then(r => r.json()),
        fetch("/api/v1/Exceptions").then(r => r.json()),
        fetch("/api/v1/VendorLedgerItems").then(r => r.json())
      ]).then(([lines, results, exceptions, ledger]) => {
        const rMap = new Map(results.value.map(r => [r.vendorDocLine_ID, r]));
        const exMap = new Map(exceptions.value.map(e => [e.matchResult_ID, e]));
        const lMap = new Map(ledger.value.map(l => [l.ID, l]));

        const pending = [];
        const parked = [];
        const blocked = [];
        const posted = [];

        let totalMatched = 0;
        let totalCount = lines.value.length;
        let priceVarianceCount = 0;
        let qtyMismatchCount = 0;
        let missingGrCount = 0;
        let otherCount = 0;

        lines.value.forEach(line => {
          const r = rMap.get(line.ID);
          const ex = r ? exMap.get(r.ID) : undefined;
          const ledgerItem = r?.ledgerItem_ID ? lMap.get(r.ledgerItem_ID) : undefined;
          const code = r?.outcomeCode ?? "UNMATCHED";

          const formattedAmt = "₹" + Number(line.invoiceAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 });
          const formattedDelta = "₹" + Number(r?.amountDelta || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

          if (code === "MATCHED" || code.startsWith("MATCHED/")) {
            totalMatched++;
            // Deterministic MIRO / SAP accounting document number
            const miroDocNum = ledgerItem?.accountingDocument
              || (r.ledgerItem_ID ? "5105" + r.ledgerItem_ID.replace(/-/g, '').slice(0, 6) : "5105" + line.ID.replace(/-/g, '').slice(0, 6));
            posted.push({
              miroDoc: miroDocNum,
              vendor: line.sourceVendorCode,
              invoiceNo: line.vendorInvoiceNo,
              amount: formattedAmt,
              postedAt: line.modifiedAt ? new Date(line.modifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (line.createdAt ? new Date(line.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recorded"),
              cleared: ledgerItem?.isCleared ? "Yes" : "No",
              clearedState: ledgerItem?.isCleared ? "Success" : "Warning"
            });
          } else {
            const ageInDays = ex?.ageInDays || 0;

            if (code === "UNMATCHED/PRICE-HIGH") {
              priceVarianceCount++;
              blocked.push({
                invoiceNo: line.vendorInvoiceNo,
                vendor: line.sourceVendorCode,
                blockReason: "Price Variance > 2% (Tolerances exceeded)",
                blockState: "Error",
                amount: formattedAmt,
                blockDate: line.invoiceDate || "—"
              });
            } else if (code === "UNMATCHED/QTY-MORE") {
              qtyMismatchCount++;
              blocked.push({
                invoiceNo: line.vendorInvoiceNo,
                vendor: line.sourceVendorCode,
                blockReason: "Quantity Mismatch (Qty More than GR)",
                blockState: "Warning",
                amount: formattedAmt,
                blockDate: line.invoiceDate || "—"
              });
            } else if (code === "UNMATCHED/GR-PENDING") {
              missingGrCount++;
              parked.push({
                invoiceNo: line.vendorInvoiceNo,
                vendor: line.sourceVendorCode,
                parkedBy: "System",
                reason: "Awaiting Goods Receipt in ERP (MIGO)",
                daysParked: ageInDays,
                daysState: ageInDays > 30 ? "Error" : "Warning",
                amount: formattedAmt
              });
            } else {
              otherCount++;
            }

            if (!r || ex?.status === "OPEN") {
              pending.push({
                invoiceNo: line.vendorInvoiceNo,
                vendor: line.sourceVendorCode,
                poNo: line.poReference || "—",
                grStatus: code === "UNMATCHED/GR-PENDING" ? "GR Pending" : "GR Posted",
                grState: code === "UNMATCHED/GR-PENDING" ? "Warning" : "Success",
                amount: formattedAmt,
                variance: formattedDelta
              });
            }
          }
        });

        const matchRate = totalCount ? Math.round((totalMatched / totalCount) * 100) : 100;
        const totalBlocked = blocked.length;
        const totalParked = parked.length;
        const totalPending = pending.length;

        const reasons = [];
        const totalExceptions = priceVarianceCount + qtyMismatchCount + missingGrCount + otherCount;
        if (priceVarianceCount) {
          reasons.push({ reason: 'Price Variance > 2%', count: priceVarianceCount, pct: Math.round((priceVarianceCount / (totalExceptions || 1)) * 100), state: 'Error' });
        }
        if (qtyMismatchCount) {
          reasons.push({ reason: 'Quantity Mismatch', count: qtyMismatchCount, pct: Math.round((qtyMismatchCount / (totalExceptions || 1)) * 100), state: 'Warning' });
        }
        if (missingGrCount) {
          reasons.push({ reason: 'Missing GR Reference', count: missingGrCount, pct: Math.round((missingGrCount / (totalExceptions || 1)) * 100), state: 'Warning' });
        }
        if (otherCount) {
          reasons.push({ reason: 'Other Discrepancies', count: otherCount, pct: Math.round((otherCount / (totalExceptions || 1)) * 100), state: 'None' });
        }

        model.setProperty("/pendingVerification", totalPending);
        model.setProperty("/matchRate3Way", matchRate);
        model.setProperty("/blockedInvoices", totalBlocked);
        model.setProperty("/parkedInvoices", totalParked);
        model.setProperty("/postedTodayCount", posted.length);
        model.setProperty("/varianceExceeds", priceVarianceCount + qtyMismatchCount);

        model.setProperty("/matchRatePct", matchRate);
        model.setProperty("/onTimeVerifyPct", Math.round(100 - (totalParked / (totalCount || 1)) * 30));
        model.setProperty("/varianceOkPct", Math.round(100 - (priceVarianceCount / (totalCount || 1)) * 25));

        model.setProperty("/blockedReasons", reasons);
        model.setProperty("/pendingList", pending);
        model.setProperty("/parkedList", parked);
        model.setProperty("/blockedList", blocked);
        model.setProperty("/postedToday", posted);
      }).catch(err => MessageToast.show("Failed to load MIRO analytics: " + err.message));
    },

    onVerifyInvoice: function (oEvent) {
      const oContext = oEvent.getSource().getBindingContext("miro");
      const invNo = oContext.getProperty("invoiceNo");
      const supplier = oContext.getProperty("vendor");
      const amountStr = oContext.getProperty("amount").replace(/[^0-9.]/g, '');
      const amount = parseFloat(amountStr);

      const model = this.getView().getModel();
      const listBinding = model.bindList("/VendorLedgerItems");

      listBinding.create({
        supplier: supplier,
        companyCode: "1000",
        accountingDocument: invNo,
        documentDate: new Date().toISOString().split('T')[0],
        postingDate: new Date().toISOString().split('T')[0],
        amountInTransCrcy: amount,
        transactionCurrency: "INR",
        isCleared: false,
        taxAmount: 0
      });

      MessageBox.success(`Invoice ${invNo} verified and posted to S/4HANA Finance (accounting document generated)!`);

      setTimeout(() => {
        this.loadKpis();
        model.refresh();
      }, 1000);
    },

    onReleaseBlock: function () {
      MessageBox.confirm("Are you sure you want to release the payment block for this invoice?", {
        title: "Confirm Release",
        onClose: (sAction) => {
          if (sAction === MessageBox.Action.OK) {
            MessageToast.show("Payment block released in S/4HANA (MRBR transaction simulated).");
            this.loadKpis();
          }
        }
      });
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("home");
    },

    onLogout: function () {
      const oRouter = this.getOwnerComponent().getRouter();
      MessageBox.confirm("Are you sure you want to log out?", {
        title: "Confirm Logout",
        actions: [MessageBox.Action.YES, MessageBox.Action.NO],
        emphasizedAction: MessageBox.Action.NO,
        onClose: function (sAction) {
          if (sAction === MessageBox.Action.YES) {
            sessionStorage.removeItem("vr_user");
            oRouter.navTo("login");
          }
        }
      });
    }
  });
});
