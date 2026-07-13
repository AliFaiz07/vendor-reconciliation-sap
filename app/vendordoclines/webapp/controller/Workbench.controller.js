sap.ui.define([
  "sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel", "sap/m/MessageToast"
], function (Controller, JSONModel, MessageToast) {
  return Controller.extend("vendordoclines.controller.Workbench", {
    onInit: function () {
      this._allRows = [];
      this.getView().setModel(new JSONModel({ filter: "ALL", search: "", rows: [], active: null }), "wb");
      this.loadData();
    },
    loadData: function () {
      Promise.all([
        fetch("/api/v1/VendorDocLines").then(r => r.json()),
        fetch("/api/v1/MatchResults").then(r => r.json()),
        fetch("/api/v1/VendorLedgerItems").then(r => r.json()),
        fetch("/api/v1/Exceptions").then(r => r.json())
      ]).then(([lines, results, ledger, exceptions]) => {
        const rByLine = new Map(results.value.map(r => [r.vendorDocLine_ID, r]));
        const lById = new Map(ledger.value.map(l => [l.ID, l]));
        const exByResult = new Map(exceptions.value.map(e => [e.matchResult_ID, e]));

        this._allRows = lines.value.map(line => {
          const r = rByLine.get(line.ID);
          const ex = r ? exByResult.get(r.ID) : undefined;
          const ledgerItem = r?.ledgerItem_ID ? lById.get(r.ledgerItem_ID) : undefined;
          const code = r?.outcomeCode ?? "UNMATCHED";
          return {
            id: line.ID, vendorInvoiceNo: line.vendorInvoiceNo, documentRef: line.documentRef || "—", invoiceDate: line.invoiceDate,
            invoiceAmount: line.invoiceAmount, poReference: line.poReference || "—",
            sourceVendorCode: line.sourceVendorCode, currency: line.currency,
            outcomeCode: code, outcomeState: this._tone(code),
            amountDelta: r?.amountDelta || 0, matchRuleApplied: r?.matchRuleApplied || "—",
            exceptionId: ex?.ID, exStatus: ex?.status, exState: ex?.status === "OPEN" ? "Warning" : "Success",
            canResolve: ex?.status === "OPEN", canReopen: ex?.status === "RESOLVED",
            ledgerDoc: ledgerItem?.accountingDocument || "—",
            ledgerAmount: ledgerItem?.amountInTransCrcy || "—",
            ledgerCleared: ledgerItem?.isCleared ? "Yes" : "No",
            recommendedAction: ex?.recommendedAction || "—"
          };
        });
        this._applyFilter();
      }).catch(e => MessageToast.show("Load error: " + e.message));
    },
    _tone: function (code) {
      if (code === "MATCHED") return "Success";
      if (code.startsWith("UNMATCHED")) return "Error";
      return "Warning";
    },
    _applyFilter: function () {
      const model = this.getView().getModel("wb");
      const filter = model.getProperty("/filter");
      const q = (model.getProperty("/search") || "").toLowerCase();
      let rows = this._allRows;
      if (filter === "MATCHED") rows = rows.filter(r => r.outcomeCode.startsWith("MATCHED"));
      if (filter === "UNMATCHED") rows = rows.filter(r => r.outcomeCode.startsWith("UNMATCHED"));
      if (filter === "EXCEPTIONS") rows = rows.filter(r => !!r.exceptionId);
      if (filter === "OPEN") rows = rows.filter(r => r.exStatus === "OPEN");
      if (q) rows = rows.filter(r => `${r.vendorInvoiceNo} ${r.poReference} ${r.sourceVendorCode}`.toLowerCase().includes(q));
      model.setProperty("/rows", rows);
    },
    onFilterChange: function (oEvent) {
      this.getView().getModel("wb").setProperty("/filter", oEvent.getParameter("item").getKey());
      this._applyFilter();
    },
    onSearch: function (oEvent) {
      this.getView().getModel("wb").setProperty("/search", oEvent.getParameter("newValue"));
      this._applyFilter();
    },
    onOpenDetails: function (oEvent) {
      const ctx = oEvent.getSource().getBindingContext("wb").getObject();
      const activeObj = {
        ...ctx,
        hasException: !!ctx.exceptionId,
        canResolve: ctx.exStatus === "OPEN" || ctx.exStatus === "DISPUTED",
        canDispute: ctx.exStatus === "OPEN",
        canReopen: ctx.exStatus === "RESOLVED",
        history: []
      };
      
      this.getView().getModel("wb").setProperty("/active", activeObj);
      
      if (ctx.exceptionId) {
        fetch(`/api/v1/WorkflowHistory?$filter=exceptionID eq ${ctx.exceptionId}&$orderby=timestamp asc`)
          .then(r => r.json())
          .then(data => {
            if (data && data.value) {
              activeObj.history = data.value.map(h => {
                return {
                  timestamp: h.timestamp ? new Date(h.timestamp).toLocaleString() : "—",
                  stepName: h.stepName,
                  action: h.action,
                  actor: h.actor,
                  comment: h.comment
                };
              });
              this.getView().getModel("wb").setProperty("/active", activeObj);
            }
          })
          .catch(err => MessageToast.show("Error loading history: " + err.message));
      }
      
      this.byId("detailsDialog").open();
    },
    onCloseDetails: function () { this.byId("detailsDialog").close(); },
    _resolve: function (exceptionId, note) {
      const model = this.getView().getModel();
      const ctx = model.bindContext("/resolveException(...)");
      ctx.setParameter("exceptionId", exceptionId);
      ctx.setParameter("note", note || "");
      ctx.execute().then(() => { MessageToast.show("Exception marked RESOLVED"); this.loadData(); });
    },
    _reopen: function (exceptionId) {
      const model = this.getView().getModel();
      const ctx = model.bindContext("/reopenException(...)");
      ctx.setParameter("exceptionId", exceptionId);
      ctx.execute().then(() => { MessageToast.show("Exception reopened"); this.loadData(); });
    },
    onResolvePress: function (oEvent) {
      const row = oEvent.getSource().getBindingContext("wb").getObject();
      this._resolve(row.exceptionId, "");
    },
    onReopenPress: function (oEvent) {
      const row = oEvent.getSource().getBindingContext("wb").getObject();
      this._reopen(row.exceptionId);
    },
    onResolveFromDialog: function () {
      const active = this.getView().getModel("wb").getProperty("/active");
      this._resolve(active.exceptionId, this.byId("resolutionNote").getValue());
      this.byId("detailsDialog").close();
    },
    onReopenFromDialog: function () {
      const active = this.getView().getModel("wb").getProperty("/active");
      this._reopen(active.exceptionId);
      this.byId("detailsDialog").close();
    },
    onDisputeFromDialog: function () {
      const active = this.getView().getModel("wb").getProperty("/active");
      const note = this.byId("resolutionNote").getValue();
      const model = this.getView().getModel();
      const ctx = model.bindContext("/raiseDispute(...)");
      ctx.setParameter("exceptionId", active.exceptionId);
      ctx.setParameter("comment", note || "Disputed via UI");
      ctx.execute().then(() => { 
        MessageToast.show("Dispute submitted successfully"); 
        this.byId("detailsDialog").close();
        this.loadData(); 
      }).catch(e => MessageToast.show("Error: " + e.message));
    }
  });
});