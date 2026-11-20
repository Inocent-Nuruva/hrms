"use client";

import { useEffect } from "react";
import { subscribeToDashboardActorSnapshot } from "@/lib/dashboard-permissions";
import { readStoredSessionTokens } from "@/lib/session-client";
import { disableBrowserPush, syncBrowserPush } from "@/lib/browser-push";
import { showNotificationPopup } from "@/lib/notification-popups";

const SW_URL = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1";

export function PwaProvider() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SW_URL, {
          scope: "/",
          updateViaCache: "none",
        });

        await registration.update();
      } catch (error) {
        console.error("PWA service worker registration failed", error);
      }
    };

    void register();

    let lastToken = "";
    const sync = () => {
      const token = readStoredSessionTokens().accessToken;
      if (!token && lastToken) {
        const previousToken = lastToken;
        lastToken = "";
        void disableBrowserPush(previousToken).catch(() => {});
        return;
      }
      if (!token || token === lastToken) return;
      lastToken = token;
      void syncBrowserPush(token).catch((error) => {
        console.warn("Browser notification subscription could not be refreshed.", error);
      });
    };
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === "hrms:web-push" && data.notification && typeof data.notification === "object") {
        showNotificationPopup(data.notification);
      }
    };
    const unsubscribe = subscribeToDashboardActorSnapshot(sync);
    navigator.serviceWorker.addEventListener("message", onMessage);
    window.addEventListener("focus", sync);
    sync();
    return () => {
      unsubscribe();
      navigator.serviceWorker.removeEventListener("message", onMessage);
      window.removeEventListener("focus", sync);
    };
  }, []);

  return null;
}
