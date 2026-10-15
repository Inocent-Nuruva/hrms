import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig, { resolveBackendOrigin } from "./next.config";

afterEach(() => vi.unstubAllEnvs());
function resetBackendEnvironment() {
  for (const key of ["INTERNAL_BACKEND_URL", "BACKEND_ORIGIN", "NEXT_PUBLIC_BACKEND_ORIGIN", "NEXT_PUBLIC_API_BASE_URL", "APP_ENV"]) {
    vi.stubEnv(key, "");
  }
}

describe("backend rewrites", () => {
  it("proxies uploads before static files and leaves local API handlers ahead of API rewrites", async () => {
    resetBackendEnvironment();
    const rewrites = await nextConfig.rewrites!();
    expect(rewrites).toEqual({
      beforeFiles: [{ source: "/uploads/:path*", destination: "http://localhost:8888/uploads/:path*" }],
      afterFiles: [
        { source: "/socket.io", destination: "http://localhost:8888/socket.io" },
        { source: "/socket.io/:path*", destination: "http://localhost:8888/socket.io/:path*" },
        { source: "/api/:path*", destination: "http://localhost:8888/api/:path*" },
      ],
      fallback: [],
    });
  });

  it("uses the UAT port with same-origin API configuration", () => {
    resetBackendEnvironment(); vi.stubEnv("APP_ENV", "uat"); vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    expect(resolveBackendOrigin()).toBe("http://127.0.0.1:9999");
  });

  it("accepts an explicit absolute backend origin ending in /api", () => {
    resetBackendEnvironment(); vi.stubEnv("BACKEND_ORIGIN", "http://10.0.0.5:7777/api");
    expect(resolveBackendOrigin()).toBe("http://10.0.0.5:7777");
  });

  it("prioritizes the internal origin for upload routing", async () => {
    resetBackendEnvironment(); vi.stubEnv("INTERNAL_BACKEND_URL", "https://backend.example.com:444/api/");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    const rules = await nextConfig.rewrites!();
    expect(!Array.isArray(rules) && rules.beforeFiles?.[0]?.destination).toBe("https://backend.example.com:444/uploads/:path*");
  });

  it.each(["/relative", "file:///tmp/uploads", "https://user:pass@backend.example.com", "https://backend.example.com/custom", "https://backend.example.com?target=other"])(
    "rejects invalid backend origin %s", (origin) => {
      resetBackendEnvironment(); vi.stubEnv("INTERNAL_BACKEND_URL", origin);
      expect(resolveBackendOrigin).toThrow();
    },
  );
});
