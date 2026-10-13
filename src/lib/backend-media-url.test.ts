import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "./env";
import { resolveBackendMediaUrl } from "./backend-media-url";
const originalBase = env.NEXT_PUBLIC_API_BASE_URL;
afterEach(() => { env.NEXT_PUBLIC_API_BASE_URL = originalBase; vi.unstubAllEnvs(); });

describe("media host boundaries", () => {
  it("leaves third-party uploads and signed URLs on their original host", () => {
    const url = "https://cdn.example.com/uploads/profile-photos/user.webp?signature=secret";
    expect(resolveBackendMediaUrl(url)).toBe(url);
    expect(resolveBackendMediaUrl("//cdn.example.com/uploads/default-avatars/user.png")).toBe("//cdn.example.com/uploads/default-avatars/user.png");
  });
  it("normalizes same-origin upload paths to use the app upload rewrite", () => {
    env.NEXT_PUBLIC_API_BASE_URL = "";
    expect(resolveBackendMediaUrl("uploads/default-avatars/user.png")).toBe("/uploads/default-avatars/user.png");
  });
  it("only rebinds an explicitly known backend origin", () => {
    env.NEXT_PUBLIC_API_BASE_URL = "";
    vi.stubEnv("NEXT_PUBLIC_BACKEND_ORIGIN", "https://backend.example.com");
    expect(resolveBackendMediaUrl("https://backend.example.com/uploads/user.png?version=1")).toBe("/uploads/user.png?version=1");
    expect(resolveBackendMediaUrl("https://third-party.example.com/uploads/user.png")).toBe("https://third-party.example.com/uploads/user.png");
  });
});
