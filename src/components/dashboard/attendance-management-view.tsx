"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CircleHelpIcon, FilterIcon, InfoIcon, PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon, XIcon } from "lucide-react"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import {
  buildFormDraftStorageKey,
  clearPersistedFormState,
  formatAdminValue,
  persistFormState,
  readPersistedFormState,
  readStoredCompanyName,
  RecordDetailsDialog,
} from "@/components/dashboard/admin-view-shared"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ResizableTable } from "@/components/ui/resizable-table"
import { Textarea } from "@/components/ui/textarea"

import {
  createAttendanceResource,
  deleteAttendanceResourceById,
  activateAttendancePolicy,
  getAttendanceResourceById,
  listAttendanceCheckpoints,
  listAttendanceDeviceSyncLogs,
  listAttendanceDevices,
  listAttendanceGeofences,
  listAttendanceHolidayGroups,
  listAttendanceHolidays,
  listAttendanceMobilePunches,
  listAttendancePolicies,
  listAttendanceSettings,
  listAttendanceWifiNetworks,
  listBranches,
  listEmployees,
  updateAttendanceResourceById,
  type AdminRecord,
  type AttendanceResourceKey,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

type AttendanceSectionKey = AttendanceResourceKey

type FieldType = "text" | "number" | "boolean" | "select" | "password" | "json" | "date"
type FieldOption = string | { label: string; value: string }

type FieldConfig = {
  key: string
  label: string
  description?: string
  type: FieldType
  required?: boolean
  options?: FieldOption[]
  placeholder?: string
  readOnlyOnEdit?: boolean
  /** Pre-filled create value (string form state). */
  defaultValue?: string
}

/** Full attendance policy schema → POST/PATCH /api/attendance/config/policies */
const ATTENDANCE_POLICY_FIELDS: FieldConfig[] = [
  {
    key: "name",
    label: "Policy Name",
    description: "Name of this attendance policy.",
    type: "text",
    required: true,
    placeholder: "e.g Main Office Policy",
  },
  {
    key: "is_active",
    label: "Policy Is Active",
    description: "Usually leave No and use Activate after review. Only one policy is active per company.",
    type: "boolean",
    defaultValue: "false",
  },
  {
    key: "late_after_minutes",
    label: "Mark Late After (Minutes)",
    description: "Minutes after scheduled start before someone is considered late.",
    type: "number",
    placeholder: "e.g 10",
    defaultValue: "10",
  },
  {
    key: "half_day_after_minutes",
    label: "Mark Half Day After (Minutes)",
    description: "Minutes late after which the day counts as half day.",
    type: "number",
    placeholder: "e.g 240",
    defaultValue: "240",
  },
  {
    key: "absent_after_minutes",
    label: "Mark Absent After (Minutes)",
    description: "Minutes late after which the day counts as absent.",
    type: "number",
    placeholder: "e.g 480",
    defaultValue: "480",
  },
  {
    key: "grace_period_minutes",
    label: "Grace Period (Minutes)",
    description: "Extra minutes allowed before late rules apply.",
    type: "number",
    placeholder: "e.g 10",
    defaultValue: "10",
  },
  {
    key: "allow_early_checkin",
    label: "Allow Early Check-In",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "allow_late_checkout",
    label: "Allow Late Check-Out",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "auto_absent_if_no_checkin",
    label: "Auto-Mark Absent If No Check-In",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "ignore_missing_checkout_if_hours_valid",
    label: "Ignore Missing Check-Out If Hours Are Enough",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "max_missing_punch_allowed",
    label: "Maximum Missing Punches Allowed",
    type: "number",
    placeholder: "e.g 0",
    defaultValue: "0",
  },
  {
    key: "rounding_mode",
    label: "Rounding Mode",
    description: "How attendance minutes are rounded.",
    type: "select",
    options: ["NEAREST", "UP", "DOWN"],
    defaultValue: "NEAREST",
  },
  {
    key: "weekend_days",
    label: "Weekend Days",
    description: "Comma-separated day codes (API format).",
    type: "text",
    placeholder: "e.g SAT,SUN",
    defaultValue: "SAT,SUN",
  },
  {
    key: "auto_mark_weekend_as_off",
    label: "Auto-Mark Weekends As Off Days",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "treat_weekend_as_absent_if_scheduled",
    label: "Treat Weekend As Absent If Scheduled",
    type: "boolean",
    defaultValue: "false",
  },
  {
    key: "holiday_policy_mode",
    label: "Holiday Policy Mode",
    type: "select",
    options: ["OFF", "PAID", "UNPAID", "OPTIONAL"],
    defaultValue: "OFF",
  },
  {
    key: "authentication_modes",
    label: "Allowed Check-In Methods",
    description: "Comma-separated modes employees may use.",
    type: "text",
    placeholder: "e.g MOBILE_APP,WEB",
    defaultValue: "MOBILE_APP,WEB",
  },
  {
    key: "require_geo_fencing",
    label: "Require Geo-Fencing",
    type: "boolean",
    defaultValue: "false",
  },
  {
    key: "allow_multi_device_login",
    label: "Allow Multiple Device Login",
    type: "boolean",
    defaultValue: "false",
  },
  {
    key: "auto_calculate_attendance",
    label: "Calculate Attendance Automatically",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "calculation_time",
    label: "Daily Calculation Time",
    description: "Time of day attendance totals are processed (HH:mm:ss).",
    type: "text",
    placeholder: "e.g 23:59:00",
    defaultValue: "23:59:00",
  },
  {
    key: "consider_shift_roster",
    label: "Use Shift Roster",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "requires_manager_approval_for_overtime",
    label: "Require Manager Approval For Overtime",
    type: "boolean",
    defaultValue: "false",
  },
  {
    key: "overtime_requires_approval",
    label: "Overtime Requires Approval",
    type: "boolean",
    defaultValue: "false",
  },
  {
    key: "overtime_auto_calculate",
    label: "Auto-Calculate Overtime",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "overtime_start_after_minutes",
    label: "Start Overtime After (Minutes)",
    type: "number",
    placeholder: "e.g 0",
    defaultValue: "0",
  },
  {
    key: "max_overtime_minutes_per_day",
    label: "Daily Overtime Limit (Minutes)",
    type: "number",
    placeholder: "e.g 0",
    defaultValue: "0",
  },
  {
    key: "max_overtime_minutes_per_month",
    label: "Monthly Overtime Limit (Minutes)",
    type: "number",
    placeholder: "e.g 0",
    defaultValue: "0",
  },
  {
    key: "overtime_rate_multiplier",
    label: "Normal Overtime Rate Multiplier",
    type: "number",
    placeholder: "e.g 1",
    defaultValue: "1",
  },
  {
    key: "holiday_overtime_multiplier",
    label: "Holiday Overtime Rate Multiplier",
    type: "number",
    placeholder: "e.g 1",
    defaultValue: "1",
  },
  {
    key: "weekend_overtime_multiplier",
    label: "Weekend Overtime Rate Multiplier",
    type: "number",
    placeholder: "e.g 1",
    defaultValue: "1",
  },
]

const EAST_AFRICA_TIMEZONES = [
  "Africa/Dar_es_Salaam",
  "Africa/Nairobi",
  "Africa/Kampala",
  "Africa/Kigali",
  "Africa/Bujumbura",
  "Africa/Juba",
  "Africa/Mogadishu",
  "Africa/Addis_Ababa",
  "Africa/Djibouti",
  "Africa/Asmara",
  "Indian/Antananarivo",
]

const ROUTE_TO_SECTION: Record<string, AttendanceSectionKey> = {
  settings: "settings",
  policies: "policies",
  devices: "devices",
  checkpoints: "checkpoints",
  geofences: "geofences",
  "wifi-networks": "wifi-networks",
  "mobile-punches": "mobile-punches",
  "holiday-groups": "holiday-groups",
  holidays: "holidays",
  "device-sync-logs": "device-sync-logs",
}

const SECTION_FIELDS: Record<AttendanceSectionKey, FieldConfig[]> = {
  // settings + policies both hit POST/GET /api/attendance/config/policies
  settings: ATTENDANCE_POLICY_FIELDS,
  policies: ATTENDANCE_POLICY_FIELDS,
  devices: [
    {
      key: "device_name",
      label: "Device Name",
      description: "Friendly name for the terminal as admins will search for it later.",
      type: "text",
      placeholder: "e.g Main Gate Terminal",
    },
    {
      key: "device_code",
      label: "Device Code",
      description: "Short unique code used to quickly verify the created device record.",
      type: "text",
      placeholder: "e.g DAR-MAIN-01",
    },
    {
      key: "device_serial_number",
      label: "Serial Number",
      description: "Hardware serial number reported by the attendance device.",
      type: "text",
      placeholder: "e.g DS-K1T804AMF-00012345",
    },
    {
      key: "device_model",
      label: "Model",
      description: "Exact model name to make similar terminals easier to distinguish.",
      type: "text",
      placeholder: "e.g DS-K1T804AMF",
    },
    { key: "vendor_name", label: "Vendor Name", type: "text", required: true },
    { key: "ip_address", label: "IP Address", type: "text", required: true },
    { key: "port", label: "Port", type: "number", required: true },
    {
      key: "integration_type",
      label: "Integration Type",
      type: "select",
      required: true,
      options: [{ label: "Hikvision", value: "hikvision" }],
    },
    {
      key: "auth_type",
      label: "Auth Type",
      type: "select",
      required: true,
      options: [{ label: "Digest", value: "digest" }],
    },
    {
      key: "sync_mode",
      label: "Sync Mode",
      description: "Choose how this device exchanges attendance data with the system.",
      type: "select",
      required: true,
      options: ["PULL", "PUSH"],
    },
    { key: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE", "OFFLINE"] },
    {
      key: "branch_id",
      label: "Branch",
      description: "Select the branch where this attendance device is installed.",
      type: "number",
      required: true,
    },
    { key: "location_description", label: "Location Description", type: "text" },
    {
      key: "protocol",
      label: "Protocol",
      type: "select",
      required: true,
      options: [{ label: "ISAPI", value: "ISAPI" }],
    },
    { key: "api_username", label: "API Username", type: "text", required: true },
    { key: "api_password", label: "API Password", type: "password", required: true },
    {
      key: "timezone",
      label: "Timezone",
      type: "select",
      required: true,
      options: EAST_AFRICA_TIMEZONES,
      description: "Pick the closest East Africa timezone for this device location.",
    },
  ],
  checkpoints: [
    {
      key: "policy_set_id",
      label: "Attendance Policy",
      description: "Pick the attendance policy this checkpoint belongs to. Create and activate the policy first.",
      type: "number",
      required: true,
    },
    {
      key: "name",
      label: "Name",
      description: "Use a simple name staff and admins can recognize, such as Main Gate GPS or Office WiFi Check-In.",
      type: "text",
      required: true,
    },
    {
      key: "type",
      label: "Type",
      description: "Choose Device for machine-based punching, GPS for location-based punching, WiFi for office-network checks, or QR/Manual for special flows.",
      type: "select",
      required: true,
      options: ["DEVICE", "GPS", "WIFI", "QR", "MANUAL"],
    },
    {
      key: "device_id",
      label: "Device",
      description: "Required only when checkpoint type is Device.",
      type: "number",
    },
    {
      key: "geofence_id",
      label: "Geofence",
      description: "Required only when checkpoint type is GPS.",
      type: "number",
    },
    {
      key: "wifi_network_id",
      label: "WiFi Network",
      description: "Required only when checkpoint type is WiFi.",
      type: "number",
    },
    {
      key: "is_required",
      label: "Is Required",
      description: "Choose Yes if employees must satisfy this checkpoint for the punch to be accepted normally.",
      type: "boolean",
    },
    {
      key: "allow_override",
      label: "Allow Override",
      description: "Choose Yes if staff can still request an override reason when this checkpoint fails.",
      type: "boolean",
    },
    {
      key: "max_distance_meters",
      label: "Max Distance (meters)",
      description: "Use this only for GPS checkpoints. It defines how far from the geofence center is still acceptable.",
      type: "number",
    },
    {
      key: "strict_mode",
      label: "Strict Mode",
      description: "Choose Yes if you want this checkpoint enforced more tightly with less tolerance for mismatches.",
      type: "boolean",
    },
    {
      key: "status",
      label: "Status",
      description: "Set Active when this checkpoint is ready to be used in live attendance.",
      type: "select",
      options: ["ACTIVE", "INACTIVE"],
    },
  ],
  geofences: [
    {
      key: "branchId",
      label: "Branch",
      description: "Pick the branch this location belongs to, for example Head Office or Mwanza Branch.",
      type: "number",
    },
    {
      key: "name",
      label: "Name",
      description: "Give this location a simple name your team will recognize, such as Main Office Gate or Warehouse Yard.",
      type: "text",
      required: true,
      placeholder: "e.g Main Office",
    },
    {
      key: "description",
      label: "Description",
      description: "Optional note to explain what this geofence covers or when it should be used.",
      type: "text",
      placeholder: "e.g Staff can check in anywhere within the office compound",
    },
    {
      key: "type",
      label: "Type",
      description: "Choose Circle for one central point and a radius. Choose Polygon if you need to mark an irregular boundary on multiple corners.",
      type: "select",
      options: ["CIRCLE", "POLYGON"],
    },
    {
      key: "latitude",
      label: "Latitude",
      description: "The north/south map position of the location center. Use this together with longitude for circle geofences.",
      type: "number",
      placeholder: "e.g -6.7924",
    },
    {
      key: "longitude",
      label: "Longitude",
      description: "The east/west map position of the location center. Use this together with latitude for circle geofences.",
      type: "number",
      placeholder: "e.g 39.2083",
    },
    {
      key: "radiusMeters",
      label: "Radius Meters",
      description: "How far from the center point someone can be and still count as inside. Example: 100 means 100 meters.",
      type: "number",
      placeholder: "e.g 100",
    },
    {
      key: "allowedAccuracyMeters",
      label: "Allowed Accuracy Meters",
      description: "How much phone GPS error you want to allow. A slightly higher number is safer if staff check in outdoors with weak signal.",
      type: "number",
      placeholder: "e.g 20",
    },
    {
      key: "strictAccuracy",
      label: "Strict Accuracy",
      description: "Choose Yes only if you want the app to reject check-ins when location accuracy is poor.",
      type: "boolean",
    },
    {
      key: "polygonCoordinates",
      label: "Polygon Corner Points",
      description: "Use this only for Polygon type. Enter one corner per line in latitude,longitude format, going around the area boundary in order.",
      type: "text",
      placeholder: "-6.7924,39.2083\n-6.7920,39.2091\n-6.7931,39.2098",
    },
    {
      key: "status",
      label: "Status",
      description: "Set Active when this geofence is ready to be used for attendance. Use Inactive if you are still preparing it.",
      type: "select",
      options: ["ACTIVE", "INACTIVE"],
    },
  ],
  "wifi-networks": [
    { key: "branchId", label: "Branch", type: "number" },
    { key: "name", label: "Name", type: "text", required: true },
    { key: "description", label: "Description", type: "text" },
    { key: "ssid", label: "SSID", type: "text", required: true },
    { key: "bssid", label: "BSSID", type: "text" },
    {
      key: "allowedIpCidrs",
      label: "Allowed IP CIDRs",
      description: "Enter one CIDR block per line, for example office LAN or VPN ranges.",
      type: "text",
      placeholder: "192.168.1.0/24\n10.0.0.0/16",
    },
    {
      key: "securityType",
      label: "Security Type",
      type: "select",
      options: ["OPEN", "WPA", "WPA2", "WPA3", "ENTERPRISE", "UNKNOWN"],
    },
    { key: "requireSsidMatch", label: "Require SSID Match", type: "boolean" },
    { key: "requireBssidMatch", label: "Require BSSID Match", type: "boolean" },
    { key: "requireIpMatch", label: "Require IP Match", type: "boolean" },
    { key: "allowMobileAttendance", label: "Allow Mobile Attendance", type: "boolean" },
    { key: "status", label: "Status", type: "select", options: ["ACTIVE", "INACTIVE"] },
  ],
  "mobile-punches": [
    { key: "employeeId", label: "Employee ID", type: "number" },
    { key: "branchId", label: "Branch ID", type: "number" },
    { key: "punchType", label: "Punch Type", type: "select", options: ["CHECK_IN", "CHECK_OUT"] },
    {
      key: "validationStatus",
      label: "Validation Status",
      type: "select",
      options: ["APPROVED", "REJECTED", "PENDING_OVERRIDE", "OVERRIDE_APPROVED", "OVERRIDE_REJECTED"],
    },
    { key: "dateFrom", label: "Date From", type: "text", placeholder: "YYYY-MM-DD" },
    { key: "dateTo", label: "Date To", type: "text", placeholder: "YYYY-MM-DD" },
  ],
  "holiday-groups": [
    { key: "name", label: "Name", type: "text", required: true },
    { key: "description", label: "Description", type: "text" },
  ],
  holidays: [
    { key: "holiday_group_id", label: "Holiday Group", type: "select", required: true },
    { key: "name", label: "Name", type: "text", required: true },
    { key: "date", label: "Date", type: "date", required: true, placeholder: "YYYY-MM-DD" },
    { key: "type", label: "Type", type: "select", required: true, options: ["PUBLIC", "COMPANY", "RELIGIOUS", "OPTIONAL"] },
    { key: "is_paid", label: "Is Paid", type: "boolean" },
    { key: "affects_overtime", label: "Affects Overtime", type: "boolean" },
    { key: "counts_as_working_day", label: "Counts As Working Day", type: "boolean" },
    { key: "branch_id", label: "Branch ID", type: "number" },
  ],
  "device-sync-logs": [
    { key: "device_id", label: "Device ID", type: "number", required: true },
    { key: "sync_type", label: "Sync Type", type: "select", required: true, options: ["MANUAL", "AUTO", "WEBHOOK"] },
    { key: "status", label: "Status", type: "select", required: true, options: ["SUCCESS", "FAILED", "PARTIAL"] },
    { key: "started_at", label: "Started At", type: "text", placeholder: "ISO datetime" },
    { key: "completed_at", label: "Completed At", type: "text", placeholder: "ISO datetime" },
    { key: "records_received", label: "Records Received", type: "number" },
    { key: "records_processed", label: "Records Processed", type: "number" },
    { key: "failed_records", label: "Failed Records", type: "number" },
    { key: "error_message", label: "Error Message", type: "text" },
  ],
}

const READ_ONLY_SECTIONS = new Set<AttendanceSectionKey>([
  "device-sync-logs",
  "mobile-punches",
])

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

function listRowsForSection(key: AttendanceSectionKey, token: string) {
  const params = { page: 1, limit: 50, sortBy: "created_at", sortOrder: "DESC" as const }

  if (key === "settings") return listAttendanceSettings(token, params)
  if (key === "policies") return listAttendancePolicies(token, params)
  if (key === "devices") return listAttendanceDevices(token, params)
  if (key === "checkpoints") return listAttendanceCheckpoints(token, params)
  if (key === "geofences") return listAttendanceGeofences(token, params)
  if (key === "wifi-networks") return listAttendanceWifiNetworks(token, params)
  if (key === "mobile-punches") return listAttendanceMobilePunches(token, params)
  if (key === "holiday-groups") return listAttendanceHolidayGroups(token, params)
  if (key === "holidays") return listAttendanceHolidays(token, params)
  return listAttendanceDeviceSyncLogs(token, params)
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

function buildAttendanceDeviceIdentity(row: AdminRecord, resolveBranchName?: (branchId: number | null) => string) {
  const branchId = readNumberFromRecord(row, ["branch_id", "branchId"])
  const branchName = resolveBranchName ? resolveBranchName(branchId) : null

  return {
    id: readNumberFromRecord(row, ["id", "device_id", "attendance_device_id"]),
    name: readStringFromRecord(row, ["device_name", "deviceName", "name", "title"]),
    code: readStringFromRecord(row, ["device_code", "deviceCode"]),
    serial: readStringFromRecord(row, ["device_serial_number", "deviceSerialNumber", "serial_no"]),
    model: readStringFromRecord(row, ["device_model", "deviceModel", "model"]),
    vendor: readStringFromRecord(row, ["vendor_name", "vendorName"]),
    integrationType: readStringFromRecord(row, ["integration_type", "integrationType"]),
    branchId,
    branchName: branchName && branchName !== "-" ? branchName : null,
    status: readStringFromRecord(row, ["status"]),
    ipAddress: readStringFromRecord(row, ["ip_address"]),
  }
}

function getAttendanceDeviceSearchText(row: AdminRecord, resolveBranchName?: (branchId: number | null) => string) {
  const identity = buildAttendanceDeviceIdentity(row, resolveBranchName)
  return [
    identity.id,
    identity.name,
    identity.code,
    identity.serial,
    identity.model,
    identity.vendor,
    identity.integrationType,
    identity.branchName,
    identity.status,
    identity.ipAddress,
  ]
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase()
}

function formatAttendanceError(
  errorObject: unknown,
  section: AttendanceSectionKey,
  fallback: string
) {
  const fallbackMessage =
    errorObject instanceof Error && errorObject.message
      ? errorObject.message
      : fallback

  const status =
    typeof errorObject === "object" &&
    errorObject !== null &&
    "status" in errorObject &&
    typeof (errorObject as { status?: unknown }).status === "number"
      ? (errorObject as { status: number }).status
      : null

  if (
    status === 500 &&
    fallbackMessage.toLowerCase() === "internal server error"
  ) {
    return `Unable to load ${section.replaceAll("-", " ")} right now. The server returned an internal error (500).`
  }

  return fallbackMessage
}

function resolveVisibleColumns(section: AttendanceSectionKey, rows: AdminRecord[]) {
  const preferredBySection: Record<AttendanceSectionKey, string[]> = {
    settings: [
      "name",
      "is_active",
      "grace_period_minutes",
      "late_after_minutes",
      "auto_calculate_attendance",
      "require_geo_fencing",
    ],
    policies: [
      "name",
      "is_active",
      "grace_period_minutes",
      "late_after_minutes",
      "auto_calculate_attendance",
      "require_geo_fencing",
    ],
    devices: ["device_code", "device_serial_number", "device_model", "branch_id", "vendor_name", "integration_type", "status", "ip_address"],
    checkpoints: ["name", "type", "policy_set_id", "status"],
    geofences: ["name", "status", "type", "branchId"],
    "wifi-networks": ["name", "status", "ssid"],
    "mobile-punches": ["employee_name", "attendanceDate", "punchType", "validationStatus"],
    "holiday-groups": ["name", "status", "start_date", "end_date"],
    holidays: ["name", "date", "type", "branch_id"],
    "device-sync-logs": ["status", "records_synced", "created_at", "device_id"],
  }

  const preferred = preferredBySection[section] ?? ["name", "status", "type", "created_at"]
  const keySet = new Set<string>()
  rows.forEach((row) => Object.keys(row).forEach((key) => keySet.add(key)))
  if (section === "mobile-punches") {
    return preferred
  }
  const ordered = preferred.filter((key) => keySet.has(key))
  const extras = Array.from(keySet).filter((key) => !ordered.includes(key)).sort((a, b) => a.localeCompare(b))
  return [...ordered, ...extras].slice(0, Math.max(ordered.length, 4))
}

function getAttendanceDeviceLink(row: AdminRecord) {
  const deviceId = readNumberFromRecord(row, ["device_id", "deviceId", "attendance_device_id", "id"])
  if (deviceId === null) {
    return null
  }

  const deviceLabel =
    readStringFromRecord(row, ["device_name", "deviceName", "device_code", "device_serial_number", "vendor_name", "name"]) ??
    `Device ${deviceId}`

  const ipAddress = readStringFromRecord(row, ["ip_address"])
  const serial = readStringFromRecord(row, ["device_serial_number", "deviceSerialNumber", "serial_no"])
  const detailParts = [`ID ${deviceId}`]
  if (serial) {
    detailParts.push(serial)
  }
  if (ipAddress) {
    detailParts.push(ipAddress)
  }

  return {
    href: `/dashboard/access-control/devices/${deviceId}`,
    label: deviceLabel,
    detail: detailParts.join(" • "),
  }
}

function getSectionFormDescription(section: AttendanceSectionKey) {
  if (section === "geofences") {
    return "Use a geofence to mark where attendance is allowed. Choose Circle for a normal office or shop with one center point. Choose Polygon for a larger or irregular area. For Circle, fill latitude, longitude, and radius. For Polygon, enter one corner point per line and leave radius blank."
  }

  if (section === "wifi-networks") {
    return "Add the office WiFi details employees are allowed to use for attendance. This helps the system confirm that a punch came from an approved network."
  }

  if (section === "checkpoints") {
    return "Create checkpoints after your policies, geofences, and WiFi networks are ready. Choose one checkpoint type and only fill the matching source: Device, GPS geofence, or WiFi network."
  }

  return "Fill the fields and submit."
}

function getSectionSetupGuidance(section: AttendanceSectionKey) {
  if (section === "policies" || section === "settings") {
    return [
      "Policies map to POST/GET /api/attendance/config/policies for the active company.",
      "Create a policy first, then use Activate so only one policy is active company-wide.",
      "Timing order must be: Late After ≤ Half Day After ≤ Absent After.",
      "Weekend days use short codes like SAT,SUN. Auth modes use values like MOBILE_APP,WEB.",
    ]
  }

  if (section === "geofences") {
    return [
      "Recommended order: Policies → Geofences/WiFi → Checkpoints.",
      "Use Circle for normal offices or branches with one center point.",
      "Use Polygon only when the allowed area has an irregular shape with multiple corners.",
      "Mobile punch validation currently works best with Circle geofences.",
    ]
  }

  if (section === "wifi-networks") {
    return [
      "Add office or branch WiFi networks before creating WiFi checkpoints.",
      "Turn on BSSID match only if you want the exact router access point to be enforced.",
      "Turn on IP match only when you have approved network CIDR ranges ready.",
    ]
  }

  if (section === "checkpoints") {
    return [
      "Create checkpoints only after the attendance policy already exists.",
      "Device type needs a device, GPS type needs a geofence, and WiFi type needs a WiFi network.",
      "QR and Manual checkpoints should not be linked to a device, geofence, or WiFi network.",
      "Max distance is only used for GPS checkpoints.",
    ]
  }

  return []
}

function validateAttendancePayload(section: AttendanceSectionKey, payload: AdminRecord) {
  if (section === "policies" || section === "settings") {
    const late = typeof payload.late_after_minutes === "number" ? payload.late_after_minutes : null
    const halfDay =
      typeof payload.half_day_after_minutes === "number" ? payload.half_day_after_minutes : null
    const absent =
      typeof payload.absent_after_minutes === "number" ? payload.absent_after_minutes : null

    if (
      late !== null &&
      halfDay !== null &&
      absent !== null &&
      !(late <= halfDay && halfDay <= absent)
    ) {
      throw new Error(
        "Policy timing must follow this order: Late After <= Half Day After <= Absent After."
      )
    }
  }

  if (section === "geofences") {
    const type = typeof payload.type === "string" ? payload.type : ""

    if (type === "CIRCLE") {
      if (
        typeof payload.latitude !== "number" ||
        typeof payload.longitude !== "number" ||
        typeof payload.radiusMeters !== "number"
      ) {
        throw new Error(
          "Circle geofences require latitude, longitude, and radius meters."
        )
      }

      if (payload.radiusMeters < 5) {
        throw new Error("Circle geofence radius must be at least 5 meters.")
      }

      delete payload.polygonCoordinates
    }

    if (type === "POLYGON") {
      const coordinates = Array.isArray(payload.polygonCoordinates)
        ? payload.polygonCoordinates
        : []

      if (coordinates.length < 3) {
        throw new Error(
          "Polygon geofences need at least 3 corner points."
        )
      }

      delete payload.latitude
      delete payload.longitude
      delete payload.radiusMeters
    }
  }

  if (section === "wifi-networks") {
    if (payload.requireBssidMatch === true && !String(payload.bssid ?? "").trim()) {
      throw new Error("BSSID is required when Require BSSID Match is set to Yes.")
    }

    if (payload.requireIpMatch === true) {
      const cidrs = Array.isArray(payload.allowedIpCidrs) ? payload.allowedIpCidrs : []
      if (!cidrs.length) {
        throw new Error(
          "Add at least one allowed IP CIDR when Require IP Match is set to Yes."
        )
      }
    }
  }

  if (section === "checkpoints") {
    const type = typeof payload.type === "string" ? payload.type : ""
    const hasDevice = typeof payload.device_id === "number"
    const hasGeofence = typeof payload.geofence_id === "number"
    const hasWifi = typeof payload.wifi_network_id === "number"

    if (type === "DEVICE") {
      if (!hasDevice) {
        throw new Error("Device checkpoints require a selected device.")
      }
      delete payload.geofence_id
      delete payload.wifi_network_id
      delete payload.max_distance_meters
    } else if (type === "GPS") {
      if (!hasGeofence) {
        throw new Error("GPS checkpoints require a selected geofence.")
      }
      delete payload.device_id
      delete payload.wifi_network_id
    } else if (type === "WIFI") {
      if (!hasWifi) {
        throw new Error("WiFi checkpoints require a selected WiFi network.")
      }
      delete payload.device_id
      delete payload.geofence_id
      delete payload.max_distance_meters
    } else if (type === "QR" || type === "MANUAL") {
      delete payload.device_id
      delete payload.geofence_id
      delete payload.wifi_network_id
      delete payload.max_distance_meters
    }

    if (type !== "GPS") {
      delete payload.max_distance_meters
    }
  }
}

function buildInitialState(fields: FieldConfig[]) {
  const initial: Record<string, string> = {}
  for (const field of fields) {
    if (field.defaultValue !== undefined) {
      initial[field.key] = field.defaultValue
      continue
    }

    if (field.type === "select" && field.options?.length === 1) {
      const onlyOption = field.options[0]
      initial[field.key] = typeof onlyOption === "string" ? onlyOption : onlyOption.value
      continue
    }

    if (field.type === "boolean") {
      initial[field.key] = "false"
      continue
    }

    initial[field.key] = ""
  }
  return initial
}

function buildEditState(fields: FieldConfig[], row: AdminRecord) {
  const next: Record<string, string> = {}

  for (const field of fields) {
    const value = row[field.key]

    if (value === null || value === undefined) {
      next[field.key] = ""
      continue
    }

    if (field.type === "json") {
      next[field.key] =
        typeof value === "string" ? value : JSON.stringify(value, null, 2)
      continue
    }

    if (field.key === "polygonCoordinates") {
      if (Array.isArray(value)) {
        next[field.key] = value
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter(Boolean)
          .join("\n")
        continue
      }

      if (typeof value === "object" && value !== null) {
        const extracted = Array.isArray((value as { coordinates?: unknown }).coordinates)
          ? ((value as { coordinates: unknown[] }).coordinates
              .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
              .filter(Boolean)
              .join("\n"))
          : ""
        next[field.key] = extracted
        continue
      }
    }

    if (field.key === "allowedIpCidrs" && Array.isArray(value)) {
      next[field.key] = value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
        .join("\n")
      continue
    }

    if (typeof value === "boolean") {
      next[field.key] = value ? "true" : "false"
      continue
    }

    if (field.type === "date" && typeof value === "string" && value.trim()) {
      next[field.key] = value.trim().slice(0, 10)
      continue
    }

    next[field.key] = String(value)
  }

  return next
}

function toPayload(fields: FieldConfig[], values: Record<string, string>) {
  const payload: AdminRecord = {}
  for (const field of fields) {
    const raw = values[field.key]
    const trimmed = raw.trim()

    if (field.required && !trimmed) {
      throw new Error(`${field.label} is required.`)
    }

    if (!trimmed) {
      continue
    }

    if (field.key === "polygonCoordinates") {
      const coordinates = raw
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean)

      if (!coordinates.length) {
        continue
      }

      payload[field.key] = coordinates
      continue
    }

    if (field.key === "allowedIpCidrs") {
      const cidrs = raw
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean)

      if (!cidrs.length) {
        continue
      }

      payload[field.key] = cidrs
      continue
    }

    if (field.type === "number") {
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed)) {
        throw new Error(`${field.label} must be a valid number.`)
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

    if (field.type === "json") {
      payload[field.key] = JSON.parse(trimmed)
      continue
    }

    // Normalize calculation_time to HH:mm:ss for attendance policies API.
    if (field.key === "calculation_time") {
      if (/^\d{2}:\d{2}$/.test(trimmed)) {
        payload[field.key] = `${trimmed}:00`
        continue
      }
    }

    payload[field.key] = trimmed
  }
  return payload
}

function buildAttendanceLookupLabelMaps({
  companyName,
  employees,
  branches,
  policies,
  devices,
  geofences,
  wifiNetworks,
  holidayGroups,
}: {
  companyName: string | null
  employees: AdminRecord[]
  branches: AdminRecord[]
  policies: AdminRecord[]
  devices: AdminRecord[]
  geofences: AdminRecord[]
  wifiNetworks: AdminRecord[]
  holidayGroups: AdminRecord[]
}) {
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
    employee_id: toMap(employees, ["id", "employee_id", "employeeId"], (row, id) => {
      const employeeNo = readStringFromRecord(row, ["employee_no", "employeeNo"])
      const fullName =
        readStringFromRecord(row, ["employee_name", "employeeName", "full_name", "fullName", "display_name", "displayName", "name"]) ??
        [
          readStringFromRecord(row, ["first_name", "firstName", "preferred_name", "preferredName"]),
          readStringFromRecord(row, ["middle_name", "middleName"]),
          readStringFromRecord(row, ["last_name", "lastName"]),
        ]
          .filter(Boolean)
          .join(" ")
          .trim()
      return fullName ? (employeeNo ? `${fullName} (${employeeNo})` : fullName) : `Employee ${id}`
    }),
    employeeId: toMap(employees, ["id", "employee_id", "employeeId"], (row, id) => {
      const employeeNo = readStringFromRecord(row, ["employee_no", "employeeNo"])
      const fullName =
        readStringFromRecord(row, ["employee_name", "employeeName", "full_name", "fullName", "display_name", "displayName", "name"]) ??
        [
          readStringFromRecord(row, ["first_name", "firstName", "preferred_name", "preferredName"]),
          readStringFromRecord(row, ["middle_name", "middleName"]),
          readStringFromRecord(row, ["last_name", "lastName"]),
        ]
          .filter(Boolean)
          .join(" ")
          .trim()
      return fullName ? (employeeNo ? `${fullName} (${employeeNo})` : fullName) : `Employee ${id}`
    }),
    branch_id: toMap(branches, ["id", "branch_id"], (row, id) => {
      return readStringFromRecord(row, ["name", "title", "display_name"]) ?? `Branch ${id}`
    }),
    branchId: toMap(branches, ["id", "branch_id"], (row, id) => {
      return readStringFromRecord(row, ["name", "title", "display_name"]) ?? `Branch ${id}`
    }),
    geofence_id: toMap(geofences, ["id"], (row, id) => {
      return readStringFromRecord(row, ["name"]) ?? `Geofence ${id}`
    }),
    wifi_network_id: toMap(wifiNetworks, ["id", "wifi_network_id"], (row, id) => {
      return readStringFromRecord(row, ["name", "ssid"]) ?? `WiFi ${id}`
    }),
    policy_set_id: toMap(policies, ["id", "policy_set_id"], (row, id) => {
      return readStringFromRecord(row, ["name", "title"]) ?? `Policy ${id}`
    }),
    device_id: toMap(devices, ["id", "device_id", "attendance_device_id"], (row, id) => {
      const name = readStringFromRecord(row, ["device_name", "name", "vendor_name"]) ?? `Device ${id}`
      const code = readStringFromRecord(row, ["device_code", "deviceCode"])
      const serial = readStringFromRecord(row, ["device_serial_number", "deviceSerialNumber", "serial_no"])
      return code ? `${name} (${code})` : serial ? `${name} (${serial})` : name
    }),
    holiday_group_id: toMap(holidayGroups, ["id", "holiday_group_id"], (row, id) => {
      return readStringFromRecord(row, ["name", "title"]) ?? `Holiday Group ${id}`
    }),
  } satisfies Record<string, Map<string, string>>
}

