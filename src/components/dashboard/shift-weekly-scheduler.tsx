"use client"

import * as React from "react"
import Link from "next/link"
import {
  Add20Regular,
  ArrowDownload20Regular,
  ArrowSync20Regular,
  CalendarClock24Color,
  CalendarLtr20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  Copy20Regular,
  Delete16Regular,
  Filter20Regular,
  LockClosed16Regular,
  PeopleTeam24Regular,
  ReOrderDotsVertical20Regular,
  Settings20Regular,
} from "@fluentui/react-icons"
import { toast } from "@/components/ui/fluent-toast-store"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { resolveBackendMediaUrl, type AdminRecord } from "@/lib/admin-api"
import { cn } from "@/lib/utils"

type SchedulePrefill = {
  employeeId?: string
  employeeIds?: string[]
  scheduleDate?: string
  shiftId?: string
}

type ShiftWeeklySchedulerProps = {
  rows: AdminRecord[]
  employees: AdminRecord[]
  departments: AdminRecord[]
  shifts: AdminRecord[]
  shiftAssignments: AdminRecord[]
  leaveRequests: AdminRecord[]
  loading: boolean
  onCreate: (prefill?: SchedulePrefill) => void
  onEdit: (id: string, overrides?: Record<string, string>) => void | Promise<void>
  onRemove: (id: string) => void
  onClearAssigned: (employeeId: string, date: string, shiftId: string) => void
  onRefresh: () => void
}

type EmployeeView = {
  id: string
  name: string
  code: string
  department: string
  designation: string
  team: string
  avatarUrl: string | null
  source: AdminRecord
}

type ShiftView = {
  id: string
  name: string
  startTime: string
  endTime: string
  active: boolean
  source: AdminRecord
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const DRAG_SHIFT_MIME = "application/x-hrms-shift-id"
const ALL_DEPARTMENTS_VALUE = "All departments"
const ALL_DESIGNATIONS_VALUE = "All designations"

type RosterViewMode = "employee" | "department" | "team"

function readString(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return ""
  for (const key of keys) {
    const value = row[key]
    if ((typeof value === "string" || typeof value === "number") && String(value).trim()) {
      return String(value).trim()
    }
  }
  return ""
}

function readBoolean(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "boolean") return value
    if (typeof value === "number") return value === 1
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (["true", "1", "yes"].includes(normalized)) return true
      if (["false", "0", "no"].includes(normalized)) return false
    }
  }
  return false
}

function readObject(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as AdminRecord
    }
  }
  return null
}

function mondayFor(value: Date) {
  const date = new Date(value)
  date.setHours(12, 0, 0, 0)
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return date
}

function addDays(value: Date, amount: number) {
  const date = new Date(value)
  date.setDate(date.getDate() + amount)
  return date
}

function dateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function rowDateKey(row: AdminRecord) {
  return readString(row, ["schedule_date", "scheduleDate", "date"]).slice(0, 10)
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(value)
}

function formatLongRange(start: Date, end: Date) {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
    }).format(end)}`
  }
  return `${formatShortDate(start)} – ${new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(end)}`
}

function formatTime(value: string) {
  if (!value) return ""
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return value
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const suffix = hours >= 12 ? "pm" : "am"
  const hour = hours % 12 || 12
  return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${suffix}`
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "E"
}

function resolvePersonName(row: AdminRecord) {
  const user = readObject(row, ["user", "company_user", "companyUser", "profile"])
  const direct = readString(row, ["full_name", "fullName", "display_name", "displayName", "name"])
  const nested = readString(user, ["full_name", "fullName", "display_name", "displayName", "name"])
  if (direct || nested) return direct || nested

  const source = readString(row, ["first_name", "firstName"])
    ? row
    : user
  return [
    readString(source, ["first_name", "firstName"]),
    readString(source, ["middle_name", "middleName"]),
    readString(source, ["last_name", "lastName"]),
  ].filter(Boolean).join(" ") || "Employee"
}

function employeeIdFrom(row: AdminRecord) {
  const nested = readObject(row, ["employee"])
  return readString(row, ["employee_id", "employeeId", "id"]) || readString(nested, ["id", "employee_id"])
}

function departmentName(row: AdminRecord, departmentNames: Map<string, string>) {
  const nested = readObject(row, ["primary_department", "primaryDepartment", "department"])
  const nestedName = readString(nested, ["name", "department_name", "departmentName"])
  if (nestedName) return nestedName
  const directName = readString(row, ["department_name", "departmentName"])
  if (directName) return directName
  const id = readString(row, ["primary_department_id", "primaryDepartmentId", "department_id", "departmentId"])
  return departmentNames.get(id) || "Unassigned"
}

function relationName(row: AdminRecord, relationKeys: string[], directKeys: string[], fallback: string) {
  const nested = readObject(row, relationKeys)
  return readString(nested, ["name", "title", "label"])
    || readString(row, directKeys)
    || fallback
}

