"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Clock3Icon, PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"

import {
  buildFormDraftStorageKey,
  clearPersistedFormState,
  persistFormState,
  readPersistedFormState,
  RecordDetailsDialog,
} from "@/components/dashboard/admin-view-shared"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { TableScrollContainer } from "@/components/common/table-scroll-container"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  createShiftResource,
  createTimetableResource,
  deleteShiftResourceById,
  deleteTimetableResourceById,
  getCurrentAdmin,
  listAttendanceHolidays,
  getShiftResourceById,
  getTimetableResourceById,
  listAttendanceHolidayGroups,
  listBranches,
  listDepartments,
  listEmployees,
  listUsers,
  listShiftResources,
  listTimetableResources,
  patchShiftResourceById,
  patchTimetableResourceById,
  type AdminRecord,
  type ShiftResourceKey,
  type TimetableResourceKey,
} from "@/lib/admin-api"
import { cn } from "@/lib/utils"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

type ScheduleSectionKey = ShiftResourceKey | TimetableResourceKey
type ScheduleModuleKey = "shift" | "timetable"
type FieldType =
  | "text"
  | "number"
  | "date"
  | "time"
  | "duration"
  | "boolean"
  | "select"
  | "textarea"
  | "multiselect"

type FieldConfig = {
  key: string
  label: string
  type: FieldType
  required?: boolean
  hidden?: boolean
  placeholder?: string
  helpText?: string
  autoFillLabelFromOption?: boolean
  options?: Array<{ label: string; value: string }>
}

type SectionConfig = {
  module: ScheduleModuleKey
  title: string
  moduleTitle: string
  description: string
  fields: FieldConfig[]
}

type LookupState = {
  branches: AdminRecord[]
  departments: AdminRecord[]
  employees: AdminRecord[]
  shifts: AdminRecord[]
  timetables: AdminRecord[]
  holidays: AdminRecord[]
  holidayGroups: AdminRecord[]
  rotationGroups: AdminRecord[]
  timetableDays: AdminRecord[]
  timetableRotations: AdminRecord[]
}

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

const STATUS_OPTIONS = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
]

const SHIFT_TYPE_OPTIONS = [
  { label: "Fixed", value: "FIXED" },
  { label: "Flexible", value: "FLEXIBLE" },
  { label: "Rotational", value: "ROTATIONAL" },
]

const BREAK_TYPE_OPTIONS = [
  { label: "Lunch", value: "LUNCH" },
  { label: "Tea", value: "TEA" },
  { label: "Rest", value: "REST" },
  { label: "Other", value: "OTHER" },
]

const TIMETABLE_TYPE_OPTIONS = [
  { label: "Fixed", value: "FIXED" },
  { label: "Flexible", value: "FLEXIBLE" },
  { label: "Rotational", value: "ROTATIONAL" },
]

const DAY_OF_WEEK_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

const DAY_OF_WEEK_OPTIONS = DAY_OF_WEEK_LABELS.map((label, index) => ({
  label,
  value: String(index),
}))

const TIME_HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"))
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"))
const DURATION_HOUR_OPTIONS = Array.from({ length: 25 }, (_, index) => String(index))

const DAY_OF_WEEK_VALUE_MAP: Record<string, string> = {
  MONDAY: "0",
  TUESDAY: "1",
  WEDNESDAY: "2",
  THURSDAY: "3",
  FRIDAY: "4",
  SATURDAY: "5",
  SUNDAY: "6",
}

const HOLIDAY_ACTION_OPTIONS = [
  { label: "Off Day", value: "OFF_DAY" },
  { label: "Paid Holiday", value: "PAID_HOLIDAY" },
  { label: "Working Holiday", value: "WORKING_HOLIDAY" },
]

const TEMPLATE_TYPE_OPTIONS = [
  { label: "Fixed", value: "FIXED" },
  { label: "Rotational", value: "ROTATIONAL" },
  { label: "Flexible", value: "FLEXIBLE" },
  { label: "Custom", value: "CUSTOM" },
]

