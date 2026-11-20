import { describe, expect, it } from "vitest";
import { formatDeviceSyncFailure, formatDeviceSyncJob } from "./device-sync-feedback";

describe("device sync feedback", () => {
  it("explains failed template numbers and groups repeated device responses", () => {
    const message = formatDeviceSyncFailure({
      synced: 2, skipped: 0, failed: 6,
      results: Array.from({ length: 6 }, (_, index) => ({ template_no: String(index + 3), status: "FAILED", reason: "status=404" })),
    }, "Syncing templates");
    expect(message).toContain("2 synced, 0 skipped, 6 failed");
    expect(message).toContain("HTTP 404 (items 3, 4, 5, 6, 7 and 1 more)");
    expect(message).toContain("Logs tab");
  });

  it("reports missing details instead of claiming success", () => {
    expect(formatDeviceSyncFailure(null, "Syncing templates")).toContain("No details");
    expect(formatDeviceSyncJob({ state: "completed", result: {} }, "3").state).toBe("error");
  });

  it("displays the detailed reason returned by the device", () => {
    const message = formatDeviceSyncFailure({
      synced: 2, skipped: 0, failed: 1,
      results: [{ template_no: "3", status: "FAILED", reason: "Device returned HTTP 404: Invalid Content / badParameters" }],
    }, "Syncing templates");
    expect(message).toContain("Invalid Content / badParameters (items 3)");
  });

  it("distinguishes queued, failed, partial and successful jobs", () => {
    expect(formatDeviceSyncJob({ state: "waiting" }, "3").state).toBe("queued");
    expect(formatDeviceSyncJob({ state: "failed", failed_reason: "Device unreachable" }, "3").message).toContain("Device unreachable");
    expect(formatDeviceSyncJob({ state: "completed", result: { status: "PARTIAL", fingerprints: { received: 1, failed: 9 } } }, "3").message).toContain("1 received, 9 failed");
    expect(formatDeviceSyncJob({ state: "completed", result: { status: "SUCCESS", users: { received: 104, failed: 0 } } }, "3").state).toBe("success");
  });
});
