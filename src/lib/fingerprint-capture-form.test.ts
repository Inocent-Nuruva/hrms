import { describe, expect, it } from "vitest";
import { canCaptureFingerprint } from "./fingerprint-capture-form";

describe("fingerprint capture readiness", () => {
  it("requires a supported verify mode and an explicitly selected unused slot", () => {
    expect(canCaptureFingerprint(false, "1", [])).toBe(false);
    expect(canCaptureFingerprint(true, "", [])).toBe(false);
    expect(canCaptureFingerprint(true, "1", ["1"])).toBe(false);
    expect(canCaptureFingerprint(true, "11", [])).toBe(false);
    expect(canCaptureFingerprint(true, "2", ["1"])).toBe(true);
  });

  it("accepts every available slot from 1 through 10", () => {
    for (let slot = 1; slot <= 10; slot += 1) {
      expect(canCaptureFingerprint(true, String(slot), [])).toBe(true);
    }
    expect(canCaptureFingerprint(true, "0", [])).toBe(false);
    expect(canCaptureFingerprint(true, "11", [])).toBe(false);
  });
});
