sap.ui.define(["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel"], function (Controller, JSONModel) {
  return Controller.extend("vendordoclines.controller.PersonaWorkbench", {
    onInit: function () {
      const user = JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      if (!user.username) return this.getOwnerComponent().getRouter().navTo("login");
      const model = new JSONModel({ workbenchLabel: user.businessRole, rows: [] });
      this.getView().setModel(model, "persona");
      Promise.all([
        fetch("/api/v1/VendorDocLines").then(r => r.json()),
        fetch(`/api/v1/MatchResults?$filter=businessRole eq '${user.businessRole}'`).then(r => r.json()),
        fetch("/api/v1/Exceptions").then(r => r.json())
      ]).then(([lines, results, exceptions]) => {
        const linesMap = new Map(lines.value.map(l => [l.ID, l]));
        const exMap = new Map(exceptions.value.map(e => [e.matchResult_ID, e]));

        const rows = (results.value || []).map(r => {
          const line = linesMap.get(r.vendorDocLine_ID);
          const ex = exMap.get(r.ID);
          return {
            vendorInvoiceNo: line?.vendorInvoiceNo || "—",
            documentRef: line?.documentRef || "—",
            outcomeCode: r.outcomeCode,
            outcomeState: r.outcomeCode.startsWith("MATCHED") ? "Success" : "Error",
            exStatus: ex ? ex.status : "—",
            exState: ex?.status === "OPEN" ? "Warning" : (ex?.status === "RESOLVED" ? "Success" : "None")
          };
        });
        model.setProperty("/rows", rows);
      }).catch(e => {
        console.error("Error loading persona workbench data: ", e);
      });
    }
  });
});