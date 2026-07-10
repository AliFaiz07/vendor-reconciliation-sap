sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox"
], function (Controller, JSONModel, MessageBox) {
  return Controller.extend("vendordoclines.controller.BillingDashboard", {
    onInit: function () {
      const user = JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      if (!user.username) return this.getOwnerComponent().getRouter().navTo("login");
      
      const model = new JSONModel({
        username: user.fullName,
        role: 'Vendor Billing',
        invoicesRaised: 24,
        paidThisMonth: 18,
        overdueAmount: '₹3,25,000',
        underDispute: 2,
        avgPaymentDays: 28,
        statementsSubmitted: 3,
        paidPct: 75,
        pendingPct: 17,
        overduePct: 8,
        myInvoices: [
          { invoiceNo: 'INV-2026-0089', poRef: 'PO-4500001234', amount: '₹1,50,000', dueDate: '15-Jul-2026', status: 'Paid', statusState: 'Success' },
          { invoiceNo: 'INV-2026-0090', poRef: 'PO-4500001235', amount: '₹99,500', dueDate: '20-Jul-2026', status: 'Pending', statusState: 'Warning' },
          { invoiceNo: 'INV-2026-0091', poRef: 'PO-4500001236', amount: '₹2,10,000', dueDate: '05-Jul-2026', status: 'Overdue', statusState: 'Error' },
          { invoiceNo: 'INV-2026-0088', poRef: 'PO-4500001233', amount: '₹75,000', dueDate: '01-Jul-2026', status: 'Paid', statusState: 'Success' },
          { invoiceNo: 'INV-2026-0092', poRef: 'PO-4500001237', amount: '₹1,15,000', dueDate: '25-Jul-2026', status: 'Disputed', statusState: 'Error' }
        ],
        myStatements: [
          { stmtId: 'STA-2026-003', uploadDate: 'Today, 09:30', lines: 24, matchStatus: 'Matched', matchState: 'Success' },
          { stmtId: 'STA-2026-002', uploadDate: '08-Jul-2026', lines: 18, matchStatus: 'Partially Matched', matchState: 'Warning' },
          { stmtId: 'STA-2026-001', uploadDate: '01-Jul-2026', lines: 22, matchStatus: 'Matched', matchState: 'Success' }
        ],
        pendingPayments: [
          { invoiceNo: 'INV-2026-0091', overdueDays: 4, amount: '₹2,10,000', priority: 'High', priorityState: 'Error' },
          { invoiceNo: 'INV-2026-0085', overdueDays: 12, amount: '₹1,15,000', priority: 'High', priorityState: 'Error' },
          { invoiceNo: 'INV-2026-0087', overdueDays: 2, amount: '₹75,000', priority: 'Medium', priorityState: 'Warning' }
        ]
      });
      this.getView().setModel(model, "billing");
    },

    loadKpis: function () {
      // Mock refresh
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
