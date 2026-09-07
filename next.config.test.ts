import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("next socket rewrites", () => {
  it("proxies the Socket.IO engine path to the backend origin", async () => {
    const rewrites = await nextConfig.rewrites?.();
    expect(rewrites).toEqual(
      expect.arrayContaining([
        {
          source: "/socket.io",
          destination: "http://localhost:9999/socket.io",
        },
        {
          source: "/socket.io/:path*",
          destination: "http://localhost:9999/socket.io/:path*",
        },
      ]),
    );
  });
});
