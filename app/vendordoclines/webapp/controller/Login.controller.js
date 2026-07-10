sap.ui.define(["sap/ui/core/mvc/Controller", "sap/m/MessageToast"], function (Controller, MessageToast) {
  return Controller.extend("vendordoclines.controller.Login", {
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
        this.getOwnerComponent().getRouter().navTo("home");
      }).catch(e => MessageToast.show(e.message));
    },
    onGoRegister: function () {
      this.getOwnerComponent().getRouter().navTo("register");
    }
  });
});