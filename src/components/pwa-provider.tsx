"use client";

import { useEffect } from "react";

const SW_URL = "/sw.js";

export function PwaProvider() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });
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
  }, []);

  return null;
}
