import type { AppProps } from "next/app";
import { Comfortaa } from "next/font/google";
import App from "@/App";
import { SessionExpiryGuard } from "@/components/auth/session-expiry-guard";
import { ThemeProvider } from "@/components/theme-provider";
import { AppFluentThemeProvider } from "@/components/fluent-theme-provider";
import { AppTextScale } from "@/components/app-text-scale";
import "@/app/globals.css";

const comfortaa = Comfortaa({
  variable: "--font-comfortaa",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export default function MyApp(props: AppProps) {
  return (
    <main className={`${comfortaa.variable} ${comfortaa.className}`}>
      <ThemeProvider>
        <AppFluentThemeProvider>
          <AppTextScale />
          <SessionExpiryGuard />
          <App {...props} />
        </AppFluentThemeProvider>
      </ThemeProvider>
    </main>
  );
}
