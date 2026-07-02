sap.ui.define(
  ["sap/ui/core/ComponentContainer"],
  function (ComponentContainer) {
    "use strict";

    new ComponentContainer({
      name: "sap.ui.demo.app",
      settings: {
        id: "app",
      },
      async: true,
    }).placeAt("content");
  },
);
