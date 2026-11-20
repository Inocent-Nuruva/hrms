import { describe, expect, it } from "vitest"
import { initialRemovalChoices } from "./employee-access-removal-defaults"

describe("access removal defaults", () => {
  it("selects only the requested group and never selects employee lifecycle actions", () => {
    expect(initialRemovalChoices(["7"], ["4", "5"], null, 4)).toEqual({
      devices: { "7": false }, groups: { "4": true, "5": false },
      disableFingerprintsOnSelectedDevices: false, endShiftAssignments: false,
      archiveEmployee: false, suspendEmployee: false, terminateEmployee: false,
    })
  })
  it("selects only the requested device when opened from a device", () => {
    const choices = initialRemovalChoices(["7", "8"], ["4"], 8, null)
    expect(choices.devices).toEqual({ "7": false, "8": true })
    expect(choices.groups).toEqual({ "4": false })
    expect(choices.archiveEmployee).toBe(false)
  })
})
