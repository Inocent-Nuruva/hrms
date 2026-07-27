"use client"

import * as React from "react"

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import {
  listAccessControlResources,
  listAccessGroupEmployees,
  listEmployeeDevices,
  listEmployeeDeviceFingerprints,
  listShiftResources,
  patchEmployeeStatus,
  patchShiftResourceById,
  removeAccessGroupEmployee,
  removeEmployeeDeviceAssignment,
  disableEmployeeDeviceFingerprint,
  type AdminRecord,
  type EmployeeStatusPayload,
} from "@/lib/admin-api"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
import { cn } from "@/lib/utils"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

function readStoredToken() {
  if (typeof window === "undefined") return ""
  const direct = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
  if (direct) return direct
  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (!authTokensRaw) return ""
  try {
    const parsed = JSON.parse(authTokensRaw) as { accessToken?: string; access_token?: string }
    return (parsed.accessToken ?? parsed.access_token ?? "").trim()
  } catch {
    return ""
  }
}

function readNumber(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function readString(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return null
}

export type EmployeeAccessRemovalTarget = {
  employeeId: number
  employeeName: string
  employeeNo?: string | null
  /** When opened from a device page, that device is pre-selected. */
  preferredDeviceId?: string | number | null
  preferredDeviceLabel?: string | null
  /** When opened from an access group page. */
  preferredGroupId?: string | number | null
  preferredGroupLabel?: string | null
}

type DeviceOption = {
  id: string
  label: string
}

type GroupOption = {
  id: string
  label: string
}

type ShiftOption = {
  id: string
  label: string
}

type RemovalChoices = {
  devices: Record<string, boolean>
  groups: Record<string, boolean>
  disableFingerprintsOnSelectedDevices: boolean
  endShiftAssignments: boolean
  suspendEmployee: boolean
  terminateEmployee: boolean
}

type Step = "choose" | "confirm" | "running" | "done"

type Props = {
  open: boolean
  target: EmployeeAccessRemovalTarget | null
  onOpenChange: (open: boolean) => void
  onCompleted?: () => void
}

function emptyChoices(): RemovalChoices {
  return {
    devices: {},
    groups: {},
    disableFingerprintsOnSelectedDevices: true,
    endShiftAssignments: false,
    suspendEmployee: false,
    terminateEmployee: false,
  }
}

export function EmployeeAccessRemovalDialog({ open, target, onOpenChange, onCompleted }: Props) {
  const [step, setStep] = React.useState<Step>("choose")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [devices, setDevices] = React.useState<DeviceOption[]>([])
  const [groups, setGroups] = React.useState<GroupOption[]>([])
  const [shifts, setShifts] = React.useState<ShiftOption[]>([])
  const [choices, setChoices] = React.useState<RemovalChoices>(emptyChoices)
  const [results, setResults] = React.useState<string[]>([])
  const [progressLabel, setProgressLabel] = React.useState("")

  const reset = React.useCallback(() => {
    setStep("choose")
    setLoading(false)
    setError(null)
    setDevices([])
    setGroups([])
    setShifts([])
    setChoices(emptyChoices())
    setResults([])
    setProgressLabel("")
  }, [])

  React.useEffect(() => {
    if (!open || !target) {
      return
    }

    let cancelled = false
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }

    setLoading(true)
    setError(null)
    setStep("choose")
    setResults([])

    void (async () => {
      const nextDevices: DeviceOption[] = []
      const nextGroups: GroupOption[] = []
      const nextShifts: ShiftOption[] = []
      const deviceMap = new Map<string, DeviceOption>()
      const groupMap = new Map<string, GroupOption>()

      const addDevice = (id: string | number | null, label?: string | null) => {
        if (id === null || id === undefined || String(id).trim() === "") return
        const key = String(id)
        if (deviceMap.has(key)) return
        deviceMap.set(key, {
          id: key,
          label: (label && label.trim()) || `Device #${key}`,
        })
      }

      const addGroup = (id: string | number | null, label?: string | null) => {
        if (id === null || id === undefined || String(id).trim() === "") return
        const key = String(id)
        if (groupMap.has(key)) return
        groupMap.set(key, {
          id: key,
          label: (label && label.trim()) || `Access group #${key}`,
        })
      }

      if (target.preferredDeviceId != null) {
        addDevice(target.preferredDeviceId, target.preferredDeviceLabel)
      }
      if (target.preferredGroupId != null) {
        addGroup(target.preferredGroupId, target.preferredGroupLabel)
      }

      try {
        const deviceRows = await listEmployeeDevices(token, target.employeeId)
        deviceRows.forEach((row) => {
          const id = readNumber(row, ["device_id", "deviceId", "attendance_device_id", "id"])
          const label =
            readString(row, [
              "device_name",
              "deviceName",
              "name",
              "device_code",
              "deviceCode",
            ]) ?? null
          addDevice(id, label)
          const groupId = readNumber(row, ["access_group_id", "accessGroupId", "group_id"])
          const groupLabel = readString(row, ["access_group_name", "accessGroupName", "group_name"])
          addGroup(groupId, groupLabel)
        })
      } catch {
        // Endpoint may be unavailable; keep preferred device if any.
      }

      try {
        const groupsResult = await listAccessControlResources(token, "groups", {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        })
        const groupRows = groupsResult.rows
        // Cap membership probes to keep the dialog snappy.
        const probes = groupRows.slice(0, 40)
        const membershipChecks = await Promise.allSettled(
          probes.map(async (group: AdminRecord) => {
            const groupId = readNumber(group, ["id", "access_group_id", "group_id"])
            if (groupId === null) return null
            if (groupMap.has(String(groupId))) return null
            const members = await listAccessGroupEmployees(token, groupId)
            const isMember = members.some((member) => {
              const memberId = readNumber(member, [
                "resolved_employee_id",
                "employee_id",
                "employeeId",
                "id",
              ])
              return memberId === target.employeeId
            })
            if (!isMember) return null
            return {
              id: String(groupId),
              label:
                readString(group, ["name", "title", "group_name", "groupName"]) ??
                `Access group #${groupId}`,
            }
          })
        )
        membershipChecks.forEach((result) => {
          if (result.status === "fulfilled" && result.value) {
            groupMap.set(result.value.id, result.value)
          }
        })
      } catch {
        // Optional discovery.
      }

      try {
        const shiftResult = await listShiftResources(token, "shift-assignments", {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
          // Some backends accept employee_id filter via search; we filter client-side.
        })
        shiftResult.rows.forEach((row) => {
          const employeeId = readNumber(row, ["employee_id", "employeeId"])
          if (employeeId !== target.employeeId) return
          const id = readNumber(row, ["id", "assignment_id", "shift_assignment_id"])
          if (id === null) return
          const shiftName =
            readString(row, ["shift_name", "shiftName", "name", "title"]) ?? `Shift assignment #${id}`
          nextShifts.push({ id: String(id), label: shiftName })
        })
      } catch {
        // Optional.
      }

      nextDevices.push(...Array.from(deviceMap.values()))
      nextGroups.push(...Array.from(groupMap.values()))

      if (cancelled) return

      setDevices(nextDevices)
      setGroups(nextGroups)
      setShifts(nextShifts)

      const deviceChoices: Record<string, boolean> = {}
      nextDevices.forEach((device) => {
        const preferred =
          target.preferredDeviceId != null && String(target.preferredDeviceId) === device.id
        deviceChoices[device.id] = preferred || nextDevices.length === 1
      })
      const groupChoices: Record<string, boolean> = {}
      nextGroups.forEach((group) => {
        const preferred =
          target.preferredGroupId != null && String(target.preferredGroupId) === group.id
        groupChoices[group.id] = preferred
      })

      setChoices({
        devices: deviceChoices,
        groups: groupChoices,
        disableFingerprintsOnSelectedDevices: true,
        endShiftAssignments: nextShifts.length > 0,
        suspendEmployee: false,
        terminateEmployee: false,
      })
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [open, target])

  React.useEffect(() => {
    if (!open) {
      // Keep state briefly for exit animation; reset on next open.
      const timer = window.setTimeout(() => reset(), 200)
      return () => window.clearTimeout(timer)
    }
  }, [open, reset])

  const selectedDeviceIds = React.useMemo(
    () => Object.entries(choices.devices).filter(([, on]) => on).map(([id]) => id),
    [choices.devices]
  )
  const selectedGroupIds = React.useMemo(
    () => Object.entries(choices.groups).filter(([, on]) => on).map(([id]) => id),
    [choices.groups]
  )

  const hasAnyAction =
    selectedDeviceIds.length > 0 ||
    selectedGroupIds.length > 0 ||
    (choices.endShiftAssignments && shifts.length > 0) ||
    choices.suspendEmployee ||
    choices.terminateEmployee

  const summaryLines = React.useMemo(() => {
    const lines: string[] = []
    selectedDeviceIds.forEach((id) => {
      const device = devices.find((item) => item.id === id)
      lines.push(`Remove from device: ${device?.label ?? id}`)
    })
    if (choices.disableFingerprintsOnSelectedDevices && selectedDeviceIds.length > 0) {
      lines.push("Disable fingerprints on selected devices (best effort)")
    }
    selectedGroupIds.forEach((id) => {
      const group = groups.find((item) => item.id === id)
      lines.push(`Remove from access group: ${group?.label ?? id}`)
    })
    if (choices.endShiftAssignments && shifts.length > 0) {
      lines.push(`End ${shifts.length} shift assignment(s)`)
    }
    if (choices.suspendEmployee) {
      lines.push("Set employment status to Suspended")
    }
    if (choices.terminateEmployee) {
      lines.push("Set employment status to Terminated")
    }
    return lines
  }, [
    choices.disableFingerprintsOnSelectedDevices,
    choices.endShiftAssignments,
    choices.suspendEmployee,
    choices.terminateEmployee,
    devices,
    groups,
    selectedDeviceIds,
    selectedGroupIds,
    shifts.length,
  ])

  const runRemoval = async () => {
    if (!target) return
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }
    if (!hasAnyAction) {
      setError("Select at least one place to remove or disable.")
      return
    }

    setStep("running")
    setError(null)
    const outcome: string[] = []
    const failures: string[] = []

    const runStep = async (label: string, fn: () => Promise<void>) => {
      setProgressLabel(label)
      try {
        await fn()
        outcome.push(`✓ ${label}`)
      } catch (errorObject) {
        const message = errorObject instanceof Error ? errorObject.message : "Failed"
        failures.push(`✗ ${label}: ${message}`)
        outcome.push(`✗ ${label}: ${message}`)
      }
    }

    for (const deviceId of selectedDeviceIds) {
      const deviceLabel = devices.find((d) => d.id === deviceId)?.label ?? deviceId

      if (choices.disableFingerprintsOnSelectedDevices) {
        await runStep(`Disable fingerprints on ${deviceLabel}`, async () => {
          const fingerprints = await listEmployeeDeviceFingerprints(token, target.employeeId, deviceId)
          for (const fp of fingerprints) {
            const fpId =
              readString(fp, ["id", "fingerprint_id", "fingerprintId", "uuid"]) ??
              (readNumber(fp, ["id", "fingerprint_id"]) !== null
                ? String(readNumber(fp, ["id", "fingerprint_id"]))
                : null)
            if (!fpId) continue
            try {
              await disableEmployeeDeviceFingerprint(token, target.employeeId, deviceId, fpId)
            } catch {
              // Best effort per fingerprint.
            }
          }
        })
      }

      await runStep(`Remove from device ${deviceLabel}`, async () => {
        await removeEmployeeDeviceAssignment(token, target.employeeId, deviceId)
      })
    }

    for (const groupId of selectedGroupIds) {
      const groupLabel = groups.find((g) => g.id === groupId)?.label ?? groupId
      await runStep(`Remove from access group ${groupLabel}`, async () => {
        await removeAccessGroupEmployee(token, groupId, target.employeeId)
      })
    }

    if (choices.endShiftAssignments && shifts.length > 0) {
      for (const shift of shifts) {
        await runStep(`End shift assignment ${shift.label}`, async () => {
          await patchShiftResourceById(token, "shift-assignments", shift.id, {
            status: "inactive",
            is_active: false,
            end_date: new Date().toISOString().slice(0, 10),
          })
        })
      }
    }

    if (choices.suspendEmployee || choices.terminateEmployee) {
      const status = choices.terminateEmployee ? "terminated" : "suspended"
      const label =
        status === "terminated" ? "Set status to Terminated" : "Set status to Suspended"
      await runStep(label, async () => {
        const payload: EmployeeStatusPayload = {
          employment_status: status,
          notes:
            status === "terminated"
              ? "Terminated via unified removal dialog"
              : "Suspended via unified removal dialog",
        }
        if (status === "terminated") {
          payload.exit_date = new Date().toISOString().slice(0, 10)
          payload.exit_reason = "Removed via access cleanup"
        }
        // terminated may not be in exited path; try terminated first then exited
        try {
          await patchEmployeeStatus(token, target.employeeId, payload)
        } catch {
          if (status === "terminated") {
            await patchEmployeeStatus(token, target.employeeId, {
              employment_status: "exited",
              exit_date: new Date().toISOString().slice(0, 10),
              exit_reason: "Removed via access cleanup",
              notes: "Exited via unified removal dialog",
            })
          } else {
            throw new Error("Could not update employment status")
          }
        }
      })
    }

    setResults(outcome)
    setStep("done")
    setProgressLabel("")

    if (failures.length === 0) {
      showSuccessAlert("Removal completed successfully.")
      onCompleted?.()
    } else if (failures.length < outcome.length) {
      showSuccessAlert("Removal finished with some warnings.")
      onCompleted?.()
    } else {
      showErrorAlert(failures[0] ?? "Removal failed.")
    }
  }

  if (!target) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && step === "running") return
        onOpenChange(next)
      }}
    >
      <DialogPopup className="max-h-[90vh] w-[min(96vw,30rem)] overflow-y-auto sm:max-w-[30rem]">
        <DialogHeader>
          <DialogTitle>
            {step === "confirm"
              ? "Confirm removal"
              : step === "done"
                ? "Removal finished"
                : step === "running"
                  ? "Removing…"
                  : "Remove access"}
          </DialogTitle>
          <DialogDescription>
            {target.employeeName}
            {target.employeeNo ? ` · ${target.employeeNo}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 px-1 pb-1">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {loading ? (
            <p className="text-sm text-slate-500">Loading assignments…</p>
          ) : null}

          {step === "choose" && !loading ? (
            <>
              <p className="text-sm text-slate-600">
                Choose where to remove or disable this person. You can do several places at once.
              </p>

              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Devices
                </p>
                {devices.length === 0 ? (
                  <p className="text-sm text-slate-400">No device assignments found.</p>
                ) : (
                  <ul className="space-y-2">
                    {devices.map((device) => (
                      <li key={device.id}>
                        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-800">
                          <span className="min-w-0 truncate">{device.label}</span>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--primary)]"
                            checked={Boolean(choices.devices[device.id])}
                            onChange={(event) =>
                              setChoices((prev) => ({
                                ...prev,
                                devices: {
                                  ...prev.devices,
                                  [device.id]: event.target.checked,
                                },
                              }))
                            }
                          />
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {devices.length > 0 ? (
                  <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-slate-100 pt-2 text-sm text-slate-700">
                    <span>Also disable fingerprints on selected devices</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={choices.disableFingerprintsOnSelectedDevices}
                      onChange={(event) =>
                        setChoices((prev) => ({
                          ...prev,
                          disableFingerprintsOnSelectedDevices: event.target.checked,
                        }))
                      }
                    />
                  </label>
                ) : null}
              </section>

              <section className="space-y-2 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Access groups
                </p>
                {groups.length === 0 ? (
                  <p className="text-sm text-slate-400">No access group memberships found.</p>
                ) : (
                  <ul className="space-y-2">
                    {groups.map((group) => (
                      <li key={group.id}>
                        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-800">
                          <span className="min-w-0 truncate">{group.label}</span>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--primary)]"
                            checked={Boolean(choices.groups[group.id])}
                            onChange={(event) =>
                              setChoices((prev) => ({
                                ...prev,
                                groups: {
                                  ...prev.groups,
                                  [group.id]: event.target.checked,
                                },
                              }))
                            }
                          />
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {shifts.length > 0 ? (
                <section className="space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Attendance
                  </p>
                  <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-800">
                    <span>End shift assignment(s) ({shifts.length})</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={choices.endShiftAssignments}
                      onChange={(event) =>
                        setChoices((prev) => ({
                          ...prev,
                          endShiftAssignments: event.target.checked,
                        }))
                      }
                    />
                  </label>
                </section>
              ) : null}

              <section className="space-y-2 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Employment status
                </p>
                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-800">
                  <span>Suspend employee</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--primary)]"
                    checked={choices.suspendEmployee}
                    onChange={(event) =>
                      setChoices((prev) => ({
                        ...prev,
                        suspendEmployee: event.target.checked,
                        terminateEmployee: event.target.checked ? false : prev.terminateEmployee,
                      }))
                    }
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-800">
                  <span>Terminate / exit employee</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--primary)]"
                    checked={choices.terminateEmployee}
                    onChange={(event) =>
                      setChoices((prev) => ({
                        ...prev,
                        terminateEmployee: event.target.checked,
                        suspendEmployee: event.target.checked ? false : prev.suspendEmployee,
                      }))
                    }
                  />
                </label>
                <p className="text-xs text-slate-500">
                  Status changes apply company-wide. Leave both off to only clean access.
                </p>
              </section>
            </>
          ) : null}

          {step === "confirm" ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                You are about to apply the following for{" "}
                <span className="font-semibold text-slate-900">{target.employeeName}</span>. This
                cannot be easily undone.
              </p>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-800">
                {summaryLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {step === "running" ? (
            <div className="space-y-2 py-4 text-center">
              <p className="text-sm font-medium text-slate-900">Working…</p>
              <p className="text-xs text-slate-500">{progressLabel || "Please wait"}</p>
            </div>
          ) : null}

          {step === "done" ? (
            <ul className="space-y-1.5 text-sm">
              {results.map((line) => (
                <li
                  key={line}
                  className={cn(
                    line.startsWith("✓") ? "text-emerald-700" : "text-rose-700"
                  )}
                >
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {step === "choose" ? (
            <>
              <button
                type="button"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:w-auto"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium !text-white disabled:opacity-50 sm:w-auto"
                disabled={loading || !hasAnyAction}
                onClick={() => {
                  setError(null)
                  if (!hasAnyAction) {
                    setError("Select at least one place to remove or disable.")
                    return
                  }
                  setStep("confirm")
                }}
              >
                Continue
              </button>
            </>
          ) : null}

          {step === "confirm" ? (
            <>
              <button
                type="button"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:w-auto"
                onClick={() => setStep("choose")}
              >
                Back
              </button>
              <button
                type="button"
                className="w-full rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white sm:w-auto"
                onClick={() => void runRemoval()}
              >
                Confirm & remove
              </button>
            </>
          ) : null}

          {step === "done" ? (
            <button
              type="button"
              className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium !text-white sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              Done
            </button>
          ) : null}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
