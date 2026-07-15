sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, JSONModel, MessageBox, MessageToast) {
  return Controller.extend("vendordoclines.controller.PRDashboard", {
    onInit: function () {
      const user = JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      if (!user.username) return this.getOwnerComponent().getRouter().navTo("login");
    },

    onSubmitPR: function () {
      const materialInput = this.byId("prMaterial");
      const qtyInput = this.byId("prQty");
      const amountInput = this.byId("prAmount");

      const material = materialInput.getValue();
      const qty = qtyInput.getValue();
      const amount = amountInput.getValue();

      if (!material || !amount || Number(amount) <= 0) {
        MessageToast.show("Please enter valid material and estimated amount details.");
        return;
      }

      const model = this.getView().getModel();
      const ctx = model.bindContext("/createPR(...)");
      ctx.setParameter("material", material);
      ctx.setParameter("qty", parseFloat(qty));
      ctx.setParameter("amount", parseFloat(amount));

      ctx.execute().then(() => {
        MessageToast.show("Purchase Requisition submitted successfully!");
        materialInput.setValue("");
        qtyInput.setValue(1);
        amountInput.setValue("");
        model.refresh();
      }).catch(e => {
        MessageToast.show("Error submitting PR: " + e.message);
      });
    },

    onPOTrack: function (oEvent) {
      const poRef = oEvent.getSource().getText();
      const model = this.getView().getModel();
      
      // Query the PO status from OData
      const path = `/PurchaseOrders?$filter=purchaseOrder eq '${poRef}'`;
      
      fetch(`/api/v1${path}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.value && data.value.length > 0) {
            const po = data.value[0];
            MessageBox.information(
              `Purchase Order Status:\n\n` +
              `PO Number: ${po.purchaseOrder}\n` +
              `Supplier: ${po.supplier}\n` +
              `Material: ${po.material || '—'}\n` +
              `Quantity: ${po.poQty} units\n` +
              `Amount: ₹${Number(po.poAmount).toLocaleString('en-IN')}\n` +
              `Status: ${po.status}\n` +
              `Received Quantity: ${po.receivedQty || 0} units`
            );
          } else {
            MessageBox.warning("PO details could not be loaded.");
          }
        })
        .catch(e => {
          MessageToast.show("Error loading PO info: " + e.message);
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
