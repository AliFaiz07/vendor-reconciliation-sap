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
        pendingVerification: 5, matchRate3Way: 82, blockedInvoices: 2, parkedInvoices: 3, postedToday: 8, varianceExceeds: 2,
        matchRatePct: 82, onTimeVerifyPct: 78, varianceOkPct: 91,
        blockedReasons: [
          { reason: 'Price Variance > 2%', count: 4, pct: 40, state: 'Error' },
          { reason: 'Quantity Mismatch', count: 3, pct: 30, state: 'Warning' },
          { reason: 'Missing GR Reference', count: 2, pct: 20, state: 'Warning' },
          { reason: 'Duplicate Invoice', count: 1, pct: 10, state: 'Error' }
        ],
        pendingList: [
          { invoiceNo: 'INV-2026-0093', vendor: 'Vasavi Castings', poNo: 'PO-4500001234', grStatus: 'GR Posted', grState: 'Success', amount: '₹1,42,500', variance: '₹0' },
          { invoiceNo: 'INV-2026-0094', vendor: 'ABC Suppliers', poNo: 'PO-4500001235', grStatus: 'GR Pending', grState: 'Warning', amount: '₹74,800', variance: '₹700' },
          { invoiceNo: 'INV-2026-0095', vendor: 'XYZ Components', poNo: 'PO-4500001236', grStatus: 'GR Posted', grState: 'Success', amount: '₹22,500', variance: '₹1,200' },
          { invoiceNo: 'INV-2026-0096', vendor: 'Global Parts', poNo: 'PO-4500001238', grStatus: 'GR Posted', grState: 'Success', amount: '₹98,000', variance: '₹0' },
          { invoiceNo: 'INV-2026-0097', vendor: 'Precision Metals', poNo: 'PO-4500001240', grStatus: 'Partial GR', grState: 'Warning', amount: '₹55,000', variance: '₹5,000' }
        ],
        parkedList: [
          { invoiceNo: 'INV-2026-0088', vendor: 'Vasavi Castings', parkedBy: 'R.Kumar', reason: 'Awaiting GR Confirmation', daysParked: 2, daysState: 'Warning', amount: '₹99,999' },
          { invoiceNo: 'INV-2026-0090', vendor: 'ABC Suppliers', parkedBy: 'S.Patel', reason: 'Price Clarification Needed', daysParked: 4, daysState: 'Error', amount: '₹45,000' },
          { invoiceNo: 'INV-2026-0087', vendor: 'XYZ Components', parkedBy: 'R.Kumar', reason: 'Duplicate Check in Progress', daysParked: 1, daysState: 'Success', amount: '₹32,500' }
        ],
        blockedList: [
          { invoiceNo: 'INV-2026-0086', vendor: 'Vasavi Castings', blockReason: 'Price Variance 4.5%', blockState: 'Error', amount: '₹2,10,000', blockDate: '07-Jul-2026' },
          { invoiceNo: 'INV-2026-0083', vendor: 'ABC Suppliers', blockReason: 'Quantity Short by 5 units', blockState: 'Warning', amount: '₹89,500', blockDate: '05-Jul-2026' }
        ],
        postedToday: [
          { miroDoc: '5105001234', vendor: 'Global Parts', invoiceNo: 'INV-2026-0082', amount: '₹98,000', postedAt: '09:45 AM', cleared: 'Yes', clearedState: 'Success' },
          { miroDoc: '5105001235', vendor: 'Precision Metals', invoiceNo: 'INV-2026-0081', amount: '₹55,000', postedAt: '10:15 AM', cleared: 'Pending', clearedState: 'Warning' },
          { miroDoc: '5105001236', vendor: 'Vasavi Castings', invoiceNo: 'INV-2026-0080', amount: '₹1,42,500', postedAt: '10:30 AM', cleared: 'Yes', clearedState: 'Success' }
        ]
      });
      this.getView().setModel(model, "miro");
    },

    loadKpis: function () {
      // Mock refresh
    },

    onVerifyInvoice: function () {
      MessageToast.show("Invoice verification process (MIRO) initiated. Running 3-way validation in ERP...");
    },

    onReleaseBlock: function () {
      MessageToast.show("Payment block release request submitted to AP Manager.");
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
