import { describe, expect, it } from "vitest"

import { describeDeviceProvisioning } from "./onboarding-device-provisioning-status"

const base = {
  id: 7,
  status: "failed" as const,
  attempt_count: 8,
  max_attempts: 8,
  exhausted: true,
  last_error: "Device offline",
  next_retry_at: null,
  failed_at: "2026-11-06T08:00:00.000Z",
  completed_at: null,
  device_count: 2,
}

describe("device provisioning status", () => {
  it("offers a retry once automatic attempts are exhausted", () => {
    const view = describeDeviceProvisioning(base)
    expect(view.intent).toBe("error")
    expect(view.canRetry).toBe(true)
    expect(view.body).toContain("Device offline")
  })

  it("still allows a retry while backing off between attempts", () => {
    const view = describeDeviceProvisioning({ ...base, exhausted: false, attempt_count: 3 })
    expect(view.intent).toBe("warning")
    expect(view.body).toContain("Attempt 3 of 8")
    expect(view.canRetry).toBe(true)
  })

  it("has nothing to retry when done or in progress", () => {
    expect(describeDeviceProvisioning({ ...base, status: "completed", exhausted: false }).canRetry).toBe(false)
    expect(describeDeviceProvisioning({ ...base, status: "pending", exhausted: false }).canRetry).toBe(false)
  })
})
