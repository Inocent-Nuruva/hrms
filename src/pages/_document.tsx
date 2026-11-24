import { Html, Head, Main, NextScript } from "next/document";

/**
 * Apply a saved theme before paint. Users without a saved choice start in
 * light mode rather than inheriting a device-wide dark preference.
 */
const themeInitScript = `
(function () {
  try {
    var key = "hrms.theme";
    var stored = (localStorage.getItem(key) || "").trim();
    var theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "light";
    var resolved = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    var root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  } catch (e) {}
})();
`;

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </Head>
      <body className="bg-background text-foreground antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