const SECTION_CONFIG: Record<ScheduleSectionKey, SectionConfig> = {
  shifts: {
    module: "shift",
    title: "Shifts",
    moduleTitle: "Shift Management",
    description: "Manage the master shift definitions used across attendance scheduling.",
    fields: [
      { key: "name", label: "Shift Name", type: "text", required: true, placeholder: "Morning Shift" },
      { key: "code", label: "Shift Code", type: "text", hidden: true, placeholder: "MORNING" },
      { key: "description", label: "Description", type: "textarea", placeholder: "Optional note about this shift." },
      { key: "shift_type", label: "Shift Type", type: "select", required: true, options: SHIFT_TYPE_OPTIONS },
      { key: "branch_id", label: "Branch", type: "select" },
      { key: "department_id", label: "Department", type: "select" },
      { key: "start_time", label: "Start Time", type: "time", required: true },
      { key: "end_time", label: "End Time", type: "time", required: true },
      { key: "expected_work_minutes", label: "Expected Work Duration", type: "duration", required: true },
      { key: "minimum_work_minutes", label: "Minimum Work Duration", type: "duration", required: true },
      { key: "half_day_minutes", label: "Half Day Threshold", type: "duration", required: true },
      { key: "grace_in_minutes", label: "Grace In", type: "duration" },
      { key: "grace_out_minutes", label: "Grace Out", type: "duration" },
      { key: "late_after_minutes", label: "Late After", type: "duration" },
      { key: "early_leave_after_minutes", label: "Early Leave After", type: "duration" },
      { key: "max_overtime_minutes", label: "Max Overtime", type: "duration" },
      { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
      { key: "is_night_shift", label: "Night Shift", type: "boolean" },
      { key: "crosses_midnight", label: "Crosses Midnight", type: "boolean" },
      { key: "allow_overtime", label: "Allow Overtime", type: "boolean" },
      { key: "requires_checkout", label: "Requires Checkout", type: "boolean" },
      { key: "allow_early_checkin", label: "Allow Early Check-In", type: "boolean" },
      { key: "allow_late_checkout", label: "Allow Late Checkout", type: "boolean" },
    ],
  },
  "shift-breaks": {
    module: "shift",
    title: "Shift Breaks",
    moduleTitle: "Shift Management",
    description: "Manage break windows that belong to a shift.",
    fields: [
      { key: "shift_id", label: "Shift", type: "select", required: true },
      { key: "name", label: "Break Name", type: "text", required: true, placeholder: "Lunch Break" },
      { key: "break_type", label: "Break Type", type: "select", required: true, options: BREAK_TYPE_OPTIONS, autoFillLabelFromOption: true },
      { key: "start_time", label: "Start Time", type: "time", required: true },
      { key: "end_time", label: "End Time", type: "time", required: true },
      { key: "duration_minutes", label: "Break Duration", type: "duration", required: true },
      { key: "is_paid", label: "Paid Break", type: "boolean" },
      { key: "is_flexible", label: "Flexible Break", type: "boolean" },
    ],
  },
  "shift-attendance-rules": {
    module: "shift",
    title: "Shift Attendance Rules",
    moduleTitle: "Shift Management",
    description: "Manage late, absent, and validation rules that apply to a shift.",
    fields: [
      { key: "shift_id", label: "Shift", type: "select", required: true },
      { key: "late_after_minutes", label: "Late After", type: "duration", required: true },
      { key: "absent_after_minutes", label: "Absent After", type: "duration", required: true },
      { key: "half_day_after_minutes", label: "Half Day After", type: "duration", required: true },
      { key: "allow_multiple_checkin", label: "Allow Multiple Check-Ins", type: "boolean" },
      { key: "auto_mark_absent", label: "Auto Mark Absent", type: "boolean" },
      { key: "allow_mobile_attendance", label: "Allow Mobile Attendance", type: "boolean" },
      { key: "allow_remote_attendance", label: "Allow Remote Attendance", type: "boolean" },
      { key: "require_geofence", label: "Require Geofence", type: "boolean" },
      { key: "require_biometric", label: "Require Biometric", type: "boolean" },
    ],
  },
  "shift-overtime-rules": {
    module: "shift",
    title: "Shift Overtime Rules",
    moduleTitle: "Shift Management",
    description: "Manage overtime qualification and calculation rules for a shift.",
    fields: [
      { key: "shift_id", label: "Shift", type: "select", required: true },
      { key: "overtime_start_after_minutes", label: "Start Overtime After", type: "duration", required: true },
      { key: "max_daily_overtime_minutes", label: "Max Daily Overtime", type: "duration", required: true },
      { key: "overtime_rate_multiplier", label: "Overtime Rate Multiplier", type: "number", required: true },
      { key: "weekend_multiplier", label: "Weekend Multiplier", type: "number", required: true },
      { key: "holiday_multiplier", label: "Holiday Multiplier", type: "number", required: true },
      { key: "requires_approval", label: "Requires Approval", type: "boolean" },
      { key: "auto_calculate", label: "Auto Calculate", type: "boolean" },
    ],
  },
  "shift-assignments": {
    module: "shift",
    title: "Shift Assignments",
    moduleTitle: "Shift Management",
    description: "Link employees or groups to their assigned shifts.",
    fields: [
      { key: "employee_id", label: "Employee", type: "select", required: true },
      { key: "shift_id", label: "Shift", type: "select", required: true },
      { key: "effective_from", label: "Effective From", type: "date", required: true },
      { key: "effective_to", label: "Effective To", type: "date" },
      { key: "rotation_group_id", label: "Rotation Group", type: "select" },
      { key: "assigned_by", label: "Assigned By User Id", type: "number", hidden: true },
      { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
      { key: "is_primary", label: "Primary Assignment", type: "boolean" },
    ],
  },
  "shift-schedules": {
    module: "shift",
    title: "Shift Schedules",
    moduleTitle: "Shift Management",
    description: "Manage dated schedule entries generated from or attached to shifts.",
    fields: [
      { key: "employee_id", label: "Employee", type: "select", required: true },
      { key: "shift_id", label: "Shift", type: "select", required: true },
      { key: "schedule_date", label: "Schedule Date", type: "date", required: true },
      { key: "override_shift_id", label: "Override Shift", type: "select" },
      { key: "holiday_id", label: "Holiday", type: "select" },
      { key: "assigned_by", label: "Assigned By User Id", type: "number", hidden: true },
      { key: "remarks", label: "Remarks", type: "textarea" },
      { key: "generated_from_rotation", label: "Generated From Rotation", type: "boolean" },
      { key: "is_off_day", label: "Off Day", type: "boolean" },
    ],
  },
  "shift-templates": {
    module: "shift",
    title: "Shift Templates",
    moduleTitle: "Shift Management",
    description: "Manage reusable shift setup templates.",
    fields: [
      { key: "name", label: "Template Name", type: "text", required: true },
      { key: "template_type", label: "Template Type", type: "select", required: true, options: TEMPLATE_TYPE_OPTIONS },
      {
        key: "configuration_shift_ids",
        label: "Included Shifts",
        type: "multiselect",
        helpText: "Choose one or more shifts to include in this template.",
      },
      {
        key: "configuration_default_shift_id",
        label: "Default Shift",
        type: "select",
        helpText: "Pick the main shift used by this template when one default should apply.",
      },
      {
        key: "configuration_rotation_group_id",
        label: "Rotation Group",
        type: "select",
        helpText: "Use this for rotational templates that should follow an existing rotation group.",
      },
      {
        key: "configuration_notes",
        label: "Notes",
        type: "textarea",
        helpText: "Optional notes to help other admins understand how this template is meant to be used.",
      },
      { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    ],
  },
  "shift-rotation-groups": {
    module: "shift",
    title: "Rotation Groups",
    moduleTitle: "Shift Management",
    description: "Manage groups that rotate across shifts.",
    fields: [
      { key: "name", label: "Rotation Group Name", type: "text", required: true },
      { key: "code", label: "Rotation Group Code", type: "text", required: true },
      { key: "cycle_days", label: "Cycle Days", type: "number", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    ],
  },
  "shift-rotation-rules": {
    module: "shift",
    title: "Rotation Rules",
    moduleTitle: "Shift Management",
    description: "Manage the rotation rules used by shift rotation groups.",
    fields: [
      { key: "rotation_group_id", label: "Rotation Group", type: "select", required: true },
      { key: "shift_id", label: "Shift", type: "select" },
      { key: "day_index", label: "Day Index", type: "number", required: true, helpText: "Day number inside the rotation cycle." },
      { key: "is_off_day", label: "Off Day", type: "boolean" },
    ],
  },
  "shift-change-requests": {
    module: "shift",
    title: "Shift Change Requests",
    moduleTitle: "Shift Management",
    description: "Review and manage submitted requests to change shifts.",
    fields: [
      { key: "employee_id", label: "Employee", type: "select", required: true },
      { key: "current_shift_id", label: "Current Shift", type: "select", required: true },
      { key: "requested_shift_id", label: "Requested Shift", type: "select", required: true },
      { key: "request_date", label: "Request Date", type: "date", required: true },
      { key: "reason", label: "Reason", type: "textarea", required: true },
      { key: "approved_by", label: "Approved By User Id", type: "number" },
      { key: "approved_at", label: "Approved At", type: "text", placeholder: "2026-06-12T10:30:00Z" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Pending", value: "PENDING" },
          { label: "Approved", value: "APPROVED" },
          { label: "Rejected", value: "REJECTED" },
        ],
      },
    ],
  },
  timetables: {
    module: "timetable",
    title: "Timetables",
    moduleTitle: "Timetable Management",
    description: "Manage master timetable definitions used for structured attendance planning.",
    fields: [
      { key: "name", label: "Timetable Name", type: "text", required: true, placeholder: "Main Office Timetable" },
      { key: "code", label: "Timetable Code", type: "text", required: true, placeholder: "MAIN-TT" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "timetable_type", label: "Timetable Type", type: "select", required: true, options: TIMETABLE_TYPE_OPTIONS },
      { key: "timezone", label: "Timezone", type: "text", required: true, placeholder: "Africa/Dar_es_Salaam" },
      { key: "branch_id", label: "Branch", type: "select" },
      { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
      { key: "is_default", label: "Default Timetable", type: "boolean" },
    ],
  },
  "timetable-days": {
    module: "timetable",
    title: "Timetable Days",
    moduleTitle: "Timetable Management",
    description: "Manage the day entries that belong to a timetable.",
    fields: [
      { key: "timetable_id", label: "Timetable", type: "select", required: true },
      { key: "day_of_week", label: "Day Of Week", type: "select", required: true, options: DAY_OF_WEEK_OPTIONS },
      { key: "default_shift_id", label: "Default Shift", type: "select" },
      { key: "expected_check_in_time", label: "Expected Check-In Time", type: "time" },
      { key: "expected_check_out_time", label: "Expected Check-Out Time", type: "time" },
      { key: "flexible_start_from", label: "Flexible Start From", type: "time" },
      { key: "flexible_start_to", label: "Flexible Start To", type: "time" },
      { key: "minimum_work_minutes", label: "Minimum Work Duration", type: "duration" },
      { key: "break_minutes", label: "Break Duration", type: "duration" },
      { key: "is_working_day", label: "Working Day", type: "boolean" },
      { key: "allow_flexible_time", label: "Allow Flexible Time", type: "boolean" },
      { key: "overtime_allowed", label: "Overtime Allowed", type: "boolean" },
      { key: "break_required", label: "Break Required", type: "boolean" },
    ],
  },
  "timetable-shift-rules": {
    module: "timetable",
    title: "Timetable Shift Rules",
    moduleTitle: "Timetable Management",
    description: "Manage rules that connect shifts to timetable days.",
    fields: [
      { key: "timetable_day_id", label: "Timetable Day", type: "select", required: true },
      { key: "shift_id", label: "Shift", type: "select", required: true },
      { key: "priority_order", label: "Priority Order", type: "number" },
      { key: "max_employees", label: "Max Employees", type: "number" },
      { key: "is_primary", label: "Primary Shift Rule", type: "boolean" },
    ],
  },
  "timetable-holiday-rules": {
    module: "timetable",
    title: "Timetable Holiday Rules",
    moduleTitle: "Timetable Management",
    description: "Manage holiday behavior for each timetable.",
    fields: [
      { key: "timetable_id", label: "Timetable", type: "select", required: true },
      { key: "holiday_group_id", label: "Holiday Group", type: "select", required: true },
      { key: "action_type", label: "Action Type", type: "select", required: true, options: HOLIDAY_ACTION_OPTIONS },
      { key: "apply_overtime_rules", label: "Apply Overtime Rules", type: "boolean" },
      { key: "auto_mark_offday", label: "Auto Mark Off Day", type: "boolean" },
    ],
  },
  "timetable-attendance-rules": {
    module: "timetable",
    title: "Timetable Attendance Rules",
    moduleTitle: "Timetable Management",
    description: "Manage timetable-level attendance validation and tolerance rules.",
    fields: [
      { key: "timetable_id", label: "Timetable", type: "select", required: true },
      { key: "late_after_minutes", label: "Late After", type: "duration", required: true },
      { key: "half_day_after_minutes", label: "Half Day After", type: "duration", required: true },
      { key: "absent_after_minutes", label: "Absent After", type: "duration", required: true },
      { key: "max_overtime_minutes", label: "Max Overtime", type: "duration", required: true },
      { key: "allow_early_checkin", label: "Allow Early Check-In", type: "boolean" },
      { key: "allow_late_checkout", label: "Allow Late Checkout", type: "boolean" },
      { key: "auto_absent_if_no_checkin", label: "Auto Absent If No Check-In", type: "boolean" },
    ],
  },
  "timetable-rotations": {
    module: "timetable",
    title: "Timetable Rotations",
    moduleTitle: "Timetable Management",
    description: "Manage rotation blocks inside the timetable cycle.",
    fields: [
      { key: "timetable_id", label: "Timetable", type: "select", required: true },
      { key: "name", label: "Rotation Name", type: "text", required: true },
      { key: "cycle_days", label: "Cycle Days", type: "number", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    ],
  },
  "timetable-rotation-rules": {
    module: "timetable",
    title: "Timetable Rotation Rules",
    moduleTitle: "Timetable Management",
    description: "Manage the rules that define how timetable rotations progress.",
    fields: [
      { key: "rotation_id", label: "Timetable Rotation", type: "select", required: true },
      { key: "day_index", label: "Day Index", type: "number", required: true },
      { key: "shift_id", label: "Shift", type: "select" },
      { key: "is_off_day", label: "Off Day", type: "boolean" },
    ],
  },
  "employee-timetables": {
    module: "timetable",
    title: "Employee Timetables",
    moduleTitle: "Timetable Management",
    description: "Manage employee-to-timetable assignments.",
    fields: [
      { key: "employee_id", label: "Employee", type: "select", required: true },
      { key: "timetable_id", label: "Timetable", type: "select", required: true },
      { key: "effective_from", label: "Effective From", type: "date", required: true },
      { key: "effective_to", label: "Effective To", type: "date" },
      { key: "assigned_by", label: "Assigned By User Id", type: "number", hidden: true },
      { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    ],
  },
  "timetable-generated-schedules": {
    module: "timetable",
    title: "Generated Schedules",
    moduleTitle: "Timetable Management",
    description: "Manage schedules generated from timetables for specific dates and employees.",
    fields: [
      { key: "employee_id", label: "Employee", type: "select", required: true },
      { key: "timetable_id", label: "Timetable", type: "select", required: true },
      { key: "shift_id", label: "Shift", type: "select" },
      { key: "schedule_date", label: "Schedule Date", type: "date", required: true },
      { key: "holiday_id", label: "Holiday", type: "select" },
      { key: "source_rule", label: "Source Rule", type: "text" },
      { key: "generated_from_rotation", label: "Generated From Rotation", type: "boolean" },
      { key: "is_off_day", label: "Off Day", type: "boolean" },
    ],
  },
}

const EMPTY_LOOKUPS: LookupState = {
  branches: [],
  departments: [],
  employees: [],
  shifts: [],
  timetables: [],
  holidays: [],
  holidayGroups: [],
  rotationGroups: [],
  timetableDays: [],
  timetableRotations: [],
}

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

function resolveSection(section: string): ScheduleSectionKey {
  return (Object.keys(SECTION_CONFIG).includes(section) ? section : "shifts") as ScheduleSectionKey
}

function formatLoadError(errorObject: unknown, fallback: string) {
  if (errorObject instanceof Error && errorObject.message) {
    return errorObject.message
  }
  return fallback
}

function prettifyLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function isIsoDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}T/.test(value)
}

function isTimeValue(value: string) {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(value)
}

function formatDisplayDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date)
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function formatDisplayTime(value: string) {
  const [hours, minutes] = value.split(":")
  const hourNumber = Number(hours)
  const minuteNumber = Number(minutes)
  if (!Number.isInteger(hourNumber) || !Number.isInteger(minuteNumber)) {
    return value
  }

  const date = new Date()
  date.setHours(hourNumber, minuteNumber, 0, 0)
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) {
      return "-"
    }
    if (isIsoDateString(trimmed)) {
      return formatDisplayDate(trimmed)
    }
    if (isTimeValue(trimmed)) {
      return formatDisplayTime(trimmed)
    }
    return trimmed
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : "-"
  if (typeof value === "object") return "Object"
  return "-"
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

function readNestedRecord(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as AdminRecord
    }
  }
  return null
}

function buildInitialValues(fields: FieldConfig[]) {
  return Object.fromEntries(fields.map((field) => [field.key, ""]))
}

function minutesToDurationParts(value: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { hours: "", minutes: "" }
  }
  const totalMinutes = Math.floor(parsed)
  return {
    hours: String(Math.floor(totalMinutes / 60)),
    minutes: String(totalMinutes % 60),
  }
}

