"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Clock3Icon, PlusIcon } from "lucide-react"
import {
  Add16Regular,
  ArrowSync20Regular,
  Delete16Regular,
  Edit16Regular,
} from "@fluentui/react-icons"
import {
  Avatar,
  Button,
  Checkbox,
  Field,
  SpinButton,
  Switch,
  Tag,
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOption,
  TeachingPopover,
  TeachingPopoverBody,
  TeachingPopoverFooter,
  TeachingPopoverHeader,
  TeachingPopoverSurface,
  TeachingPopoverTitle,
  TeachingPopoverTrigger,
} from "@fluentui/react-components"
import { Person20Regular } from "@fluentui/react-icons"
import { Info20Regular } from "@fluentui/react-icons"

import {
  buildFormDraftStorageKey,
  clearPersistedFormState,
  persistFormState,
  readPersistedFormState,
  readStoredCompanyName,
  RecordDetailList,
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Input } from "@/components/ui/input"
import { ResizableTable } from "@/components/ui/resizable-table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TimeInput } from "@/components/ui/time-input"
import { toast } from "@/components/ui/fluent-toast-store"
import { ShiftWeeklyScheduler } from "@/components/dashboard/shift-weekly-scheduler"
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
  listAllEmployees,
  listLeaveRequests,
  listUsers,
  listShiftResources,
  listTimetableResources,
  patchShiftResourceById,
  patchTimetableResourceById,
  publishGeneratedSchedule,
  unpublishGeneratedSchedule,
  createGeneratedSchedulesBulk,
  type AdminRecord,
  type ShiftResourceKey,
  type TimetableResourceKey,
} from "@/lib/admin-api"
import { cn } from "@/lib/utils"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

type ScheduleSectionKey = ShiftResourceKey | TimetableResourceKey
type ScheduleModuleKey = "shift" | "timetable"

const scheduleSectionGuides: Partial<Record<ScheduleSectionKey, { label: string; title: string; tips: string[] }>> = {
  shifts: {
    label: "Shift guide",
    title: "Create reusable shifts",
    tips: [
      "Set the shift name, code, and expected working hours once, then reuse it in schedules and assignments.",
      "Mark overnight shifts when their end time falls on the following day.",
      "Use search and status filters to find existing shifts; use the row actions to edit or remove one.",
    ],
  },
  "shift-breaks": {
    label: "Break guide",
    title: "Set up a shift break",
    tips: [
      "Each break belongs to a shift. Choose the shift, give the break a name and type, then set its start time, end time, and duration.",
      "Mark it paid or unpaid according to your policy. Use Fixed for a set break time, or Flexible when employees may take the break within the configured window.",
      "Use search or the break filter to find saved breaks. Select Create to add one, or use the row actions to edit or delete it.",
    ],
  },
  "shift-assignments": {
    label: "Assignment guide",
    title: "Assign a shift to an employee",
    tips: [
      "Choose one employee and a shift, then set when the assignment starts and, if needed, when it ends.",
      "Optionally link a rotation group. Mark an assignment Primary when it should take precedence as the employee’s main shift assignment.",
      "Use search and the status filter to find assignments; use the row actions to update or remove one.",
    ],
  },
  "shift-rotation-groups": {
    label: "Rotation guide",
    title: "Set up a rotation cycle",
    tips: [
      "Create a named group and set how many days are in its repeating cycle.",
      "After creating the group, add rotation rules for each cycle day to specify the shift or mark a rest day.",
      "Use the group’s code to identify it when linking assignments or templates.",
    ],
  },
  "shift-rotation-rules": {
    label: "Rule guide",
    title: "Define each day in a rotation",
    tips: [
      "Choose a rotation group and enter the day index within its cycle.",
      "Choose a shift for a working day, or mark the rule as an off day.",
      "Make sure the group’s rules cover its full cycle so the pattern repeats as intended.",
    ],
  },
}

function ScheduleSectionGuide({ section }: { section: ScheduleSectionKey }) {
  const guide = scheduleSectionGuides[section]
  if (!guide) return null

  return (
    <TeachingPopover appearance="brand" positioning="below-start">
      <TeachingPopoverTrigger>
        <Button
          appearance="subtle"
          size="small"
          icon={<Info20Regular />}
          className="!h-7 !min-h-7 shrink-0 !px-1.5"
          aria-label={guide.label}
          title={guide.label}
        >
          <span className="hidden sm:inline">{guide.label}</span>
        </Button>
      </TeachingPopoverTrigger>
      <TeachingPopoverSurface className="!w-[min(26rem,calc(100vw-1.5rem))] !max-w-[26rem]">
        <TeachingPopoverHeader>Quick guide</TeachingPopoverHeader>
        <TeachingPopoverBody>
          <TeachingPopoverTitle>{guide.title}</TeachingPopoverTitle>
          <div className="grid gap-2 text-sm leading-relaxed">
            {guide.tips.map((tip) => <p key={tip}>{tip}</p>)}
          </div>
        </TeachingPopoverBody>
        <TeachingPopoverFooter primary="Got it" />
      </TeachingPopoverSurface>
    </TeachingPopover>
  )
}

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
  createOnly?: boolean
  editOnly?: boolean
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
  shiftAssignments: AdminRecord[]
  leaveRequests: AdminRecord[]
  timetables: AdminRecord[]
  holidays: AdminRecord[]
  holidayGroups: AdminRecord[]
  rotationGroups: AdminRecord[]
  timetableDays: AdminRecord[]
  timetableShiftOptions: AdminRecord[]
  timetableRotations: AdminRecord[]
}

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

const SINGLE_COLUMN_SCHEDULE_FORMS = new Set<ScheduleSectionKey>([
  "shift-breaks",
  "shift-assignments",
  "shift-rotation-groups",
  "timetables",
  "timetable-holiday-rules",
  "timetable-rotations",
  "employee-timetables",
  "shift-rotation-rules",
])

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

