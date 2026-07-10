sap.ui.define(["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel", "sap/m/MessageBox"], function (Controller, JSONModel, MessageBox) {
  const ROLE_LABELS = {
    GR:      "Goods Receipt Workbench",
    MIRO:    "Invoice Verification (MIRO)",
    AP:      "Accounts Payable Cockpit",
    BILLING: "Vendor Billing Dashboard",
    AR:      "AR Receivables Monitor"
  };
  return Controller.extend("vendordoclines.controller.Home", {
    onInit: function () {
      const user = JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      if (!user.username) return this.getOwnerComponent().getRouter().navTo("login");
      const model = new JSONModel({ ...user, workbenchLabel: ROLE_LABELS[user.businessRole] || user.businessRole, kpis: {} });
      this.getView().setModel(model, "home");
      fetch("/api/v1/getCockpitKpis()").then(r => r.json()).then(data => {
        model.setProperty("/kpis", JSON.parse(data.value));
      });
    },
    onOpenWorkbench: function () {
      const user = JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      const roleRouteMap = { AP: "main", BILLING: "billing", AR: "ar", GR: "gr", MIRO: "miro" };
      const route = roleRouteMap[user.businessRole] || "workbench";
      this.getOwnerComponent().getRouter().navTo(route);
    },
    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("login");
    },
    onLogout: function () {
      MessageBox.confirm("Are you sure you want to log out?", {
        title: "Confirm Logout",
        actions: [MessageBox.Action.YES, MessageBox.Action.NO],
        emphasizedAction: MessageBox.Action.NO,
        onClose: (sAction) => {
          if (sAction === MessageBox.Action.YES) {
            sessionStorage.removeItem("vr_user");
            this.getOwnerComponent().getRouter().navTo("login");
          }
        }
      });
    }
  });
});