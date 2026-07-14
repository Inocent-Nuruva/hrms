"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeftIcon, PlusIcon, RefreshCwIcon, SearchIcon, Trash2Icon } from "lucide-react"

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { TableScrollContainer } from "@/components/common/table-scroll-container"
import {
  assignAccessGroupDoors,
  assignAccessGroupEmployees,
  getAccessControlResourceById,
  listAttendanceDevices,
  listAccessControlResources,
  listEmployees,
  listAccessGroupDoors,
  listAccessGroupEmployees,
  removeAccessGroupDoor,
  type AdminRecord,
} from "@/lib/admin-api"
import {
  EmployeeAccessRemovalDialog,
  type EmployeeAccessRemovalTarget,
} from "@/components/dashboard/employee-access-removal-dialog"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

function readStoredToken() {
  if (typeof window === "undefined") {
    return ""
  }

  const direct = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
  if (direct) {
    return direct
  }

  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (!authTokensRaw) {
    return ""
  }

  try {
    const parsed = JSON.parse(authTokensRaw) as { accessToken?: string; access_token?: string }
    return (parsed.accessToken ?? parsed.access_token ?? "").trim()
  } catch {
    return ""
  }
}

function readNumberFromRecord(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return null
}

function readStringFromRecord(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return null
}

function looksLikeIdentifier(value: string | null) {
  if (!value) {
    return false
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  return /^[0-9]+$/.test(trimmed) || /^[A-Z0-9_-]+$/i.test(trimmed)
}

function prettifyLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatDateTime(value: string) {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    return value
  }

  return new Intl.DateTimeFormat("en-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed))
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return "-"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return "-"
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      return formatDateTime(trimmed)
    }
    return trimmed
  }
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : "-"
  if (typeof value === "object") return "Available"
  return "-"
}

function resolveColumns(rows: AdminRecord[], preferred: string[]) {
  const keySet = new Set<string>()
  rows.forEach((row) => Object.keys(row).forEach((key) => keySet.add(key)))
  const ordered = preferred.filter((key) => keySet.has(key))
  const extras = Array.from(keySet).filter((key) => !ordered.includes(key)).sort((a, b) => a.localeCompare(b))
  return [...ordered, ...extras].slice(0, 6)
}