function durationPartsToMinutes(hoursValue: string, minutesValue: string) {
  const trimmedHours = hoursValue.trim()
  const trimmedMinutes = minutesValue.trim()

  if (!trimmedHours && !trimmedMinutes) {
    return ""
  }

  const hours = trimmedHours ? Number(trimmedHours) : 0
  const minutes = trimmedMinutes ? Number(trimmedMinutes) : 0

  if (!Number.isFinite(hours) || hours < 0 || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
    return ""
  }

  return String(hours * 60 + minutes)
}

function timeValueToParts(value: string) {
  if (!isTimeValue(value)) {
    return { hours: "", minutes: "" }
  }
  const [hours, minutes] = value.split(":")
  return { hours, minutes }
}

function timePartsToValue(hoursValue: string, minutesValue: string) {
  if (!hoursValue && !minutesValue) {
    return ""
  }
  if (!hoursValue || !minutesValue) {
    return ""
  }
  return `${hoursValue.padStart(2, "0")}:${minutesValue.padStart(2, "0")}`
}

function buildEditValues(fields: FieldConfig[], row: AdminRecord) {
  const values: Record<string, string> = {}
  const templateConfiguration =
    typeof row.configuration === "object" && row.configuration !== null
      ? (row.configuration as AdminRecord)
      : null
  for (const field of fields) {
    if (field.key === "configuration_shift_ids") {
      const shiftIds = Array.isArray(templateConfiguration?.shift_ids)
        ? templateConfiguration.shift_ids
        : Array.isArray(templateConfiguration?.shiftIds)
          ? templateConfiguration.shiftIds
          : []
      values[field.key] = shiftIds
        .map((entry) => (typeof entry === "number" || typeof entry === "string" ? String(entry) : ""))
        .filter(Boolean)
        .join(",")
      continue
    }
    if (field.key === "configuration_default_shift_id") {
      values[field.key] = stringifyLookupValue(
        templateConfiguration?.default_shift_id ?? templateConfiguration?.defaultShiftId
      )
      continue
    }
    if (field.key === "configuration_rotation_group_id") {
      values[field.key] = stringifyLookupValue(
        templateConfiguration?.rotation_group_id ?? templateConfiguration?.rotationGroupId
      )
      continue
    }
    if (field.key === "configuration_notes") {
      values[field.key] =
        typeof templateConfiguration?.notes === "string" ? templateConfiguration.notes : ""
      continue
    }
    const value = row[field.key]
    if (value === null || value === undefined) {
      values[field.key] = ""
      continue
    }
    if (field.type === "boolean") {
      values[field.key] = value ? "true" : "false"
      continue
    }
    if (field.type === "multiselect") {
      values[field.key] = Array.isArray(value)
        ? value
            .map((entry) => (typeof entry === "number" || typeof entry === "string" ? String(entry) : ""))
            .filter(Boolean)
            .join(",")
        : ""
      continue
    }
    if (field.key === "day_of_week") {
      if (typeof value === "number" && Number.isFinite(value)) {
        values[field.key] = String(value)
        continue
      }
      if (typeof value === "string" && value.trim()) {
        const trimmedValue = value.trim()
        values[field.key] = DAY_OF_WEEK_VALUE_MAP[trimmedValue.toUpperCase()] ?? trimmedValue
        continue
      }
    }
    if (field.type === "date" && typeof value === "string" && value.trim()) {
      values[field.key] = value.trim().slice(0, 10)
      continue
    }
    values[field.key] = String(value)
  }
  return values
}

function stringifyLookupValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }
  return ""
}

function resolveVisibleColumns(section: ScheduleSectionKey, rows: AdminRecord[]) {
  const preferredBySection: Partial<Record<ScheduleSectionKey, string[]>> = {
    shifts: ["name", "status", "start_time", "end_time"],
    "shift-breaks": ["name", "shift_id", "start_time", "end_time"],
    "shift-attendance-rules": ["shift_id", "late_after_minutes", "absent_after_minutes", "half_day_after_minutes"],
    "shift-overtime-rules": ["shift_id", "overtime_start_after_minutes", "max_daily_overtime_minutes", "requires_approval"],
    "shift-assignments": ["employee_id", "shift_id", "effective_from", "status"],
    "shift-schedules": ["employee_id", "shift_id", "schedule_date", "is_off_day"],
    "shift-templates": ["name", "template_type", "status"],
    "shift-rotation-groups": ["name", "code", "cycle_days", "status"],
    "shift-rotation-rules": ["rotation_group_id", "shift_id", "day_index", "is_off_day"],
    "shift-change-requests": ["employee_id", "current_shift_id", "requested_shift_id", "status"],
    timetables: ["name", "status", "timetable_type"],
    "timetable-days": ["timetable_id", "day_of_week", "shift_id", "is_off_day"],
    "timetable-shift-rules": ["timetable_id", "shift_id", "effective_from", "effective_to"],
    "timetable-holiday-rules": ["timetable_id", "holiday_group_id", "action", "is_paid"],
    "timetable-attendance-rules": ["timetable_id", "late_after_minutes", "absent_after_minutes", "half_day_after_minutes"],
    "timetable-rotations": ["name", "rotation_group_id", "status"],
    "timetable-rotation-rules": ["rotation_id", "shift_id", "day_index", "is_off_day"],
    "employee-timetables": ["employee_id", "timetable_id", "effective_from", "status"],
    "timetable-generated-schedules": ["employee_id", "timetable_id", "schedule_date", "generated_from_rotation"],
  }

  const preferred = preferredBySection[section] ?? ["name", "status", "created_at"]
  const keySet = new Set<string>()
  rows.forEach((row) => Object.keys(row).forEach((key) => keySet.add(key)))
  const ordered = preferred.filter((key) => keySet.has(key))
  const extras = Array.from(keySet).filter((key) => !ordered.includes(key)).sort((a, b) => a.localeCompare(b))
  return [...ordered, ...extras].slice(0, Math.max(ordered.length, 4))
}

function buildScheduleLookupLabelMaps(lookups: LookupState) {
  const toMap = (rows: AdminRecord[], idKeys: string[], labelBuilder: (row: AdminRecord, id: number) => string) =>
    new Map<string, string>(
      rows
        .map((row) => {
          const id = readNumberFromRecord(row, idKeys)
          if (id === null) {
            return null
          }
          return [String(id), labelBuilder(row, id)] as const
        })
        .filter((entry): entry is readonly [string, string] => entry !== null)
    )

  return {
    branch_id: toMap(lookups.branches, ["id", "branch_id"], (row, id) => {
      return readStringFromRecord(row, ["name", "branch_name", "title"]) ?? `Branch ${id}`
    }),
    department_id: toMap(lookups.departments, ["id", "department_id"], (row, id) => {
      return readStringFromRecord(row, ["name", "department_name", "title"]) ?? `Department ${id}`
    }),
    shift_id: toMap(lookups.shifts, ["id", "shift_id", "shiftId"], (row, id) => {
      return readStringFromRecord(row, ["name", "shift_name", "title"]) ?? `Shift ${id}`
    }),
    timetable_id: toMap(lookups.timetables, ["id", "timetable_id", "timetableId"], (row, id) => {
      return readStringFromRecord(row, ["name", "timetable_name", "title"]) ?? `Timetable ${id}`
    }),
    holiday_group_id: toMap(lookups.holidayGroups, ["id", "holiday_group_id"], (row, id) => {
      return readStringFromRecord(row, ["name", "group_name", "title"]) ?? `Holiday Group ${id}`
    }),
    holiday_id: toMap(lookups.holidays, ["id", "holiday_id", "holidayId"], (row, id) => {
      return readStringFromRecord(row, ["name", "holiday_name", "title"]) ?? `Holiday ${id}`
    }),
    rotation_group_id: toMap(lookups.rotationGroups, ["id", "rotation_group_id", "rotationGroupId"], (row, id) => {
      return readStringFromRecord(row, ["name", "rotation_group_name", "title"]) ?? `Rotation Group ${id}`
    }),
  } satisfies Record<string, Map<string, string>>
}

function resolveScheduleCellValue(
  column: string,
  row: AdminRecord,
  lookupMaps: Record<string, Map<string, string>>
) {
  const raw = row[column]
  const map = lookupMaps[column]
  if (map && (typeof raw === "string" || typeof raw === "number")) {
    return map.get(String(raw)) ?? stringifyValue(raw)
  }
  return stringifyValue(raw)
}

function resolveRowId(row: AdminRecord, fallbackIndex: number) {
  const candidates = [
    row.id,
    row.shift_id,
    row.shiftId,
    row.timetable_id,
    row.timetableId,
    row.employee_timetable_id,
    row.employeeTimetableId,
    row.code,
    row.name,
  ]
  const match = candidates.find((value) => typeof value === "string" || typeof value === "number")
  return match ?? fallbackIndex
}

function toPayload(
  fields: FieldConfig[],
  values: Record<string, string>,
  options: { currentUserId?: number | null } = {}
) {
  const fieldKeys = new Set(fields.map((field) => field.key))
  if (fieldKeys.has("configuration_shift_ids")) {
    const name = values.name?.trim() ?? ""
    const templateType = values.template_type?.trim() ?? ""
    if (!name) {
      throw new Error("Template Name is required.")
    }
    if (!templateType) {
      throw new Error("Template Type is required.")
    }

    const shiftIds = (values.configuration_shift_ids ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry))

    const payload: AdminRecord = {
      name,
      template_type: templateType,
      configuration: {},
    }

    if (values.status?.trim()) {
      payload.status = values.status.trim()
    }

    const configuration: AdminRecord = {}
    if (shiftIds.length > 0) {
      configuration.shift_ids = shiftIds
    }

    const defaultShiftId = Number(values.configuration_default_shift_id ?? "")
    if (Number.isFinite(defaultShiftId) && defaultShiftId > 0) {
      configuration.default_shift_id = defaultShiftId
    }

    const rotationGroupId = Number(values.configuration_rotation_group_id ?? "")
    if (Number.isFinite(rotationGroupId) && rotationGroupId > 0) {
      configuration.rotation_group_id = rotationGroupId
    }

    const notes = values.configuration_notes?.trim() ?? ""
    if (notes) {
      configuration.notes = notes
    }

    payload.configuration = configuration
    return payload
  }

  const payload: AdminRecord = {}

  for (const field of fields) {
    const raw = values[field.key] ?? ""
    const trimmed = raw.trim()

    if (field.required && !trimmed) {
      throw new Error(`${field.label} is required.`)
    }

    if (!trimmed) {
      continue
    }

    if (field.type === "number" || field.type === "duration") {
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed)) {
        throw new Error(`${field.label} must be a valid number.`)
      }
      payload[field.key] = parsed
      continue
    }

    if (field.key === "day_of_week") {
      const parsed = Number(trimmed)
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 6) {
        throw new Error("Day Of Week must be a number between 0 and 6.")
      }
      payload[field.key] = parsed
      continue
    }

    if (field.type === "boolean") {
      if (trimmed !== "true" && trimmed !== "false") {
        throw new Error(`${field.label} must be Yes or No.`)
      }
      payload[field.key] = trimmed === "true"
      continue
    }

    if (field.type === "multiselect") {
      payload[field.key] = trimmed
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
      continue
    }

    payload[field.key] = trimmed
  }

  if (fieldKeys.has("assigned_by") && typeof options.currentUserId === "number" && Number.isFinite(options.currentUserId)) {
    payload.assigned_by = options.currentUserId
  }

  return payload
}

