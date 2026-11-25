// Sets <html data-ui="v1|v2"> from the ui-theme cookie before first paint, so
// Theme 2 styles (scoped to html[data-ui="v2"]) apply without a flash. The
// dashboard layout reads the same cookie on the server to pick the frame.
(function () {
  try {
    var match = document.cookie.match(/(?:^|;\s*)ui-theme=([^;]+)/);
    document.documentElement.setAttribute("data-ui", match && match[1] === "v2" ? "v2" : "v1");
  } catch (error) {
    document.documentElement.setAttribute("data-ui", "v1");
  }
})();
