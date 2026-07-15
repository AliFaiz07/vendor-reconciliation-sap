sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
  return Controller.extend("vendordoclines.controller.PODashboard", {
    onInit: function () {
      const user = JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      if (!user.username) return this.getOwnerComponent().getRouter().navTo("login");
    },

    onApprovePR: function (oEvent) {
      const prId = oEvent.getSource().getBindingContext().getProperty("ID");
      const model = this.getView().getModel();
      const ctx = model.bindContext("/approvePR(...)");
      ctx.setParameter("prId", prId);
      
      ctx.execute().then(() => {
        MessageToast.show("Requisition approved!");
        model.refresh();
      }).catch(e => {
        MessageToast.show("Error: " + e.message);
      });
    },

    onOpenPOConversion: function (oEvent) {
      this._activePrContext = oEvent.getSource().getBindingContext();
      this.byId("poDialog").open();
    },

    onClosePODialog: function () {
      this.byId("poDialog").close();
    },

    onGeneratePO: function () {
      const supplierSelect = this.byId("poSupplier");
      const poNumInput = this.byId("poCustomNumber");

      const supplier = supplierSelect.getSelectedKey() || supplierSelect.getValue();
      const purchaseOrder = poNumInput.getValue();
      const prId = this._activePrContext.getProperty("ID");

      if (!supplier) {
        MessageToast.show("Please assign a supplier to this purchase order.");
        return;
      }

      const model = this.getView().getModel();
      const ctx = model.bindContext("/createPO(...)");
      ctx.setParameter("prId", prId);
      ctx.setParameter("supplier", supplier);
      ctx.setParameter("purchaseOrder", purchaseOrder || null);

      ctx.execute().then(() => {
        MessageToast.show("Purchase Order generated successfully!");
        this.byId("poDialog").close();
        supplierSelect.setValue("");
        poNumInput.setValue("");
        model.refresh();
      }).catch(e => {
        MessageToast.show("Error generating PO: " + e.message);
      });
    },

    onSendPO: function (oEvent) {
      const poId = oEvent.getSource().getBindingContext().getProperty("ID");
      const model = this.getView().getModel();
      const ctx = model.bindContext("/sendPOToVendor(...)");
      ctx.setParameter("poId", poId);

      ctx.execute().then(() => {
        MessageToast.show("PO status set to SENT. Released to supplier portal.");
        model.refresh();
      }).catch(e => {
        MessageToast.show("Error sending PO: " + e.message);
      });
    },

    onCancelPO: function (oEvent) {
      const poContext = oEvent.getSource().getBindingContext();
      const poId = poContext.getProperty("ID");
      const poNo = poContext.getProperty("purchaseOrder");
      const model = this.getView().getModel();

      MessageBox.confirm(`Are you sure you want to cancel PO ${poNo}?`, {
        title: "Cancel PO",
        actions: [MessageBox.Action.YES, MessageBox.Action.NO],
        onClose: (sAction) => {
          if (sAction === MessageBox.Action.YES) {
            // Emulate cancel
            const ctx = model.bindContext("/sendPOToVendor(...)"); // reuse update hook
            // Note: In real life we'd call cancellation, here we set status directly
            const odataModel = this.getView().getModel();
            const poBind = odataModel.bindContext(poContext.getPath());
            poContext.setProperty("status", "CANCELLED");
            odataModel.submitBatch("updateGroup").then(() => {
              MessageToast.show("PO cancelled.");
              model.refresh();
            }).catch(err => {
              // Direct update
              MessageToast.show("Cancel action simulated.");
              model.refresh();
            });
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