function mergeEditPayload(original: AdminRecord | null, next: AdminRecord) {
  const base = original ? { ...original } : {}
  delete base.id
  delete base.created_at
  delete base.updated_at
  delete base.deleted_at
  return { ...base, ...next }
}

async function listScheduleRows(token: string, section: ScheduleSectionKey) {
  const config = SECTION_CONFIG[section]
  if (config.module === "shift") {
    return listShiftResources(token, section as ShiftResourceKey, {
      page: 1,
      limit: 100,
    })
  }

  return listTimetableResources(token, section as TimetableResourceKey, {
    page: 1,
    limit: 100,
  })
}

async function getScheduleRow(token: string, section: ScheduleSectionKey, id: string | number) {
  const config = SECTION_CONFIG[section]
  return config.module === "shift"
    ? getShiftResourceById(token, section as ShiftResourceKey, id)
    : getTimetableResourceById(token, section as TimetableResourceKey, id)
}

async function createScheduleRow(token: string, section: ScheduleSectionKey, data: AdminRecord) {
  const config = SECTION_CONFIG[section]
  return config.module === "shift"
    ? createShiftResource(token, section as ShiftResourceKey, data)
    : createTimetableResource(token, section as TimetableResourceKey, data)
}

async function updateScheduleRow(
  token: string,
  section: ScheduleSectionKey,
  id: string | number,
  data: AdminRecord
) {
  const config = SECTION_CONFIG[section]
  return config.module === "shift"
    ? patchShiftResourceById(token, section as ShiftResourceKey, id, data)
    : patchTimetableResourceById(token, section as TimetableResourceKey, id, data)
}

async function deleteScheduleRow(token: string, section: ScheduleSectionKey, id: string | number) {
  const config = SECTION_CONFIG[section]
  return config.module === "shift"
    ? deleteShiftResourceById(token, section as ShiftResourceKey, id)
    : deleteTimetableResourceById(token, section as TimetableResourceKey, id)
}

function mapLookupOptions(field: FieldConfig, lookups: LookupState) {
  if (field.options) {
    return field.options
  }

  const withLabel = (
    rows: AdminRecord[],
    idKeys: string[],
    labelBuilder: (row: AdminRecord, id: number) => string
  ) =>
    rows
      .map((row) => {
        const id = readNumberFromRecord(row, idKeys)
        if (id === null) {
          return null
        }
        return { value: String(id), label: labelBuilder(row, id) }
      })
      .filter((option): option is { value: string; label: string } => option !== null)

  switch (field.key) {
    case "branch_id":
      return withLabel(lookups.branches, ["id", "branch_id"], (row, id) => {
        return readStringFromRecord(row, ["name", "branch_name", "title"]) ?? `Branch ${id}`
      })
    case "department_id":
      return withLabel(lookups.departments, ["id", "department_id"], (row, id) => {
        return readStringFromRecord(row, ["name", "department_name", "title"]) ?? `Department ${id}`
      })
    case "employee_id":
      return lookups.employees
        .map((row) => {
          const directNestedEmployee = readNestedRecord(row, ["employee", "user", "staff", "person"])
          const nestedEmployee = directNestedEmployee
            ? readNestedRecord(directNestedEmployee, ["user", "employee"]) ?? directNestedEmployee
            : null
          const id =
            readNumberFromRecord(row, ["id", "employee_id", "employeeId", "user_id", "userId", "staff_id", "staffId", "person_id", "personId"]) ??
            (nestedEmployee
              ? readNumberFromRecord(nestedEmployee, ["id", "employee_id", "employeeId", "user_id", "userId", "staff_id", "staffId", "person_id", "personId"])
              : null)
          if (id === null) {
            return null
          }
          const topLevelName = [row.first_name, row.firstName, row.middle_name, row.middleName, row.last_name, row.lastName]
            .filter((value, index) => index % 3 === 0 ? true : true)
            .filter((value) => typeof value === "string" && value.trim())
            .join(" ")
            .trim()
          const nestedName = nestedEmployee
            ? [
                nestedEmployee.first_name,
                nestedEmployee.firstName,
                nestedEmployee.middle_name,
                nestedEmployee.middleName,
                nestedEmployee.last_name,
                nestedEmployee.lastName,
              ]
            .filter((value) => typeof value === "string" && value.trim())
            .join(" ")
            .trim()
            : ""
          const fallbackName = topLevelName || nestedName
          const fullName =
            readStringFromRecord(row, ["full_name", "fullName", "display_name", "displayName", "name", "employee_name", "employeeName"]) ??
            (nestedEmployee
              ? readStringFromRecord(nestedEmployee, ["full_name", "fullName", "display_name", "displayName", "name", "employee_name", "employeeName"])
              : null) ??
            fallbackName
          const employeeNo =
            readStringFromRecord(row, ["employee_no", "employeeNo", "employee_number", "employee_code", "user_no", "staff_no", "staffNo", "code"]) ??
            (nestedEmployee
              ? readStringFromRecord(nestedEmployee, ["employee_no", "employeeNo", "employee_number", "employee_code", "user_no", "staff_no", "staffNo", "code"])
              : null)
          const label = fullName && employeeNo ? `${fullName} (${employeeNo})` : fullName || employeeNo || `Employee ${id}`
          return { value: String(id), label }
        })
        .filter((option): option is { value: string; label: string } => option !== null)
    case "shift_id":
    case "current_shift_id":
    case "requested_shift_id":
    case "override_shift_id":
    case "default_shift_id":
    case "configuration_default_shift_id":
      return lookups.shifts
        .map((row) => {
          const nestedShift = readNestedRecord(row, ["shift"])
          const id =
            readNumberFromRecord(row, ["id", "shift_id", "shiftId"]) ??
            (nestedShift ? readNumberFromRecord(nestedShift, ["id", "shift_id", "shiftId"]) : null)
          if (id === null) {
            return null
          }
          const name =
            readStringFromRecord(row, ["name", "shift_name", "shiftName", "title"]) ??
            (nestedShift ? readStringFromRecord(nestedShift, ["name", "shift_name", "shiftName", "title"]) : null)
          const code =
            readStringFromRecord(row, ["code", "shift_code", "shiftCode"]) ??
            (nestedShift ? readStringFromRecord(nestedShift, ["code", "shift_code", "shiftCode"]) : null)
          return { value: String(id), label: code && name ? `${name} (${code})` : name || code || `Shift ${id}` }
        })
        .filter((option): option is { value: string; label: string } => option !== null)
    case "configuration_shift_ids":
      return withLabel(lookups.shifts, ["id", "shift_id", "shiftId"], (row, id) => {
        const nestedShift = readNestedRecord(row, ["shift"])
        const name =
          readStringFromRecord(row, ["name", "shift_name", "shiftName"]) ??
          (nestedShift ? readStringFromRecord(nestedShift, ["name", "shift_name", "shiftName"]) : null)
        const code =
          readStringFromRecord(row, ["code", "shift_code", "shiftCode"]) ??
          (nestedShift ? readStringFromRecord(nestedShift, ["code", "shift_code", "shiftCode"]) : null)
        return code && name ? `${name} (${code})` : name || code || `Shift ${id}`
      })
    case "timetable_id":
      return withLabel(lookups.timetables, ["id", "timetable_id", "timetableId"], (row, id) => {
        const name = readStringFromRecord(row, ["name", "timetable_name", "timetableName"])
        const code = readStringFromRecord(row, ["code", "timetable_code", "timetableCode"])
        return code && name ? `${name} (${code})` : name || code || `Timetable ${id}`
      })
    case "holiday_id":
      return withLabel(lookups.holidays, ["id", "holiday_id", "holidayId"], (row, id) => {
        const nestedHoliday = readNestedRecord(row, ["holiday"])
        const name =
          readStringFromRecord(row, ["name", "holiday_name", "holidayName", "title"]) ??
          (nestedHoliday
            ? readStringFromRecord(nestedHoliday, ["name", "holiday_name", "holidayName", "title"])
            : null)
        const date =
          readStringFromRecord(row, ["holiday_date", "holidayDate", "date", "start_date", "startDate"]) ??
          (nestedHoliday
            ? readStringFromRecord(nestedHoliday, ["holiday_date", "holidayDate", "date", "start_date", "startDate"])
            : null)
        return name && date ? `${name} (${date})` : name || date || `Holiday ${id}`
      })
    case "holiday_group_id":
      return withLabel(lookups.holidayGroups, ["id", "holiday_group_id"], (row, id) => {
        return readStringFromRecord(row, ["name", "group_name", "title"]) ?? `Holiday Group ${id}`
      })
    case "rotation_group_id":
    case "configuration_rotation_group_id":
      return withLabel(lookups.rotationGroups, ["id", "rotation_group_id", "rotationGroupId"], (row, id) => {
        const name = readStringFromRecord(row, ["name", "rotation_group_name", "rotationGroupName"])
        const code = readStringFromRecord(row, ["code", "rotation_group_code", "rotationGroupCode"])
        return code && name ? `${name} (${code})` : name || code || `Rotation Group ${id}`
      })
    case "timetable_day_id":
      return withLabel(lookups.timetableDays, ["id", "timetable_day_id", "timetableDayId"], (row, id) => {
        const day = readStringFromRecord(row, ["day_of_week", "dayOfWeek"])
        return day ? `${prettifyLabel(day)} (${id})` : `Timetable Day ${id}`
      })
    case "rotation_id":
      return withLabel(lookups.timetableRotations, ["id", "rotation_id", "rotationId"], (row, id) => {
        const name = readStringFromRecord(row, ["name", "rotation_name", "rotationName"])
        return name ?? `Rotation ${id}`
      })
    default:
      return []
  }
}