function resolveAttendanceCellValue(
  column: string,
  row: AdminRecord,
  lookupMaps: Record<string, Map<string, string>>
) {
  if (column === "employee_name") {
    const directName =
      readStringFromRecord(row, ["employee_name", "employeeName", "full_name", "fullName", "display_name", "displayName", "name"])
    if (directName) {
      return directName
    }

    const rawEmployeeId = row.employeeId ?? row.employee_id
    if (typeof rawEmployeeId === "string" || typeof rawEmployeeId === "number") {
      return (
        lookupMaps.employeeId?.get(String(rawEmployeeId)) ??
        lookupMaps.employee_id?.get(String(rawEmployeeId)) ??
        formatAdminValue(rawEmployeeId)
      )
    }
  }

  const raw = row[column]
  const map = lookupMaps[column]
  if (map && (typeof raw === "string" || typeof raw === "number")) {
    return map.get(String(raw)) ?? formatAdminValue(raw)
  }
  return formatAdminValue(raw)
}

function isAttendanceDateLikeColumn(column: string) {
  const normalized = column.trim().toLowerCase()
  return (
    normalized.includes("date") ||
    normalized.includes("time") ||
    normalized.includes("_at") ||
    normalized.endsWith("at")
  )
}

function isFieldDisabled(
  section: AttendanceSectionKey,
  fieldKey: string,
  values: Record<string, string>
) {
  if (section === "geofences") {
    const type = values.type ?? ""

    if (fieldKey === "polygonCoordinates") {
      return type !== "POLYGON"
    }

    if (fieldKey === "latitude" || fieldKey === "longitude" || fieldKey === "radiusMeters") {
      return type === "POLYGON"
    }
  }

  return false
}

