sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel"],
  function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("sap.ui.demo.app.Main", {
      onInit: function () {
        var oModel = new JSONModel({
          vendors: [],
          invoices: [],
          payments: [],
        });
        this.getView().setModel(oModel);
        this.loadData();
      },

      loadData: function () {
        var that = this;
        Promise.all([
          fetch("/odata/v4/vendor/Vendors").then(function (r) {
            return r.json();
          }),
          fetch("/odata/v4/vendor/Invoices").then(function (r) {
            return r.json();
          }),
          fetch("/odata/v4/vendor/Payments").then(function (r) {
            return r.json();
          }),
        ])
          .then(function (results) {
            var oModel = that.getView().getModel();
            oModel.setData({
              vendors: results[0].value || [],
              invoices: results[1].value || [],
              payments: results[2].value || [],
            });
          })
          .catch(function (err) {
            console.error(err);
          });
      },
    });
  },
);
