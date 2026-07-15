sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, JSONModel, MessageBox, MessageToast) {
  return Controller.extend("vendordoclines.controller.VendorPortal", {
    onInit: function () {
      const user = JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      if (!user.username) return this.getOwnerComponent().getRouter().navTo("login");
      
      if (!user.vendorCode) {
        MessageBox.error("No Vendor Code associated with your user. Please log in with a Vendor profile.");
      }
    },

    _fileToBase64: function (file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    onDispatch: function (oEvent) {
      const poId = oEvent.getSource().getBindingContext().getProperty("ID");
      const model = this.getView().getModel();
      const ctx = model.bindContext("/dispatchGoods(...)");
      ctx.setParameter("poId", poId);

      ctx.execute().then(() => {
        MessageToast.show("Goods dispatched. Shipment tracking sent to buyer.");
        model.refresh();
      }).catch(e => {
        MessageToast.show("Error: " + e.message);
      });
    },

    onSubmitInvoice: function () {
      const user = JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      
      const invNoInput = this.byId("invNumber");
      const dateInput = this.byId("invDate");
      const amountInput = this.byId("invAmount");
      const poRefInput = this.byId("invPoRef");
      const gstTdsInput = this.byId("invGstTds");

      const vendorInvoiceNo = invNoInput.getValue();
      const invoiceDate = dateInput.getValue();
      const invoiceAmount = amountInput.getValue();
      const poReference = poRefInput.getValue();
      const gstTdsAmount = gstTdsInput.getValue() || 0;

      if (!vendorInvoiceNo || !invoiceDate || !invoiceAmount || !poReference) {
        MessageToast.show("Please fill out all required fields.");
        return;
      }

      const model = this.getView().getModel();
      const listBinding = model.bindList("/VendorDocLines");

      listBinding.create({
        vendorInvoiceNo,
        invoiceDate,
        invoiceAmount: parseFloat(invoiceAmount),
        currency: "INR",
        poReference,
        gstTdsAmount: parseFloat(gstTdsAmount),
        sourceVendorCode: user.vendorCode
      });

      // Submit batch if needed, or if it is auto-submitted, we refresh
      MessageToast.show("Invoice submitted successfully!");
      invNoInput.setValue("");
      dateInput.setValue("");
      amountInput.setValue("");
      poRefInput.setValue("");
      gstTdsInput.setValue("");

      setTimeout(() => {
        model.refresh();
      }, 1000);
    },

    onUploadVendorStatement: function () {
      const uploader = this.byId("vendorStatementUploader");
      const file = uploader.oFileUpload.files[0];
      if (!file) {
        MessageToast.show("Please select an Excel sheet first.");
        return;
      }

      const user = JSON.parse(sessionStorage.getItem("vr_user") || "{}");

      this._fileToBase64(file).then(base64 => {
        const model = this.getView().getModel();
        const ctx = model.bindContext("/uploadStatement(...)");
        ctx.setParameter("fileBase64", base64);
        ctx.setParameter("companyCode", "1000");
        ctx.setParameter("period", "2026-04");
        ctx.setParameter("fiscalYear", "2026");
        ctx.setParameter("fileName", file.name);

        ctx.execute().then(() => {
          MessageToast.show("Statement uploaded successfully.");
          uploader.setValue("");
          model.refresh();
        }).catch(e => {
          MessageToast.show("Error: " + e.message);
        });
      });
    },

    onTabSelect: function (oEvent) {
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