function buildEmployees(
  employees: AdminRecord[],
  schedules: AdminRecord[],
  departments: AdminRecord[]
) {
  const departmentNames = new Map(
    departments
      .map((department) => [
        readString(department, ["id", "department_id", "departmentId"]),
        readString(department, ["name", "department_name", "departmentName"]),
      ] as const)
      .filter(([id]) => Boolean(id))
  )

  const sources = [...employees]
  schedules.forEach((schedule) => {
    const nested = readObject(schedule, ["employee"])
    if (nested) sources.push(nested)
  })

  const unique = new Map<string, EmployeeView>()
  sources.forEach((employee) => {
    const id = employeeIdFrom(employee)
    if (!id || unique.has(id)) return
    const user = readObject(employee, ["user", "company_user", "companyUser", "profile"])
    const avatar = readString(employee, ["profile_photo_url", "profilePhotoUrl", "avatar_url", "avatarUrl", "photo_url"])
      || readString(user, ["profile_photo_url", "profilePhotoUrl", "avatar_url", "avatarUrl", "photo_url"])
    unique.set(id, {
      id,
      name: resolvePersonName(employee),
      code: readString(employee, ["employee_no", "employeeNo", "employee_number", "employeeNumber", "staff_no", "staffNo"]),
      department: departmentName(employee, departmentNames),
      designation: relationName(
        employee,
        ["primary_position", "primaryPosition", "position", "designation", "job_title"],
        ["position_name", "positionName", "designation_name", "designationName", "job_title", "jobTitle"],
        "Unassigned"
      ),
      team: relationName(
        employee,
        ["primary_team", "primaryTeam", "team"],
        ["team_name", "teamName"],
        "No team"
      ),
      avatarUrl: avatar ? resolveBackendMediaUrl(avatar) : null,
      source: employee,
    })
  })

  return [...unique.values()].sort((left, right) =>
    left.department.localeCompare(right.department) || left.name.localeCompare(right.name)
  )
}

function buildShifts(shifts: AdminRecord[]) {
  const unique = new Map<string, ShiftView>()
  shifts.forEach((shift) => {
    const id = readString(shift, ["id", "shift_id", "shiftId"])
    if (!id || unique.has(id)) return
    unique.set(id, {
      id,
      name: readString(shift, ["name", "shift_name", "shiftName", "title"]) || "Shift",
      startTime: readString(shift, ["start_time", "startTime"]),
      endTime: readString(shift, ["end_time", "endTime"]),
      active: readString(shift, ["status"]).toUpperCase() !== "INACTIVE",
      source: shift,
    })
  })
  return [...unique.values()]
}

function rowId(row: AdminRecord, fallback: string) {
  return readString(row, ["id", "shift_schedule_id", "shiftScheduleId"]) || fallback
}

function scheduleEmployeeId(row: AdminRecord) {
  const employee = readObject(row, ["employee"])
  return readString(row, ["employee_id", "employeeId"]) || readString(employee, ["id", "employee_id"])
}

function scheduleShiftId(row: AdminRecord) {
  const override = readObject(row, ["override_shift", "overrideShift"])
  const shift = readObject(row, ["shift"])
  return readString(row, ["override_shift_id", "overrideShiftId", "shift_id", "shiftId"])
    || readString(override, ["id", "shift_id"])
    || readString(shift, ["id", "shift_id"])
}

function assignmentEmployeeId(row: AdminRecord) {
  const employee = readObject(row, ["employee"])
  return readString(row, ["employee_id", "employeeId"])
    || readString(employee, ["id", "employee_id", "employeeId"])
}

function assignmentShiftId(row: AdminRecord) {
  const shift = readObject(row, ["shift"])
  return readString(row, ["shift_id", "shiftId"])
    || readString(shift, ["id", "shift_id", "shiftId"])
}

function activeAssignmentForDate(assignments: AdminRecord[], employeeId: string, date: string) {
  return assignments
    .filter((assignment) => {
      if (assignmentEmployeeId(assignment) !== employeeId) return false
      const status = readString(assignment, ["status"]).toUpperCase()
      if (status && status !== "ACTIVE") return false
      const effectiveFrom = readString(assignment, ["effective_from", "effectiveFrom"]).slice(0, 10)
      const effectiveTo = readString(assignment, ["effective_to", "effectiveTo"]).slice(0, 10)
      return (!effectiveFrom || effectiveFrom <= date) && (!effectiveTo || effectiveTo >= date)
    })
    .sort((left, right) => {
      const primaryDifference = Number(readBoolean(right, ["is_primary", "isPrimary"]))
        - Number(readBoolean(left, ["is_primary", "isPrimary"]))
      if (primaryDifference !== 0) return primaryDifference
      return readString(right, ["effective_from", "effectiveFrom"])
        .localeCompare(readString(left, ["effective_from", "effectiveFrom"]))
    })[0]
}

function leaveEmployeeId(row: AdminRecord) {
  const employee = readObject(row, ["employee"])
  return readString(row, ["employee_id", "employeeId"])
    || readString(employee, ["id", "employee_id", "employeeId"])
}

function approvedLeaveForDate(leaveRequests: AdminRecord[], employeeId: string, date: string) {
  return leaveRequests.find((leave) => {
    if (leaveEmployeeId(leave) !== employeeId) return false
    if (readString(leave, ["status"]).toLowerCase() !== "approved") return false
    const startDate = readString(leave, ["start_date", "startDate"]).slice(0, 10)
    const endDate = readString(leave, ["end_date", "endDate"]).slice(0, 10)
    return Boolean(startDate && endDate && startDate <= date && endDate >= date)
  })
}