const SECTION_CONFIG: Record<ScheduleSectionKey, SectionConfig> = {
  shifts: {
    module: "shift",
    title: "Shifts",
    moduleTitle: "Shift Management",
    description: "Manage the master shift definitions used across attendance scheduling.",
    fields: [
      { key: "name", label: "Shift Name", type: "text", required: true, placeholder: "Morning Shift" },
      { key: "code", label: "Shift Code", type: "text", required: true, placeholder: "MORNING", helpText: "Short unique code, max 50 characters. Filled from the name if you leave it blank." },
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
      { key: "half_day_after_minutes", label: "Half Day After", type: "duration" },
      { key: "absent_after_minutes", label: "Absent After", type: "duration" },
      { key: "early_leave_after_minutes", label: "Early Leave After", type: "duration" },
      { key: "max_overtime_minutes", label: "Max Overtime", type: "duration" },
      { key: "overtime_start_after_minutes", label: "Overtime Starts After", type: "duration" },
      { key: "overtime_rate_multiplier", label: "Overtime Multiplier", type: "number" },
      { key: "weekend_multiplier", label: "Weekend Multiplier", type: "number" },
      { key: "holiday_multiplier", label: "Holiday Multiplier", type: "number" },
      { key: "overtime_requires_approval", label: "Overtime Requires Approval", type: "boolean" },
      { key: "overtime_auto_calculate", label: "Calculate Overtime Automatically", type: "boolean" },
      { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
      { key: "is_night_shift", label: "Night Shift", type: "boolean" },
      { key: "crosses_midnight", label: "Crosses Midnight", type: "boolean" },
      { key: "allow_overtime", label: "Allow Overtime", type: "boolean" },
      { key: "requires_checkout", label: "Requires Checkout", type: "boolean" },
      { key: "allow_early_checkin", label: "Allow Early Check-In", type: "boolean" },
      { key: "allow_late_checkout", label: "Allow Late Checkout", type: "boolean" },
      { key: "allow_multiple_checkin", label: "Allow Multiple Check-Ins", type: "boolean" },
      { key: "auto_mark_absent", label: "Mark Absent Automatically", type: "boolean" },
      { key: "allow_mobile_attendance", label: "Allow Mobile Attendance", type: "boolean" },
      { key: "allow_remote_attendance", label: "Allow Remote Attendance", type: "boolean" },
      { key: "require_geofence", label: "Require Geofence", type: "boolean" },
      { key: "require_biometric", label: "Require Biometric", type: "boolean" },
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
      {
        key: "employee_id",
        label: "Employee",
        type: "select",
        required: true,
        helpText: "Choose one employee for a single schedule, or use Bulk Employees below to create the same schedule for many employees at once.",
      },
      {
        key: "employee_ids",
        label: "Bulk Employees",
        type: "multiselect",
        createOnly: true,
        helpText: "Optional. Every selected employee will receive the same shift, date, and schedule settings in one action.",
      },
      { key: "shift_id", label: "Shift", type: "select", required: true, helpText: "This is the main shift to assign on the selected date." },
      { key: "schedule_date", label: "Schedule Date", type: "date", required: true, helpText: "Date when this shift schedule should apply." },
      { key: "override_shift_id", label: "Override Shift", type: "select", helpText: "Use this only when the schedule should differ from the main shift for that date." },
      { key: "holiday_id", label: "Holiday", type: "select", helpText: "Optional holiday linked to this schedule entry." },
      { key: "assigned_by", label: "Assigned By User Id", type: "number", hidden: true },
      { key: "remarks", label: "Remarks", type: "textarea", helpText: "Optional note for admins about why this schedule was created or adjusted." },
      { key: "generated_from_rotation", label: "Generated From Rotation", type: "boolean", helpText: "Set Yes when this schedule came from a rotation pattern." },
      { key: "is_off_day", label: "Off Day", type: "boolean", helpText: "Set Yes when the selected date should be treated as an off day." },
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
      { key: "late_after_minutes", label: "Late After", type: "duration" },
      { key: "half_day_after_minutes", label: "Half Day After", type: "duration" },
      { key: "absent_after_minutes", label: "Absent After", type: "duration" },
      { key: "max_overtime_minutes", label: "Max Overtime", type: "duration" },
      { key: "allow_early_checkin", label: "Allow Early Check-In", type: "boolean" },
      { key: "allow_late_checkout", label: "Allow Late Checkout", type: "boolean" },
      { key: "auto_absent_if_no_checkin", label: "Mark Absent When No Check-In", type: "boolean" },
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
      { key: "max_employees", label: "Max Employees (blank = unlimited)", type: "number" },
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
      { key: "employee_ids", label: "Bulk Employees", type: "multiselect", createOnly: true, helpText: "Assign this shift/date to several employees in one atomic batch." },
      { key: "schedule_date", label: "Schedule Date", type: "date", required: true },
      { key: "timetable_day_shift_option_id", label: "Timetable Shift Option", type: "select", helpText: "Choose a shift option configured for this weekday." },
      { key: "shift_id", label: "Shift", type: "select", helpText: "Used when assigning a shift outside a timetable option." },
      { key: "timetable_id", label: "Timetable", type: "select", helpText: "Optional when a timetable shift option is selected." },
      { key: "is_off_day", label: "Off Day", type: "boolean" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
}

const EMPTY_LOOKUPS: LookupState = {
  branches: [],
  departments: [],
  employees: [],
  shifts: [],
  shiftAssignments: [],
  leaveRequests: [],
  timetables: [],
  holidays: [],
  holidayGroups: [],
  rotationGroups: [],
  timetableDays: [],
  timetableShiftOptions: [],
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

function scheduleStatusTextClass(status: string) {
  const normalizedStatus = status.trim().toUpperCase()

  if (["ACTIVE", "APPROVED", "COMPLETED"].includes(normalizedStatus)) {
    return "text-emerald-700 dark:text-emerald-400"
  }

  if (["INACTIVE", "REJECTED", "CANCELLED", "FAILED"].includes(normalizedStatus)) {
    return "text-rose-700 dark:text-rose-400"
  }

  if (["PENDING", "DRAFT"].includes(normalizedStatus)) {
    return "text-amber-700 dark:text-amber-400"
  }

  return "text-muted-foreground"
}

function isIsoDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}T/.test(value)
}

function currentLocalDateKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function ensureShiftScheduleDateIsNotPast(value: unknown) {
  const scheduleDate = typeof value === "string" ? value.slice(0, 10) : ""
  if (scheduleDate && scheduleDate < currentLocalDateKey()) {
    throw new Error("Shift schedules cannot be created or changed for previous days.")
  }
}

function ensureShiftScheduleCanBeRemoved(value: unknown) {
  const scheduleDate = typeof value === "string" ? value.slice(0, 10) : ""
  if (!scheduleDate || scheduleDate <= currentLocalDateKey()) {
    throw new Error("Only future shift schedules that have not started can be removed.")
  }
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
    "shift-assignments": ["employee_id", "shift_id", "effective_from", "status"],
    "shift-schedules": ["employee_id", "shift_id", "schedule_date", "is_off_day"],
    "shift-rotation-groups": ["name", "code", "cycle_days", "status"],
    "shift-rotation-rules": ["rotation_group_id", "shift_id", "day_index", "is_off_day"],
    timetables: ["name", "status", "timetable_type"],
    "timetable-days": ["timetable_id", "day_of_week", "default_shift_id", "is_working_day"],
    "timetable-shift-rules": ["timetable_day_id", "shift_id", "priority_order", "max_employees", "is_primary"],
    "timetable-holiday-rules": ["timetable_id", "holiday_group_id", "action", "is_paid"],
    "timetable-rotations": ["name", "rotation_group_id", "status"],
    "timetable-rotation-rules": ["rotation_id", "shift_id", "day_index", "is_off_day"],
    "employee-timetables": ["employee_id", "timetable_id", "effective_from", "status"],
    "timetable-generated-schedules": ["employee_id", "schedule_date", "shift_id", "status"],
  }

  const preferred = preferredBySection[section] ?? ["name", "status", "created_at"]
  const keySet = new Set<string>()
  rows.forEach((row) => Object.keys(row).forEach((key) => keySet.add(key)))
  const ordered = preferred.filter((key) => keySet.has(key))
  const extras = Array.from(keySet).filter((key) => !ordered.includes(key)).sort((a, b) => a.localeCompare(b))
  return [...ordered, ...extras].slice(0, Math.max(ordered.length, 4))
}

function buildScheduleLookupLabelMaps(lookups: LookupState, companyName: string | null) {
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
    company_id: new Map(companyName ? [["1", companyName]] : []),
    companyId: new Map(companyName ? [["1", companyName]] : []),
    branch_id: toMap(lookups.branches, ["id", "branch_id"], (row, id) => {
      return readStringFromRecord(row, ["name", "branch_name", "title"]) ?? `Branch ${id}`
    }),
    department_id: toMap(lookups.departments, ["id", "department_id"], (row, id) => {
      return readStringFromRecord(row, ["name", "department_name", "title"]) ?? `Department ${id}`
    }),
    employee_id: new Map(
      lookups.employees
        .map(resolveEmployeeLookupOption)
        .filter((option): option is { value: string; label: string } => option !== null)
        .map((option) => [option.value, option.label] as const)
    ),
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

function buildScheduleDetailTitle(section: ScheduleSectionKey, row: AdminRecord, lookupMaps: Record<string, Map<string, string>>) {
  const config = SECTION_CONFIG[section]
  const direct =
    readStringFromRecord(row, ["name", "title", "code"]) ||
    (row.employee_id !== undefined ? String(resolveScheduleCellValue("employee_id", row, lookupMaps)) : null) ||
    (row.shift_id !== undefined ? String(resolveScheduleCellValue("shift_id", row, lookupMaps)) : null) ||
    (row.timetable_id !== undefined ? String(resolveScheduleCellValue("timetable_id", row, lookupMaps)) : null)

  if (direct) return direct

  const id = resolveRowId(row, 0)
  return `${config.title.slice(0, -1) || config.title} ${id ? `#${String(id)}` : ""}`.trim()
}

function buildScheduleDetailEntries(
  section: ScheduleSectionKey,
  row: AdminRecord,
  lookupMaps: Record<string, Map<string, string>>
) {
  const config = SECTION_CONFIG[section]
  const seen = new Set<string>()
  const entries: Array<{ label: string; value: string }> = []

  for (const field of config.fields) {
    seen.add(field.key)
    const raw = row[field.key]
    if (raw === undefined || raw === null || field.hidden) {
      continue
    }
    const value = String(resolveScheduleCellValue(field.key, row, lookupMaps))
    if (!value || value === "-") {
      continue
    }
    entries.push({ label: field.label, value })
  }

  for (const key of ["status", "created_at", "updated_at", "remarks", "description"]) {
    if (seen.has(key)) continue
    const raw = row[key]
    if (raw === undefined || raw === null) continue
    const value = String(resolveScheduleCellValue(key, row, lookupMaps))
    if (!value || value === "-") continue
    entries.push({ label: prettifyLabel(key), value })
  }

  return entries
}

function ScheduleDetailsContent({
  section,
  row,
  lookupMaps,
}: {
  section: ScheduleSectionKey
  row: AdminRecord | null
  lookupMaps: Record<string, Map<string, string>>
}) {
  if (!row) {
    return <p className="text-sm text-muted-foreground">No details are available for this schedule record.</p>
  }

  const config = SECTION_CONFIG[section]
  const title = buildScheduleDetailTitle(section, row, lookupMaps)
  const entries = buildScheduleDetailEntries(section, row, lookupMaps)
  const statusValue =
    row.status !== undefined ? String(resolveScheduleCellValue("status", row, lookupMaps)) : ""

  const summaryFields = [
    row.employee_id !== undefined
      ? { label: "Employee", value: String(resolveScheduleCellValue("employee_id", row, lookupMaps)) }
      : null,
    row.shift_id !== undefined
      ? { label: "Shift", value: String(resolveScheduleCellValue("shift_id", row, lookupMaps)) }
      : null,
    row.timetable_id !== undefined
      ? { label: "Timetable", value: String(resolveScheduleCellValue("timetable_id", row, lookupMaps)) }
      : null,
    row.schedule_date !== undefined
      ? { label: "Schedule Date", value: String(resolveScheduleCellValue("schedule_date", row, lookupMaps)) }
      : null,
    row.effective_from !== undefined
      ? { label: "Effective From", value: String(resolveScheduleCellValue("effective_from", row, lookupMaps)) }
      : null,
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry && entry.value && entry.value !== "-"))
  const summaryLabels = new Set(summaryFields.map((entry) => entry.label))
  const detailEntries = entries.filter((entry) => !summaryLabels.has(entry.label))

  return (
    <div className="max-h-[65vh] space-y-7 overflow-auto pr-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {config.moduleTitle}
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
        </div>
        {statusValue && statusValue !== "-" ? (
          <span className={cn("mr-7 text-sm font-semibold", scheduleStatusTextClass(statusValue))}>
            {statusValue}
          </span>
        ) : null}
      </div>

      {summaryFields.length > 0 ? (
        <RecordDetailList items={summaryFields.map((entry) => ({ ...entry, key: entry.label }))} />
      ) : null}

      {detailEntries.length > 0 ? (
        <RecordDetailList
          items={detailEntries.map((entry) => ({ ...entry, key: `${entry.label}-${entry.value}` }))}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No readable details are available for this record.</p>
      )}
    </div>
  )
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

function slugifyScheduleCode(name: string) {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
  return slug || "SHIFT"
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
  const nextValues = { ...values }
  if (fieldKeys.has("code") && !(nextValues.code ?? "").trim()) {
    nextValues.code = slugifyScheduleCode(nextValues.name ?? "")
  }

  for (const field of fields) {
    const raw = nextValues[field.key] ?? ""
    const trimmed = raw.trim()

    if (
      field.required &&
      !trimmed &&
      !(field.key === "employee_id" && fieldKeys.has("employee_ids") && (values.employee_ids ?? "").trim())
    ) {
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

    payload[field.key] = field.key === "code" ? trimmed.slice(0, 50) : trimmed
  }

  if (fieldKeys.has("code")) {
    const code = typeof payload.code === "string" ? payload.code.trim() : ""
    payload.code = (code || slugifyScheduleCode(String(values.name ?? ""))).slice(0, 50)
  }

  if (fieldKeys.has("assigned_by") && typeof options.currentUserId === "number" && Number.isFinite(options.currentUserId)) {
    payload.assigned_by = options.currentUserId
  }

  return payload
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

async function listAllApprovedLeaveRequests(token: string) {
  const rows: AdminRecord[] = []
  const pageSize = 100
  for (let page = 1; page <= 50; page += 1) {
    const result = await listLeaveRequests(token, {
      page,
      limit: pageSize,
      status: "approved",
      sortBy: "start_date",
      sortOrder: "DESC",
    })
    rows.push(...result.rows)
    const reachedEnd = result.rows.length < pageSize
      || (result.totalPages !== null && page >= result.totalPages)
      || (result.total !== null && rows.length >= result.total)
    if (reachedEnd) break
  }
  return { rows }
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

function resolveEmployeeLookupOption(row: AdminRecord): { value: string; label: string } | null {
  const directNestedEmployee = readNestedRecord(row, ["employee", "user", "staff", "person"])
  const nestedEmployee = directNestedEmployee
    ? readNestedRecord(directNestedEmployee, ["user", "employee"]) ?? directNestedEmployee
    : null
  const id =
    readNumberFromRecord(row, ["id", "employee_id", "employeeId", "user_id", "userId", "staff_id", "staffId", "person_id", "personId"]) ??
    (nestedEmployee
      ? readNumberFromRecord(nestedEmployee, ["id", "employee_id", "employeeId", "user_id", "userId", "staff_id", "staffId", "person_id", "personId"])
      : null)
  if (id === null) return null

  const nameSource = nestedEmployee ?? row
  const fallbackName = [
    readStringFromRecord(nameSource, ["first_name", "firstName"]),
    readStringFromRecord(nameSource, ["middle_name", "middleName"]),
    readStringFromRecord(nameSource, ["last_name", "lastName"]),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
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
    case "employee_ids":
      return lookups.employees
        .map(resolveEmployeeLookupOption)
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
    case "timetable_day_shift_option_id":
      return withLabel(lookups.timetableShiftOptions, ["id", "timetable_day_shift_option_id"], (row, id) => {
        const shift = readNestedRecord(row, ["shift"])
        const name = shift ? readStringFromRecord(shift, ["name", "code"]) : null
        const day = readStringFromRecord(row, ["timetable_day_id", "timetableDayId"])
        return `${name || `Shift option ${id}`}${day ? ` · Day ${day}` : ""}`
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
  return (
    <TimeInput
      aria-label="Select time"
      className="w-full"
      increment={5}
      placeholder="Select time"
      value={value}
      onChange={(event) => onChange(event.target.value)}
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
  const hours = parts.hours ? Number(parts.hours) : null
  const minutes = parts.minutes ? Number(parts.minutes) : null

  const updateDuration = (nextHours: number | null, nextMinutes: number | null) => {
    if (nextHours === null && nextMinutes === null) {
      onChange("")
      return
    }
    onChange(durationPartsToMinutes(String(nextHours ?? 0), String(nextMinutes ?? 0)))
  }

  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Duration">
      <Field label="Hours">
        <SpinButton
          aria-label="Duration hours"
          min={0}
          max={24}
          step={1}
          value={hours}
          displayValue={hours === null ? "" : `${hours} hr`}
          placeholder="0 hr"
          onChange={(_event, data) => updateDuration(data.value ?? null, minutes)}
        />
      </Field>
      <Field label="Minutes">
        <SpinButton
          aria-label="Duration minutes"
          min={0}
          max={59}
          step={5}
          value={minutes}
          displayValue={minutes === null ? "" : `${minutes} min`}
          placeholder="0 min"
          onChange={(_event, data) => updateDuration(hours, data.value ?? null)}
        />
      </Field>
    </div>
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

  if (field.key === "employee_ids") {
    return <EmployeeTagPicker value={value} options={options} onChange={onChange} />
  }

  if (field.type === "select" || options.length > 0) {
    return (
      <FluentSelect
        ariaLabel={field.label}
        className="w-full"
        value={value}
        onChange={onChange}
        placeholder={`Select ${field.label}`}
        options={[
          { value: "", label: `Select ${field.label}` },
          ...options,
        ]}
      />
    )
  }

  if (field.type === "boolean") {
    return (
      <FluentSelect
        ariaLabel={field.label}
        className="w-full"
        value={value}
        onChange={onChange}
        placeholder={`Select ${field.label}`}
        options={[
          { value: "", label: `Select ${field.label}` },
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]}
      />
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
              <div
                key={`${field.key}-${option.value}`}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300"
              >
                <Checkbox
                  checked={checked}
                  label={option.label}
                  onChange={(_event, data) => {
                    const next = new Set(selected)
                    if (data.checked === true) {
                      next.add(option.value)
                    } else {
                      next.delete(option.value)
                    }
                    onChange(Array.from(next).join(","))
                  }}
                />
              </div>
            )
          })
        )}
      </div>
    )
  }

  if (field.type === "textarea") {
    return (
      <Textarea
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
    <Input
      className="w-full"
      type={field.type}
      placeholder={field.placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function EmployeeTagPicker({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const [query, setQuery] = React.useState("")
  const selectedOptions = React.useMemo(
    () => value.split(",").map((entry) => entry.trim()).filter(Boolean),
    [value],
  )
  const labelsByValue = React.useMemo(
    () => new Map(options.map((option) => [option.value, option.label])),
    [options],
  )
  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return options.filter(
      (option) =>
        !selectedOptions.includes(option.value) &&
        (!normalizedQuery || option.label.toLowerCase().includes(normalizedQuery)),
    )
  }, [options, query, selectedOptions])

  return (
    <TagPicker
      selectedOptions={selectedOptions}
      onOptionSelect={(_event, data) => {
        if (data.value === "__no-results") return
        onChange(data.selectedOptions.join(","))
        setQuery("")
      }}
    >
      <TagPickerControl className="w-full">
        <TagPickerGroup aria-label="Selected employees">
          {selectedOptions.map((employeeId) => {
            const label = labelsByValue.get(employeeId) ?? `Employee ${employeeId}`
            return (
              <Tag
                key={employeeId}
                value={employeeId}
                media={<Avatar name={label} icon={<Person20Regular />} size={20} />}
              >
                {label}
              </Tag>
            )
          })}
        </TagPickerGroup>
        <TagPickerInput
          aria-label="Search employees"
          placeholder={selectedOptions.length > 0 ? "Add another employee" : "Search employees"}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </TagPickerControl>
      <TagPickerList>
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => (
            <TagPickerOption
              key={option.value}
              value={option.value}
              text={option.label}
              media={<Avatar name={option.label} icon={<Person20Regular />} size={24} />}
            >
              {option.label}
            </TagPickerOption>
          ))
        ) : (
          <TagPickerOption value="__no-results">
            No employees found
          </TagPickerOption>
        )}
      </TagPickerList>
    </TagPicker>
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
  const [scheduleAssignmentMode, setScheduleAssignmentMode] = React.useState<"single" | "bulk">("single")
  const [editingId, setEditingId] = React.useState("")
  const [deletingId, setDeletingId] = React.useState("")
  const [clearingAssignedShift, setClearingAssignedShift] = React.useState<{
    employeeId: string
    date: string
    shiftId: string
  } | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [selectedRow, setSelectedRow] = React.useState<AdminRecord | null>(null)
  const [managementSearch, setManagementSearch] = React.useState("")
  const [managementFilter, setManagementFilter] = React.useState("ALL")
  const [currentCompanyName, setCurrentCompanyName] = React.useState<string | null>(() =>
    readStoredCompanyName()
  )

  React.useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  React.useEffect(() => {
    if (message) toast.success(message)
  }, [message])

  React.useEffect(() => {
    if (formError) toast.error(formError)
  }, [formError])

  React.useEffect(() => {
    if (lookupError) toast.warning(lookupError)
  }, [lookupError])

  React.useEffect(() => {
    setCreateValues(readPersistedFormState(createDraftKey, initialFormState))
    setEditValues(initialFormState)
    setEditingId("")
    setDeletingId("")
    setClearingAssignedShift(null)
    setSelectedRow(null)
    setDetailsOpen(false)
    setError(null)
    setMessage(null)
    setFormError(null)
    setLookupError(null)
    setCurrentUserId(null)
    setManagementSearch("")
    setManagementFilter("ALL")
    setScheduleAssignmentMode("single")
  }, [activeSection, createDraftKey, initialFormState])

  React.useEffect(() => {
    persistFormState(createDraftKey, createValues)
  }, [createDraftKey, createValues])

  React.useEffect(() => {
    setCurrentCompanyName(readStoredCompanyName())
  }, [])

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
          shiftAssignmentsResult,
          leaveRequestsResult,
          timetablesResult,
          holidaysResult,
          holidayGroupsResult,
          rotationGroupsResult,
          timetableDaysResult,
          timetableShiftOptionsResult,
          timetableRotationsResult,
        ] = await Promise.allSettled([
          needed.has("branch_id")
            ? listBranches(token, { page: 1, limit: 100 })
            : Promise.resolve({ rows: [] }),
          needed.has("department_id")
            ? listDepartments(token, { page: 1, limit: 100 })
            : Promise.resolve({ rows: [] }),
          needed.has("employee_id")
            ? listAllEmployees(token, {}, { pageSize: 100, maxPages: 50 }).then(async (rows) => {
              if (rows.length > 0) {
                return { rows }
              }
              const fallback = await listUsers(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
              return { rows: fallback.rows }
            })
            : Promise.resolve({ rows: [] }),
          activeSection === "shift-schedules" || [
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
          activeSection === "shift-schedules"
            ? listShiftResources(token, "shift-assignments", {
              page: 1,
              limit: 100,
              sortBy: "created_at",
              sortOrder: "DESC",
            })
            : Promise.resolve({ rows: [] }),
          activeSection === "shift-schedules"
            ? listAllApprovedLeaveRequests(token)
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
          needed.has("timetable_day_shift_option_id")
            ? listTimetableResources(token, "timetable-shift-rules", { page: 1, limit: 500 })
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
          shiftAssignments: resolveRows(shiftAssignmentsResult, "shift assignments"),
          leaveRequests: resolveRows(leaveRequestsResult, "approved leave"),
          timetables: resolveRows(timetablesResult, "timetables"),
          holidays: resolveRows(holidaysResult, "holidays"),
          holidayGroups: resolveRows(holidayGroupsResult, "holiday groups"),
          rotationGroups: resolveRows(rotationGroupsResult, "rotation groups"),
          timetableDays: resolveRows(timetableDaysResult, "timetable days"),
          timetableShiftOptions: resolveRows(timetableShiftOptionsResult, "timetable shift options"),
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
  }, [activeSection, fields])

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
  const lookupMaps = React.useMemo(
    () => buildScheduleLookupLabelMaps(lookups, currentCompanyName),
    [currentCompanyName, lookups]
  )
  const enhancedShiftList = [
    "shifts",
    "shift-breaks",
    "shift-assignments",
    "shift-rotation-groups",
    "shift-rotation-rules",
  ].includes(activeSection)
  const filteredManagementRows = React.useMemo(() => {
    if (!enhancedShiftList) return rows
    const query = managementSearch.trim().toLowerCase()
    return rows.filter((row) => {
      const status = readStringFromRecord(row, ["status"])?.toUpperCase() || "ACTIVE"
      if (
        managementFilter !== "ALL"
        && activeSection !== "shift-breaks"
        && activeSection !== "shift-rotation-rules"
        && status !== managementFilter
      ) return false
      if (activeSection === "shift-breaks" && managementFilter !== "ALL") {
        const isPaid = row.is_paid === true || row.isPaid === true
        if (managementFilter === "PAID" && !isPaid) return false
        if (managementFilter === "UNPAID" && isPaid) return false
      }
      if (activeSection === "shift-rotation-rules" && managementFilter !== "ALL") {
        const isOffDay = row.is_off_day === true || row.isOffDay === true
        if (managementFilter === "OFF_DAY" && !isOffDay) return false
        if (managementFilter === "WORKING" && isOffDay) return false
      }
      if (!query) return true
      const scalarValues = Object.values(row)
        .filter((value) => ["string", "number", "boolean"].includes(typeof value))
        .map((value) => String(value))
      const employeeId = row.employee_id ?? row.employeeId
      const shiftId = row.shift_id ?? row.shiftId
      const rotationGroupId = row.rotation_group_id ?? row.rotationGroupId
      const relationLabels = [
        employeeId === null || employeeId === undefined ? "" : lookupMaps.employee_id?.get(String(employeeId)) || "",
        shiftId === null || shiftId === undefined ? "" : lookupMaps.shift_id?.get(String(shiftId)) || "",
        rotationGroupId === null || rotationGroupId === undefined ? "" : lookupMaps.rotation_group_id?.get(String(rotationGroupId)) || "",
      ]
      return [...scalarValues, ...relationLabels].some((value) => value.toLowerCase().includes(query))
    })
  }, [activeSection, enhancedShiftList, lookupMaps, managementFilter, managementSearch, rows])
  const activeStatusCount = React.useMemo(
    () => rows.filter((row) => (readStringFromRecord(row, ["status"])?.toUpperCase() || "ACTIVE") === "ACTIVE").length,
    [rows]
  )
  const nightShiftCount = React.useMemo(
    () => rows.filter((row) => row.is_night_shift === true || row.isNightShift === true).length,
    [rows]
  )
  const paidBreakCount = React.useMemo(
    () => rows.filter((row) => row.is_paid === true || row.isPaid === true).length,
    [rows]
  )
  const primaryAssignmentCount = React.useMemo(
    () => rows.filter((row) => row.is_primary === true || row.isPrimary === true).length,
    [rows]
  )
  const offDayRuleCount = React.useMemo(
    () => rows.filter((row) => row.is_off_day === true || row.isOffDay === true).length,
    [rows]
  )

  // Defined before tableColumns so the actions column can reference it safely.
  const openEdit = React.useCallback(async (id: string, overrides?: Record<string, string>) => {
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
      const initialEditState = buildEditValues(fields, record)
      const initialEditDraftKey = buildFormDraftStorageKey(`schedule:${activeSection}:edit:${id}`)
      clearPersistedFormState(initialEditDraftKey)
      setEditValues({ ...initialEditState, ...overrides })
      setFormError(null)
      setEditOpen(true)
    } catch (errorObject) {
      setFormError(formatLoadError(errorObject, "Could not load this record for editing."))
    }
  }, [activeSection, fields])

  const openCreate = React.useCallback((prefill?: {
    employeeId?: string
    employeeIds?: string[]
    scheduleDate?: string
    shiftId?: string
  }) => {
    setFormError(null)
    setScheduleAssignmentMode(prefill?.employeeIds?.length ? "bulk" : "single")
    setCreateValues((current) => ({
      ...current,
      ...(prefill?.employeeId ? { employee_id: prefill.employeeId, employee_ids: "" } : {}),
      ...(prefill?.employeeIds?.length ? { employee_id: "", employee_ids: prefill.employeeIds.join(",") } : {}),
      ...(prefill?.scheduleDate ? { schedule_date: prefill.scheduleDate } : {}),
      ...(prefill?.shiftId ? { shift_id: prefill.shiftId, override_shift_id: "", is_off_day: "false" } : {}),
    }))
    setCreateOpen(true)
  }, [])

  const tableColumns = React.useMemo(
    () => {
      const actionColumn = {
        key: "actions",
        label: "Actions",
        defaultWidth: 82,
        sortable: false,
        render: (row: AdminRecord) => {
          const rowId = String(resolveRowId(row, -1))
          if (activeSection === "timetable-generated-schedules" && readStringFromRecord(row, ["status"]) === "PUBLISHED") {
            return <span className="text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">Published</span>
          }
          return (
            <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
              <button
                className="admin-table-icon-button"
                type="button"
                aria-label={activeSection === "shifts" ? "Edit shift" : "Edit"}
                title="Edit"
                onClick={() => {
                  void openEdit(rowId)
                }}
              >
                <Edit16Regular className="h-3.5 w-3.5" />
              </button>
              <button
                className="admin-table-icon-button"
                data-variant="danger"
                type="button"
                aria-label={activeSection === "shifts" ? "Delete shift" : "Delete"}
                title="Delete"
                onClick={() => {
                  setDeletingId(rowId)
                  setDeleteOpen(true)
                }}
              >
                <Delete16Regular className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        },
      }

      if (activeSection === "shifts") {
        return [
          {
            key: "name",
            label: "Shift",
            defaultWidth: 245,
            sortable: true,
            render: (row: AdminRecord) => {
              const name = readStringFromRecord(row, ["name", "shift_name", "shiftName"]) || "Unnamed shift"
              const code = readStringFromRecord(row, ["code"])
              const description = readStringFromRecord(row, ["description"])
              return (
                <div className="flex min-w-0 items-center gap-2.5 py-1">
                  <span className="h-8 w-1 shrink-0 bg-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-foreground">{name}</span>
                      {code ? (
                        <span className="shrink-0 bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {code}
                        </span>
                      ) : null}
                    </span>
                    {description ? <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{description}</span> : null}
                  </span>
                </div>
              )
            },
          },
          {
            key: "schedule_summary",
            label: "Working hours",
            defaultWidth: 190,
            sortable: true,
            sortValue: (row: AdminRecord) => readStringFromRecord(row, ["start_time", "startTime"]),
            render: (row: AdminRecord) => {
              const start = readStringFromRecord(row, ["start_time", "startTime"])
              const end = readStringFromRecord(row, ["end_time", "endTime"])
              const expectedMinutes = readNumberFromRecord(row, ["expected_work_minutes", "expectedWorkMinutes"])
              const duration = expectedMinutes !== null
                ? `${Math.floor(expectedMinutes / 60)}h ${expectedMinutes % 60 ? `${expectedMinutes % 60}m` : ""}`.trim()
                : null
              return (
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-foreground">
                    <Clock3Icon className="size-3.5 text-primary" />
                    {start ? formatDisplayTime(start) : "—"} <span className="text-muted-foreground">–</span> {end ? formatDisplayTime(end) : "—"}
                  </span>
                  {duration ? <span className="mt-0.5 block text-[10px] text-muted-foreground">{duration} expected</span> : null}
                </span>
              )
            },
          },
          {
            key: "shift_type",
            label: "Type",
            defaultWidth: 115,
            sortable: true,
            render: (row: AdminRecord) => {
              const type = readStringFromRecord(row, ["shift_type", "shiftType"]) || "FIXED"
              return (
                <span className="inline-flex bg-primary/8 px-2 py-1 text-[10px] font-semibold text-primary">
                  {prettifyLabel(type)}
                </span>
              )
            },
          },
          {
            key: "scope",
            label: "Availability",
            defaultWidth: 185,
            sortable: false,
            render: (row: AdminRecord) => {
              const branchId = row.branch_id ?? row.branchId
              const departmentId = row.department_id ?? row.departmentId
              const branch = branchId !== null && branchId !== undefined
                ? lookupMaps.branch_id?.get(String(branchId))
                : null
              const department = departmentId !== null && departmentId !== undefined
                ? lookupMaps.department_id?.get(String(departmentId))
                : null
              return (
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-foreground">{department || branch || "All employees"}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                    {department && branch ? branch : department ? "Department shift" : branch ? "Branch shift" : "Company-wide"}
                  </span>
                </span>
              )
            },
          },
          {
            key: "status",
            label: "Status",
            defaultWidth: 105,
            sortable: true,
            render: (row: AdminRecord) => {
              const status = readStringFromRecord(row, ["status"])?.toUpperCase() || "ACTIVE"
              return (
                <span className={cn("text-[10px] font-semibold", scheduleStatusTextClass(status))}>
                  {prettifyLabel(status)}
                </span>
              )
            },
          },
          actionColumn,
        ]
      }

      if (activeSection === "shift-breaks") {
        return [
          {
            key: "name",
            label: "Break",
            defaultWidth: 225,
            sortable: true,
            render: (row: AdminRecord) => {
              const name = readStringFromRecord(row, ["name"]) || "Unnamed break"
              const type = readStringFromRecord(row, ["break_type", "breakType"]) || "OTHER"
              return (
                <div className="flex min-w-0 items-center gap-2.5 py-1">
                  <span className="h-8 w-1 shrink-0 bg-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-foreground">{name}</span>
                    <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">{prettifyLabel(type)} break</span>
                  </span>
                </div>
              )
            },
          },
          {
            key: "shift_id",
            label: "Shift",
            defaultWidth: 190,
            sortable: true,
            render: (row: AdminRecord) => {
              const id = row.shift_id ?? row.shiftId
              return <span className="truncate text-xs font-medium text-foreground">{lookupMaps.shift_id?.get(String(id ?? "")) || "Unassigned shift"}</span>
            },
          },
          {
            key: "break_window",
            label: "Break window",
            defaultWidth: 195,
            sortable: true,
            sortValue: (row: AdminRecord) => readStringFromRecord(row, ["start_time", "startTime"]),
            render: (row: AdminRecord) => {
              const start = readStringFromRecord(row, ["start_time", "startTime"])
              const end = readStringFromRecord(row, ["end_time", "endTime"])
              const duration = readNumberFromRecord(row, ["duration_minutes", "durationMinutes"])
              return (
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-foreground">
                    <Clock3Icon className="size-3.5 text-primary" />
                    {start ? formatDisplayTime(start) : "—"} <span className="text-muted-foreground">–</span> {end ? formatDisplayTime(end) : "—"}
                  </span>
                  {duration !== null ? <span className="mt-0.5 block text-[10px] text-muted-foreground">{duration} minutes</span> : null}
                </span>
              )
            },
          },
          {
            key: "break_settings",
            label: "Policy",
            defaultWidth: 175,
            sortable: false,
            render: (row: AdminRecord) => {
              const paid = row.is_paid === true || row.isPaid === true
              const flexible = row.is_flexible === true || row.isFlexible === true
              return (
                <span className="inline-flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                  <span className={paid ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>
                    {paid ? "Paid" : "Unpaid"}
                  </span>
                  <span aria-hidden="true" className="text-muted-foreground/50">·</span>
                  <span className="text-primary">{flexible ? "Flexible" : "Fixed"}</span>
                </span>
              )
            },
          },
          actionColumn,
        ]
      }

      if (activeSection === "shift-assignments") {
        return [
          {
            key: "employee_id",
            label: "Employee",
            defaultWidth: 245,
            sortable: true,
            render: (row: AdminRecord) => {
              const id = row.employee_id ?? row.employeeId
              return (
                <div className="flex min-w-0 items-center gap-2.5 py-1">
                  <span className="flex size-7 shrink-0 items-center justify-center bg-primary/10 text-[10px] font-bold text-primary">
                    {(lookupMaps.employee_id?.get(String(id ?? "")) || "E").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate text-xs font-semibold text-foreground">{lookupMaps.employee_id?.get(String(id ?? "")) || "Unknown employee"}</span>
                </div>
              )
            },
          },
          {
            key: "shift_id",
            label: "Assigned shift",
            defaultWidth: 190,
            sortable: true,
            render: (row: AdminRecord) => {
              const id = row.shift_id ?? row.shiftId
              return <span className="truncate text-xs font-medium text-foreground">{lookupMaps.shift_id?.get(String(id ?? "")) || "Unknown shift"}</span>
            },
          },
          {
            key: "effective_period",
            label: "Effective period",
            defaultWidth: 205,
            sortable: true,
            sortValue: (row: AdminRecord) => readStringFromRecord(row, ["effective_from", "effectiveFrom"]),
            render: (row: AdminRecord) => {
              const from = readStringFromRecord(row, ["effective_from", "effectiveFrom"])
              const to = readStringFromRecord(row, ["effective_to", "effectiveTo"])
              return (
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-foreground">{from ? formatDisplayDate(from) : "Not set"}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{to ? `Until ${formatDisplayDate(to)}` : "No end date"}</span>
                </span>
              )
            },
          },
          {
            key: "assignment_state",
            label: "Assignment",
            defaultWidth: 165,
            sortable: true,
            sortValue: (row: AdminRecord) => readStringFromRecord(row, ["status"]),
            render: (row: AdminRecord) => {
              const status = readStringFromRecord(row, ["status"])?.toUpperCase() || "ACTIVE"
              const primary = row.is_primary === true || row.isPrimary === true
              return (
                <span className="inline-flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                  <span className={scheduleStatusTextClass(status)}>{prettifyLabel(status)}</span>
                  <span aria-hidden="true" className="text-muted-foreground/50">·</span>
                  <span className="text-primary">{primary ? "Primary" : "Secondary"}</span>
                </span>
              )
            },
          },
          {
            key: "rotation_group_id",
            label: "Rotation",
            defaultWidth: 165,
            sortable: true,
            render: (row: AdminRecord) => {
              const id = row.rotation_group_id ?? row.rotationGroupId
              return <span className="truncate text-xs text-muted-foreground">{id ? lookupMaps.rotation_group_id?.get(String(id)) || `Group ${String(id)}` : "No rotation"}</span>
            },
          },
          actionColumn,
        ]
      }

      if (activeSection === "shift-rotation-groups") {
        return [
          {
            key: "name",
            label: "Rotation group",
            defaultWidth: 285,
            sortable: true,
            render: (row: AdminRecord) => {
              const name = readStringFromRecord(row, ["name"]) || "Unnamed group"
              const code = readStringFromRecord(row, ["code"])
              const description = readStringFromRecord(row, ["description"])
              return (
                <div className="flex min-w-0 items-center gap-2.5 py-1">
                  <span className="h-8 w-1 shrink-0 bg-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-foreground">{name}</span>
                      {code ? <span className="bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">{code}</span> : null}
                    </span>
                    {description ? <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{description}</span> : null}
                  </span>
                </div>
              )
            },
          },
          {
            key: "cycle_days",
            label: "Cycle",
            defaultWidth: 150,
            sortable: true,
            render: (row: AdminRecord) => {
              const days = readNumberFromRecord(row, ["cycle_days", "cycleDays"])
              return (
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-foreground">{days ?? "—"} {days === 1 ? "day" : "days"}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">Repeating rotation</span>
                </span>
              )
            },
          },
          {
            key: "rules",
            label: "Rules",
            defaultWidth: 145,
            sortable: false,
            render: (row: AdminRecord) => {
              const nestedRules = Array.isArray(row.rules) ? row.rules.length : null
              return <span className="text-xs font-medium text-foreground">{nestedRules === null ? "Open to manage" : `${nestedRules} ${nestedRules === 1 ? "rule" : "rules"}`}</span>
            },
          },
          {
            key: "status",
            label: "Status",
            defaultWidth: 115,
            sortable: true,
            render: (row: AdminRecord) => {
              const status = readStringFromRecord(row, ["status"])?.toUpperCase() || "ACTIVE"
              return (
                <span className={cn("text-[10px] font-semibold", scheduleStatusTextClass(status))}>
                  {prettifyLabel(status)}
                </span>
              )
            },
          },
          actionColumn,
        ]
      }

      if (activeSection === "shift-rotation-rules") {
        return [
          {
            key: "rotation_group_id",
            label: "Rotation group",
            defaultWidth: 235,
            sortable: true,
            render: (row: AdminRecord) => {
              const id = row.rotation_group_id ?? row.rotationGroupId
              return <span className="truncate text-xs font-semibold text-foreground">{lookupMaps.rotation_group_id?.get(String(id ?? "")) || "Unknown rotation group"}</span>
            },
          },
          {
            key: "day_index",
            label: "Cycle day",
            defaultWidth: 135,
            sortable: true,
            render: (row: AdminRecord) => {
              const day = readNumberFromRecord(row, ["day_index", "dayIndex"])
              return <span className="inline-flex size-8 items-center justify-center bg-primary/10 text-xs font-bold text-primary">{day ?? "—"}</span>
            },
          },
          {
            key: "shift_id",
            label: "Shift",
            defaultWidth: 205,
            sortable: true,
            render: (row: AdminRecord) => {
              const id = row.shift_id ?? row.shiftId
              const offDay = row.is_off_day === true || row.isOffDay === true
              return <span className="truncate text-xs font-medium text-foreground">{offDay ? "No shift" : lookupMaps.shift_id?.get(String(id ?? "")) || "Unassigned shift"}</span>
            },
          },
          {
            key: "is_off_day",
            label: "Day type",
            defaultWidth: 140,
            sortable: true,
            render: (row: AdminRecord) => {
              const offDay = row.is_off_day === true || row.isOffDay === true
              return (
                <span className={cn(
                  "text-[10px] font-semibold",
                  offDay ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                )}>{offDay ? "Off day" : "Working day"}</span>
              )
            },
          },
          actionColumn,
        ]
      }

      return [
        ...columns.map((column) => ({
          key: column,
          label: fields.find((field) => field.key === column)?.label ?? prettifyLabel(column),
          defaultWidth: column === "name" ? 180 : column === "status" ? 90 : 150,
          sortable: true,
          render: (row: AdminRecord) => resolveScheduleCellValue(column, row, lookupMaps),
        })),
        actionColumn,
      ]
    },
    [activeSection, columns, fields, lookupMaps, openEdit]
  )

  const onCreate = async () => {
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }

    try {
      const payload = toPayload(fields, createValues, { currentUserId })
      if (activeSection === "shift-schedules") {
        ensureShiftScheduleDateIsNotPast(payload.schedule_date)
        const bulkEmployeeIds = Array.isArray(payload.employee_ids)
          ? payload.employee_ids.map((entry) => String(entry).trim()).filter(Boolean)
          : []
        const singleEmployeeId =
          typeof payload.employee_id === "string" || typeof payload.employee_id === "number"
            ? String(payload.employee_id).trim()
            : ""
        const targetEmployeeIds = bulkEmployeeIds.length > 0
          ? bulkEmployeeIds
          : singleEmployeeId
            ? [singleEmployeeId]
            : []

        if (targetEmployeeIds.length === 0) {
          throw new Error("Select one employee or choose Bulk Employees before creating schedules.")
        }

        const basePayload = { ...payload }
        delete basePayload.employee_ids
        await Promise.all(
          targetEmployeeIds.map((employeeId) =>
            createScheduleRow(token, activeSection, {
              ...basePayload,
              employee_id: employeeId,
            })
          )
        )
        setMessage(
          targetEmployeeIds.length > 1
            ? `Created ${targetEmployeeIds.length} shift schedules successfully.`
            : "Created successfully."
        )
      } else if (activeSection === "timetable-generated-schedules") {
        const bulkEmployeeIds = Array.isArray(payload.employee_ids)
          ? payload.employee_ids.map((entry) => String(entry).trim()).filter(Boolean)
          : []
        if (bulkEmployeeIds.length > 0) {
          const basePayload = { ...payload }
          delete basePayload.employee_ids
          await createGeneratedSchedulesBulk(token, bulkEmployeeIds.map((employeeId) => ({ ...basePayload, employee_id: employeeId })))
          setMessage(`Created ${bulkEmployeeIds.length} schedule drafts successfully.`)
        } else {
          await createScheduleRow(token, activeSection, payload)
          setMessage("Schedule draft created successfully.")
        }
      } else {
        await createScheduleRow(token, activeSection, payload)
        setMessage("Created successfully.")
      }
      setFormError(null)
      setCreateOpen(false)
      clearPersistedFormState(createDraftKey)
      setCreateValues(initialFormState)
      setScheduleAssignmentMode("single")
      await fetchRows()
      router.refresh()
    } catch (errorObject) {
      setFormError(formatLoadError(errorObject, "Could not create this record."))
    }
  }

  const onEdit = async () => {
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }

    try {
      const payload = toPayload(fields, editValues, { currentUserId })
      if (activeSection === "shift-schedules") {
        ensureShiftScheduleDateIsNotPast(payload.schedule_date)
      }
      await updateScheduleRow(token, activeSection, editingId, payload)
      setMessage("Updated successfully.")
      setFormError(null)
      setEditOpen(false)
      setEditValues(initialFormState)
      setEditingId("")
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
      if (activeSection === "shift-schedules" && clearingAssignedShift) {
        ensureShiftScheduleCanBeRemoved(clearingAssignedShift.date)
        await createScheduleRow(token, activeSection, {
          employee_id: clearingAssignedShift.employeeId,
          shift_id: clearingAssignedShift.shiftId,
          schedule_date: clearingAssignedShift.date,
          is_off_day: true,
          ...(currentUserId ? { assigned_by: currentUserId } : {}),
        })
        setMessage("Shift removed from the selected future day.")
      } else {
        await deleteScheduleRow(token, activeSection, deletingId)
        setMessage(activeSection === "shift-schedules" ? "Future schedule removed successfully." : "Deleted successfully.")
      }
      setFormError(null)
      setDeleteOpen(false)
      setDeletingId("")
      setClearingAssignedShift(null)
      await fetchRows()
      router.refresh()
    } catch (errorObject) {
      setFormError(formatLoadError(errorObject, "Could not delete this record."))
    }
  }

  const renderForm = (
    values: Record<string, string>,
    onChange: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    mode: "create" | "edit"
  ) => {
    const isScheduleCreate = activeSection === "shift-schedules" && mode === "create"
    const usesSingleColumnForm = SINGLE_COLUMN_SCHEDULE_FORMS.has(activeSection)

    return (
      <div className={cn("grid items-start gap-4", !usesSingleColumnForm && "md:grid-cols-2")}>
        {isScheduleCreate ? (
          <Field
            className="md:col-span-2"
            label="Assignment mode"
            hint={scheduleAssignmentMode === "bulk"
              ? "Search for and select everyone who should receive this schedule."
              : "Choose one employee for this schedule."}
          >
            <div className="flex min-h-10 items-center gap-3 border-b border-border pb-3">
              <Switch
                checked={scheduleAssignmentMode === "bulk"}
                label={scheduleAssignmentMode === "bulk" ? "Bulk employees" : "Single employee"}
                onChange={(_event, data) => {
                  const nextMode = data.checked ? "bulk" : "single"
                  setScheduleAssignmentMode(nextMode)
                  onChange((current) => ({
                    ...current,
                    employee_id: nextMode === "bulk" ? "" : current.employee_id,
                    employee_ids: nextMode === "single" ? "" : current.employee_ids,
                  }))
                }}
              />
            </div>
          </Field>
        ) : null}
        {fields.map((field) => {
          if (
            field.hidden ||
            (field.createOnly && mode !== "create") ||
            (field.editOnly && mode !== "edit") ||
            (isScheduleCreate && field.key === "employee_id" && scheduleAssignmentMode === "bulk") ||
            (isScheduleCreate && field.key === "employee_ids" && scheduleAssignmentMode === "single")
          ) {
            return null
          }

          return (
        <Field
          key={field.key}
          className={!usesSingleColumnForm && (field.type === "textarea" || field.type === "multiselect") ? "md:col-span-2" : undefined}
          label={field.label}
          required={field.required}
          hint={field.helpText}
        >
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

                if (field.key === "name") {
                  const suggestedCode = slugifyScheduleCode(nextValue)
                  const currentCode = current.code?.trim() ?? ""
                  const previousSuggestedCode = slugifyScheduleCode(current.name ?? "")
                  if (suggestedCode && (!currentCode || currentCode === previousSuggestedCode)) {
                    nextState.code = suggestedCode
                  }
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
        </Field>
          )
        })}
        {lookupLoading ? (
          <p className={cn("text-xs text-slate-500", !usesSingleColumnForm && "md:col-span-2")}>
            Loading available options…
          </p>
        ) : null}
      </div>
    )
  }

  const openDetailsDialog = (row: AdminRecord) => {
    setSelectedRow(row)
    setDetailsOpen(true)
  }

  const enhancedListMeta: Partial<Record<ScheduleSectionKey, { title: string }>> = {
    shifts: {
      title: "Shift management",
    },
    "shift-breaks": {
      title: "Shift breaks",
    },
    "shift-assignments": {
      title: "Shift assignments",
    },
    "shift-rotation-groups": {
      title: "Rotation groups",
    },
    "shift-rotation-rules": {
      title: "Rotation rules",
    },
  }
  const activeEnhancedListMeta = enhancedListMeta[activeSection]

  const sectionTitleBlock = activeEnhancedListMeta ? (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">{activeEnhancedListMeta.title}</h1>
        <ScheduleSectionGuide section={activeSection} />
      </div>
    </div>
  ) : (
    <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {config.moduleTitle}
      </span>
      <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        {config.title}
      </h1>
    </div>
  )

  const enhancedListSummary = enhancedShiftList ? (
    <>
      <span><span className="font-semibold text-foreground">{rows.length}</span> total</span>
      {activeSection === "shifts" ? (
        <>
          <span><span className="font-semibold text-emerald-700 dark:text-emerald-400">{activeStatusCount}</span> active</span>
          <span><span className="font-semibold text-primary">{nightShiftCount}</span> night</span>
        </>
      ) : activeSection === "shift-breaks" ? (
        <span><span className="font-semibold text-emerald-700 dark:text-emerald-400">{paidBreakCount}</span> paid</span>
      ) : activeSection === "shift-assignments" ? (
        <span><span className="font-semibold text-primary">{primaryAssignmentCount}</span> primary</span>
      ) : activeSection === "shift-rotation-groups" ? (
        <span><span className="font-semibold text-emerald-700 dark:text-emerald-400">{activeStatusCount}</span> active</span>
      ) : activeSection === "shift-rotation-rules" ? (
        <span><span className="font-semibold text-amber-700 dark:text-amber-400">{offDayRuleCount}</span> off day</span>
      ) : null}
    </>
  ) : null

  return (
    <div className="mt-1.5 w-full min-w-0 max-w-none space-y-2">
      {activeSection === "shift-schedules" ? (
        <ShiftWeeklyScheduler
          rows={rows}
          employees={lookups.employees}
          departments={lookups.departments}
          shifts={lookups.shifts}
          shiftAssignments={lookups.shiftAssignments}
          leaveRequests={lookups.leaveRequests}
          loading={loading || lookupLoading}
          onCreate={openCreate}
          onEdit={openEdit}
          onRemove={(id) => {
            setFormError(null)
            setClearingAssignedShift(null)
            setDeletingId(id)
            setDeleteOpen(true)
          }}
          onClearAssigned={(employeeId, date, shiftId) => {
            setFormError(null)
            setDeletingId("")
            setClearingAssignedShift({ employeeId, date, shiftId })
            setDeleteOpen(true)
          }}
          onRefresh={() => {
            setMessage(null)
            void fetchRows()
          }}
        />
      ) : (
      <ResizableTable
        title={config.title}
        data={enhancedShiftList ? filteredManagementRows : rows}
        columns={tableColumns}
        loading={loading}
        itemsPerPage={20}
        showExport={false}
        storageKey={`schedule-${activeSection}`}
        toolbarStart={sectionTitleBlock}
        toolbarSummary={enhancedListSummary}
        toolbarActions={
          <>
            {activeSection === "timetable-generated-schedules" && rows.some((row) => readStringFromRecord(row, ["status"]) === "DRAFT") ? (
              <Button
                appearance="outline"
                size="small"
                className="!h-8 !min-h-8"
                type="button"
                disabled={loading}
                onClick={() => {
                  const token = readStoredToken()
                  const drafts = rows.filter((row) => readStringFromRecord(row, ["status"]) === "DRAFT")
                  void Promise.allSettled(drafts.map((row) => publishGeneratedSchedule(token, String(row.id))))
                    .then((results) => {
                      const published = results.filter((result) => result.status === "fulfilled").length
                      const failed = results.length - published
                      setMessage(`Published ${published} schedule${published === 1 ? "" : "s"}${failed ? `; ${failed} failed` : ""}.`)
                      void fetchRows()
                    })
                }}
              >
                Publish drafts ({rows.filter((row) => readStringFromRecord(row, ["status"]) === "DRAFT").length})
              </Button>
            ) : null}
            {activeSection === "timetable-generated-schedules" && rows.some((row) => readStringFromRecord(row, ["status"]) === "PUBLISHED") ? (
              <Button
                appearance="outline"
                size="small"
                className="!h-8 !min-h-8"
                type="button"
                disabled={loading}
                onClick={() => {
                  const token = readStoredToken()
                  const publishedRows = rows.filter((row) => readStringFromRecord(row, ["status"]) === "PUBLISHED")
                  void Promise.allSettled(publishedRows.map((row) => unpublishGeneratedSchedule(token, String(row.id))))
                    .then((results) => {
                      const count = results.filter((result) => result.status === "fulfilled").length
                      setMessage(`Unpublished ${count} schedule${count === 1 ? "" : "s"}.`)
                      void fetchRows()
                    })
                }}
              >
                Unpublish published ({rows.filter((row) => readStringFromRecord(row, ["status"]) === "PUBLISHED").length})
              </Button>
            ) : null}
            {enhancedShiftList ? (
              <>
                <div className="hidden sm:block">
                  <Input
                    type="search"
                    value={managementSearch}
                    onChange={(event) => setManagementSearch(event.target.value)}
                    placeholder={`Search ${config.title.toLowerCase()}`}
                    className="w-40 lg:w-48"
                    aria-label={`Search ${config.title.toLowerCase()}`}
                  />
                </div>
                <Select value={managementFilter} onValueChange={(value) => setManagementFilter(value || "ALL")}>
                  <SelectTrigger
                    className={cn(
                      "h-8 rounded-lg bg-background text-xs whitespace-nowrap",
                      activeSection === "shift-rotation-rules" ? "w-40" : "w-31",
                    )}
                    controlClassName="!h-8 !min-h-8 !px-2 !text-xs !whitespace-nowrap"
                    aria-label={`Filter ${config.title.toLowerCase()}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeSection === "shift-breaks" ? (
                      <>
                        <SelectItem value="ALL">All breaks</SelectItem>
                        <SelectItem value="PAID">Paid</SelectItem>
                        <SelectItem value="UNPAID">Unpaid</SelectItem>
                      </>
                    ) : activeSection === "shift-rotation-rules" ? (
                      <>
                        <SelectItem value="ALL">All day types</SelectItem>
                        <SelectItem value="WORKING">Working days</SelectItem>
                        <SelectItem value="OFF_DAY">Off days</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="ALL">All statuses</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </>
            ) : null}
            <Button
              appearance="primary"
              size="small"
              className="!h-8 !min-h-8"
              type="button"
              onClick={() => {
                openCreate()
              }}
              aria-label={`Create ${config.title}`}
              title="Create"
            >
              <Add16Regular className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Create</span>
            </Button>
            <Button
              appearance="outline"
              size="small"
              className="!h-8 !min-h-8 !w-8 !min-w-8"
              type="button"
              disabled={loading}
              onClick={() => {
                setMessage(null)
                void fetchRows()
              }}
              aria-label="Refresh"
              title="Refresh"
            >
              <ArrowSync20Regular className={`h-3.5 w-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
            </Button>
          </>
        }
        onRowSelect={(_, row) => {
          if (row) {
            openDetailsDialog(row)
          }
        }}
      />
      )}

      <RecordDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        title={`${config.title} details`}
        description="Review the selected schedule record in a readable operational summary."
        row={selectedRow}
        content={<ScheduleDetailsContent section={activeSection} row={selectedRow} lookupMaps={lookupMaps} />}
        resolveLabel={(key) => prettifyLabel(key)}
        resolveValue={(key, row) => resolveScheduleCellValue(key, row, lookupMaps)}
        footer={selectedRow ? (
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button
              appearance="secondary"
              icon={<Edit16Regular className="h-3.5 w-3.5" />}
              onClick={() => {
                const rowId = String(resolveRowId(selectedRow, -1))
                setDetailsOpen(false)
                void openEdit(rowId)
              }}
            >
              Edit
            </Button>
            <Button
              appearance="primary"
              className="!bg-red-600 !text-white hover:!bg-red-700"
              icon={<Delete16Regular className="h-3.5 w-3.5" />}
              onClick={() => {
                const rowId = String(resolveRowId(selectedRow, -1))
                setDetailsOpen(false)
                setDeletingId(rowId)
                setDeleteOpen(true)
              }}
            >
              Delete
            </Button>
          </div>
        ) : null}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup
          className={cn(
            "flex w-full flex-col overflow-hidden",
            SINGLE_COLUMN_SCHEDULE_FORMS.has(activeSection) ? "sm:max-w-lg" : "sm:max-w-2xl",
          )}
          bodyClassName="!h-full !max-h-none !overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle>Create {config.title.toLowerCase()}</DialogTitle>
            {activeSection === "shift-schedules" ? (
              <DialogDescription>
                Choose single or bulk assignment, then set the shift and schedule date.
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {renderForm(createValues, setCreateValues, "create")}
          </div>
          <DialogFooter className="sticky bottom-0 z-10 mt-auto shrink-0 border-t border-border bg-background py-3">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold !text-white transition hover:brightness-95"
              onClick={() => void onCreate()}
            >
              Create
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogPopup
          className={cn(
            "flex w-full flex-col overflow-hidden",
            SINGLE_COLUMN_SCHEDULE_FORMS.has(activeSection) ? "sm:max-w-lg" : "sm:max-w-2xl",
          )}
          bodyClassName="!h-full !max-h-none !overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle>Edit {config.title.toLowerCase()}</DialogTitle>
            {activeSection === "shift-schedules" ? (
              <DialogDescription>
                Update the selected employee schedule details here. Bulk Employees is only available when creating new schedules.
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {renderForm(editValues, setEditValues, "edit")}
          </div>
          <DialogFooter className="sticky bottom-0 z-10 mt-auto shrink-0 border-t border-border bg-background py-3">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold !text-white transition hover:brightness-95"
              onClick={() => void onEdit()}
            >
              Save
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setClearingAssignedShift(null)
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{activeSection === "shift-schedules" ? "Remove future schedule?" : `Delete ${config.title.toLowerCase()}`}</AlertDialogTitle>
            <AlertDialogDescription>
              {activeSection === "shift-schedules"
                ? clearingAssignedShift
                  ? "This marks the future date as an off day without changing the employee’s ongoing default shift assignment."
                  : "This removes the selected assignment before it starts. Schedules for today and previous days are locked to preserve attendance history."
                : "This action removes the selected record from the backend. Continue only if you are sure."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              appearance="primary"
              className="min-w-24 !bg-red-600 !text-white hover:!bg-red-700"
              onClick={() => void onDelete()}
            >
              {activeSection === "shift-schedules" ? "Remove" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