export function AccessGroupDetailView({ groupId }: { groupId: string }) {
  const [group, setGroup] = React.useState<AdminRecord | null>(null)
  const [assignedDoors, setAssignedDoors] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [allEmployees, setAllEmployees] = React.useState<AdminRecord[]>([])
  const [availableDoors, setAvailableDoors] = React.useState<AdminRecord[]>([])
  const [templates, setTemplates] = React.useState<AdminRecord[]>([])
  const [devices, setDevices] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [assignOpen, setAssignOpen] = React.useState(false)
  const [selectedDoorId, setSelectedDoorId] = React.useState("")
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("")
  const [assigning, setAssigning] = React.useState(false)
  const [removingDoorId, setRemovingDoorId] = React.useState("")
  const [assignError, setAssignError] = React.useState<string | null>(null)
  const [removeConfirmOpen, setRemoveConfirmOpen] = React.useState(false)
  const [removeError, setRemoveError] = React.useState<string | null>(null)
  const [doorPendingRemoval, setDoorPendingRemoval] = React.useState<AdminRecord | null>(null)
  const [assignEmployeeOpen, setAssignEmployeeOpen] = React.useState(false)
  const [assignEmployeePickerOpen, setAssignEmployeePickerOpen] = React.useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState("")
  const [assignEmployeeSearch, setAssignEmployeeSearch] = React.useState("")
  const [assignEmployeeError, setAssignEmployeeError] = React.useState<string | null>(null)
  const [assigningEmployee, setAssigningEmployee] = React.useState(false)
  const [removalOpen, setRemovalOpen] = React.useState(false)
  const [removalTarget, setRemovalTarget] = React.useState<EmployeeAccessRemovalTarget | null>(null)
  const [activeTab, setActiveTab] = React.useState<"details" | "doors" | "employees">("details")
  const [doorSearch, setDoorSearch] = React.useState("")
  const [employeeSearch, setEmployeeSearch] = React.useState("")

  const doorSearchActive = doorSearch.trim().length > 0
  const employeeSearchActive = employeeSearch.trim().length > 0

  const fetchGroupData = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [groupRecord, groupDoorRows, employeeRows, deviceRows, allEmployeeRows, templateRows, allDoorRows] =
        await Promise.all([
          getAccessControlResourceById(token, "groups", groupId),
          listAccessGroupDoors(token, groupId),
          listAccessGroupEmployees(token, groupId),
          listAttendanceDevices(token, {
            page: 1,
            limit: 100,
            sortBy: "created_at",
            sortOrder: "DESC",
          }),
          listEmployees(token, {
            page: 1,
            limit: 100,
            sortBy: "created_at",
            sortOrder: "DESC",
          }),
          listAccessControlResources(token, "schedule-templates", {
            page: 1,
            limit: 100,
            sortBy: "created_at",
            sortOrder: "DESC",
          }),
          listAccessControlResources(token, "doors", {
            page: 1,
            limit: 100,
            sortBy: "created_at",
            sortOrder: "DESC",
          }),
        ])

      setGroup(groupRecord)
      setAssignedDoors(groupDoorRows)
      setEmployees(employeeRows)
      setDevices(deviceRows.rows)
      setAvailableDoors(allDoorRows.rows)
      setAllEmployees(allEmployeeRows.rows)
      setTemplates(templateRows.rows)
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Failed to load group details.")
    } finally {
      setLoading(false)
    }
  }, [groupId])

  React.useEffect(() => {
    void fetchGroupData()
  }, [fetchGroupData])

  const groupName = React.useMemo(
    () => readStringFromRecord(group ?? {}, ["group_name", "groupName", "name"]) ?? `Group ${groupId}`,
    [group, groupId]
  )

  const assignedDoorIds = React.useMemo(
    () =>
      new Set(
        assignedDoors
          .map((door) => readNumberFromRecord(door, ["door_id", "doorId", "id"]))
          .filter((doorId): doorId is number => doorId !== null)
      ),
    [assignedDoors]
  )

  const assignableDoors = React.useMemo(
    () =>
      availableDoors.filter((door) => {
        const doorId = readNumberFromRecord(door, ["id", "door_id", "doorId"])
        return doorId !== null && !assignedDoorIds.has(doorId)
      }),
    [assignedDoorIds, availableDoors]
  )

  const selectedDoorRecord = React.useMemo(() => {
    const doorId = Number(selectedDoorId)
    if (!Number.isFinite(doorId)) {
      return null
    }

    return (
      assignableDoors.find((door) => readNumberFromRecord(door, ["id", "door_id", "doorId"]) === doorId) ?? null
    )
  }, [assignableDoors, selectedDoorId])

  const doorDisplayRows = React.useMemo(
    () =>
      assignedDoors.map((door) => {
        const deviceId = readNumberFromRecord(door, ["device_id", "deviceId"])
        const matchedDevice =
          deviceId === null
            ? null
            : devices.find((device) => readNumberFromRecord(device, ["id", "device_id"]) === deviceId) ?? null

        const templateId = readNumberFromRecord(door, ["schedule_template_id", "scheduleTemplateId"])
        const matchedTemplate =
          templateId === null
            ? null
            : templates.find((template) => readNumberFromRecord(template, ["id", "template_id", "templateId"]) === templateId) ?? null

        return {
          ...door,
          device_name:
            readStringFromRecord(door, ["device_name", "deviceName"]) ??
            readStringFromRecord(matchedDevice ?? {}, ["device_name", "deviceName", "name"]) ??
            (deviceId !== null ? `Device ${deviceId}` : "-"),
          schedule_template_name:
            readStringFromRecord(door, ["schedule_template_name", "scheduleTemplateName", "template_name", "templateName"]) ??
            readStringFromRecord(matchedTemplate ?? {}, ["template_name", "templateName", "name"]) ??
            (templateId !== null ? `Template ${templateId}` : "-"),
          access_group_name:
            readStringFromRecord(door, ["access_group_name", "accessGroupName", "group_name", "groupName"]) ??
            groupName,
          access_group_id:
            readNumberFromRecord(door, ["access_group_id", "accessGroupId", "group_id", "groupId"]) ??
            Number(groupId),
        }
      }),
    [assignedDoors, devices, groupId, groupName, templates]
  )

  const employeeDisplayRows = React.useMemo(
    () =>
      employees.map((employee) => {
        const employeeId = readNumberFromRecord(employee, ["employee_id", "employeeId", "id"])
        const employeeNo =
          readStringFromRecord(employee, ["employee_no", "employee_number", "employeeNumber", "name"]) ?? null
        const matchedEmployee =
          allEmployees.find((entry) => {
            const candidateId = readNumberFromRecord(entry, ["id", "employee_id", "employeeId"])
            const candidateNo =
              readStringFromRecord(entry, ["employee_no", "employee_number", "employeeNumber"]) ?? null

            if (employeeId !== null && candidateId === employeeId) {
              return true
            }

            if (employeeNo && candidateNo && candidateNo === employeeNo) {
              return true
            }

            return false
          }) ?? null

        const employeeNameParts = [
          readStringFromRecord(matchedEmployee ?? {}, ["first_name"]),
          readStringFromRecord(matchedEmployee ?? {}, ["middle_name"]),
          readStringFromRecord(matchedEmployee ?? {}, ["last_name"]),
        ].filter(Boolean)

        const directEmployeeName = readStringFromRecord(employee, [
          "employee_name",
          "employeeName",
          "full_name",
          "display_name",
        ])

        return {
          ...employee,
          resolved_employee_id:
            employeeId ??
            readNumberFromRecord(matchedEmployee ?? {}, ["id", "employee_id", "employeeId"]),
          resolved_employee_no:
            employeeNo ??
            readStringFromRecord(matchedEmployee ?? {}, ["employee_no", "employee_number", "employeeNumber"]),
          employee_name:
            (employeeNameParts.length > 0 ? employeeNameParts.join(" ") : null) ??
            readStringFromRecord(matchedEmployee ?? {}, ["full_name", "display_name", "name"]) ??
            (directEmployeeName && !looksLikeIdentifier(directEmployeeName) ? directEmployeeName : null) ??
            "-",
          access_group_name:
            readStringFromRecord(employee, ["access_group_name", "accessGroupName", "group_name", "groupName"]) ??
            groupName,
        }
      }),
    [allEmployees, employees, groupName]
  )

  const assignedEmployeeKeys = React.useMemo(
    () =>
      new Set(
        employeeDisplayRows.flatMap((employee) => {
          const keys: string[] = []
          const employeeId = readNumberFromRecord(employee, ["resolved_employee_id", "employee_id", "employeeId", "id"])
          const employeeNo = readStringFromRecord(employee, [
            "resolved_employee_no",
            "employee_no",
            "employee_number",
            "employeeNumber",
          ])
          if (employeeId !== null) {
            keys.push(`id:${employeeId}`)
          }
          if (employeeNo) {
            keys.push(`no:${employeeNo}`)
          }
          return keys
        })
      ),
    [employeeDisplayRows]
  )

  const assignableEmployees = React.useMemo(
    () =>
      allEmployees.filter((employee) => {
        const employeeId = readNumberFromRecord(employee, ["id", "employee_id", "employeeId"])
        const employeeNo = readStringFromRecord(employee, ["employee_no", "employee_number", "employeeNumber"])
        if (employeeId !== null && assignedEmployeeKeys.has(`id:${employeeId}`)) {
          return false
        }
        if (employeeNo && assignedEmployeeKeys.has(`no:${employeeNo}`)) {
          return false
        }
        return employeeId !== null
      }),
    [allEmployees, assignedEmployeeKeys]
  )

  const filteredAssignableEmployees = React.useMemo(() => {
    const normalizedSearch = assignEmployeeSearch.trim().toLowerCase()
    if (!normalizedSearch) {
      return assignableEmployees
    }

    return assignableEmployees.filter((employee) => {
      const employeeNo =
        readStringFromRecord(employee, ["employee_no", "employee_number", "employeeNumber"]) ?? ""
      const employeeName =
        [
          readStringFromRecord(employee, ["first_name"]),
          readStringFromRecord(employee, ["middle_name"]),
          readStringFromRecord(employee, ["last_name"]),
        ]
          .filter(Boolean)
          .join(" ") ||
        readStringFromRecord(employee, ["full_name", "display_name", "name"]) ||
        ""

      return [employeeNo, employeeName].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [assignEmployeeSearch, assignableEmployees])

  const selectedAssignableEmployeeLabel = React.useMemo(() => {
    if (!selectedEmployeeId) {
      return "Select employee"
    }

    const selectedEmployee =
      assignableEmployees.find(
        (employee) =>
          readNumberFromRecord(employee, ["id", "employee_id", "employeeId"]) === Number(selectedEmployeeId)
      ) ?? null

    if (!selectedEmployee) {
      return "Select employee"
    }

    const employeeNo =
      readStringFromRecord(selectedEmployee, ["employee_no", "employee_number", "employeeNumber"]) ?? "-"
    const employeeName =
      [
        readStringFromRecord(selectedEmployee, ["first_name"]),
        readStringFromRecord(selectedEmployee, ["middle_name"]),
        readStringFromRecord(selectedEmployee, ["last_name"]),
      ]
        .filter(Boolean)
        .join(" ") ||
      readStringFromRecord(selectedEmployee, ["full_name", "display_name", "name"]) ||
      `Employee ${selectedEmployeeId}`

    return `${employeeName} (${employeeNo})`
  }, [assignableEmployees, selectedEmployeeId])

  const doorColumns = React.useMemo(
    () =>
      resolveColumns(doorDisplayRows, [
        "door_name",
        "doorName",
        "door_no",
        "doorNo",
        "device_name",
        "schedule_template_name",
        "access_group_name",
        "access_group_id",
        "created_at",
      ]),
    [doorDisplayRows]
  )

  const employeeColumns = React.useMemo(
    () =>
      resolveColumns(employeeDisplayRows, [
        "employee_no",
        "employee_number",
        "employee_name",
        "status",
        "access_group_name",
        "assigned_at",
        "created_at",
        "email",
      ]),
    [employeeDisplayRows]
  )

  const filteredDoorRows = React.useMemo(() => {
    const normalizedSearch = doorSearch.trim().toLowerCase()
    if (!normalizedSearch) {
      return doorDisplayRows
    }

    return doorDisplayRows.filter((door) =>
      [
        readStringFromRecord(door, ["door_name", "doorName", "name"]),
        readStringFromRecord(door, ["door_no", "doorNo"]),
        readStringFromRecord(door, ["device_name"]),
        readStringFromRecord(door, ["schedule_template_name"]),
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedSearch))
    )
  }, [doorDisplayRows, doorSearch])

  const filteredEmployeeRows = React.useMemo(() => {
    const normalizedSearch = employeeSearch.trim().toLowerCase()
    if (!normalizedSearch) {
      return employeeDisplayRows
    }

    return employeeDisplayRows.filter((employee) =>
      [
        readStringFromRecord(employee, ["employee_no", "employee_number", "employeeNumber"]),
        readStringFromRecord(employee, ["employee_name"]),
        readStringFromRecord(employee, ["access_group_name"]),
        readStringFromRecord(employee, ["status"]),
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedSearch))
    )
  }, [employeeDisplayRows, employeeSearch])

  const onAssignDoor = async () => {
    const token = readStoredToken()
    if (!token) {
      setAssignError("Authentication required. Please log in again.")
      return
    }
    if (!selectedDoorId) {
      setAssignError("Select a door to assign.")
      return
    }
    if (!selectedTemplateId) {
      setAssignError("Select a schedule template for this door.")
      return
    }

    setAssigning(true)
    setAssignError(null)
    try {
      await assignAccessGroupDoors(token, groupId, [
        {
          door_id: selectedDoorId,
          schedule_template_id: selectedTemplateId,
          device_id: readNumberFromRecord(selectedDoorRecord ?? {}, ["device_id", "deviceId"]),
        },
      ])
      setMessage("Door assigned successfully.")
      setError(null)
      setAssignOpen(false)
      setSelectedDoorId("")
      setSelectedTemplateId("")
      await fetchGroupData()
    } catch (errorObject) {
      setAssignError(errorObject instanceof Error ? errorObject.message : "Failed to assign door.")
    } finally {
      setAssigning(false)
    }
  }

  const requestRemoveDoor = (door: AdminRecord) => {
    setDoorPendingRemoval(door)
    setRemoveError(null)
    setRemoveConfirmOpen(true)
  }

  const onRemoveDoor = async () => {
    const token = readStoredToken()
    if (!token) {
      setRemoveError("Authentication required. Please log in again.")
      return
    }

    if (!doorPendingRemoval) {
      setRemoveError("Select a door to remove.")
      return
    }

    const doorId = readNumberFromRecord(doorPendingRemoval, ["door_id", "doorId", "id"])
    if (doorId === null) {
      setRemoveError("This door does not have a valid id.")
      return
    }

    setRemovingDoorId(String(doorId))
    setRemoveError(null)
    try {
      await removeAccessGroupDoor(token, groupId, doorId)
      setMessage("Door removed from group.")
      setError(null)
      setRemoveConfirmOpen(false)
      setDoorPendingRemoval(null)
      await fetchGroupData()
    } catch (errorObject) {
      setRemoveError(errorObject instanceof Error ? errorObject.message : "Failed to remove door.")
    } finally {
      setRemovingDoorId("")
    }
  }

  const onAssignEmployee = async () => {
    const token = readStoredToken()
    if (!token) {
      setAssignEmployeeError("Authentication required. Please log in again.")
      return
    }
    if (!selectedEmployeeId) {
      setAssignEmployeeError("Select an employee to assign.")
      return
    }

    setAssigningEmployee(true)
    setAssignEmployeeError(null)
    try {
      await assignAccessGroupEmployees(token, groupId, [selectedEmployeeId])
      setMessage("Employee assigned successfully.")
      setError(null)
      setAssignEmployeeOpen(false)
      setSelectedEmployeeId("")
      await fetchGroupData()
    } catch (errorObject) {
      setAssignEmployeeError(
        errorObject instanceof Error ? errorObject.message : "Failed to assign employee."
      )
    } finally {
      setAssigningEmployee(false)
    }
  }

  const requestRemoveEmployee = (employee: AdminRecord) => {
    const employeeId = readNumberFromRecord(employee, [
      "resolved_employee_id",
      "employee_id",
      "employeeId",
      "id",
    ])
    if (employeeId === null) {
      setError("This employee does not have a valid id.")
      return
    }
    setRemovalTarget({
      employeeId,
      employeeName:
        readStringFromRecord(employee, ["employee_name", "full_name", "name"]) ??
        `Employee #${employeeId}`,
      employeeNo:
        readStringFromRecord(employee, [
          "resolved_employee_no",
          "employee_no",
          "employee_number",
          "employeeNumber",
        ]) ?? null,
      preferredGroupId: groupId,
      preferredGroupLabel: groupName,
    })
    setRemovalOpen(true)
  }

  return (
    <div className="space-y-4">
      <style jsx>{`
        @keyframes search-result-reveal {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-5 shadow-sm lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2">
              <Link
                href="/dashboard/attendance/groups"
                className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to groups
              </Link>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{groupName}</h2>
            <p className="text-sm text-slate-500">Group details, assigned doors, and assigned employees</p>
          </div>
          <button
            type="button"
            onClick={() => void fetchGroupData()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-primary hover:bg-slate-50"
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCwIcon className={`h-4 w-4 text-primary ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-5 shadow-sm lg:px-6">
        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          {[
            ["details", "Group Details"],
            ["doors", "Doors"],
            ["employees", "Employees"],
          ].map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              className={`rounded-full px-4 py-2 text-sm transition ${
                activeTab === tabKey
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => setActiveTab(tabKey as "details" | "doors" | "employees")}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "details" ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Group Name", groupName],
              ["Display Name", readStringFromRecord(group ?? {}, ["name"])],
              ["Group Code", readStringFromRecord(group ?? {}, ["group_code", "groupCode"])],
              ["Status", readStringFromRecord(group ?? {}, ["status"])],
              ["Description", readStringFromRecord(group ?? {}, ["description"])],
              [
                "Device",
                readStringFromRecord(group ?? {}, ["device_name", "deviceName"]) ??
                  stringifyValue(group?.device_id ?? group?.deviceId),
              ],
              ["Assigned Doors", String(assignedDoors.length)],
              ["Assigned Employees", String(employees.length)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-sm text-slate-900">{value || "-"}</p>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === "doors" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Assigned Doors</h3>
                <p className="text-sm text-slate-500">Assign or remove doors linked to this group.</p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => setAssignOpen(true)}
              >
                <PlusIcon className="h-4 w-4" />
                Assign Door
              </button>
            </div>

            <div className="relative">
              <SearchIcon
                className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition ${
                  doorSearchActive ? "animate-pulse text-slate-700" : ""
                }`}
              />
              <input
                className="w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
                placeholder="Search doors by name, number, device, or template"
                value={doorSearch}
                onChange={(event) => setDoorSearch(event.target.value)}
              />
            </div>

            <TableScrollContainer>
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50/90">
                  <tr>
                    {doorColumns.map((column) => (
                      <th
                        key={column}
                        className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap"
                      >
                        {prettifyLabel(column)}
                      </th>
                    ))}
                    <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="[&_tr:nth-child(odd)]:bg-slate-50/35 [&_tr]:border-t [&_tr]:border-slate-100 [&_tr:hover]:bg-slate-50/80">
                  {!loading && filteredDoorRows.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(doorColumns.length + 1, 1)} className="px-4 py-10 text-sm text-slate-500">
                        {doorSearch.trim()
                          ? "No assigned doors matched your search."
                          : "No doors assigned to this group yet."}
                      </td>
                    </tr>
                  ) : null}
                  {filteredDoorRows.map((door, index) => {
                    const rowId =
                      readNumberFromRecord(door, ["door_id", "doorId", "id"]) ?? `door-${index}`
                    return (
                      <tr
                        key={String(rowId)}
                        style={
                          doorSearchActive
                            ? {
                                animation: "search-result-reveal 280ms ease both",
                                animationDelay: `${index * 45}ms`,
                              }
                            : undefined
                        }
                      >
                        {doorColumns.map((column) => (
                          <td key={`${rowId}-${column}`} className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">
                            {stringifyValue((door as Record<string, unknown>)[column])}
                          </td>
                        ))}
                        <td className="px-4 py-4">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                              onClick={() => requestRemoveDoor(door)}
                              disabled={removingDoorId === String(rowId)}
                              aria-label="Remove door"
                              title="Remove door"
                            >
                              <Trash2Icon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableScrollContainer>
          </div>
        ) : null}

        {activeTab === "employees" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Assigned Employees</h3>
                <p className="text-sm text-slate-500">Employees currently linked to this access group.</p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => setAssignEmployeeOpen(true)}
              >
                <PlusIcon className="h-4 w-4" />
                Assign Employee
              </button>
            </div>

            <div className="relative">
              <SearchIcon
                className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition ${
                  employeeSearchActive ? "animate-pulse text-slate-700" : ""
                }`}
              />
              <input
                className="w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
                placeholder="Search employees by number, name, group, or status"
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
              />
            </div>

            <TableScrollContainer>
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50/90">
                  <tr>
                    {employeeColumns.map((column) => (
                      <th
                        key={column}
                        className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap"
                      >
                        {prettifyLabel(column)}
                      </th>
                    ))}
                    <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="[&_tr:nth-child(odd)]:bg-slate-50/35 [&_tr]:border-t [&_tr]:border-slate-100 [&_tr:hover]:bg-slate-50/80">
                  {!loading && filteredEmployeeRows.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(employeeColumns.length + 1, 1)} className="px-4 py-10 text-sm text-slate-500">
                        {employeeSearch.trim()
                          ? "No assigned employees matched your search."
                          : "No employees assigned to this group yet."}
                      </td>
                    </tr>
                  ) : null}
                  {filteredEmployeeRows.map((employee, index) => {
                    const rowId =
                      readNumberFromRecord(employee, ["id", "employee_id", "employeeId"]) ??
                      `employee-${index}`
                    return (
                      <tr
                        key={String(rowId)}
                        style={
                          employeeSearchActive
                            ? {
                                animation: "search-result-reveal 280ms ease both",
                                animationDelay: `${index * 45}ms`,
                              }
                            : undefined
                        }
                      >
                        {employeeColumns.map((column) => (
                          <td
                            key={`${rowId}-${column}`}
                            className={`px-4 py-4 text-sm text-slate-700 whitespace-nowrap ${
                              column === "employee_name" && employeeSearchActive ? "font-medium" : ""
                            }`}
                          >
                            {stringifyValue((employee as Record<string, unknown>)[column])}
                          </td>
                        ))}
                        <td className="px-4 py-4">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                              onClick={() => requestRemoveEmployee(employee)}
                              disabled={
                                readNumberFromRecord(employee, [
                                  "resolved_employee_id",
                                  "employee_id",
                                  "employeeId",
                                  "id",
                                ]) === null
                              }
                              aria-label="Remove employee"
                              title="Remove employee"
                            >
                              <Trash2Icon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableScrollContainer>
          </div>
        ) : null}
      </div>

      <Dialog
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open)
          if (!open) {
            setAssignError(null)
            setSelectedDoorId("")
            setSelectedTemplateId("")
          }
        }}
      >
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Door To Group</DialogTitle>
            <DialogDescription>
              Select an available door and schedule template to add to this group.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {assignError ? <p className="text-sm text-red-600">{assignError}</p> : null}
            <label className="grid gap-1">
              <span className="text-xs font-medium uppercase text-slate-600">Door</span>
              <select
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                value={selectedDoorId}
                onChange={(event) => setSelectedDoorId(event.target.value)}
              >
                <option value="">Select door</option>
                {assignableDoors.map((door, index) => {
                  const doorId = readNumberFromRecord(door, ["id", "door_id", "doorId"])
                  if (doorId === null) return null
                  const doorName =
                    readStringFromRecord(door, ["door_name", "doorName", "name"]) ?? `Door ${doorId}`
                  const doorNo = readStringFromRecord(door, ["door_no", "doorNo"])
                  return (
                    <option key={`assignable-door-${doorId}-${index}`} value={String(doorId)}>
                      {doorNo ? `${doorName} (#${doorNo})` : doorName}
                    </option>
                  )
                })}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium uppercase text-slate-600">Schedule Template</span>
              <select
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
              >
                <option value="">Select schedule template</option>
                {templates.map((template, index) => {
                  const templateId = readNumberFromRecord(template, ["id", "template_id", "templateId"])
                  if (templateId === null) return null
                  const templateName =
                    readStringFromRecord(template, ["template_name", "templateName", "name"]) ??
                    `Template ${templateId}`
                  return (
                    <option key={`assign-template-${templateId}-${index}`} value={String(templateId)}>
                      {templateName}
                    </option>
                  )
                })}
              </select>
            </label>
            {assignableDoors.length === 0 ? (
              <p className="text-sm text-slate-500">
                No unassigned doors are currently available for this group.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              onClick={() => {
                setAssignOpen(false)
                setAssignError(null)
                setSelectedDoorId("")
                setSelectedTemplateId("")
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              onClick={() => void onAssignDoor()}
              disabled={assigning || !selectedDoorId || !selectedTemplateId}
            >
              {assigning ? "Assigning..." : "Assign Door"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={removeConfirmOpen}
        onOpenChange={(open) => {
          setRemoveConfirmOpen(open)
          if (!open) {
            setRemoveError(null)
            setDoorPendingRemoval(null)
          }
        }}
      >
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Assigned Door</DialogTitle>
            <DialogDescription>
              Confirm that you want to remove this door from the access group.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {removeError ? <p className="text-sm text-red-600">{removeError}</p> : null}
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <p className="font-medium text-slate-900">
                {readStringFromRecord(doorPendingRemoval ?? {}, ["door_name", "doorName", "name"]) ?? "Selected door"}
              </p>
              <p className="mt-1 text-slate-500">
                Door No: {readStringFromRecord(doorPendingRemoval ?? {}, ["door_no", "doorNo"]) ?? "-"}
              </p>
              <p className="text-slate-500">
                Schedule Template:{" "}
                {readStringFromRecord(doorPendingRemoval ?? {}, [
                  "schedule_template_name",
                  "scheduleTemplateName",
                  "template_name",
                  "templateName",
                ]) ?? "-"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              onClick={() => {
                setRemoveConfirmOpen(false)
                setRemoveError(null)
                setDoorPendingRemoval(null)
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              onClick={() => void onRemoveDoor()}
              disabled={
                !doorPendingRemoval ||
                removingDoorId ===
                  String(readNumberFromRecord(doorPendingRemoval ?? {}, ["door_id", "doorId", "id"]) ?? "")
              }
            >
              {removingDoorId &&
              removingDoorId ===
                String(readNumberFromRecord(doorPendingRemoval ?? {}, ["door_id", "doorId", "id"]) ?? "")
                ? "Removing..."
                : "Remove Door"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={assignEmployeeOpen}
        onOpenChange={(open) => {
          setAssignEmployeeOpen(open)
          if (!open) {
            setAssignEmployeeError(null)
            setAssignEmployeePickerOpen(false)
            setSelectedEmployeeId("")
            setAssignEmployeeSearch("")
          }
        }}
      >
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Employee To Group</DialogTitle>
            <DialogDescription>Select an employee to add to this access group.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {assignEmployeeError ? <p className="text-sm text-red-600">{assignEmployeeError}</p> : null}
            <div className="grid gap-1">
              <span className="text-xs font-medium uppercase text-slate-600">Employee</span>
              <div className="relative">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md border border-slate-300 px-3 py-2 text-left text-sm outline-none transition hover:bg-slate-50 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
                  onClick={() => setAssignEmployeePickerOpen((current) => !current)}
                  aria-expanded={assignEmployeePickerOpen}
                >
                  <span className={selectedEmployeeId ? "text-slate-900" : "text-slate-500"}>
                    {selectedAssignableEmployeeLabel}
                  </span>
                  <span className="text-slate-500">{assignEmployeePickerOpen ? "▲" : "▼"}</span>
                </button>
                {assignEmployeePickerOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                    <div className="relative">
                      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        className="w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
                        placeholder="Search employees by number or name"
                        value={assignEmployeeSearch}
                        onChange={(event) => setAssignEmployeeSearch(event.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-slate-200">
                      {filteredAssignableEmployees.length ? (
                        filteredAssignableEmployees.map((employee, index) => {
                          const employeeId = readNumberFromRecord(employee, ["id", "employee_id", "employeeId"])
                          if (employeeId === null) return null
                          const employeeNo =
                            readStringFromRecord(employee, [
                              "employee_no",
                              "employee_number",
                              "employeeNumber",
                            ]) ?? "-"
                          const employeeName =
                            [
                              readStringFromRecord(employee, ["first_name"]),
                              readStringFromRecord(employee, ["middle_name"]),
                              readStringFromRecord(employee, ["last_name"]),
                            ]
                              .filter(Boolean)
                              .join(" ") ||
                            readStringFromRecord(employee, ["full_name", "display_name", "name"]) ||
                            `Employee ${employeeId}`

                          return (
                            <button
                              key={`assign-employee-${employeeId}-${index}`}
                              type="button"
                              className={`flex w-full items-start justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50 ${
                                selectedEmployeeId === String(employeeId) ? "bg-slate-100" : ""
                              }`}
                              onClick={() => {
                                setSelectedEmployeeId(String(employeeId))
                                setAssignEmployeePickerOpen(false)
                              }}
                            >
                              <span className="text-slate-900">{employeeName}</span>
                              <span className="shrink-0 text-xs text-slate-500">{employeeNo}</span>
                            </button>
                          )
                        })
                      ) : (
                        <div className="px-3 py-3">
                          <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
                            {assignableEmployees.length === 0
                              ? "No unassigned employees are currently available for this group."
                              : "No available employees matched your search."}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              <input
                type="hidden"
                value={selectedEmployeeId}
                readOnly
                aria-hidden="true"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              onClick={() => {
                setAssignEmployeeOpen(false)
                setAssignEmployeeError(null)
                setAssignEmployeePickerOpen(false)
                setSelectedEmployeeId("")
                setAssignEmployeeSearch("")
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              onClick={() => void onAssignEmployee()}
              disabled={assigningEmployee || !selectedEmployeeId}
            >
              {assigningEmployee ? "Assigning..." : "Assign Employee"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <EmployeeAccessRemovalDialog
        open={removalOpen}
        target={removalTarget}
        onOpenChange={(open) => {
          setRemovalOpen(open)
          if (!open) setRemovalTarget(null)
        }}
        onCompleted={() => {
          void fetchGroupData()
        }}
      />
    </div>
  )
}
