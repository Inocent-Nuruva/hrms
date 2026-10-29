import type { Metadata, Viewport } from "next";
import { Comfortaa } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionExpiryGuard } from "@/components/auth/session-expiry-guard";
import { PwaProvider } from "@/components/pwa-provider";
import { AppFluentThemeProvider } from "@/components/fluent-theme-provider";
import { AppTextScale } from "@/components/app-text-scale";
import "./globals.css";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";

const comfortaa = Comfortaa({
  variable: "--font-comfortaa",
  subsets: ["latin"],
  weight: ["400", "700"],
});

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
        <Script src="/hrms-accent-bootstrap.js" strategy="beforeInteractive" />
        <ThemeProvider>
          <AppFluentThemeProvider>
            <PwaProvider />
            <AppTextScale />
            <SessionExpiryGuard />
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </AppFluentThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
