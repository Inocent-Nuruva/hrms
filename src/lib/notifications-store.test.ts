import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveNotificationsSocketOrigin,
  resolveNotificationsSocketUrl,
} from "./notifications-store";

describe("notifications socket URL resolution", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("prefers the configured API origin over the browser origin", () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://192.168.1.30:9999/api");
    vi.stubGlobal("window", {
      location: {
        origin: "http://192.168.1.50:3000",
        protocol: "http:",
      },
    });

    expect(resolveNotificationsSocketOrigin()).toBe("http://192.168.1.30:9999");
    expect(resolveNotificationsSocketUrl()).toBe("http://192.168.1.30:9999/notifications");
  });

  it("uses the browser origin when no API origin is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    vi.stubGlobal("window", {
      location: {
        origin: "http://192.168.1.50:3000",
        protocol: "http:",
      },
    });

    expect(resolveNotificationsSocketOrigin()).toBe("http://192.168.1.50:3000");
  });
});
