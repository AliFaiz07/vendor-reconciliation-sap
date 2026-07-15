sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
  return Controller.extend("vendordoclines.controller.APPayment", {
    onInit: function () {
      const user = JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      if (!user.username) return this.getOwnerComponent().getRouter().navTo("login");
    },

    onCreateProposal: function () {
      const table = this.byId("approvedTable");
      const selectedItems = table.getSelectedItems();

      if (selectedItems.length === 0) {
        MessageToast.show("Please select at least one approved invoice.");
        return;
      }

      const ids = selectedItems.map(item => item.getBindingContext().getProperty("ID"));
      
      const model = this.getView().getModel();
      const ctx = model.bindContext("/createPaymentProposal(...)");
      ctx.setParameter("docLineIds", JSON.stringify(ids));

      ctx.execute().then(() => {
        MessageToast.show("Payment proposal generated successfully!");
        table.removeSelections();
        model.refresh();
      }).catch(e => {
        MessageToast.show("Error creating proposal: " + e.message);
      });
    },

    onOpenPaymentRun: function () {
      const table = this.byId("proposalsTable");
      const selectedItems = table.getSelectedItems();

      if (selectedItems.length === 0) {
        MessageToast.show("Please select at least one proposal invoice.");
        return;
      }

      this._selectedProposalIds = selectedItems.map(item => item.getBindingContext().getProperty("ID"));
      
      // Auto-populate UTR ref
      const randomUt = 'UTR-F110-' + Math.floor(100000 + Math.random() * 900000);
      this.byId("payRefInput").setValue(randomUt);
      this.byId("payDialog").open();
    },

    onClosePayDialog: function () {
      this.byId("payDialog").close();
    },

    onExecutePayment: function () {
      const payRefInput = this.byId("payRefInput");
      const paymentRef = payRefInput.getValue();

      if (!paymentRef) {
        MessageToast.show("Payment reference (UTR) is required.");
        return;
      }

      const model = this.getView().getModel();
      const ctx = model.bindContext("/executePaymentRun(...)");
      ctx.setParameter("paymentRef", paymentRef);
      ctx.setParameter("docLineIds", JSON.stringify(this._selectedProposalIds));

      ctx.execute().then(() => {
        MessageToast.show("Automatic Payment Run (F110) executed successfully! Invoices cleared.");
        this.byId("payDialog").close();
        this.byId("proposalsTable").removeSelections();
        model.refresh();
      }).catch(e => {
        MessageToast.show("Error executing payment: " + e.message);
      });
    },

    onTabSelect: function () {
      this.getView().getModel().refresh();
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
