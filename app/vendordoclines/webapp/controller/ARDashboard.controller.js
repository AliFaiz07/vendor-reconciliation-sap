sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox"
], function (Controller, JSONModel, MessageBox) {
  return Controller.extend("vendordoclines.controller.ARDashboard", {
    onInit: function () {
      const user = JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      if (!user.username) return this.getOwnerComponent().getRouter().navTo("login");
      
      const model = new JSONModel({
        totalARBalance: '₹8,49,999',
        collectedThisMonth: '₹6,25,000',
        dsoDays: 34,
        overdue60Days: '₹2,50,000',
        activeDisputes: 3,
        collectionRate: 74,
        collectionRatePct: 74,
        disputeRatePct: 12,
        onTimePct: 65,
        aging0_30: 65, aging31_60: 20, aging61_90: 10, aging90plus: 5,
        overdueInvoices: [
          { invoiceNo: 'INV-2026-0091', buyer: 'Customer Corp Ltd.', amount: '₹2,10,000', dueDate: '05-Jul-2026', daysOverdue: 4, daysState: 'Error' },
          { invoiceNo: 'INV-2026-0085', buyer: 'Customer Corp Ltd.', amount: '₹1,15,000', dueDate: '27-Jun-2026', daysOverdue: 12, daysState: 'Error' },
          { invoiceNo: 'INV-2026-0087', buyer: 'Customer Corp Ltd.', amount: '₹75,000', dueDate: '07-Jul-2026', daysOverdue: 2, daysState: 'Warning' }
        ],
        activeDisputesList: [
          { disputeId: 'DIS-0021', invoiceNo: 'INV-2026-0092', reason: 'Price Discrepancy', amount: '₹1,15,000', status: 'Under Review', statusState: 'Warning', raisedOn: '08-Jul-2026' },
          { disputeId: 'DIS-0020', invoiceNo: 'INV-2026-0088', reason: 'Short Payment', amount: '₹25,000', status: 'Escalated', statusState: 'Error', raisedOn: '05-Jul-2026' },
          { disputeId: 'DIS-0019', invoiceNo: 'INV-2026-0084', reason: 'TDS Deduction', amount: '₹8,250', status: 'Resolved', statusState: 'Success', raisedOn: '01-Jul-2026' }
        ],
        paymentConfirmations: [
          { payRef: 'PAY-2026-0156', date: 'Today, 10:00', amount: '₹1,50,000', bankRef: 'NEFT/12345678', confirmedBy: 'AP-Team' },
          { payRef: 'PAY-2026-0145', date: '08-Jul-2026', amount: '₹99,500', bankRef: 'RTGS/87654321', confirmedBy: 'AP-Team' },
          { payRef: 'PAY-2026-0132', date: '05-Jul-2026', amount: '₹2,10,000', bankRef: 'NEFT/11223344', confirmedBy: 'AP-Team' }
        ]
      });
      this.getView().setModel(model, "ar");
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
