(function () {
  try {
    var storageKey = "hrms.accent.color";
    var fallback = "#303194";
    var stored = (window.localStorage.getItem(storageKey) || "").trim();
    var normalized = stored.toLowerCase();
    var valid =
      /^#[0-9a-f]{6}$/i.test(stored) &&
      normalized !== "#111111" &&
      normalized !== "#000000";
    var accent = valid ? stored : fallback;
    if (accent !== stored) window.localStorage.setItem(storageKey, accent);

    var value = parseInt(accent.slice(1), 16);
    var red = (value >> 16) & 255;
    var green = (value >> 8) & 255;
    var blue = value & 255;
    var rgb = red + " " + green + " " + blue;
    var header = "rgba(" + red + ", " + green + ", " + blue + ", 0.14)";
    var rail = "rgba(" + red + ", " + green + ", " + blue + ", 0.10)";
    var railBorder = "rgba(" + red + ", " + green + ", " + blue + ", 0.16)";
    var root = document.documentElement;

    root.style.setProperty("--sidebar-icon-color", accent);
    root.style.setProperty("--sidebar-active-link-color", accent);
    root.style.setProperty("--table-header-accent", accent);
    root.style.setProperty("--table-header-accent-bg", header);
    root.style.setProperty("--section-tab-rail-bg", rail);
    root.style.setProperty("--section-tab-rail-border", railBorder);
    root.style.setProperty("--primary", accent);
    root.style.setProperty("--primary-foreground", "#ffffff");
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-foreground", "#ffffff");
    root.style.setProperty("--ring", accent);
    root.style.setProperty("--primary-rgb", rgb);
  } catch {}
})();
