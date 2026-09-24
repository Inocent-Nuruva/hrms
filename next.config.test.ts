import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("next rewrites", () => {
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
});