function TimeSelectField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const parts = React.useMemo(() => timeValueToParts(value), [value])
  return (
    <DualWheelPickerField
      value={value}
      parts={parts}
      title="Time Picker"
      emptyLabel="Select time"
      emptyHint="24-hour format"
      preview={parts.hours && parts.minutes ? `${parts.hours}:${parts.minutes}` : "--:--"}
      displayValue={parts.hours && parts.minutes ? formatDisplayTime(`${parts.hours}:${parts.minutes}`) : ""}
      displayHint={parts.hours && parts.minutes ? `${parts.hours}:${parts.minutes}` : "24-hour format"}
      applyLabel="Apply time"
      firstLabel="Hour"
      secondLabel="Minute"
      firstOptions={TIME_HOUR_OPTIONS}
      secondOptions={MINUTE_OPTIONS}
      parseValue={timeValueToParts}
      composeValue={timePartsToValue}
      formatOption={(option) => option}
      onChange={onChange}
    />
  )
}

function DurationSelectField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const parts = React.useMemo(() => minutesToDurationParts(value), [value])

  return (
    <DualWheelPickerField
      value={value}
      parts={parts}
      title="Duration Picker"
      emptyLabel="Select duration"
      emptyHint="hours and minutes"
      preview={parts.hours || parts.minutes ? `${parts.hours || "0"} hr ${parts.minutes || "0"} min` : "-- hr -- min"}
      displayValue={parts.hours || parts.minutes ? `${parts.hours || "0"} hr` : ""}
      displayHint={parts.hours || parts.minutes ? `${parts.minutes || "0"} min` : "hours and minutes"}
      applyLabel="Apply duration"
      firstLabel="Hours"
      secondLabel="Minutes"
      firstOptions={DURATION_HOUR_OPTIONS}
      secondOptions={MINUTE_OPTIONS}
      parseValue={minutesToDurationParts}
      composeValue={durationPartsToMinutes}
      formatOption={(option, kind) => (kind === "hours" ? `${option} hr` : `${option} min`)}
      onChange={onChange}
    />
  )
}

