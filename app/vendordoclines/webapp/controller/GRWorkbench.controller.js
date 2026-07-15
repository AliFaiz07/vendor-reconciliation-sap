sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, JSONModel, MessageBox, MessageToast) {
  return Controller.extend("vendordoclines.controller.GRWorkbench", {
    onInit: function () {
      const user = JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      if (!user.username) return this.getOwnerComponent().getRouter().navTo("login");
      
      const model = new JSONModel({
        pendingGR: 0,
        grPostedToday: 0,
        grirClearing: 0,
        shortDeliveries: 0,
        returns: 0,
        poCoverage: 100,
        grVsPOPct: 100,
        grirClearedPct: 100,
        onTimePct: 100,
        openGRs: [],
        postedGRs: [],
        grirItems: [],
        returnsList: []
      });
      this.getView().setModel(model, "gr");
      
      this.loadKpis();
    },

    loadKpis: function () {
      const model = this.getView().getModel("gr");
      
      Promise.all([
        fetch("/api/v1/PurchaseOrders").then(r => r.json()),
        fetch("/api/v1/GrirSnapshot").then(r => r.json())
      ]).then(([pos, grir]) => {
        const poList = pos.value || [];
        const grirList = grir.value || [];
        
        const openGRs = poList.filter(po => po.status === 'SENT' || po.status === 'DISPATCHED').map(po => ({
          poId: po.ID,
          poNo: po.purchaseOrder,
          vendor: po.supplier,
          material: po.material || 'Materials',
          expectedQty: po.poQty,
          expectedDate: po.modifiedAt ? new Date(po.modifiedAt).toLocaleDateString() : 'Today',
          status: po.status === 'DISPATCHED' ? 'Dispatched' : 'Awaiting GR',
          statusState: po.status === 'DISPATCHED' ? 'Information' : 'Warning'
        }));
        
        const postedGRs = poList.filter(po => po.status === 'GR_POSTED').map(po => ({
          grDoc: '5000' + po.purchaseOrder.replace(/[^0-9]/g, '').slice(-6),
          poNo: po.purchaseOrder,
          vendor: po.supplier,
          qtyPosted: po.receivedQty,
          postingDate: new Date(po.modifiedAt).toLocaleDateString(),
          miroStatus: 'GR Received',
          miroState: 'Success'
        }));
        
        const grirItems = grirList.map(item => ({
          poNo: item.purchaseOrder,
          grDate: item.modifiedAt ? new Date(item.modifiedAt).toLocaleDateString() : 'Recent',
          grAmount: '₹' + Number(item.grirAmount).toLocaleString('en-IN'),
          miroStatus: 'Pending Match',
          miroState: 'Warning',
          daysPending: 1
        }));
        
        model.setProperty("/pendingGR", openGRs.length);
        model.setProperty("/grPostedToday", postedGRs.length);
        model.setProperty("/grirClearing", grirItems.length);
        
        model.setProperty("/openGRs", openGRs);
        model.setProperty("/postedGRs", postedGRs);
        model.setProperty("/grirItems", grirItems);
        
      }).catch(err => {
        console.error("Error loading GR KPIs:", err);
      });
    },

    onPostGR: function (oEvent) {
      const oContext = oEvent.getSource().getBindingContext("gr");
      const poId = oContext.getProperty("poId");
      const expectedQty = oContext.getProperty("expectedQty");
      
      const model = this.getView().getModel();
      const ctx = model.bindContext("/postGR(...)");
      ctx.setParameter("poId", poId);
      ctx.setParameter("grQty", parseFloat(expectedQty));
      ctx.setParameter("plant", "1000");

      ctx.execute().then(() => {
        MessageToast.show("Goods Receipt posting (MIGO) succeeded!");
        this.loadKpis();
        this.getView().getModel().refresh();
      }).catch(e => {
        MessageToast.show("Error: " + e.message);
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