function leaveDisplay(leave: AdminRecord) {
  const leaveType = readObject(leave, ["leave_type", "leaveType"])
  const name = readString(leaveType, ["name", "title", "code"])
    || readString(leave, ["leave_type_name", "leaveTypeName"])
    || "Leave"
  const duration = readString(leave, ["duration_type", "durationType"]).toLowerCase()
  const durationLabel = duration === "half_day"
    ? "Half day"
    : duration === "hourly"
      ? "Hourly"
      : "Full day"
  return { name, durationLabel }
}

function shiftForSchedule(row: AdminRecord, shiftsById: Map<string, ShiftView>): ShiftView | null {
  const nested = readObject(row, ["override_shift", "overrideShift", "shift"])
  const id = scheduleShiftId(row)
  const known = shiftsById.get(id)
  if (known) return known
  if (!nested && !id) return null
  return {
    id,
    name: readString(nested, ["name", "shift_name", "shiftName", "title"]) || "Assigned shift",
    startTime: readString(nested, ["start_time", "startTime"]),
    endTime: readString(nested, ["end_time", "endTime"]),
    active: true,
    source: nested || {},
  }
}

function escapeDelimitedCell(value: string, delimiter: string) {
  if (delimiter === "\t") return value.replaceAll("\t", " ").replaceAll("\n", " ")
  return `"${value.replaceAll('"', '""')}"`
}