function FieldInput({
  field,
  value,
  onChange,
  branches = [],
  policies = [],
  devices = [],
  geofences = [],
  wifiNetworks = [],
  holidayGroups = [],
  branchesLoading = false,
  policiesLoading = false,
  devicesLoading = false,
  geofencesLoading = false,
  wifiNetworksLoading = false,
  holidayGroupsLoading = false,
  disabled = false,
}: {
  field: FieldConfig
  value: string
  onChange: (next: string) => void
  branches?: AdminRecord[]
  policies?: AdminRecord[]
  devices?: AdminRecord[]
  geofences?: AdminRecord[]
  wifiNetworks?: AdminRecord[]
  holidayGroups?: AdminRecord[]
  branchesLoading?: boolean
  policiesLoading?: boolean
  devicesLoading?: boolean
  geofencesLoading?: boolean
  wifiNetworksLoading?: boolean
  holidayGroupsLoading?: boolean
  disabled?: boolean
}) {
  if (field.key === "branch_id" || field.key === "branchId") {
    return (
      <select
        className={`w-full rounded-md border px-2 py-1.5 text-sm ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            : "border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        }`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {branchesLoading ? "Loading branches..." : "Select branch"}
        </option>
        {branches.map((branch, index) => {
          const id = readNumberFromRecord(branch, ["id", "branch_id"])
          if (id === null) {
            return null
          }
          return (
            <option key={`branch-${id}-${index}`} value={String(id)}>
              {readStringFromRecord(branch, ["name", "title", "display_name"]) ?? `Branch ${id}`}
            </option>
          )
        })}
      </select>
    )
  }

  if (field.key === "geofence_id") {
    return (
      <select
        className={`w-full rounded-md border px-2 py-1.5 text-sm ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            : "border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        }`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {geofencesLoading ? "Loading geofences..." : "Select geofence"}
        </option>
        {geofences.map((geofence, index) => {
          const id = readNumberFromRecord(geofence, ["id"])
          if (id === null) {
            return null
          }
          const name =
            readStringFromRecord(geofence, ["name"]) ?? `Geofence ${id}`
          const type = readStringFromRecord(geofence, ["type"])
          return (
            <option key={`geofence-${id}-${index}`} value={String(id)}>
              {type ? `${name} (${type})` : name}
            </option>
          )
        })}
      </select>
    )
  }

  if (field.key === "wifi_network_id") {
    return (
      <select
        className={`w-full rounded-md border px-2 py-1.5 text-sm ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            : "border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        }`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {wifiNetworksLoading ? "Loading WiFi networks..." : "Select WiFi network"}
        </option>
        {wifiNetworks.map((network, index) => {
          const id = readNumberFromRecord(network, ["id", "wifi_network_id"])
          if (id === null) {
            return null
          }
          const ssid = readStringFromRecord(network, ["ssid"])
          const name = readStringFromRecord(network, ["name"]) ?? ssid ?? `WiFi ${id}`
          const bssid = readStringFromRecord(network, ["bssid"])
          return (
            <option key={`wifi-network-${id}-${index}`} value={String(id)}>
              {bssid ? `${name} (${bssid})` : name}
            </option>
          )
        })}
      </select>
    )
  }

  if (field.key === "holiday_group_id") {
    return (
      <select
        className={`w-full rounded-md border px-2 py-1.5 text-sm ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            : "border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        }`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {holidayGroupsLoading ? "Loading holiday groups..." : "Select holiday group"}
        </option>
        {holidayGroups.map((group, index) => {
          const id = readNumberFromRecord(group, ["id", "holiday_group_id"])
          if (id === null) {
            return null
          }
          const name = readStringFromRecord(group, ["name", "title"]) ?? `Holiday Group ${id}`
          return (
            <option key={`holiday-group-${id}-${index}`} value={String(id)}>
              {name}
            </option>
          )
        })}
      </select>
    )
  }

  if (field.key === "policy_set_id") {
    return (
      <select
        className={`w-full rounded-md border px-2 py-1.5 text-sm ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            : "border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        }`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {policiesLoading ? "Loading attendance policies..." : "Select attendance policy"}
        </option>
        {policies.map((policy, index) => {
          const id = readNumberFromRecord(policy, ["id", "policy_set_id"])
          if (id === null) {
            return null
          }
          const name = readStringFromRecord(policy, ["name", "title"]) ?? `Policy ${id}`
          const status = readStringFromRecord(policy, ["status"])
          return (
            <option key={`policy-${id}-${index}`} value={String(id)}>
              {status ? `${name} (${status})` : name}
            </option>
          )
        })}
      </select>
    )
  }

  if (field.key === "device_id") {
    return (
      <select
        className={`w-full rounded-md border px-2 py-1.5 text-sm ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            : "border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        }`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {devicesLoading ? "Loading devices..." : "Select device"}
        </option>
        {devices.map((device, index) => {
          const id = readNumberFromRecord(device, ["id", "device_id", "attendance_device_id"])
          if (id === null) {
            return null
          }
          const name =
            readStringFromRecord(device, ["device_name", "name", "vendor_name"]) ?? `Device ${id}`
          const code = readStringFromRecord(device, ["device_code", "deviceCode"])
          const serial = readStringFromRecord(device, ["device_serial_number", "deviceSerialNumber", "serial_no"])
          return (
            <option key={`device-${id}-${index}`} value={String(id)}>
              {code ? `${name} (${code})` : serial ? `${name} (${serial})` : name}
            </option>
          )
        })}
      </select>
    )
  }

  if (field.key === "wifi_ssid") {
    return (
      <select
        className={`w-full rounded-md border px-2 py-1.5 text-sm ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            : "border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        }`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {wifiNetworksLoading ? "Loading WiFi networks..." : "Select WiFi network"}
        </option>
        {wifiNetworks.map((network, index) => {
          const ssid = readStringFromRecord(network, ["ssid"])
          if (!ssid) {
            return null
          }
          const name =
            readStringFromRecord(network, ["name"]) ?? ssid
          const bssid = readStringFromRecord(network, ["bssid"])
          return (
            <option key={`wifi-${ssid}-${bssid ?? index}`} value={ssid}>
              {bssid ? `${name} (${ssid} • ${bssid})` : `${name} (${ssid})`}
            </option>
          )
        })}
      </select>
    )
  }

  if (field.type === "select") {
    return (
      <select
        className={`w-full rounded-md border px-2 py-1.5 text-sm ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            : "border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        }`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select {field.label}</option>
        {(field.options ?? []).map((option) => {
          const normalized =
            typeof option === "string" ? { label: option, value: option } : option
          return (
            <option key={normalized.value} value={normalized.value}>
              {normalized.label}
            </option>
          )
        })}
      </select>
    )
  }

  if (field.type === "boolean") {
    return (
      <select
        className={`w-full rounded-md border px-2 py-1.5 text-sm ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            : "border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        }`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select {field.label}</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    )
  }

  if (field.type === "json") {
    return (
      <Textarea
        className={`min-h-16 w-full rounded-md border p-2 font-mono text-xs ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
        }`}
        value={value}
        disabled={disabled}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  if (field.type === "date") {
    return (
      <DatePickerPresets
        value={value}
        onChange={onChange}
        placeholder={field.placeholder || `Select ${field.label}`}
      />
    )
  }

  if (field.key === "allowedIpCidrs") {
    return (
      <Textarea
        className={`min-h-24 w-full rounded-md border p-3 font-mono text-sm leading-6 ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
        }`}
        value={value}
        disabled={disabled}
        readOnly={disabled}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  if (field.key === "polygonCoordinates") {
    return (
      <Textarea
        className={`min-h-24 w-full rounded-md border p-3 font-mono text-sm leading-6 ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
        }`}
        value={value}
        disabled={disabled}
        readOnly={disabled}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  return (
    <input
      className={`w-full rounded-md border px-2 py-1.5 text-sm ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
          : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
      }`}
      type={field.type === "number" ? "number" : field.type === "password" ? "password" : "text"}
      value={value}
      disabled={disabled}
      readOnly={disabled}
      placeholder={field.placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function FieldLabel({ field }: { field: FieldConfig }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium uppercase text-slate-600 dark:text-slate-100">
        {field.label}
        {field.required ? <span className="text-red-600"> *</span> : null}
      </span>
      {field.description ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                aria-label={`About ${field.label}`}
              />
            }
          >
            <CircleHelpIcon className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top" align="start" className="max-w-64 text-left leading-relaxed">
            {field.description}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}

function shouldShowField(
  section: AttendanceSectionKey,
  fieldKey: string,
  values: Record<string, string>
) {
  if (section !== "checkpoints") {
    return true
  }

  const type = values.type ?? ""

  if (fieldKey === "device_id") {
    return type === "DEVICE"
  }

  if (fieldKey === "geofence_id") {
    return type === "GPS"
  }

  if (fieldKey === "wifi_network_id") {
    return type === "WIFI"
  }

  if (fieldKey === "max_distance_meters") {
    return type === "GPS"
  }

  return true
}

export function AttendanceManagementView({ section }: { section: string }) {
  const router = useRouter()
  const activeSection = ROUTE_TO_SECTION[section] ?? "settings"
  const isDeviceSyncLogsSection = activeSection === "device-sync-logs"
  const isReadOnlySection = READ_ONLY_SECTIONS.has(activeSection)
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [policies, setPolicies] = React.useState<AdminRecord[]>([])
  const [devices, setDevices] = React.useState<AdminRecord[]>([])
  const [geofences, setGeofences] = React.useState<AdminRecord[]>([])
  const [wifiNetworks, setWifiNetworks] = React.useState<AdminRecord[]>([])
  const [holidayGroups, setHolidayGroups] = React.useState<AdminRecord[]>([])
  const [branchesLoading, setBranchesLoading] = React.useState(false)
  const [policiesLoading, setPoliciesLoading] = React.useState(false)
  const [devicesLoading, setDevicesLoading] = React.useState(false)
  const [geofencesLoading, setGeofencesLoading] = React.useState(false)
  const [wifiNetworksLoading, setWifiNetworksLoading] = React.useState(false)
  const [holidayGroupsLoading, setHolidayGroupsLoading] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)

  const fields = React.useMemo(() => SECTION_FIELDS[activeSection], [activeSection])
  const initialCreateState = React.useMemo(() => buildInitialState(fields), [fields])
  const createDraftKey = React.useMemo(
    () => buildFormDraftStorageKey(`attendance:${activeSection}:create`),
    [activeSection]
  )
  const guidanceStorageKey = React.useMemo(
    () => buildFormDraftStorageKey(`attendance:${activeSection}:guidance-hidden`),
    [activeSection]
  )
  const [createValues, setCreateValues] = React.useState<Record<string, string>>(() =>
    readPersistedFormState(createDraftKey, initialCreateState)
  )
  const [editValues, setEditValues] = React.useState<Record<string, string>>(() => initialCreateState)
  const [editingId, setEditingId] = React.useState("")
  const [editingLoading, setEditingLoading] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState("")
  const [activatingId, setActivatingId] = React.useState("")
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [selectedRow, setSelectedRow] = React.useState<AdminRecord | null>(null)
  const [guidanceDismissed, setGuidanceDismissed] = React.useState(false)
  const [currentCompanyName, setCurrentCompanyName] = React.useState<string | null>(() =>
    readStoredCompanyName()
  )
  const [deviceSearch, setDeviceSearch] = React.useState("")
  const [deviceBranchFilter, setDeviceBranchFilter] = React.useState("all")
  const [deviceVendorFilter, setDeviceVendorFilter] = React.useState("all")
  const [deviceIntegrationFilter, setDeviceIntegrationFilter] = React.useState("all")
  const [, setFocusedDeviceFingerprint] = React.useState<{
    code?: string
    serial?: string
    model?: string
    vendor?: string
    branchId?: number
    integrationType?: string
    ipAddress?: string
  } | null>(null)

  React.useEffect(() => {
    setCreateValues(readPersistedFormState(createDraftKey, initialCreateState))
    setEditValues(initialCreateState)
    setEditingId("")
    setEditingLoading(false)
    setDeletingId("")
    setActivatingId("")
    setSelectedRow(null)
    setDetailsOpen(false)
    setError(null)
    setFormError(null)
    setMessage(null)
    setDeviceSearch("")
    setDeviceBranchFilter("all")
    setDeviceVendorFilter("all")
    setDeviceIntegrationFilter("all")
    setFocusedDeviceFingerprint(null)
  }, [createDraftKey, initialCreateState])

  React.useEffect(() => {
    persistFormState(createDraftKey, createValues)
  }, [createDraftKey, createValues])

  const editDraftKey = React.useMemo(() => {
    return editingId ? buildFormDraftStorageKey(`attendance:${activeSection}:edit:${editingId}`) : ""
  }, [activeSection, editingId])

  React.useEffect(() => {
    if (!editDraftKey) {
      return
    }
    persistFormState(editDraftKey, editValues)
  }, [editDraftKey, editValues])

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    setGuidanceDismissed(window.localStorage.getItem(guidanceStorageKey) === "true")
  }, [guidanceStorageKey])

  React.useEffect(() => {
    setCurrentCompanyName(readStoredCompanyName())
  }, [])

  const supportsEditDelete = !isReadOnlySection
  const supportsCreate = !isReadOnlySection

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
      const result = await listRowsForSection(activeSection, token)
      setRows(result.rows)
    } catch (errorObject) {
      setRows([])
      setError(
        formatAttendanceError(
          errorObject,
          activeSection,
          "Failed to load attendance data."
        )
      )
    } finally {
      setLoading(false)
    }
  }, [activeSection])

  React.useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  React.useEffect(() => {
    const needsEmployees = activeSection === "mobile-punches"
    if (!needsEmployees) {
      setEmployees([])
      return
    }

    const token = readStoredToken()
    if (!token) {
      setEmployees([])
      return
    }

    let cancelled = false

    const loadEmployees = async () => {
      try {
        const result = await listEmployees(token, {
          page: 1,
          limit: 200,
          sortBy: "created_at",
          sortOrder: "DESC",
        })
        if (!cancelled) {
          setEmployees(result.rows)
        }
      } catch {
        if (!cancelled) {
          setEmployees([])
        }
      } finally {
        // No-op: employee rows are only used for label lookups in this view.
      }
    }

    void loadEmployees()

    return () => {
      cancelled = true
    }
  }, [activeSection])

  React.useEffect(() => {
    const needsBranches = fields.some(
      (field) => field.key === "branch_id" || field.key === "branchId"
    )
    if (!needsBranches) {
      setBranches([])
      setBranchesLoading(false)
      return
    }

    const token = readStoredToken()
    if (!token) {
      setBranches([])
      return
    }

    let cancelled = false

    const loadBranches = async () => {
      setBranchesLoading(true)
      try {
        const result = await listBranches(token, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        })
        if (!cancelled) {
          setBranches(result.rows)
        }
      } catch {
        if (!cancelled) {
          setBranches([])
        }
      } finally {
        if (!cancelled) {
          setBranchesLoading(false)
        }
      }
    }

    void loadBranches()

    return () => {
      cancelled = true
    }
  }, [fields])

  React.useEffect(() => {
    const needsCheckpointLookups = fields.some(
      (field) =>
        field.key === "policy_set_id" ||
        field.key === "device_id" ||
        field.key === "geofence_id" ||
        field.key === "wifi_network_id"
    )
    if (!needsCheckpointLookups) {
      setPolicies([])
      setDevices([])
      setGeofences([])
      setWifiNetworks([])
      setPoliciesLoading(false)
      setDevicesLoading(false)
      setGeofencesLoading(false)
      setWifiNetworksLoading(false)
      return
    }

    const token = readStoredToken()
    if (!token) {
      setPolicies([])
      setDevices([])
      setGeofences([])
      setWifiNetworks([])
      return
    }

    let cancelled = false

    const loadLookups = async () => {
      setPoliciesLoading(true)
      setDevicesLoading(true)
      setGeofencesLoading(true)
      setWifiNetworksLoading(true)
      try {
        const [policiesResult, devicesResult, geofencesResult, wifiResult] = await Promise.all([
          listAttendancePolicies(token, {
            page: 1,
            limit: 100,
            sortBy: "created_at",
            sortOrder: "DESC",
          }),
          listAttendanceDevices(token, {
            page: 1,
            limit: 100,
            sortBy: "created_at",
            sortOrder: "DESC",
          }),
          listAttendanceGeofences(token, {
            page: 1,
            limit: 100,
            sortBy: "created_at",
            sortOrder: "DESC",
          }),
          listAttendanceWifiNetworks(token, {
            page: 1,
            limit: 100,
            sortBy: "created_at",
            sortOrder: "DESC",
          }),
        ])

        if (!cancelled) {
          setPolicies(policiesResult.rows)
          setDevices(devicesResult.rows)
          setGeofences(geofencesResult.rows)
          setWifiNetworks(wifiResult.rows)
        }
      } catch {
        if (!cancelled) {
          setPolicies([])
          setDevices([])
          setGeofences([])
          setWifiNetworks([])
        }
      } finally {
        if (!cancelled) {
          setPoliciesLoading(false)
          setDevicesLoading(false)
          setGeofencesLoading(false)
          setWifiNetworksLoading(false)
        }
      }
    }

    void loadLookups()

    return () => {
      cancelled = true
    }
  }, [fields])

  React.useEffect(() => {
    const needsHolidayGroups = fields.some((field) => field.key === "holiday_group_id")
    if (!needsHolidayGroups) {
      setHolidayGroups([])
      setHolidayGroupsLoading(false)
      return
    }

    const token = readStoredToken()
    if (!token) {
      setHolidayGroups([])
      return
    }

    let cancelled = false

    const loadHolidayGroups = async () => {
      setHolidayGroupsLoading(true)
      try {
        const result = await listAttendanceHolidayGroups(token, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        })
        if (!cancelled) {
          setHolidayGroups(result.rows)
        }
      } catch {
        if (!cancelled) {
          setHolidayGroups([])
        }
      } finally {
        if (!cancelled) {
          setHolidayGroupsLoading(false)
        }
      }
    }

    void loadHolidayGroups()

    return () => {
      cancelled = true
    }
  }, [fields])

  const lookupMaps = React.useMemo(
    () =>
      buildAttendanceLookupLabelMaps({
        companyName: currentCompanyName,
        employees,
        branches,
        policies,
        devices,
        geofences,
        wifiNetworks,
        holidayGroups,
      }),
    [branches, currentCompanyName, devices, employees, geofences, holidayGroups, policies, wifiNetworks]
  )
  const resolveBranchName = React.useCallback(
    (branchId: number | null) => {
      if (branchId === null) {
        return "-"
      }
      return lookupMaps.branch_id?.get(String(branchId)) ?? lookupMaps.branchId?.get(String(branchId)) ?? `Branch ${branchId}`
    },
    [lookupMaps]
  )
  const filteredRows = React.useMemo(() => {
    if (activeSection !== "devices") {
      return rows
    }

    const normalizedSearch = deviceSearch.trim().toLowerCase()
    return rows.filter((row) => {
      const identity = buildAttendanceDeviceIdentity(row, resolveBranchName)
      if (deviceBranchFilter !== "all" && String(identity.branchId ?? "") !== deviceBranchFilter) {
        return false
      }
      if (deviceVendorFilter !== "all" && (identity.vendor ?? "").toLowerCase() !== deviceVendorFilter) {
        return false
      }
      if (
        deviceIntegrationFilter !== "all" &&
        (identity.integrationType ?? "").toLowerCase() !== deviceIntegrationFilter
      ) {
        return false
      }
      if (normalizedSearch && !getAttendanceDeviceSearchText(row, resolveBranchName).includes(normalizedSearch)) {
        return false
      }
      return true
    })
  }, [
    activeSection,
    deviceBranchFilter,
    deviceIntegrationFilter,
    deviceSearch,
    deviceVendorFilter,
    resolveBranchName,
    rows,
  ])
  const columns = React.useMemo(
    () => resolveVisibleColumns(activeSection, filteredRows),
    [activeSection, filteredRows]
  )
  const showDeviceContextColumn = isDeviceSyncLogsSection
  const sectionGuidance = React.useMemo(() => getSectionSetupGuidance(activeSection), [activeSection])
  const deviceVendorOptions = React.useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => buildAttendanceDeviceIdentity(row).vendor?.toLowerCase() ?? "")
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [rows]
  )
  const deviceIntegrationOptions = React.useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => buildAttendanceDeviceIdentity(row).integrationType?.toLowerCase() ?? "")
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [rows]
  )
  const activeDeviceFilterCount = React.useMemo(() => {
    let count = 0
    if (deviceBranchFilter !== "all") count += 1
    if (deviceVendorFilter !== "all") count += 1
    if (deviceIntegrationFilter !== "all") count += 1
    return count
  }, [deviceBranchFilter, deviceIntegrationFilter, deviceVendorFilter])

  const onCreate = async () => {
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }
    try {
      const payload = toPayload(fields, createValues)
      validateAttendancePayload(activeSection, payload)
      await createAttendanceResource(token, activeSection, payload)
      if (activeSection === "devices") {
        const fingerprint = {
          code: typeof payload.device_code === "string" ? payload.device_code : undefined,
          serial:
            typeof payload.device_serial_number === "string" ? payload.device_serial_number : undefined,
          model: typeof payload.device_model === "string" ? payload.device_model : undefined,
          vendor: typeof payload.vendor_name === "string" ? payload.vendor_name : undefined,
          branchId: typeof payload.branch_id === "number" ? payload.branch_id : undefined,
          integrationType:
            typeof payload.integration_type === "string" ? payload.integration_type : undefined,
          ipAddress: typeof payload.ip_address === "string" ? payload.ip_address : undefined,
        }
        setFocusedDeviceFingerprint(fingerprint)
        const preferredSearchTerm =
          fingerprint.code ??
          fingerprint.serial ??
          fingerprint.ipAddress ??
          fingerprint.model ??
          fingerprint.vendor ??
          ""
        setDeviceSearch(preferredSearchTerm)
        setDeviceBranchFilter(
          typeof fingerprint.branchId === "number" ? String(fingerprint.branchId) : "all"
        )
        setDeviceVendorFilter(fingerprint.vendor ? fingerprint.vendor.toLowerCase() : "all")
        setDeviceIntegrationFilter(
          fingerprint.integrationType ? fingerprint.integrationType.toLowerCase() : "all"
        )
        setMessage(
          preferredSearchTerm
            ? `Created successfully. Filtered the device list to help verify ${preferredSearchTerm}.`
            : "Created successfully."
        )
      } else {
        setMessage("Created successfully.")
      }
      setError(null)
      setFormError(null)
      setCreateOpen(false)
      clearPersistedFormState(createDraftKey)
      setCreateValues(initialCreateState)
      await fetchRows()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Create failed.")
    }
  }

  const onEdit = async () => {
    if (!supportsEditDelete || activeSection === "device-sync-logs" || activeSection === "mobile-punches") return
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }
    if (!editingId.trim()) {
      setFormError("Provide record id to update.")
      return
    }
    try {
      const payload = toPayload(fields, editValues)
      validateAttendancePayload(activeSection, payload)
      await updateAttendanceResourceById(token, activeSection, editingId.trim(), payload)
      setMessage("Updated successfully.")
      setError(null)
      setFormError(null)
      setEditOpen(false)
      if (editDraftKey) {
        clearPersistedFormState(editDraftKey)
      }
      setEditValues(initialCreateState)
      setEditingId("")
      await fetchRows()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Update failed.")
    }
  }

  const onDelete = async () => {
    if (!supportsEditDelete || activeSection === "device-sync-logs" || activeSection === "mobile-punches") return
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }
    if (!deletingId.trim()) {
      setFormError("Provide record id to delete.")
      return
    }
    try {
      await deleteAttendanceResourceById(token, activeSection, deletingId.trim())
      setMessage("Deleted successfully.")
      setError(null)
      setFormError(null)
      setDeleteOpen(false)
      setDeletingId("")
      await fetchRows()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Delete failed.")
    }
  }

  const onActivatePolicy = async (row: AdminRecord) => {
    if (activeSection !== "policies" && activeSection !== "settings") return

    const rowId = row.id
    if (rowId === null || rowId === undefined) {
      setFormError("This policy does not have an id to activate.")
      return
    }
    const recordId = rowId as string | number

    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }

    setActivatingId(String(recordId))
    try {
      await activateAttendancePolicy(token, recordId)
      setMessage("Policy activated successfully.")
      setError(null)
      setFormError(null)
      await fetchRows()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Activation failed.")
    } finally {
      setActivatingId("")
    }
  }

  const openEditDialog = (row: AdminRecord) => {
    const rowId = row.id
    if (rowId === null || rowId === undefined) {
      setFormError("This record does not have an id to update.")
      return
    }
    const recordId = rowId as string | number

    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }

    setEditingId(String(recordId))
    const initialEditState = buildEditState(fields, row)
    const initialDraftKey = buildFormDraftStorageKey(`attendance:${activeSection}:edit:${String(recordId)}`)
    setEditValues(readPersistedFormState(initialDraftKey, initialEditState))
    setEditingLoading(true)
    setEditOpen(true)
    setFormError(null)
    setMessage(null)

    void (async () => {
      try {
        const latest = await getAttendanceResourceById(token, activeSection, recordId)
        const latestState = buildEditState(fields, latest ? { ...row, ...latest } : row)
        setEditValues(readPersistedFormState(initialDraftKey, latestState))
      } catch {
        setEditValues(readPersistedFormState(initialDraftKey, initialEditState))
      } finally {
        setEditingLoading(false)
      }
    })()
  }

  const openDeleteDialog = (row: AdminRecord) => {
    const rowId = row.id
    if (rowId === null || rowId === undefined) {
      setFormError("This record does not have an id to delete.")
      return
    }

    setDeletingId(String(rowId))
    setDeleteOpen(true)
    setFormError(null)
  }

  const openDetailsDialog = (row: AdminRecord) => {
    setSelectedRow(row)
    setDetailsOpen(true)
  }

  const handleRowClick = (row: AdminRecord) => {
    if (activeSection === "devices") {
      const deviceLink = getAttendanceDeviceLink(row)
      if (deviceLink) {
        router.push(deviceLink.href)
        return
      }
    }

    openDetailsDialog(row)
  }

  const renderSectionDialogHeader = (mode: "Create" | "Edit") => {
    const description = getSectionFormDescription(activeSection)
    const useInfoTooltip = activeSection === "geofences"

    return (
      <DialogHeader>
        <div className="flex items-center gap-2">
          <DialogTitle className="text-slate-900 dark:text-slate-100">{mode} {activeSection.replaceAll("-", " ")}</DialogTitle>
          {useInfoTooltip ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100"
                    aria-label={`About ${activeSection.replaceAll("-", " ")}`}
                  />
                }
              >
                <InfoIcon className="h-3.5 w-3.5" />
              </TooltipTrigger>
              <TooltipContent side="top" align="start" className="max-w-80 text-left leading-relaxed">
                {description}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        {!useInfoTooltip ? <DialogDescription className="text-slate-600 dark:text-slate-300">{description}</DialogDescription> : null}
      </DialogHeader>
    )
  }

  const ATTENDANCE_SETUP_SECTIONS = new Set([
    "policies",
    "holiday-groups",
    "holidays",
    "geofences",
    "wifi-networks",
    "checkpoints",
  ])
  const sectionDisplayTitle = activeSection
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
  const sectionGroupTitle = ATTENDANCE_SETUP_SECTIONS.has(activeSection)
    ? "Attendance Setup"
    : activeSection === "mobile-punches" || activeSection === "device-sync-logs"
      ? "Attendance Operations"
      : "Attendance"

  const sectionTitleBlock = (
    <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {sectionGroupTitle}
      </span>
      <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        {sectionDisplayTitle}
      </h1>
      {activeSection === "devices" ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:text-slate-700"
                aria-label="About device sync"
              />
            }
          >
            <CircleHelpIcon className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top" align="start" className="max-w-72 text-left leading-relaxed">
            Click a device row to open its device page, where you can sync it and manage assigned
            employees.
          </TooltipContent>
        </Tooltip>
      ) : null}
      {sectionGuidance.length && guidanceDismissed ? (
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100"
          aria-label="Show setup guidance"
          onClick={() => {
            setGuidanceDismissed(false)
            if (typeof window !== "undefined") {
              window.localStorage.removeItem(guidanceStorageKey)
            }
          }}
        >
          <InfoIcon className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )

  const deviceFiltersControl =
    activeSection === "devices" ? (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="relative inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border px-2 text-xs font-medium text-foreground transition hover:bg-muted"
          aria-label="Filter devices"
          title="Filters"
        >
          <FilterIcon className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline">Filters</span>
          {activeDeviceFilterCount > 0 || deviceSearch.trim() ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {activeDeviceFilterCount + (deviceSearch.trim() ? 1 : 0)}
            </span>
          ) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 p-2.5">
          <div className="space-y-1.5">
            <DropdownMenuLabel className="px-0 py-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Filters
            </DropdownMenuLabel>
            <input
              type="text"
              className="h-7 w-full rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              value={deviceSearch}
              onChange={(event) => setDeviceSearch(event.target.value)}
              placeholder="Search code, serial, model…"
            />
            <label className="grid gap-0.5 text-[10px]">
              <span className="font-medium text-slate-600 dark:text-slate-300">Branch</span>
              <select
                className="h-7 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[11px] text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                value={deviceBranchFilter}
                onChange={(event) => setDeviceBranchFilter(event.target.value)}
              >
                <option value="all">All branches</option>
                {branches.map((branch, index) => {
                  const branchId = readNumberFromRecord(branch, ["id", "branch_id"])
                  if (branchId === null) return null
                  return (
                    <option key={`device-branch-filter-${branchId}-${index}`} value={String(branchId)}>
                      {resolveBranchName(branchId)}
                    </option>
                  )
                })}
              </select>
            </label>
            <label className="grid gap-0.5 text-[10px]">
              <span className="font-medium text-slate-600 dark:text-slate-300">Vendor</span>
              <select
                className="h-7 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[11px] text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                value={deviceVendorFilter}
                onChange={(event) => setDeviceVendorFilter(event.target.value)}
              >
                <option value="all">All vendors</option>
                {deviceVendorOptions.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-0.5 text-[10px]">
              <span className="font-medium text-slate-600 dark:text-slate-300">Integration</span>
              <select
                className="h-7 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[11px] text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                value={deviceIntegrationFilter}
                onChange={(event) => setDeviceIntegrationFilter(event.target.value)}
              >
                <option value="all">All integrations</option>
                {deviceIntegrationOptions.map((integration) => (
                  <option key={integration} value={integration}>
                    {integration}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="inline-flex h-7 w-full items-center justify-center rounded-md border border-slate-300 px-2 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              disabled={activeDeviceFilterCount === 0 && !deviceSearch.trim()}
              onClick={() => {
                setDeviceSearch("")
                setDeviceBranchFilter("all")
                setDeviceVendorFilter("all")
                setDeviceIntegrationFilter("all")
              }}
            >
              Reset filters
            </button>
            <p className="text-[10px] text-muted-foreground">
              {filteredRows.length}/{rows.length} devices
            </p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null

  return (
    <div className="w-full space-y-2">
      {/* Dialogs stay mounted at root so toolbar actions only open them. */}
      {supportsCreate ? (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogPopup className="flex max-h-[90vh] w-[min(920px,96vw)] flex-col overflow-hidden sm:max-w-4xl">
                  {renderSectionDialogHeader("Create")}
                  {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
                  <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1 pb-2">
                    {activeSection === "wifi-networks" ? (
                      <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-950 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
                        <p className="font-medium">Wi-Fi details helper</p>
                        <p className="mt-1 text-sky-900 dark:text-sky-200">
                          Browsers cannot read saved or current SSID, BSSID, security type, or allowed CIDRs directly from a device.
                          The best workflow is to connect a phone or laptop to the target Wi-Fi, then copy those values from device
                          settings and router or LAN configuration.
                        </p>
                      </div>
                    ) : null}
                    {fields
                      .filter((field) => shouldShowField(activeSection, field.key, createValues))
                      .map((field) => (
                      <label key={`create-${field.key}`} className="grid gap-1">
                        <FieldLabel field={field} />
                        <FieldInput
                          field={field}
                          value={createValues[field.key] ?? ""}
                          branches={branches}
                          policies={policies}
                          devices={devices}
                          geofences={geofences}
                          wifiNetworks={wifiNetworks}
                          holidayGroups={holidayGroups}
                          branchesLoading={branchesLoading}
                          policiesLoading={policiesLoading}
                          devicesLoading={devicesLoading}
                          geofencesLoading={geofencesLoading}
                          wifiNetworksLoading={wifiNetworksLoading}
                          holidayGroupsLoading={holidayGroupsLoading}
                          disabled={isFieldDisabled(activeSection, field.key, createValues)}
                          onChange={(next) => setCreateValues((prev) => ({ ...prev, [field.key]: next }))}
                        />
                      </label>
                    ))}
                  </div>
                  <DialogFooter className="mt-0 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      onClick={() => {
                        setCreateOpen(false)
                        setFormError(null)
                      }}
                    >
                      Cancel
                    </button>
                    <button type="button" onClick={() => void onCreate()} className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm !text-white transition hover:brightness-95">
                      Create
                    </button>
                  </DialogFooter>
                </DialogPopup>
              </Dialog>
          ) : null}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogPopup className="flex max-h-[90vh] w-[min(920px,96vw)] flex-col overflow-hidden sm:max-w-4xl">
              {renderSectionDialogHeader("Edit")}
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
              {editingLoading ? (
                <p className="text-sm text-slate-500">Loading latest record details...</p>
              ) : null}
              <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1 pb-2">
                {activeSection === "wifi-networks" ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-950 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
                    <p className="font-medium">Wi-Fi details helper</p>
                    <p className="mt-1 text-sky-900 dark:text-sky-200">
                      Browsers cannot read saved or current SSID, BSSID, security type, or allowed CIDRs directly from a device.
                      The best workflow is to connect a phone or laptop to the target Wi-Fi, then copy those values from device
                      settings and router or LAN configuration.
                    </p>
                  </div>
                ) : null}
                {fields
                  .filter((field) => shouldShowField(activeSection, field.key, editValues))
                  .map((field) => (
                  <label key={`edit-${field.key}`} className="grid gap-1">
                    <FieldLabel field={field} />
                    <FieldInput
                      field={field}
                      value={editValues[field.key] ?? ""}
                      branches={branches}
                      policies={policies}
                      devices={devices}
                      geofences={geofences}
                      wifiNetworks={wifiNetworks}
                      holidayGroups={holidayGroups}
                      branchesLoading={branchesLoading}
                      policiesLoading={policiesLoading}
                      devicesLoading={devicesLoading}
                      geofencesLoading={geofencesLoading}
                      wifiNetworksLoading={wifiNetworksLoading}
                      holidayGroupsLoading={holidayGroupsLoading}
                      disabled={Boolean(field.readOnlyOnEdit) || isFieldDisabled(activeSection, field.key, editValues)}
                      onChange={(next) => setEditValues((prev) => ({ ...prev, [field.key]: next }))}
                    />
                  </label>
                ))}
              </div>
              <DialogFooter className="mt-0 border-t border-slate-200 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  onClick={() => {
                    setEditOpen(false)
                    setFormError(null)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void onEdit()}
                  disabled={!supportsEditDelete}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Update
                </button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogPopup className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Delete {activeSection.replaceAll("-", " ")}</DialogTitle>
                <DialogDescription>This will remove the selected record.</DialogDescription>
              </DialogHeader>
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Record ID: {deletingId || "-"}
              </div>
              <DialogFooter>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  onClick={() => {
                    setDeleteOpen(false)
                    setFormError(null)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete()}
                  disabled={!supportsEditDelete}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>
          <RecordDetailsDialog
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            title={`${activeSection.replaceAll("-", " ")} details`}
            description="Selected row details"
            row={selectedRow}
            resolveLabel={(key) => key.replaceAll("_", " ")}
            resolveValue={(key, row) => resolveAttendanceCellValue(key, row, lookupMaps)}
          />

      {sectionGuidance.length && !guidanceDismissed ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-100">
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sky-900 dark:text-sky-100">
              <InfoIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">Setup Guidance</span>
            </div>
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-sky-700 transition hover:bg-sky-100 hover:text-sky-950 dark:text-sky-300 dark:hover:bg-sky-900/60 dark:hover:text-sky-50"
              aria-label="Hide setup guidance"
              onClick={() => {
                setGuidanceDismissed(true)
                if (typeof window !== "undefined") {
                  window.localStorage.setItem(guidanceStorageKey, "true")
                }
              }}
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          {sectionGuidance.map((line, index) => (
            <p key={`${activeSection}-guidance-${index}`} className="leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {isDeviceSyncLogsSection ? (
        <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <p className="font-medium">Device sync logs are read-only.</p>
          <p className="mt-1 text-sky-900">
            Use this page to review sync failures, record counts, and timestamps. Open the related
            device to retry sync, confirm connectivity and credentials, or inspect the employees
            assigned to that terminal.
          </p>
          <Link
            href="/dashboard/access-control/devices"
            className="mt-2 inline-flex text-sm font-medium text-sky-800 underline underline-offset-4 hover:text-sky-950"
          >
            Go to devices
          </Link>
        </div>
      ) : null}

      <ResizableTable
        title={sectionDisplayTitle || "Attendance"}
        data={filteredRows}
        onRowSelect={(_, row) => {
          if (row) {
            handleRowClick(row)
          }
        }}
        columns={[
          ...columns.map((column: string) => ({
            key: column,
            label:
              column === "branch_id"
                ? "branch"
                : column === "company_id" || column === "companyId"
                  ? "company"
                  : column.replaceAll("_", " "),
            defaultWidth: 75,
            sortable: true,
            render:
              column === "branch_id"
                ? (row: AdminRecord) =>
                    resolveBranchName(readNumberFromRecord(row, ["branch_id", "branchId"]))
                : column === "company_id" || column === "companyId"
                  ? () => currentCompanyName ?? "Alliance Insurance Corporation Limited"
                : isAttendanceDateLikeColumn(column)
                  ? (row: AdminRecord) => formatAdminValue(row[column])
                : undefined,
          })),
          ...(showDeviceContextColumn ? [{ key: "related_device", label: "Device", defaultWidth: 75 }] : []),
          ...(supportsEditDelete ? [{ key: "actions", label: "Actions", defaultWidth: 55, sortable: false, render: (row: AdminRecord) => (
            <div className="flex justify-end gap-1" onClick={e=>e.stopPropagation()}>
              {(activeSection === "policies" || activeSection === "settings") &&
              !row.is_active ? (
                <button
                  className="admin-table-icon-button"
                  disabled={activatingId === String(row.id)}
                  onClick={() => void onActivatePolicy(row)}
                >
                  {activatingId === String(row.id) ? "Activating…" : "Activate"}
                </button>
              ) : null}
              <button className="admin-table-icon-button" aria-label="Edit" onClick={() => openEditDialog(row)}><PencilIcon className="h-3.5 w-3.5" /></button>
              <button className="admin-table-icon-button" data-variant="danger" aria-label="Delete" onClick={() => openDeleteDialog(row)}><Trash2Icon className="h-3.5 w-3.5" /></button>
            </div>
          ) }] : []),
        ]}
        itemsPerPage={20}
        loading={loading}
        showExport={false}
        toolbarStart={sectionTitleBlock}
        toolbarActions={
          <>
            {supportsCreate ? (
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold !text-white transition hover:brightness-95"
                onClick={() => setCreateOpen(true)}
                aria-label={`Create ${activeSection.replaceAll("-", " ")}`}
                title="Create"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Create</span>
              </button>
            ) : null}
            {deviceFiltersControl}
            <button
              type="button"
              onClick={() => void fetchRows()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCwIcon className={`h-3.5 w-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
            </button>
          </>
        }
        enableColumnVisibility={activeSection === "devices"}
        hiddenColumnKeys={activeSection === "devices" ? ["device_code"] : []}
        storageKey={`attendance-${activeSection}`}
      />

    </div>
  )
}
