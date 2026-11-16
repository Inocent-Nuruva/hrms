import { describe, expect, it, vi } from "vitest";
import { sendReadyContract } from "./contract-workspace-send";

describe("send readiness", () => {
  it("never sends after a failed save or a failed readiness check", async () => {
    const send = vi.fn();
    const confirm = vi.fn(async () => true);
    const readiness = vi.fn(async () => ({
      ready: false,
      field_errors: {},
      missing_fields: [],
      warnings: {},
      signatory_id: null,
    }));
    expect(
      (
        await sendReadyContract({
          flush: async () => false,
          readiness,
          confirm,
          send,
        })
      ).outcome,
    ).toBe("unsaved");
    expect(readiness).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(
      (
        await sendReadyContract({
          flush: async () => true,
          readiness,
          confirm,
          send,
        })
      ).outcome,
    ).toBe("not_ready");
    expect(confirm).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
  it("saves, rechecks, confirms and then sends in order", async () => {
    const steps: string[] = [];
    const result = await sendReadyContract({
      flush: async () => {
        steps.push("save");
        return true;
      },
      readiness: async () => {
        steps.push("ready");
        return {
          ready: true,
          field_errors: {},
          missing_fields: [],
          warnings: {},
          signatory_id: 1,
        };
      },
      confirm: async () => {
        steps.push("confirm");
        return true;
      },
      send: async () => {
        steps.push("send");
      },
    });
    expect(result.outcome).toBe("sent");
    expect(steps).toEqual(["save", "ready", "confirm", "send"]);
  });
});
