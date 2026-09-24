import { afterEach, describe, expect, it } from "vitest";

import nextConfig, { resolveBackendOrigin } from "./next.config";

describe("next rewrites", () => {
  afterEach(() => {
    delete process.env.APP_ENV;
    delete process.env.BACKEND_ORIGIN;
    delete process.env.NEXT_PUBLIC_BACKEND_ORIGIN;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  });

  it("proxies Socket.IO and same-origin API paths to the backend origin", async () => {
    const rewrites = await nextConfig.rewrites?.();
    expect(rewrites).toEqual(
      expect.arrayContaining([
        {
          source: "/socket.io",
          destination: "http://localhost:8888/socket.io",
        },
        {
          source: "/socket.io/:path*",
          destination: "http://localhost:8888/socket.io/:path*",
        },
        {
          source: "/api/:path*",
          destination: "http://localhost:8888/api/:path*",
        },
      ]),
    );
  });

  it("uses the UAT backend port when same-origin API is configured in UAT", () => {
    process.env.APP_ENV = "uat";
    process.env.NEXT_PUBLIC_API_BASE_URL = "/api";

    expect(resolveBackendOrigin()).toBe("http://127.0.0.1:9999");
  });

  it("lets an explicit backend origin override the environment default", () => {
    process.env.APP_ENV = "uat";
    process.env.NEXT_PUBLIC_API_BASE_URL = "/api";
    process.env.BACKEND_ORIGIN = "http://10.0.0.5:7777/api";

    expect(resolveBackendOrigin()).toBe("http://10.0.0.5:7777");
  });
});
