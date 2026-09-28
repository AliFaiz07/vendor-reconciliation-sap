/**
 *Home.controller.js
 *
 *Home screen controller. Shows role-specific KPIs, workbench link,
 *Switch Profile popover, Reset Demo action, and Logout.
 *
 *DEMO MODE — all SAP actions are local simulations.
 */
sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/ui/core/Fragment"
], function (Controller, JSONModel, MessageBox, MessageToast, Fragment) {
  "use strict";

  var ROLE_LABELS = {
    PR:      "PR / Indenter Workbench",
    PO:      "Purchase Order Workbench",
    VENDOR:  "Vendor Portal",
    GR:      "Goods Receipt Workbench",
    FINANCE: "Finance / MIRO Workbench",
    AP:      "Accounts Payable Cockpit",
    BILLING: "Vendor Billing Dashboard",
    AR:      "AR Receivables Monitor"
  };

  var ROLE_ROUTE_MAP = {
    PR:      "pr",
    PO:      "po",
    VENDOR:  "vendorportal",
    GR:      "gr",
    FINANCE: "main",
    AP:      "main",
    BILLING: "billing",
    AR:      "ar"
  };

  return Controller.extend("vendordoclines.controller.Home", {

    onInit: function () {
      var user = this._getUser();
      if (!user || !user.username) {
        return this.getOwnerComponent().getRouter().navTo("demologin");
      }

      var model = new JSONModel({
        fullName:       user.fullName,
        businessRole:   user.businessRole,
        vendorCode:     user.vendorCode || null,
        email:          user.email,
        demoMode:       user.demoMode !== false,
        demoLabel:      user.demoMode !== false ? "[DEMO MODE]" : "",
        workbenchLabel: ROLE_LABELS[user.businessRole] || user.businessRole,
        kpis: {}
      });
      this.getView().setModel(model, "home");
      this._loadKpis(model);
    },

    _getUser: function () {
      try {
        return JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      } catch (e) {
        return {};
      }
    },

    _loadKpis: function (model) {
      fetch("/api/v1/getCockpitKpis()")
        .then(function (r) { return r.json(); })
        .then(function (data) {
          try {
            var kpis = JSON.parse(data.value);
            model.setProperty("/kpis", kpis);
          } catch (e) {
            console.warn("Could not parse KPI response:", e);
          }
        })
        .catch(function (e) { console.warn("KPI load failed:", e); });
    },

    onOpenWorkbench: function () {
      var user = this._getUser();
      var route = ROLE_ROUTE_MAP[user.businessRole] || "workbench";
      this.getOwnerComponent().getRouter().navTo(route);
    },

    /**
     * Opens Switch Profile popover with all demo personas.
     */
    onSwitchProfile: function (oEvent) {
      var oView = this.getView();
      var that = this;
      if (!this._oSwitchProfilePopover) {
        Fragment.load({
          id: oView.getId(),
          name: "vendordoclines.view.SwitchProfile",
          controller: this
        }).then(function (oPopover) {
          that._oSwitchProfilePopover = oPopover;
          oView.addDependent(oPopover);
          oPopover.openBy(oEvent.getSource());
        });
      } else {
        this._oSwitchProfilePopover.openBy(oEvent.getSource());
      }
    },

    onCloseSwitchProfile: function () {
      if (this._oSwitchProfilePopover) {
        this._oSwitchProfilePopover.close();
      }
    },

    /**
     * Called when a profile item is pressed in the Switch Profile popover.
     * Uses CustomData key="personaKey" to get the demo persona key.
     */
    onProfileItemPress: function (oEvent) {
      var item = oEvent.getParameter("listItem");
      if (!item) return;
      var personaKey = item.data("personaKey");
      if (!personaKey) return;
      if (this._oSwitchProfilePopover) this._oSwitchProfilePopover.close();
      this._switchPersona(personaKey);
    },

    _switchPersona: function (personaKey) {
      var that = this;
      fetch("/api/v1/demoLogin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaKey: personaKey })
      })
        .then(function (r) {
          if (!r.ok) throw new Error("Switch failed");
          return r.json();
        })
        .then(function (data) {
          var user;
          try {
            user = JSON.parse(data.value);
          } catch (e) {
            user = data.value || data;
          }
          sessionStorage.setItem("vr_user", JSON.stringify(user));
          MessageToast.show("Switched to: " + user.fullName + " (" + user.businessRole + ")");
          // Update model with new user context
          var model = that.getView().getModel("home");
          if (model) {
            model.setData({
              fullName:       user.fullName,
              businessRole:   user.businessRole,
              vendorCode:     user.vendorCode || null,
              email:          user.email,
              demoMode:       true,
              demoLabel:      "[DEMO MODE]",
              workbenchLabel: ROLE_LABELS[user.businessRole] || user.businessRole,
              kpis: {}
            });
            that._loadKpis(model);
          }
        })
        .catch(function (e) {
          MessageBox.error("Profile switch failed: " + e.message);
        });
    },

    /**
     * [DEMO] Resets all reconciliation runtime data to a clean state.
     * Preserves vendor master, PO/GR data, and user accounts.
     * NEVER resets real SAP data.
     */
    onResetDemo: function () {
      var that = this;
      MessageBox.confirm(
        "[DEMO MODE] This will reset all reconciliation data:\n\n" +
        "• Clears: MatchResults, Exceptions, VendorDocLines, StatementUploads, WorkflowHistory, AuditLog\n" +
        "• Preserves: VendorMaster, PurchaseOrders, GrirSnapshot, Users\n\n" +
        "This NEVER touches any real SAP data.\n\nProceed?",
        {
          title: "Reset Demo Data",
          actions: [MessageBox.Action.YES, MessageBox.Action.NO],
          emphasizedAction: MessageBox.Action.NO,
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.YES) {
              fetch("/api/v1/resetDemo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
              })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                  var result;
                  try {
                    result = JSON.parse(data.value);
                  } catch (e) {
                    result = { message: "Demo data reset complete." };
                  }
                  MessageBox.information(
                    result.message || "Demo data has been reset.",
                    { title: "Reset Complete" }
                  );
                  var model = that.getView().getModel("home");
                  if (model) model.setProperty("/kpis", {});
                })
                .catch(function (e) {
                  MessageBox.error("Reset failed: " + e.message);
                });
            }
          }
        }
      );
    },

    onLogout: function () {
      var that = this;
      MessageBox.confirm("Are you sure you want to log out?", {
        title: "Confirm Logout",
        actions: [MessageBox.Action.YES, MessageBox.Action.NO],
        emphasizedAction: MessageBox.Action.NO,
        onClose: function (sAction) {
          if (sAction === MessageBox.Action.YES) {
            sessionStorage.removeItem("vr_user");
            that.getOwnerComponent().getRouter().navTo("demologin");
          }
        }
      });
    }
  });
});