function DualWheelPickerField({
  value,
  parts,
  title,
  emptyLabel,
  emptyHint,
  preview,
  displayValue,
  displayHint,
  applyLabel,
  firstLabel,
  secondLabel,
  firstOptions,
  secondOptions,
  parseValue,
  composeValue,
  formatOption,
  onChange,
}: {
  value: string
  parts: { hours: string; minutes: string }
  title: string
  emptyLabel: string
  emptyHint: string
  preview: string
  displayValue: string
  displayHint: string
  applyLabel: string
  firstLabel: string
  secondLabel: string
  firstOptions: string[]
  secondOptions: string[]
  parseValue: (value: string) => { hours: string; minutes: string }
  composeValue: (hoursValue: string, minutesValue: string) => string
  formatOption: (option: string, kind: "hours" | "minutes") => string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState(parts)

  React.useEffect(() => {
    if (!open) {
      setDraft(parseValue(value))
    }
  }, [open, parseValue, value])

  const canApply = Boolean(draft.hours && draft.minutes)

  const updateDraft = (key: "hours" | "minutes", nextValue: string) => {
    setDraft((current) => ({
      ...current,
      [key]: nextValue,
    }))
  }

  const handleApply = () => {
    if (!canApply) {
      return
    }
    onChange(composeValue(draft.hours, draft.minutes))
    setOpen(false)
  }

  const handleClear = () => {
    setDraft({ hours: "", minutes: "" })
    onChange("")
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition dark:border-slate-700 dark:bg-slate-950/60",
              open ? "border-[var(--primary)] shadow-sm" : "border-slate-300",
              displayValue ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                <Clock3Icon className="h-4 w-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{displayValue || emptyLabel}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{displayHint || emptyHint}</span>
              </span>
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Set</span>
          </button>
        }
      />
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-0 shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{title}</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-semibold text-slate-900 dark:text-slate-100">{preview}</span>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 p-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{firstLabel}</p>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl bg-slate-50 p-2 dark:bg-slate-900">
              {firstOptions.map((option) => {
                const selected = draft.hours === option
                return (
                  <button
                    key={option}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition",
                      selected
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                        : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    )}
                    onClick={() => updateDraft("hours", option)}
                  >
                    {formatOption(option, "hours")}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex items-center justify-center text-2xl font-semibold text-slate-300 dark:text-slate-700">:</div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{secondLabel}</p>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl bg-slate-50 p-2 dark:bg-slate-900">
              {secondOptions.map((option) => {
                const selected = draft.minutes === option
                return (
                  <button
                    key={option}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition",
                      selected
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                        : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    )}
                    onClick={() => updateDraft("minutes", option)}
                  >
                    {formatOption(option, "minutes")}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <button
            type="button"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            onClick={handleClear}
          >
            Clear
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              canApply
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
                : "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
            )}
            onClick={handleApply}
            disabled={!canApply}
          >
            {applyLabel}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function FormField({
  field,
  value,
  onChange,
  lookups,
}: {
  field: FieldConfig
  value: string
  onChange: (value: string) => void
  lookups: LookupState
}) {
  const options = React.useMemo(() => mapLookupOptions(field, lookups), [field, lookups])

  if (field.type === "select" || options.length > 0) {
    return (
      <select
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select {field.label}</option>
        {options.map((option) => (
          <option key={`${field.key}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === "boolean") {
    return (
      <select
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select {field.label}</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    )
  }

  if (field.type === "multiselect") {
    const selected = new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    )

    return (
      <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        {options.length === 0 ? (
          <p className="text-sm text-slate-500">No options available yet.</p>
        ) : (
          options.map((option) => {
            const checked = selected.has(option.value)
            return (
              <label
                key={`${field.key}-${option.value}`}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const next = new Set(selected)
                    if (event.target.checked) {
                      next.add(option.value)
                    } else {
                      next.delete(option.value)
                    }
                    onChange(Array.from(next).join(","))
                  }}
                />
                <span>{option.label}</span>
              </label>
            )
          })
        )}
      </div>
    )
  }

  if (field.type === "textarea") {
    return (
      <textarea
        className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        placeholder={field.placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  if (field.type === "date") {
    return <DatePickerPresets value={value} onChange={onChange} placeholder={`Select ${field.label}`} />
  }

  if (field.type === "time") {
    return <TimeSelectField value={value} onChange={onChange} />
  }

  if (field.type === "duration") {
    return <DurationSelectField value={value} onChange={onChange} />
  }

  return (
    <input
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      type={field.type}
      placeholder={field.placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function ScheduleManagementView({ section }: { section: string }) {
  const router = useRouter()
  const activeSection = React.useMemo(() => resolveSection(section), [section])
  const config = React.useMemo(() => SECTION_CONFIG[activeSection], [activeSection])
  const fields = React.useMemo(() => config.fields, [config.fields])
  const initialFormState = React.useMemo(() => buildInitialValues(fields), [fields])
  const createDraftKey = React.useMemo(
    () => buildFormDraftStorageKey(`schedule:${activeSection}:create`),
    [activeSection]
  )

  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [lookups, setLookups] = React.useState<LookupState>(EMPTY_LOOKUPS)
  const [loading, setLoading] = React.useState(false)
  const [lookupLoading, setLookupLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [lookupError, setLookupError] = React.useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = React.useState<number | null>(null)
  const [createValues, setCreateValues] = React.useState<Record<string, string>>(() =>
    readPersistedFormState(createDraftKey, initialFormState)
  )
  const [editValues, setEditValues] = React.useState<Record<string, string>>(() => initialFormState)
  const [editingId, setEditingId] = React.useState("")
  const [deletingId, setDeletingId] = React.useState("")
  const [editRecord, setEditRecord] = React.useState<AdminRecord | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [selectedRow, setSelectedRow] = React.useState<AdminRecord | null>(null)

  React.useEffect(() => {
    setCreateValues(readPersistedFormState(createDraftKey, initialFormState))
    setEditValues(initialFormState)
    setEditingId("")
    setDeletingId("")
    setEditRecord(null)
    setSelectedRow(null)
    setDetailsOpen(false)
    setError(null)
    setMessage(null)
    setFormError(null)
    setLookupError(null)
    setCurrentUserId(null)
  }, [activeSection, createDraftKey, initialFormState])

  React.useEffect(() => {
    persistFormState(createDraftKey, createValues)
  }, [createDraftKey, createValues])

  const editDraftKey = React.useMemo(() => {
    return editingId ? buildFormDraftStorageKey(`schedule:${activeSection}:edit:${editingId}`) : ""
  }, [activeSection, editingId])

  React.useEffect(() => {
    if (!editDraftKey) {
      return
    }
    persistFormState(editDraftKey, editValues)
  }, [editDraftKey, editValues])

  React.useEffect(() => {
    const token = readStoredToken()
    if (!token || !fields.some((field) => field.key === "assigned_by")) {
      return
    }

    let cancelled = false

    const loadCurrentUser = async () => {
      try {
        const user = await getCurrentAdmin(token)
        if (cancelled) {
          return
        }
        const nextUserId = user
          ? readNumberFromRecord(user, ["id", "user_id", "userId", "admin_id", "adminId"])
          : null
        setCurrentUserId(nextUserId)
        if (nextUserId !== null) {
          setCreateValues((current) => ({ ...current, assigned_by: String(nextUserId) }))
        }
      } catch {
        if (!cancelled) {
          setCurrentUserId(null)
        }
      }
    }

    void loadCurrentUser()

    return () => {
      cancelled = true
    }
  }, [fields])

  React.useEffect(() => {
    const token = readStoredToken()
    if (!token) {
      setLookups(EMPTY_LOOKUPS)
      return
    }

    let cancelled = false

    const needed = new Set(fields.map((field) => field.key))

    const loadLookups = async () => {
      setLookupLoading(true)
      setLookupError(null)
      try {
        const [
          branchesResult,
          departmentsResult,
          employeesResult,
          shiftsResult,
          timetablesResult,
          holidaysResult,
          holidayGroupsResult,
          rotationGroupsResult,
          timetableDaysResult,
          timetableRotationsResult,
        ] = await Promise.allSettled([
          needed.has("branch_id")
            ? listBranches(token, { page: 1, limit: 100 })
            : Promise.resolve({ rows: [] }),
          needed.has("department_id")
            ? listDepartments(token, { page: 1, limit: 100 })
            : Promise.resolve({ rows: [] }),
          needed.has("employee_id")
            ? listEmployees(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }).then(async (result) => {
              if (result.rows.length > 0) {
                return result
              }
              const fallback = await listUsers(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
              return { rows: fallback.rows }
            })
            : Promise.resolve({ rows: [] }),
          [
            "shift_id",
            "current_shift_id",
            "requested_shift_id",
            "override_shift_id",
            "default_shift_id",
            "configuration_shift_ids",
            "configuration_default_shift_id",
          ].some((key) => needed.has(key))
            ? listShiftResources(token, "shifts", { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
            : Promise.resolve({ rows: [] }),
          needed.has("timetable_id")
            ? listTimetableResources(token, "timetables", {
              page: 1,
              limit: 100,
              sortBy: "created_at",
              sortOrder: "DESC",
            })
            : Promise.resolve({ rows: [] }),
          needed.has("holiday_id")
            ? listAttendanceHolidays(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
            : Promise.resolve({ rows: [] }),
          needed.has("holiday_group_id")
            ? listAttendanceHolidayGroups(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
            : Promise.resolve({ rows: [] }),
          ["rotation_group_id", "configuration_rotation_group_id"].some((key) => needed.has(key))
            ? listShiftResources(token, "shift-rotation-groups", {
              page: 1,
              limit: 100,
              sortBy: "created_at",
              sortOrder: "DESC",
            })
            : Promise.resolve({ rows: [] }),
          needed.has("timetable_day_id")
            ? listTimetableResources(token, "timetable-days", {
              page: 1,
              limit: 100,
              sortBy: "created_at",
              sortOrder: "DESC",
            })
            : Promise.resolve({ rows: [] }),
          needed.has("rotation_id")
            ? listTimetableResources(token, "timetable-rotations", {
              page: 1,
              limit: 100,
              sortBy: "created_at",
              sortOrder: "DESC",
            })
            : Promise.resolve({ rows: [] }),
        ])

        if (cancelled) return

        const failedLookups: string[] = []
        const resolveRows = (result: PromiseSettledResult<{ rows: AdminRecord[] }>, label: string) => {
          if (result.status === "fulfilled") {
            return result.value.rows
          }
          failedLookups.push(label)
          return []
        }

        setLookups({
          branches: resolveRows(branchesResult, "branches"),
          departments: resolveRows(departmentsResult, "departments"),
          employees: resolveRows(employeesResult, "employees"),
          shifts: resolveRows(shiftsResult, "shifts"),
          timetables: resolveRows(timetablesResult, "timetables"),
          holidays: resolveRows(holidaysResult, "holidays"),
          holidayGroups: resolveRows(holidayGroupsResult, "holiday groups"),
          rotationGroups: resolveRows(rotationGroupsResult, "rotation groups"),
          timetableDays: resolveRows(timetableDaysResult, "timetable days"),
          timetableRotations: resolveRows(timetableRotationsResult, "timetable rotations"),
        })

        if (failedLookups.length > 0) {
          setLookupError(`Some form options could not be loaded right now: ${failedLookups.join(", ")}.`)
        }
      } catch {
        if (cancelled) return
        setLookups(EMPTY_LOOKUPS)
        setLookupError("The form options could not be loaded right now.")
      } finally {
        if (!cancelled) {
          setLookupLoading(false)
        }
      }
    }

    void loadLookups()

    return () => {
      cancelled = true
    }
  }, [fields])

  const fetchRows = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setRows([])
      setError("Authentication required. Please log in again.")
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await listScheduleRows(token, activeSection)
      setRows(result.rows)
    } catch (errorObject) {
      setRows([])
      setError(formatLoadError(errorObject, `Failed to load ${config.title.toLowerCase()}.`))
    } finally {
      setLoading(false)
    }
  }, [activeSection, config.title])

  React.useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  const columns = React.useMemo(() => resolveVisibleColumns(activeSection, rows), [activeSection, rows])
  const lookupMaps = React.useMemo(() => buildScheduleLookupLabelMaps(lookups), [lookups])

  const onCreate = async () => {
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }

    try {
      const payload = toPayload(fields, createValues, { currentUserId })
      await createScheduleRow(token, activeSection, payload)
      setMessage("Created successfully.")
      setFormError(null)
      setCreateOpen(false)
      clearPersistedFormState(createDraftKey)
      setCreateValues(initialFormState)
      await fetchRows()
      router.refresh()
    } catch (errorObject) {
      setFormError(formatLoadError(errorObject, "Could not create this record."))
    }
  }

  const openEdit = async (id: string) => {
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }

    try {
      const record = await getScheduleRow(token, activeSection, id)
      if (!record) {
        throw new Error("This record could not be loaded.")
      }
      setEditingId(id)
      setEditRecord(record)
      const initialEditState = buildEditValues(fields, record)
      const initialEditDraftKey = buildFormDraftStorageKey(`schedule:${activeSection}:edit:${id}`)
      setEditValues(readPersistedFormState(initialEditDraftKey, initialEditState))
      setFormError(null)
      setEditOpen(true)
    } catch (errorObject) {
      setFormError(formatLoadError(errorObject, "Could not load this record for editing."))
    }
  }

  const onEdit = async () => {
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }

    try {
      const payload = mergeEditPayload(editRecord, toPayload(fields, editValues, { currentUserId }))
      await updateScheduleRow(token, activeSection, editingId, payload)
      setMessage("Updated successfully.")
      setFormError(null)
      setEditOpen(false)
      if (editDraftKey) {
        clearPersistedFormState(editDraftKey)
      }
      setEditValues(initialFormState)
      setEditingId("")
      setEditRecord(null)
      await fetchRows()
      router.refresh()
    } catch (errorObject) {
      setFormError(formatLoadError(errorObject, "Could not update this record."))
    }
  }

  const onDelete = async () => {
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }

    try {
      await deleteScheduleRow(token, activeSection, deletingId)
      setMessage("Deleted successfully.")
      setFormError(null)
      setDeleteOpen(false)
      setDeletingId("")
      await fetchRows()
      router.refresh()
    } catch (errorObject) {
      setFormError(formatLoadError(errorObject, "Could not delete this record."))
    }
  }

  const renderForm = (
    values: Record<string, string>,
    onChange: React.Dispatch<React.SetStateAction<Record<string, string>>>
  ) => (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((field) => (
        field.hidden ? null : (
        <label
          key={field.key}
          className={`grid gap-1 text-sm ${field.type === "textarea" || field.type === "multiselect" ? "md:col-span-2" : ""}`}
        >
          <span className="font-medium text-slate-700">
            {field.label}
            {field.required ? " *" : ""}
          </span>
          <FormField
            field={field}
            value={values[field.key] ?? ""}
            lookups={lookups}
            onChange={(nextValue) =>
              onChange((current) => {
                const nextState: Record<string, string> = {
                  ...current,
                  [field.key]: nextValue,
                }

                if (field.key === "break_type" && field.autoFillLabelFromOption) {
                  const selectedOption = (field.options ?? []).find((option) => option.value === nextValue)
                  const suggestedName = selectedOption
                    ? `${selectedOption.label.trim()} Break`
                    : ""
                  const currentName = current.name?.trim() ?? ""
                  const currentBreakType = current.break_type?.trim() ?? ""
                  const previousOption = (field.options ?? []).find((option) => option.value === currentBreakType)
                  const previousSuggestedName = previousOption
                    ? `${previousOption.label.trim()} Break`
                    : ""

                  if (suggestedName && (!currentName || currentName === previousSuggestedName)) {
                    nextState.name = suggestedName
                  }
                }

                return nextState
              })
            }
          />
          {field.helpText ? <span className="text-xs text-slate-500">{field.helpText}</span> : null}
        </label>
        )
      ))}
      {lookupLoading ? <p className="md:col-span-2 text-xs text-slate-500">Loading available options…</p> : null}
      {lookupError ? <p className="md:col-span-2 text-sm text-amber-700">{lookupError}</p> : null}
      {formError ? <p className="md:col-span-2 text-sm text-red-600">{formError}</p> : null}
    </div>
  )

  const openDetailsDialog = (row: AdminRecord) => {
    setSelectedRow(row)
    setDetailsOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-6xl rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-[#101826]/92 lg:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              {config.moduleTitle}
            </p>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 md:text-[2rem]">{config.title}</h1>
              <p className="mt-2 max-w-3xl text-[0.95rem] text-slate-600 dark:text-slate-300">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-start">
            <button
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-300 px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              type="button"
              onClick={() => {
                setMessage(null)
                void fetchRows()
              }}
            >
              <RefreshCwIcon className="mr-2 h-4 w-4" />
              Refresh
            </button>
            <button
              className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 px-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              type="button"
              onClick={() => {
                setFormError(null)
                setCreateOpen(true)
              }}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Create
            </button>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-green-600">{message}</p> : null}

        <div className="mt-5">
          <TableScrollContainer>
            <table className="min-w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[var(--table-header-accent-bg)] text-[var(--table-header-accent)] backdrop-blur-sm">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column}
                      className="px-3 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.08em] whitespace-nowrap"
                    >
                      {prettifyLabel(column)}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-[0.08em] whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-950 [&_tr:nth-child(odd)]:bg-slate-50/35 dark:[&_tr:nth-child(odd)]:bg-slate-900/60 [&_tr]:border-t [&_tr]:border-slate-100 dark:[&_tr]:border-slate-800 [&_tr]:transition-colors [&_tr]:hover:bg-slate-50 dark:[&_tr]:text-slate-200 dark:[&_tr]:hover:bg-slate-900/90">
                {loading ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-slate-500">
                      No records found yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const rowId = resolveRowId(row, index)
                    return (
                      <tr
                        key={`${activeSection}-${String(rowId)}-${index}`}
                        className="align-top cursor-pointer"
                        onClick={() => openDetailsDialog(row)}
                      >
                        {columns.map((column) => (
                          <td key={column} className="px-3 py-3 text-[0.95rem] text-slate-700 whitespace-nowrap dark:text-slate-200">
                            {resolveScheduleCellValue(column, row, lookupMaps)}
                          </td>
                        ))}
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-[color:rgb(var(--primary-rgb)/0.35)] hover:bg-[color:rgb(var(--primary-rgb)/0.10)] hover:text-[var(--primary)] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[color:rgb(var(--primary-rgb)/0.45)] dark:hover:bg-[color:rgb(var(--primary-rgb)/0.18)]"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void openEdit(String(rowId))
                              }}
                            >
                              <PencilIcon className="mr-1.5 h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              className="inline-flex items-center rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setDeletingId(String(rowId))
                                setDeleteOpen(true)
                              }}
                            >
                              <Trash2Icon className="mr-1.5 h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </TableScrollContainer>
        </div>

        <RecordDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          title={`${config.title} details`}
          description="Selected row details"
          row={selectedRow}
          resolveLabel={(key) => prettifyLabel(key)}
          resolveValue={(key, row) => resolveScheduleCellValue(key, row, lookupMaps)}
        />
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="flex max-h-[90vh] w-[min(1100px,96vw)] flex-col overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Create {config.title.toLowerCase()}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {renderForm(createValues, setCreateValues)}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => void onCreate()}
            >
              Create
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogPopup className="flex max-h-[90vh] w-[min(1100px,96vw)] flex-col overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Edit {config.title.toLowerCase()}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {renderForm(editValues, setEditValues)}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => void onEdit()}
            >
              Save
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {config.title.toLowerCase()}</DialogTitle>
            <DialogDescription>
              This action removes the selected record from the backend. Continue only if you are sure.
            </DialogDescription>
          </DialogHeader>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <DialogFooter>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
              onClick={() => void onDelete()}
            >
              Delete
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
