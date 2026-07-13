sap.ui.define(["sap/ui/core/mvc/Controller", "sap/m/MessageToast"], function (Controller, MessageToast) {
  return Controller.extend("vendordoclines.controller.Login", {
    onInit: function () {
      this.getOwnerComponent().getRouter().getRoute("login").attachPatternMatched(this._onObjectMatched, this);
    },
    _onObjectMatched: function () {
      const user = JSON.parse(sessionStorage.getItem("vr_user") || "{}");
      if (user.username) {
        this.getOwnerComponent().getRouter().navTo("home");
      } else {
        const lastUsername = localStorage.getItem("vr_last_username");
        if (lastUsername) {
          const usernameInput = this.byId("loginUsername");
          if (usernameInput) {
            usernameInput.setValue(lastUsername);
          }
        }
      }
    },
    onLogin: function () {
      const username = this.byId("loginUsername").getValue();
      const password = this.byId("loginPassword").getValue();
      fetch("/api/v1/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      }).then(r => {
        if (!r.ok) throw new Error("Invalid credentials");
        return r.json();
      }).then(data => {
        const user = JSON.parse(data.value);
        sessionStorage.setItem("vr_user", JSON.stringify(user));
        localStorage.setItem("vr_last_username", username);
        this.getOwnerComponent().getRouter().navTo("home");
      }).catch(e => MessageToast.show(e.message));
    },
    onGoRegister: function () {
      this.getOwnerComponent().getRouter().navTo("register");
    }
  });
});