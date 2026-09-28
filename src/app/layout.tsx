import type { Metadata, Viewport } from "next";
import { Comfortaa } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionExpiryGuard } from "@/components/auth/session-expiry-guard";
import { SuccessAlertOverlay } from "@/components/success-alert-overlay";
import { ErrorAlertOverlay } from "@/components/error-alert-overlay";
import { PwaProvider } from "@/components/pwa-provider";
import { AppFluentThemeProvider } from "@/components/fluent-theme-provider";
import "./globals.css";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";

const comfortaa = Comfortaa({
  variable: "--font-comfortaa",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const accentBootstrapScript = `
  (function () {
    try {
      var storageKey = "hrms.accent.color";
      var fallback = "#303194";
      var stored = (window.localStorage.getItem(storageKey) || "").trim();
      var normalized = stored.toLowerCase();
      var valid = /^#[0-9a-f]{6}$/i.test(stored) && normalized !== "#111111" && normalized !== "#000000";
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
    } catch (_) {}
  })();
`;

export const metadata: Metadata = {
  applicationName: env.NEXT_PUBLIC_APP_NAME,
  title: {
    default: env.NEXT_PUBLIC_APP_NAME,
    template: `%s | ${env.NEXT_PUBLIC_APP_NAME}`,
  },
  description: "Alliance HRMS for attendance, leave, approvals, and reporting.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: env.NEXT_PUBLIC_APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#303194",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", comfortaa.variable, comfortaa.className)}
    >
      <body className="flex min-h-full flex-col">
        <Script id="hrms-accent-bootstrap" strategy="beforeInteractive">
          {accentBootstrapScript}
        </Script>
        <ThemeProvider>
          <AppFluentThemeProvider>
            <PwaProvider />
            <SessionExpiryGuard />
            <TooltipProvider>
              {children}
              <SuccessAlertOverlay />
              <ErrorAlertOverlay />
              <Toaster />
            </TooltipProvider>
          </AppFluentThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
