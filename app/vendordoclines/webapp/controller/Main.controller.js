sap.ui.define(["sap/ui/core/mvc/Controller", "sap/m/MessageToast", "sap/m/MessageBox"], function (Controller, MessageToast, MessageBox) {
  return Controller.extend("vendordoclines.controller.Main", {
    formatDate: function (sDate) {
      if (!sDate) return "—";
      try {
        return new Date(sDate).toLocaleString();
      } catch (e) {
        return sDate;
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
    _refreshSubViews: function () {
      const oCockpitView = this.byId("cockpitView");
      if (oCockpitView) {
        oCockpitView.getController().loadKpis();
      }
      const oWorkbenchView = this.byId("workbenchView");
      if (oWorkbenchView) {
        oWorkbenchView.getController().loadData();
      }
    },
    onUploadSapLedger: function () {
      const file = this.byId("sapLedgerUploader").oFileUpload.files[0];
      if (!file) return;
      this._fileToBase64(file).then(base64 => {
        const model = this.getView().getModel();
        const ctx = model.bindContext("/seedSapMockData(...)");
        ctx.setParameter("fileBase64", base64);
        ctx.execute().then(() => {
          MessageToast.show("SAP Ledger uploaded and database seeded successfully");
          model.refresh();
          this._refreshSubViews();
        }).catch(e => MessageToast.show("Error: " + e.message));
      });
    },
    onUploadStatement: function () {
      const file = this.byId("statementUploader").oFileUpload.files[0];
      if (!file) return;
      this._fileToBase64(file).then(base64 => {
        const model = this.getView().getModel();
        const ctx = model.bindContext("/uploadStatement(...)");
        ctx.setParameter("fileBase64", base64);
        ctx.execute().then(() => {
          MessageToast.show("Vendor Statement uploaded and matched successfully");
          model.refresh();
          this._refreshSubViews();
        }).catch(e => MessageToast.show("Error: " + e.message));
      });
    },
    onRunMatching: function () {
      const model = this.getView().getModel();
      const ctx = model.bindContext("/runMatching(...)");
      ctx.setParameter("statementUploadId", null);
      ctx.execute().then(() => {
        MessageToast.show("Matching engine executed successfully");
        model.refresh();
        this._refreshSubViews();
      }).catch(e => MessageToast.show("Error: " + e.message));
    },
    onResolveException: function (oEvent) {
      const exceptionId = oEvent.getSource().data("exceptionId");
      const model = this.getView().getModel();
      const ctx = model.bindContext("/resolveException(...)");
      ctx.setParameter("exceptionId", exceptionId);
      ctx.setParameter("note", "Resolved via demo UI");
      ctx.execute().then(() => {
        MessageToast.show("Resolved");
        model.refresh();
        this._refreshSubViews();
      }).catch(e => MessageToast.show("Error: " + e.message));
    },
    onTabSelect: function (oEvent) {
      const sKey = oEvent.getParameter("key");
      if (sKey === "cockpit") {
        const oCockpitView = this.byId("cockpitView");
        if (oCockpitView) {
          oCockpitView.getController().loadKpis();
        }
      } else if (sKey === "workbench") {
        const oWorkbenchView = this.byId("workbenchView");
        if (oWorkbenchView) {
          oWorkbenchView.getController().loadData();
        }
      } else if (sKey === "miro") {
        const oMiroView = this.byId("miroView");
        if (oMiroView) {
          oMiroView.getController().loadKpis();
        }
      } else if (sKey === "appayment") {
        this.getView().getModel().refresh();
      }
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