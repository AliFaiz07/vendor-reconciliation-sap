sap.ui.define(["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel"], function (Controller, JSONModel) {
  return Controller.extend("vendordoclines.controller.Cockpit", {
    onInit: function () {
      this.loadKpis();
    },
    loadKpis: function () {
      fetch("/api/v1/getCockpitKpis()")
        .then(r => r.json())
        .then(data => {
          const kpis = JSON.parse(data.value);
          kpis.reasonList = Object.entries(kpis.differencesByReason).map(([reason, count]) => ({ reason, count }));
          this.getView().setModel(new JSONModel(kpis), "cockpit");
        });
    }
  });
});