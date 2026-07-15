sap.ui.define(["sap/ui/core/mvc/Controller", "sap/m/MessageToast"], function (Controller, MessageToast) {
  return Controller.extend("vendordoclines.controller.Register", {
    onRegister: function () {
      const password = this.byId("regPassword").getValue();
      if (password !== this.byId("regConfirmPassword").getValue()) {
        return MessageToast.show("Passwords do not match");
      }
      const body = {
        fullName: this.byId("regFullName").getValue()?.trim(),
        username: this.byId("regUsername").getValue()?.trim(),
        email: this.byId("regEmail").getValue()?.trim(),
        password,
        businessRole: this.byId("regBusinessRole").getSelectedKey()
      };
      fetch("/api/v1/register", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      }).then(r => {
        if (!r.ok) throw new Error("Registration failed");
        MessageToast.show("Registered — please login");
        this.getOwnerComponent().getRouter().navTo("login");
      }).catch(e => MessageToast.show(e.message));
    },
    onGoLogin: function () {
      this.getOwnerComponent().getRouter().navTo("login");
    }
  });
});