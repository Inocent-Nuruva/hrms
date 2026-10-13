import { describe, expect, it, vi } from "vitest";

async function freshMonitoring() {
  vi.resetModules();
  return import("./error-monitoring");
}

describe("monitoring reporter lifecycle", () => {
  it("flushes a bounded early-error queue to a late SDK registration", async () => {
    const monitor = await freshMonitoring();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      for (let index = 0; index < 25; index++) {
        monitor.reportBoundaryError(new Error(`failure-${index}`), "render");
      }
      const reporter = vi.fn();
      const unregister = monitor.registerErrorReporter(reporter);
      expect(reporter).toHaveBeenCalledTimes(20);
      expect(reporter.mock.calls[0][0].message).toBe("failure-5");
      unregister();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("does not let old cleanup remove a newer SDK registration", async () => {
    const monitor = await freshMonitoring();
    const removeFirst = monitor.registerErrorReporter(vi.fn());
    const second = vi.fn().mockRejectedValue(new Error("offline"));
    const removeSecond = monitor.registerErrorReporter(second);
    removeFirst();
    monitor.reportBoundaryError(new Error("second reporter"), "render");
    await Promise.resolve();
    expect(second).toHaveBeenCalledTimes(1);
    removeSecond();
  });
});
