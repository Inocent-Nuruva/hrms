import { afterEach, describe, expect, it, vi } from "vitest";
import { withAuthSessionLock } from "./auth-session-lock";

afterEach(() => vi.unstubAllGlobals());

describe("authentication session lock", () => {
  it("does not submit a competing refresh if origin storage is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("indexedDB", {
      open() {
        throw new Error("Browser storage unavailable");
      },
    });
    const work = vi.fn();
    await expect(withAuthSessionLock(work)).rejects.toThrow(
      "Browser storage unavailable",
    );
    expect(work).not.toHaveBeenCalled();
  });

  it("uses the browser lock for cross-tab coordination", async () => {
    const request = vi.fn(async (_name: string, work: () => Promise<number>) =>
      work(),
    );
    vi.stubGlobal("navigator", { locks: { request } });
    await expect(withAuthSessionLock(async () => 42)).resolves.toBe(42);
    expect(request).toHaveBeenCalledWith(
      "hrms.auth.session",
      expect.any(Function),
    );
  });
});
