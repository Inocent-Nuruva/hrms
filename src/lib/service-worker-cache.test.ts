import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const remove = vi.fn().mockResolvedValue(true);
  const caches = {
    keys: vi.fn().mockResolvedValue(["hrms-static-v2", "hrms-runtime-v2", "hrms-static-v3"]),
    delete: remove,
    match: vi.fn(),
    open: vi.fn(),
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: { location: { origin: "https://hrms.example" }, clients: { claim: vi.fn() }, addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; } },
    URL, caches, fetch: vi.fn(), Promise,
  });
  return { handlers, remove };
}

describe("service worker session isolation", () => {
  it("does not intercept authenticated or API requests", () => {
    const { handlers } = worker();
    for (const path of ["/api/users/me", "/uploads/private", "/other"]) {
      const respondWith = vi.fn();
      handlers.fetch({ request: { method: "GET", url: `https://hrms.example${path}`, mode: "cors", headers: new Headers() }, respondWith });
      expect(respondWith).not.toHaveBeenCalled();
    }
  });

  it("removes caches from the vulnerable worker on activation", async () => {
    const { handlers, remove } = worker();
    let completion: Promise<unknown> | undefined;
    handlers.activate({ waitUntil: (promise: Promise<unknown>) => { completion = promise; } });
    await completion;
    expect(remove).toHaveBeenCalledWith("hrms-runtime-v2");
    expect(remove).toHaveBeenCalledWith("hrms-static-v2");
    expect(remove).not.toHaveBeenCalledWith("hrms-static-v3");
  });
});
