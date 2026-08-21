import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveNotificationsSocketOrigin,
  resolveNotificationsSocketUrl,
} from "./notifications-store";

describe("notifications socket URL resolution", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers the current browser origin to avoid cross-origin polling", () => {
    vi.stubGlobal("window", {
      location: {
        origin: "http://192.168.1.50:3000",
        protocol: "http:",
      },
    });

    expect(resolveNotificationsSocketOrigin()).toBe("http://192.168.1.50:3000");
    expect(resolveNotificationsSocketUrl()).toBe("http://192.168.1.50:3000/notifications");
  });
});