function downloadTextFile(contents: string, filename: string, type: string) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function ScheduleCell({
  schedule,
  shift,
  leave,
  employeeId,
  date,
  onCreate,
  onEdit,
  onRemove,
  onClearAssigned,
}: {
  schedule: AdminRecord | undefined
  shift: ShiftView | null
  leave?: AdminRecord
  employeeId: string
  date: string
  onCreate: ShiftWeeklySchedulerProps["onCreate"]
  onEdit: ShiftWeeklySchedulerProps["onEdit"]
  onRemove: ShiftWeeklySchedulerProps["onRemove"]
  onClearAssigned: ShiftWeeklySchedulerProps["onClearAssigned"]
}) {
  const isOffDay = schedule ? readBoolean(schedule, ["is_off_day", "isOffDay"]) : false
  const scheduleId = schedule ? rowId(schedule, `${employeeId}-${date}`) : ""
  const today = dateKey(new Date())
  const isPastDate = date < today
  const canRemove = Boolean(schedule && date > today)

  if (leave) {
    const display = leaveDisplay(leave)
    const reason = readString(leave, ["reason"])
    return (
      <div
        className="flex min-h-16 flex-col justify-center border-l-2 border-l-primary bg-primary/[0.07] px-2.5 py-2"
        title={reason || `${display.name} · ${display.durationLabel}`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <p className="truncate text-xs font-semibold text-foreground">{display.name}</p>
          <span className="rounded-sm bg-primary px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide !text-white">On leave</span>
        </div>
        <p className="mt-1 truncate text-[10px] text-muted-foreground">{display.durationLabel}</p>
      </div>
    )
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (isPastDate) return
    const shiftId = event.dataTransfer.getData(DRAG_SHIFT_MIME) || event.dataTransfer.getData("text/plain")
    if (!shiftId) return
    if (schedule) {
      void onEdit(scheduleId, { shift_id: shiftId, override_shift_id: "", is_off_day: "false" })
      return
    }
    onCreate({ employeeId, scheduleDate: date, shiftId })
  }

  if (!schedule && shift) {
    return (
      <div
        className={cn(
          "group relative min-h-16 border-l-2 border-l-primary/45 bg-primary/[0.025] px-2.5 py-2 transition",
          isPastDate ? "cursor-default opacity-75" : "cursor-pointer hover:bg-primary/[0.06]"
        )}
        role={isPastDate ? undefined : "button"}
        tabIndex={isPastDate ? -1 : 0}
        aria-disabled={isPastDate || undefined}
        title={isPastDate ? "Previous days are locked." : "Active employee shift assignment. Select to create an override for this day."}
        onClick={() => {
          if (!isPastDate) onCreate({ employeeId, scheduleDate: date, shiftId: shift.id })
        }}
        onKeyDown={(event) => {
          if (!isPastDate && (event.key === "Enter" || event.key === " ")) {
            onCreate({ employeeId, scheduleDate: date, shiftId: shift.id })
          }
        }}
        onDragOver={(event) => {
          if (!isPastDate) event.preventDefault()
        }}
        onDrop={handleDrop}
      >
        <div className="flex items-start justify-between gap-1.5">
          <p className="truncate text-xs font-semibold text-foreground">{shift.name}</p>
          <span className="flex shrink-0 items-center gap-0.5">
            <span className="rounded-sm bg-primary/10 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-primary">
              Assigned
            </span>
            {date > today ? (
              <button
                type="button"
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-70 transition hover:bg-destructive/10 hover:text-destructive hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remove assigned shift on ${date}`}
                title="Remove shift from this future day"
                onClick={(event) => {
                  event.stopPropagation()
                  onClearAssigned(employeeId, date, shift.id)
                }}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <Delete16Regular className="size-3.5" />
              </button>
            ) : null}
          </span>
        </div>
        {shift.startTime || shift.endTime ? (
          <p className="mt-1 truncate text-[10px] text-muted-foreground">
            {formatTime(shift.startTime)}{shift.startTime && shift.endTime ? " – " : ""}{formatTime(shift.endTime)}
          </p>
        ) : null}
      </div>
    )
  }

  if (!schedule) {
    if (isPastDate) {
      return (
        <div
          className="flex min-h-16 cursor-not-allowed items-center justify-center bg-muted/20 text-muted-foreground/45"
          title="Shifts cannot be assigned to previous days."
          aria-label={`${date} is locked because it is in the past`}
        >
          <LockClosed16Regular className="size-3" aria-hidden />
        </div>
      )
    }

    return (
      <div
        className="group flex min-h-16 cursor-pointer items-center justify-center bg-background px-2 py-2 transition-colors hover:bg-primary/[0.045]"
        role="button"
        tabIndex={0}
        onClick={() => onCreate({ employeeId, scheduleDate: date })}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onCreate({ employeeId, scheduleDate: date })
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <button
          type="button"
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground/50 opacity-40 transition hover:bg-primary/10 hover:text-primary group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Assign a shift on ${date}`}
          title="Assign shift"
          onClick={(event) => {
            event.stopPropagation()
            onCreate({ employeeId, scheduleDate: date })
          }}
        >
          <Add20Regular className="size-3.5" />
        </button>
      </div>
    )
  }

  if (isOffDay) {
    return (
      <div
        className={cn(
          "group relative flex min-h-16 items-center justify-center px-2 py-2 text-xs font-medium text-muted-foreground transition",
          isPastDate ? "cursor-default opacity-75" : "cursor-pointer hover:brightness-95"
        )}
        style={{
          backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 5px, rgb(148 163 184 / 0.12) 5px, rgb(148 163 184 / 0.12) 7px)",
        }}
        role={isPastDate ? undefined : "button"}
        tabIndex={isPastDate ? -1 : 0}
        aria-disabled={isPastDate || undefined}
        title={isPastDate ? "Previous schedules are locked." : undefined}
        onClick={() => {
          if (!isPastDate) void onEdit(scheduleId)
        }}
        onKeyDown={(event) => {
          if (!isPastDate && (event.key === "Enter" || event.key === " ")) void onEdit(scheduleId)
        }}
        onDragOver={(event) => {
          if (!isPastDate) event.preventDefault()
        }}
        onDrop={handleDrop}
      >
        Week off
        {canRemove ? (
          <button
            type="button"
            className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-70 transition hover:bg-destructive/10 hover:text-destructive hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Remove week off on ${date}`}
            title="Remove future schedule"
            onClick={(event) => {
              event.stopPropagation()
              onRemove(scheduleId)
            }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Delete16Regular className="size-3.5" />
          </button>
        ) : isPastDate ? (
          <LockClosed16Regular className="absolute right-2 top-2 size-3 text-muted-foreground/55" aria-hidden />
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group relative min-h-16 border-l-2 border-l-primary bg-background px-2.5 py-2 transition",
        isPastDate ? "cursor-default opacity-75" : "cursor-pointer hover:bg-primary/[0.035]"
      )}
      role={isPastDate ? undefined : "button"}
      tabIndex={isPastDate ? -1 : 0}
      aria-disabled={isPastDate || undefined}
      title={isPastDate ? "Previous schedules are locked." : undefined}
      onClick={() => {
        if (!isPastDate) void onEdit(scheduleId)
      }}
      onKeyDown={(event) => {
        if (!isPastDate && (event.key === "Enter" || event.key === " ")) void onEdit(scheduleId)
      }}
      onDragOver={(event) => {
        if (!isPastDate) event.preventDefault()
      }}
      onDrop={handleDrop}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="truncate text-xs font-semibold text-foreground">{shift?.name || "Assigned shift"}</p>
        {canRemove ? (
          <button
            type="button"
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-70 transition hover:bg-destructive/10 hover:text-destructive hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Remove shift on ${date}`}
            title="Remove future schedule"
            onClick={(event) => {
              event.stopPropagation()
              onRemove(scheduleId)
            }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Delete16Regular className="size-3.5" />
          </button>
        ) : isPastDate ? (
          <LockClosed16Regular className="mt-0.5 size-3 shrink-0 text-muted-foreground/55" aria-hidden />
        ) : (
          <ReOrderDotsVertical20Regular className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
        )}
      </div>
      {shift?.startTime || shift?.endTime ? (
        <p className="mt-1 truncate text-[10px] text-muted-foreground">
          {formatTime(shift.startTime)}{shift.startTime && shift.endTime ? " – " : ""}{formatTime(shift.endTime)}
        </p>
      ) : null}
    </div>
  )
}

export function ShiftWeeklyScheduler({
  rows,
  employees,
  departments,
  shifts,
  shiftAssignments,
  leaveRequests,
  loading,
  onCreate,
  onEdit,
  onRemove,
  onClearAssigned,
  onRefresh,
}: ShiftWeeklySchedulerProps) {
  const [weekStart, setWeekStart] = React.useState(() => mondayFor(new Date()))
  const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<Set<string>>(() => new Set())
  const [viewMode, setViewMode] = React.useState<RosterViewMode>("employee")
  const [departmentFilter, setDepartmentFilter] = React.useState(ALL_DEPARTMENTS_VALUE)
  const [designationFilter, setDesignationFilter] = React.useState(ALL_DESIGNATIONS_VALUE)
  const [employeeSearch, setEmployeeSearch] = React.useState("")
  const weekDays = React.useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const weekEnd = weekDays[6]
  const isCurrentWeek = dateKey(weekStart) === dateKey(mondayFor(new Date()))
  const employeeViews = React.useMemo(
    () => buildEmployees(employees, rows, departments),
    [departments, employees, rows]
  )
  const shiftViews = React.useMemo(() => buildShifts(shifts), [shifts])
  const departmentOptions = React.useMemo(
    () => [...new Set(employeeViews.map((employee) => employee.department))].sort((left, right) => left.localeCompare(right)),
    [employeeViews]
  )
  const designationOptions = React.useMemo(
    () => [...new Set(employeeViews.map((employee) => employee.designation))].sort((left, right) => left.localeCompare(right)),
    [employeeViews]
  )
  const filteredEmployeeViews = React.useMemo(
    () => {
      const query = employeeSearch.trim().toLocaleLowerCase()
      return employeeViews.filter((employee) => {
        const matchesSearch = !query || [
          employee.name,
          employee.code,
          employee.department,
          employee.designation,
          employee.team,
        ].some((value) => value.toLocaleLowerCase().includes(query))

        return matchesSearch
          && (departmentFilter === ALL_DEPARTMENTS_VALUE || employee.department === departmentFilter)
          && (designationFilter === ALL_DESIGNATIONS_VALUE || employee.designation === designationFilter)
      })
    },
    [departmentFilter, designationFilter, employeeSearch, employeeViews]
  )
  const shiftsById = React.useMemo(() => new Map(shiftViews.map((shift) => [shift.id, shift])), [shiftViews])
  const visibleDateKeys = React.useMemo(() => new Set(weekDays.map(dateKey)), [weekDays])
  const schedulesByCell = React.useMemo(() => {
    const map = new Map<string, AdminRecord>()
    rows.forEach((row) => {
      const employeeId = scheduleEmployeeId(row)
      const date = rowDateKey(row)
      if (employeeId && visibleDateKeys.has(date)) map.set(`${employeeId}:${date}`, row)
    })
    return map
  }, [rows, visibleDateKeys])
  const inheritedShiftsByCell = React.useMemo(() => {
    const map = new Map<string, ShiftView>()
    employeeViews.forEach((employee) => {
      weekDays.forEach((day) => {
        const dayKey = dateKey(day)
        const assignment = activeAssignmentForDate(shiftAssignments, employee.id, dayKey)
        const assignedShift = assignment ? shiftsById.get(assignmentShiftId(assignment)) : null
        if (assignedShift) {
          map.set(`${employee.id}:${dayKey}`, assignedShift)
        }
      })
    })
    return map
  }, [employeeViews, shiftAssignments, shiftsById, weekDays])
  const leaveByCell = React.useMemo(() => {
    const map = new Map<string, AdminRecord>()
    employeeViews.forEach((employee) => {
      weekDays.forEach((day) => {
        const dayKey = dateKey(day)
        const leave = approvedLeaveForDate(leaveRequests, employee.id, dayKey)
        if (leave) map.set(`${employee.id}:${dayKey}`, leave)
      })
    })
    return map
  }, [employeeViews, leaveRequests, weekDays])
  const groupedEmployees = React.useMemo(() => {
    const groups = new Map<string, EmployeeView[]>()
    filteredEmployeeViews.forEach((employee) => {
      const groupName = viewMode === "team" ? employee.team : employee.department
      const group = groups.get(groupName) || []
      group.push(employee)
      groups.set(groupName, group)
    })
    return [...groups.entries()]
  }, [filteredEmployeeViews, viewMode])
  const schedulesPerDay = React.useMemo(
    () => weekDays.map((day) => {
      const key = dateKey(day)
      const visibleEmployeeIds = new Set(filteredEmployeeViews.map((employee) => employee.id))
      return filteredEmployeeViews.filter((employee) => {
        if (leaveByCell.has(`${employee.id}:${key}`)) return false
        const schedule = schedulesByCell.get(`${employee.id}:${key}`)
        if (schedule) return !readBoolean(schedule, ["is_off_day", "isOffDay"])
        return inheritedShiftsByCell.has(`${employee.id}:${key}`)
      }).length
    }),
    [filteredEmployeeViews, inheritedShiftsByCell, leaveByCell, schedulesByCell, weekDays]
  )
  const weeklyScheduleCount = schedulesPerDay.reduce((total, count) => total + count, 0)
  const allSelected = filteredEmployeeViews.length > 0
    && filteredEmployeeViews.every((employee) => selectedEmployeeIds.has(employee.id))
  const selectedVisibleEmployeeIds = filteredEmployeeViews
    .filter((employee) => selectedEmployeeIds.has(employee.id))
    .map((employee) => employee.id)

  const toggleAll = (checked: boolean) => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current)
      filteredEmployeeViews.forEach((employee) => {
        if (checked) next.add(employee.id)
        else next.delete(employee.id)
      })
      return next
    })
  }

  const toggleEmployee = (id: string, checked: boolean) => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const buildRosterText = React.useCallback((delimiter: "," | "\t") => {
    const header = ["Department", "Designation", "Employee number", "Employee", ...DAY_NAMES]
    const body = filteredEmployeeViews.map((employee) => {
      const cells = weekDays.map((day) => {
        const cellKey = `${employee.id}:${dateKey(day)}`
        const leave = leaveByCell.get(cellKey)
        if (leave) {
          const display = leaveDisplay(leave)
          return `${display.name} (${display.durationLabel})`
        }
        const schedule = schedulesByCell.get(cellKey)
        const inherited = inheritedShiftsByCell.get(cellKey)
        if (!schedule && !inherited) return ""
        if (schedule && readBoolean(schedule, ["is_off_day", "isOffDay"])) return "Week off"
        const shift = schedule ? shiftForSchedule(schedule, shiftsById) : inherited || null
        if (!shift) return "Assigned shift"
        const times = shift.startTime || shift.endTime
          ? ` (${formatTime(shift.startTime)}${shift.startTime && shift.endTime ? " - " : ""}${formatTime(shift.endTime)})`
          : ""
        return `${shift.name}${times}`
      })
      return [employee.department, employee.designation, employee.code, employee.name, ...cells]
    })
    return [header, ...body]
      .map((line) => line.map((cell) => escapeDelimitedCell(cell, delimiter)).join(delimiter))
      .join("\n")
  }, [filteredEmployeeViews, inheritedShiftsByCell, leaveByCell, schedulesByCell, shiftsById, weekDays])

  const copyRoster = async () => {
    try {
      await navigator.clipboard.writeText(buildRosterText("\t"))
      toast.success("Roster copied as tab-separated data. In Excel, select cell A1 on a blank sheet and paste (Ctrl+V).")
    } catch {
      toast.error("The roster could not be copied from this browser.")
    }
  }

  const exportRoster = () => {
    downloadTextFile(
      buildRosterText(","),
      `shift-roster-${dateKey(weekStart)}-${dateKey(weekEnd)}.csv`,
      "text/csv;charset=utf-8"
    )
    toast.success("The displayed weekly roster was exported.")
  }

  return (
    <section className="min-w-0 bg-background">
      <div className="border-b border-border bg-muted/20 px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex flex-col gap-2 sm:gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <CalendarClock24Color aria-hidden="true" className="hidden size-8 shrink-0 sm:block" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Shift rostering</h1>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                  Weekly planner
                </span>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
            <div className="flex h-9 items-center justify-between gap-1 rounded-lg border border-border bg-background p-1 sm:justify-start">
              <Button variant="ghost" size="icon-sm" className="size-7 shrink-0" aria-label="Previous week" title="Previous week" onClick={() => setWeekStart((current) => addDays(current, -7))}>
                <ChevronLeft20Regular />
              </Button>
              <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-1 text-xs font-semibold text-foreground sm:min-w-48">
                <CalendarLtr20Regular className="hidden size-4 shrink-0 text-primary sm:block" />
                <span className="truncate">{formatLongRange(weekStart, weekEnd)}</span>
              </div>
              <Button variant="ghost" size="icon-sm" className="size-7 shrink-0" aria-label="Next week" title="Next week" onClick={() => setWeekStart((current) => addDays(current, 7))}>
                <ChevronRight20Regular />
              </Button>
            </div>
            {!isCurrentWeek ? (
              <Button variant="outline" size="sm" className="h-9" onClick={() => setWeekStart(mondayFor(new Date()))}>This week</Button>
            ) : null}
            <ToggleGroup
              multiple={false}
              value={[viewMode]}
              onValueChange={(value) => {
                const next = value[0] as RosterViewMode | undefined
                if (next) setViewMode(next)
              }}
              variant="outline"
              size="sm"
              className="w-full bg-muted/50 p-0.5 text-foreground sm:w-auto [&_[data-slot=toggle-group-item]]:h-8 [&_[data-slot=toggle-group-item]]:flex-1 [&_[data-slot=toggle-group-item]]:border-0 [&_[data-slot=toggle-group-item]]:bg-transparent [&_[data-slot=toggle-group-item]]:px-3 [&_[data-slot=toggle-group-item]]:text-[11px] [&_[data-slot=toggle-group-item]]:text-foreground [&_[data-slot=toggle-group-item]]:aria-pressed:bg-background [&_[data-slot=toggle-group-item]]:aria-pressed:!text-foreground [&_[data-slot=toggle-group-item]]:aria-pressed:shadow-sm [&_[data-slot=toggle-group-item]]:data-[state=on]:bg-background [&_[data-slot=toggle-group-item]]:data-[state=on]:!text-foreground [&_[data-slot=toggle-group-item]]:data-[state=on]:shadow-sm"
              aria-label="Roster grouping"
            >
              <ToggleGroupItem value="employee">Employee</ToggleGroupItem>
              <ToggleGroupItem value="department">Department</ToggleGroupItem>
              <ToggleGroupItem value="team">Team</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-b border-border bg-background px-3 py-2.5 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Filter20Regular className="size-3.5" /> Filters
          </span>
          <Input
            type="search"
            value={employeeSearch}
            onChange={(event) => setEmployeeSearch(event.target.value)}
            placeholder="Search employees"
            className="w-full bg-background sm:w-44"
            aria-label="Search employees by name, employee number, department, designation, or team"
          />
          <Select value={designationFilter} onValueChange={(value) => setDesignationFilter(value || ALL_DESIGNATIONS_VALUE)}>
            <SelectTrigger size="sm" className="w-full bg-background sm:w-44" aria-label="Filter by designation">
              <SelectValue placeholder={ALL_DESIGNATIONS_VALUE} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_DESIGNATIONS_VALUE}>{ALL_DESIGNATIONS_VALUE}</SelectItem>
                {designationOptions.map((designation) => <SelectItem key={designation} value={designation}>{designation}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={(value) => setDepartmentFilter(value || ALL_DEPARTMENTS_VALUE)}>
            <SelectTrigger size="sm" className="w-full bg-background sm:w-44" aria-label="Filter by department">
              <SelectValue placeholder={ALL_DEPARTMENTS_VALUE} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_DEPARTMENTS_VALUE}>{ALL_DEPARTMENTS_VALUE}</SelectItem>
                {departmentOptions.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          {selectedVisibleEmployeeIds.length > 0 ? (
            <div className="flex h-8 items-center gap-2 rounded-lg bg-primary/8 px-2.5 text-[11px] font-medium text-primary">
              {selectedVisibleEmployeeIds.length} selected · choose a shift to assign
              <button type="button" className="font-semibold hover:underline" onClick={() => setSelectedEmployeeIds(new Set())}>Clear</button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          <Button variant="ghost" size="sm" onClick={() => void copyRoster()}>
            <Copy20Regular data-icon="inline-start" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={exportRoster}>
            <ArrowDownload20Regular data-icon="inline-start" />
            Export
          </Button>
          <Button variant="outline" size="icon-sm" disabled={loading} aria-label="Refresh schedules" title="Refresh" onClick={onRefresh}>
            <ArrowSync20Regular data-icon="inline-start" className={cn(loading && "animate-spin")} />
          </Button>
          <Button size="sm" onClick={() => onCreate()}>
            <Add20Regular data-icon="inline-start" />
            Add schedule
          </Button>
        </div>
      </div>

      <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 bg-background px-3 py-1.5 text-[10px] text-muted-foreground sm:px-4">
        <span><span className="font-semibold text-foreground">{filteredEmployeeViews.length}</span> {filteredEmployeeViews.length === 1 ? "employee" : "employees"}</span>
        <span aria-hidden="true" className="text-border">·</span>
        <span><span className="font-semibold text-foreground">{weeklyScheduleCount}</span> {weeklyScheduleCount === 1 ? "assignment" : "assignments"} this week</span>
      </div>

      <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_205px]">
        <div className="min-w-0 overflow-x-auto">
          <div className="min-w-[1035px]">
            <div className="grid grid-cols-[200px_repeat(7,minmax(119px,1fr))] border-b border-border">
              <div className="flex min-h-13 items-center gap-2.5 border-r border-border px-3">
                <Checkbox checked={allSelected} onCheckedChange={(value) => toggleAll(Boolean(value))} aria-label="Select all employees" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Employee details</p>
                  <p className="text-[10px] text-muted-foreground">{filteredEmployeeViews.length} {filteredEmployeeViews.length === 1 ? "person" : "people"}</p>
                </div>
              </div>
              {weekDays.map((day, index) => {
                const isToday = dateKey(day) === dateKey(new Date())
                return (
                  <div key={dateKey(day)} className="flex min-h-13 flex-col items-center justify-center border-r border-border px-2 text-center last:border-r-0">
                    <p className="text-xs font-semibold text-foreground">{DAY_NAMES[index]}</p>
                    <span className={cn(
                      "mt-1 inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
                      isToday && "bg-primary text-primary-foreground"
                    )}>
                      {String(day.getDate()).padStart(2, "0")}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-[200px_repeat(7,minmax(119px,1fr))] border-b border-border bg-muted/20">
              <div className="flex min-h-8 items-center border-r border-border px-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Weekly allocation
              </div>
              {schedulesPerDay.map((count, index) => (
                <div key={DAY_NAMES[index]} className="flex min-h-8 items-center justify-center border-r border-border px-2 text-[9px] text-muted-foreground last:border-r-0">
                  {count} {count === 1 ? "shift" : "shifts"}
                </div>
              ))}
            </div>

            {loading && employeeViews.length === 0 ? (
              <div className="space-y-px bg-border">
                {Array.from({ length: 5 }, (_, rowIndex) => (
                  <div key={rowIndex} className="grid grid-cols-[200px_repeat(7,minmax(119px,1fr))] gap-px">
                    <div className="flex h-16 items-center gap-2.5 bg-background px-3"><Skeleton className="size-10 rounded-full" /><Skeleton className="h-4 w-24" /></div>
                    {Array.from({ length: 7 }, (_, cellIndex) => <div key={cellIndex} className="flex h-16 items-center bg-background px-2"><Skeleton className="h-11 w-full" /></div>)}
                  </div>
                ))}
              </div>
            ) : groupedEmployees.length === 0 ? (
              <div className="flex min-h-60 flex-col items-center justify-center px-6 text-center">
                <PeopleTeam24Regular className="size-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-semibold text-foreground">No employees available</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">Employees will appear here once they are available for shift scheduling.</p>
              </div>
            ) : (
              groupedEmployees.map(([department, people]) => (
                <React.Fragment key={department}>
                  <div className="grid grid-cols-[200px_repeat(7,minmax(119px,1fr))] border-b border-border bg-primary/[0.055]">
                    <div className="col-span-8 flex min-h-8 items-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/75">
                      {department} <span className="ml-2 font-normal text-muted-foreground">{people.length}</span>
                    </div>
                  </div>
                  {people.map((employee) => (
                    <div key={employee.id} className="grid grid-cols-[200px_repeat(7,minmax(119px,1fr))] border-b border-border last:border-b-0">
                      <div className="flex min-h-16 items-center gap-2.5 border-r border-border px-3">
                        <Checkbox
                          checked={selectedEmployeeIds.has(employee.id)}
                          onCheckedChange={(value) => toggleEmployee(employee.id, Boolean(value))}
                          aria-label={`Select ${employee.name}`}
                        />
                        <Avatar size="lg">
                          {employee.avatarUrl ? <AvatarImage src={employee.avatarUrl} alt="" /> : null}
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(employee.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">{employee.name}</p>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            {employee.designation !== "Unassigned" ? employee.designation : employee.department}{employee.code ? ` · ${employee.code}` : ""}
                          </p>
                        </div>
                      </div>
                      {weekDays.map((day) => {
                        const dayKey = dateKey(day)
                        const cellKey = `${employee.id}:${dayKey}`
                        const leave = leaveByCell.get(cellKey)
                        const schedule = schedulesByCell.get(cellKey)
                        const inherited = inheritedShiftsByCell.get(cellKey)
                        const shift = schedule ? shiftForSchedule(schedule, shiftsById) : inherited || null
                        return (
                          <div key={dayKey} className="border-r border-border last:border-r-0">
                            <ScheduleCell
                              schedule={schedule}
                              shift={shift}
                              leave={leave}
                              employeeId={employee.id}
                              date={dayKey}
                              onCreate={onCreate}
                              onEdit={onEdit}
                              onRemove={onRemove}
                              onClearAssigned={onClearAssigned}
                            />
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </React.Fragment>
              ))
            )}
          </div>
        </div>

        <aside className={cn(
          "border-t border-border bg-muted/[0.12] xl:border-l xl:border-t-0",
          filteredEmployeeViews.length > 1 && "xl:sticky xl:top-14 xl:z-20 xl:self-start"
        )}>
          <div className="border-b border-border px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Shifts <span className="font-normal text-muted-foreground">{shiftViews.length}</span></h2>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {selectedVisibleEmployeeIds.length > 0 ? "Click a shift to assign it to selected employees." : "Drag a shift onto a day to assign it."}
                </p>
              </div>
              <Link
                href="/dashboard/attendance/shifts"
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[10px] font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Settings20Regular className="size-3" />
                Manage
              </Link>
            </div>
          </div>
          <div className="grid max-h-[calc(100vh-15rem)] min-h-0 gap-1.5 overflow-y-auto p-2 sm:grid-cols-2 xl:grid-cols-1">
            {shiftViews.length === 0 ? (
              <div className="border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                No shifts are defined yet. Open Shift Management to add the first shift.
              </div>
            ) : shiftViews.map((shift) => (
              <button
                key={shift.id}
                type="button"
                draggable={shift.active}
                disabled={!shift.active}
                className="flex min-h-14 cursor-grab items-center justify-between gap-2 border border-border bg-background px-2.5 py-2 text-left shadow-xs transition hover:border-primary/45 hover:bg-primary/[0.025] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-55"
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "copy"
                  event.dataTransfer.setData(DRAG_SHIFT_MIME, shift.id)
                  event.dataTransfer.setData("text/plain", shift.id)
                }}
                onClick={() => onCreate({
                  shiftId: shift.id,
                  ...(selectedVisibleEmployeeIds.length > 0 ? { employeeIds: selectedVisibleEmployeeIds } : {}),
                })}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">{shift.name}</span>
                  {shift.startTime || shift.endTime ? (
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                      {formatTime(shift.startTime)}{shift.startTime && shift.endTime ? " – " : ""}{formatTime(shift.endTime)}
                    </span>
                  ) : null}
                  {!shift.active ? <span className="mt-0.5 block text-[9px] font-medium text-muted-foreground">Inactive</span> : null}
                </span>
                <ReOrderDotsVertical20Regular className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  )
}
