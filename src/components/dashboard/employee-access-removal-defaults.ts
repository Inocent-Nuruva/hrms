export function initialRemovalChoices(
  deviceIds: string[],
  groupIds: string[],
  preferredDeviceId?: string | number | null,
  preferredGroupId?: string | number | null,
) {
  return {
    devices: Object.fromEntries(deviceIds.map((id) => [id, preferredDeviceId != null && String(preferredDeviceId) === id])),
    groups: Object.fromEntries(groupIds.map((id) => [id, preferredGroupId != null && String(preferredGroupId) === id])),
    disableFingerprintsOnSelectedDevices: false,
    endShiftAssignments: false,
    archiveEmployee: false,
    suspendEmployee: false,
    terminateEmployee: false,
  }
}
