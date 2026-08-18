import { describe, expect, it } from "vitest"

import {
  parseReadinessChecks,
  readinessIssueText,
  readinessPersonName,
} from "./employee-readiness-plain"

describe("employee readiness plain language", () => {
  const agatha = {
    employeeId: 15,
    employeeNo: "AICL/00015",
    fullName: "Agatha Kiiza",
    isReady: false,
    readinessScore: 86,
    checks: {
      isActiveEmployee: true,
      hasActiveUser: true,
      hasBranch: true,
      hasDepartment: true,
      hasTimetable: true,
      hasShift: true,
      hasDeviceAssignment: true,
      hasFingerprint: false,
      hasCardOrPin: false,
    },
    issues: "No active fingerprint registered",
  }

  it("reads checks from an object, not as JSON text", () => {
    const checks = parseReadinessChecks(agatha)
    expect(checks.hasShift).toBe(true)
    expect(checks.hasFingerprint).toBe(false)
  })

  it("uses the written issue instead of raw field names", () => {
    expect(readinessIssueText(agatha)).toBe("No active fingerprint registered")
    expect(readinessPersonName(agatha)).toBe("Agatha Kiiza")
  })
})
