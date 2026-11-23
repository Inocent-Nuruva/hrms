import { describe, expect, it } from "vitest"
import { canQueueAttendancePunch, requiresAttendanceSelfie } from "../../android/src/lib/attendance-punch-policy"

describe("native attendance policy", () => {
  it("uses the separate selfie requirement for each punch direction", () => {
    const policy = { require_selfie_for_check_in: false, require_selfie_for_check_out: true }
    expect(requiresAttendanceSelfie(policy, "in")).toBe(false)
    expect(requiresAttendanceSelfie(policy, "out")).toBe(true)
  })

  it("queues a network failure only when the policy allows mobile offline punches without a QR token", () => {
    const network = new TypeError("Network request failed")
    const policy = { allow_mobile_punches: true, allow_offline_punches: true }
    expect(canQueueAttendancePunch(policy, network, null)).toBe(true)
    expect(canQueueAttendancePunch(policy, network, "online-qr")).toBe(false)
    expect(canQueueAttendancePunch(policy, new Error("Attendance denied"), null)).toBe(false)
    expect(canQueueAttendancePunch({ ...policy, allow_mobile_punches: false }, network, null)).toBe(false)
    expect(canQueueAttendancePunch({}, network, null)).toBe(false)
  })
})
