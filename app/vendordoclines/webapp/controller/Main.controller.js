sap.ui.define(["sap/ui/core/mvc/Controller", "sap/m/MessageToast"], function (Controller, MessageToast) {
  return Controller.extend("vendordoclines.controller.Main", {

    _fileToBase64: function (file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    onSeedData: function () {
      const file = this.byId("seedUploader").oFileUpload.files[0];
      if (!file) return;
      this._fileToBase64(file).then(base64 => {
        const model = this.getView().getModel();
        const ctx = model.bindContext("/seedSapMockData(...)");
        ctx.setParameter("fileBase64", base64);
        ctx.execute().then(() => {
          MessageToast.show("Seed complete: " + ctx.getBoundContext().getObject().value);
          model.refresh();
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
          MessageToast.show("Uploaded and matched");
          model.refresh();
        }).catch(e => MessageToast.show("Error: " + e.message));
      });
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
      }).catch(e => MessageToast.show("Error: " + e.message));
    }

  });
});