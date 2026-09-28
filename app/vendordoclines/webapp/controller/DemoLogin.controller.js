/**
 *DemoLogin.controller.js
 *
 *Handles zero-friction demo persona selection AND standard credential login.
 *DEMO MODE — no real SAP authentication.
 *
 *Tile ID suffix → backend personaKey mapping:
 *tile_admin          → 'admin'
 *tile_finance        → 'finance'
 *tile_gr             → 'gr_user'
 *tile_po             → 'po_user'
 *tile_pr             → 'pr_user'
 *tile_vendor_ar      → 'vendor_ar'
 *tile_vendor_billing → 'vendor_billing'
 *tile_supervisor     → 'supervisor'
 */
sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
  "use strict";

  // Map from GenericTile local ID suffix to backend personaKey
  var TILE_PERSONA_MAP = {
    "tile_admin":          "admin",
    "tile_finance":        "finance",
    "tile_gr":             "gr_user",
    "tile_po":             "po_user",
    "tile_pr":             "pr_user",
    "tile_vendor_ar":      "vendor_ar",
    "tile_vendor_billing": "vendor_billing",
    "tile_supervisor":     "supervisor"
  };

  return Controller.extend("vendordoclines.controller.DemoLogin", {

    onInit: function () {
      // If already logged in, redirect directly
      var user = this._getUser();
      if (user && user.username) {
        this.getOwnerComponent().getRouter().navTo("home");
      }

      try {
        this.getOwnerComponent().getRouter()
          .getRoute("demologin")
          .attachPatternMatched(this._onRouteMatched, this);
      } catch (e) {
        // Route may not exist yet during initial load
      }
    },

    _onRouteMatched: function () {
      var user = this._getUser();
      if (user && user.username) {
        this.getOwnerComponent().getRouter().navTo("home");
      }
    },

    _getUser: function () {
      try {
        return JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      } catch (e) {
        return {};
      }
    },

    _saveUser: function (user) {
      sessionStorage.setItem("vr_user", JSON.stringify(user));
    },

    /**
     * Called when a GenericTile persona tile is pressed.
     * Extracts persona key from tile ID and calls demoLogin backend action.
     * NO PASSWORD REQUIRED in demo mode.
     */
    onSelectPersona: function (oEvent) {
      var tile = oEvent.getSource();
      var tileId = tile.getId();
      // The control ID includes the view prefix (e.g., "__xmlview0--tile_admin")
      // Extract just the local ID suffix after the last "--"
      var localId = tileId.split("--").pop();
      var personaKey = TILE_PERSONA_MAP[localId];

      if (!personaKey) {
        // Fallback: try using the tile's id attribute directly
        var tileIdAttr = tile.data ? tile.data("personaKey") : null;
        personaKey = tileIdAttr || null;
      }

      if (!personaKey) {
        MessageToast.show("Unable to determine persona. Please try another tile.");
        return;
      }

      this._demoLoginRequest(personaKey);
    },

    _demoLoginRequest: function (personaKey) {
      var that = this;

      fetch("/api/v1/demoLogin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaKey: personaKey })
      })
        .then(function (r) {
          if (!r.ok) {
            return r.json().then(function (e) {
              throw new Error((e.error && e.error.message) || "Demo login failed");
            });
          }
          return r.json();
        })
        .then(function (data) {
          var user;
          try {
            user = JSON.parse(data.value);
          } catch (e) {
            user = data.value || data;
          }
          that._saveUser(user);
          MessageToast.show("Logged in as " + user.fullName + " (" + user.businessRole + ")");
          that.getOwnerComponent().getRouter().navTo("home");
        })
        .catch(function (e) {
          MessageBox.error("Demo login failed: " + e.message);
        });
    },

    /**
     * Standard credential-based login (fallback for non-demo scenarios).
     */
    onLogin: function () {
      var username = (this.byId("loginUsername") && this.byId("loginUsername").getValue() || "").trim();
      var password = (this.byId("loginPassword") && this.byId("loginPassword").getValue()) || "";
      var that = this;

      if (!username) {
        MessageToast.show("Please enter a username.");
        return;
      }

      fetch("/api/v1/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username, password: password })
      })
        .then(function (r) {
          if (!r.ok) throw new Error("Invalid credentials");
          return r.json();
        })
        .then(function (data) {
          var user;
          try {
            user = JSON.parse(data.value);
          } catch (e) {
            user = data.value || data;
          }
          that._saveUser(user);
          that.getOwnerComponent().getRouter().navTo("home");
        })
        .catch(function (e) {
          MessageBox.error("Sign in failed: " + e.message);
        });
    }
  });
});
