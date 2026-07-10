sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, JSONModel, MessageBox, MessageToast) {
  return Controller.extend("vendordoclines.controller.GRWorkbench", {
    onInit: function () {
      const user = JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      if (!user.username) return this.getOwnerComponent().getRouter().navTo("login");
      
      const model = new JSONModel({
        pendingGR: 3, grPostedToday: 7, grirClearing: 5, shortDeliveries: 1, returns: 0, poCoverage: 87,
        grVsPOPct: 87, grirClearedPct: 72, onTimePct: 90,
        openGRs: [
          { poNo: 'PO-4500001234', vendor: 'Vasavi Castings', material: 'Cast Iron Flanges', expectedQty: 100, expectedDate: '10-Jul-2026', status: 'Awaiting GR', statusState: 'Warning' },
          { poNo: 'PO-4500001235', vendor: 'ABC Suppliers', material: 'MS Pipes 6 inch', expectedQty: 50, expectedDate: '11-Jul-2026', status: 'Awaiting GR', statusState: 'Warning' },
          { poNo: 'PO-4500001236', vendor: 'XYZ Components', material: 'Stainless Bolts M12', expectedQty: 500, expectedDate: '09-Jul-2026', status: 'Overdue', statusState: 'Error' }
        ],
        postedGRs: [
          { grDoc: '5000012345', poNo: 'PO-4500001230', vendor: 'Vasavi Castings', qtyPosted: 95, postingDate: 'Today', miroStatus: 'Not Received', miroState: 'Warning' },
          { grDoc: '5000012344', poNo: 'PO-4500001229', vendor: 'ABC Suppliers', qtyPosted: 50, postingDate: '08-Jul-2026', miroStatus: 'MIRO Posted', miroState: 'Success' },
          { grDoc: '5000012343', poNo: 'PO-4500001228', vendor: 'Global Parts', qtyPosted: 200, postingDate: '07-Jul-2026', miroStatus: 'MIRO Posted', miroState: 'Success' }
        ],
        grirItems: [
          { poNo: 'PO-4500001230', grDate: 'Today', grAmount: '₹1,42,500', miroStatus: 'Pending', miroState: 'Warning', daysPending: 0 },
          { poNo: 'PO-4500001227', grDate: '06-Jul-2026', grAmount: '₹89,000', miroStatus: 'Pending', miroState: 'Warning', daysPending: 3 },
          { poNo: 'PO-4500001225', grDate: '04-Jul-2026', grAmount: '₹2,25,000', miroStatus: 'Pending', miroState: 'Error', daysPending: 5 }
        ],
        returns: []
      });
      this.getView().setModel(model, "gr");
    },

    loadKpis: function () {
      // Mock refresh
    },

    onPostGR: function () {
      MessageToast.show("Goods Receipt posting (MIGO) simulation started. Sending confirmation to ERP...");
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("home");
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
