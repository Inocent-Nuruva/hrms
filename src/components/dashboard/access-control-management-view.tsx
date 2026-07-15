"use client"

import * as React from "react"
import { PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { ResizableTable } from "@/components/ui/resizable-table"
import { Textarea } from "@/components/ui/textarea"
import {
  createAccessControlResource,
  deleteAccessControlResourceById,
  getAccessControlResourceById,
  listAttendanceDevices,
  listAccessControlResources,
  listBranches,
  listDepartments,
  type AccessControlResourceKey,
  type AdminRecord,
  updateAccessControlResourceById,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

type AccessControlSectionKey = "doors" | "templates" | "organizations" | "groups"
type FieldType = "text" | "number" | "boolean" | "select" | "json"

type FieldConfig = {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: string[]
  placeholder?: string
}

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

const ROUTE_TO_RESOURCE: Record<AccessControlSectionKey, AccessControlResourceKey> = {
  doors: "doors",
  templates: "schedule-templates",
  organizations: "organizations",
  groups: "groups",
}

/** Maps UI section to API permission prefix used by /api/permissions. */
const SECTION_PERMISSION_PREFIX: Record<AccessControlSectionKey, string> = {
  doors: "access_doors",
  templates: "access_schedule_templates",
  organizations: "access_organizations",
  groups: "access_groups",
}

function readActorPermissionNames(): string[] {
  if (typeof window === "undefined") return []
  const names = new Set<string>()
  try {
    const raw = window.sessionStorage.getItem("hrms.dashboard.actorPermissions")
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        parsed.forEach((entry) => {
          if (typeof entry === "string" && entry.trim()) names.add(entry.trim().toLowerCase())
        })
      }
    }
  } catch {
    // ignore
  }
  // Fallback: JWT permissions
  try {
    const token =
      window.localStorage.getItem("hrms.admin.accessToken")?.trim() ||
      (() => {
        const raw = window.localStorage.getItem("auth_tokens") || window.localStorage.getItem("hrms.auth.tokens")
        if (!raw) return ""
        const parsed = JSON.parse(raw) as { accessToken?: string; access_token?: string }
        return (parsed.accessToken ?? parsed.access_token ?? "").trim()
      })()
    if (token) {
      const parts = token.split(".")
      if (parts[1]) {
        const payload = JSON.parse(
          atob(parts[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parts[1].length / 4) * 4, "="))
        ) as { permissions?: unknown }
        if (Array.isArray(payload.permissions)) {
          payload.permissions.forEach((entry) => {
            if (typeof entry === "string") names.add(entry.toLowerCase())
          })
        }
      }
    }
  } catch {
    // ignore
  }
  return Array.from(names)
}

function canAccessControlAction(
  section: AccessControlSectionKey,
  action: "create" | "update" | "delete" | "read"
) {
  const perms = readActorPermissionNames()
  if (perms.length === 0) return false
  const required = `${SECTION_PERMISSION_PREFIX[section]}:${action}`.toLowerCase()
  return perms.some((entry) => entry.replace(/\./g, ":") === required)
}

const SECTION_TITLES: Record<AccessControlSectionKey, string> = {
  doors: "Doors",
  templates: "Templates",
  organizations: "Organization",
  groups: "Groups",
}

const SECTION_FIELDS: Record<AccessControlSectionKey, FieldConfig[]> = {
  doors: [
    { key: "device_id", label: "Device", type: "number", required: true },
    { key: "door_no", label: "Door Number", type: "number", required: true },
    { key: "door_name", label: "Door Name", type: "text", required: true },
    { key: "branch_id", label: "Branch", type: "number" },
    { key: "magnetic_type", label: "Magnetic Type", type: "text" },
    { key: "open_button_type", label: "Open Button Type", type: "text" },
    { key: "open_duration", label: "Open Duration", type: "number" },
    { key: "disabled_open_duration", label: "Disabled Open Duration", type: "number" },
    { key: "magnetic_alarm_timeout", label: "Magnetic Alarm Timeout", type: "number" },
    { key: "enable_leader_card", label: "Enable Leader Card", type: "boolean" },
    { key: "leader_card_mode", label: "Leader Card Mode", type: "text" },
    { key: "leader_card_open_duration", label: "Leader Card Open Duration", type: "number" },
    { key: "remote_control_pw_status", label: "Remote Control Password Status", type: "boolean" },
    { key: "sync_status", label: "Sync Status", type: "select", options: ["PENDING", "SYNCED", "FAILED"] },
    { key: "metadata", label: "Metadata", type: "json", placeholder: "{\"floor\":\"Ground\"}" },
  ],
  templates: [
    { key: "device_id", label: "Device", type: "number", required: true },
    { key: "template_name", label: "Template Name", type: "text", required: true },
    { key: "hikvision_template_no", label: "Hikvision Template No", type: "text", required: true },
    { key: "week_plan_id", label: "Week Plan", type: "number", required: true },
    { key: "hikvision_week_plan_no", label: "Hikvision Week Plan No", type: "text", required: true },
    { key: "branch_id", label: "Branch", type: "number" },
    { key: "holiday_group_no", label: "Holiday Group No", type: "text" },
    { key: "schedule_type", label: "Schedule Type", type: "select", options: ["DOOR", "ATTENDANCE", "MIXED"] },
    { key: "status", label: "Status", type: "select", options: ["ACTIVE", "INACTIVE"] },
    { key: "name", label: "Display Name", type: "text" },
    { key: "metadata", label: "Metadata", type: "json", placeholder: "{\"days\":[\"MONDAY\"]}" },
  ],
  organizations: [
    { key: "org_name", label: "Organization Name", type: "text", required: true },
    { key: "name", label: "Display Name", type: "text" },
    { key: "org_code", label: "Organization Code", type: "text" },
    { key: "description", label: "Description", type: "text" },
    { key: "branch_id", label: "Branch", type: "number" },
    { key: "department_id", label: "Department", type: "number" },
    { key: "device_id", label: "Device", type: "number" },
    { key: "parent_id", label: "Parent Organization", type: "number" },
    { key: "hikvision_org_index", label: "Hikvision Org Index", type: "text" },
    { key: "hikvision_group_no", label: "Hikvision Group No", type: "text" },
    { key: "metadata", label: "Metadata", type: "json", placeholder: "{\"site\":\"HQ\"}" },
  ],
  groups: [
    { key: "group_name", label: "Group Name", type: "text", required: true },
    { key: "name", label: "Display Name", type: "text" },
    { key: "group_code", label: "Group Code", type: "text" },
    { key: "description", label: "Description", type: "text" },
    { key: "device_id", label: "Device", type: "number" },
    { key: "branch_id", label: "Branch", type: "number" },
    { key: "status", label: "Status", type: "select", options: ["ACTIVE", "INACTIVE"] },
    { key: "metadata", label: "Metadata", type: "json", placeholder: "{\"members\":10}" },
  ],
}

const FIELD_VALUE_ALIASES: Record<AccessControlSectionKey, Record<string, string[]>> = {
  doors: {
    device_id: ["deviceId"],
    door_no: ["doorNo"],
    door_name: ["doorName"],
    branch_id: ["branchId"],
    magnetic_type: ["magneticType"],
    open_button_type: ["openButtonType"],
    open_duration: ["openDuration"],
    disabled_open_duration: ["disabledOpenDuration"],
    magnetic_alarm_timeout: ["magneticAlarmTimeout"],
    enable_leader_card: ["enableLeaderCard"],
    leader_card_mode: ["leaderCardMode"],
    leader_card_open_duration: ["leaderCardOpenDuration"],
    remote_control_pw_status: ["remoteControlPwStatus"],
    sync_status: ["syncStatus"],
    metadata: ["metadataExtras"],
  },
  templates: {
    device_id: ["deviceId"],
    template_name: ["templateName"],
    hikvision_template_no: ["hikvisionTemplateNo"],
    week_plan_id: ["weekPlanId"],
    hikvision_week_plan_no: ["hikvisionWeekPlanNo"],
    branch_id: ["branchId"],
    holiday_group_no: ["holidayGroupNo"],
    schedule_type: ["scheduleType"],
    metadata: ["metadataExtras"],
  },
  organizations: {
    org_name: ["orgName"],
    org_code: ["orgCode"],
    branch_id: ["branchId"],
    department_id: ["departmentId"],
    device_id: ["deviceId"],
    parent_id: ["parentId"],
    hikvision_org_index: ["hikvisionOrgIndex"],
    hikvision_group_no: ["hikvisionGroupNo"],
    metadata: ["metadataExtras"],
  },
  groups: {
    group_name: ["groupName"],
    group_code: ["groupCode"],
    device_id: ["deviceId"],
    branch_id: ["branchId"],
    metadata: ["metadataExtras"],
  },
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

function buildInitialState(fields: FieldConfig[]) {
  const initial: Record<string, string> = {}
  for (const field of fields) {
    initial[field.key] = ""
  }
  return initial
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

function readFieldValue(
  row: AdminRecord,
  field: FieldConfig,
  aliases: Record<string, string[]>
) {
  const candidateKeys = [field.key, ...(aliases[field.key] ?? [])]
  for (const candidateKey of candidateKeys) {
    const value = row[candidateKey]
    if (value !== null && value !== undefined) {
      return value
    }
  }
  return undefined
}

function buildEditState(
  fields: FieldConfig[],
  row: AdminRecord,
  aliases: Record<string, string[]>
) {
  const next: Record<string, string> = {}
  for (const field of fields) {
    const value = readFieldValue(row, field, aliases)
    if (value === null || value === undefined) {
      next[field.key] = ""
      continue
    }
    if (field.type === "json") {
      next[field.key] = typeof value === "string" ? value : JSON.stringify(value, null, 2)
      continue
    }
    if (typeof value === "boolean") {
      next[field.key] = value ? "true" : "false"
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

    payload[field.key] = trimmed
  }
  return payload
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
    if (!trimmed) return "-"
    if (isIsoDateString(trimmed)) {
      return formatDisplayDate(trimmed)
    }
    if (isTimeValue(trimmed)) {
      return formatDisplayTime(trimmed)
    }
    if (
      !trimmed.includes(" ") &&
      !trimmed.includes("/") &&
      !trimmed.includes(":") &&
      !trimmed.includes(".") &&
      /[A-Z]/.test(trimmed) &&
      /[a-z]/.test(trimmed)
    ) {
      return prettifyLabel(trimmed)
    }
    return trimmed
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : "-"
  if (typeof value === "object") return "Object"
  return "-"
}

function resolveVisibleColumns(rows: AdminRecord[]) {
  const preferred = [
    "id",
    "door_name",
    "doorName",
    "door_no",
    "doorNo",
    "group_name",
    "groupName",
    "org_name",
    "orgName",
    "template_name",
    "templateName",
    "name",
    "group_code",
    "groupCode",
    "org_code",
    "orgCode",
    "hikvision_template_no",
    "hikvisionTemplateNo",
    "status",
    "description",
    "device_id",
    "deviceId",
    "branch_id",
    "branchId",
    "created_at",
    "updated_at",
  ]
  const keySet = new Set<string>()
  rows.forEach((row) => Object.keys(row).forEach((key) => keySet.add(key)))
  const ordered = preferred.filter((key) => keySet.has(key))
  const extras = Array.from(keySet).filter((key) => !ordered.includes(key)).sort((a, b) => a.localeCompare(b))
  return [...ordered, ...extras].slice(0, 8)
}

function resolveRowId(row: AdminRecord, fallbackIndex: number) {
  const candidates = [
    row.id,
    row.door_id,
    row.doorId,
    row.organization_id,
    row.organizationId,
    row.group_id,
    row.groupId,
    row.template_id,
    row.templateId,
    row.code,
  ]
  const match = candidates.find((value) => typeof value === "string" || typeof value === "number")
  return match ?? fallbackIndex
}

function toLookupMap(
  rows: AdminRecord[],
  idKeys: string[],
  labelResolver: (row: AdminRecord, id: number) => string
) {
  const map = new Map<number, string>()
  for (const row of rows) {
    const id = readNumberFromRecord(row, idKeys)
    if (id === null || map.has(id)) continue
    map.set(id, labelResolver(row, id))
  }
  return map
}

function formatLoadError(errorObject: unknown, fallback: string) {
  if (errorObject instanceof Error && errorObject.message) {
    return errorObject.message
  }
  return fallback
}

function FieldInput({
  field,
  value,
  onChange,
  branches = [],
  departments = [],
  devices = [],
  organizations = [],
  weekPlans = [],
  lookupLoading = false,
}: {
  field: FieldConfig
  value: string
  onChange: (next: string) => void
  branches?: AdminRecord[]
  departments?: AdminRecord[]
  devices?: AdminRecord[]
  organizations?: AdminRecord[]
  weekPlans?: AdminRecord[]
  lookupLoading?: boolean
}) {
  if (field.key === "branch_id") {
    return (
      <select
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{lookupLoading ? "Loading branches..." : "Select branch"}</option>
        {branches.map((branch, index) => {
          const id = readNumberFromRecord(branch, ["id", "branch_id"])
          if (id === null) return null
          return (
            <option key={`branch-${id}-${index}`} value={String(id)}>
              {readStringFromRecord(branch, ["name", "title", "display_name"]) ?? `Branch ${id}`}
            </option>
          )
        })}
      </select>
    )
  }

  if (field.key === "department_id") {
    return (
      <select
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{lookupLoading ? "Loading departments..." : "Select department"}</option>
        {departments.map((department, index) => {
          const id = readNumberFromRecord(department, ["id", "department_id"])
          if (id === null) return null
          return (
            <option key={`department-${id}-${index}`} value={String(id)}>
              {readStringFromRecord(department, ["name", "title", "display_name"]) ?? `Department ${id}`}
            </option>
          )
        })}
      </select>
    )
  }

  if (field.key === "device_id") {
    return (
      <select
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{lookupLoading ? "Loading devices..." : "Select device"}</option>
        {devices.map((device, index) => {
          const id = readNumberFromRecord(device, ["id", "device_id"])
          if (id === null) return null
          const name =
            readStringFromRecord(device, ["device_name", "deviceName", "name"]) ??
            `Device ${id}`
          const code = readStringFromRecord(device, ["device_code", "deviceCode"])
          return (
            <option key={`device-${id}-${index}`} value={String(id)}>
              {code ? `${name} (${code})` : name}
            </option>
          )
        })}
      </select>
    )
  }

  if (field.key === "parent_id") {
    return (
      <select
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{lookupLoading ? "Loading organizations..." : "Select parent organization"}</option>
        {organizations.map((organization, index) => {
          const id = readNumberFromRecord(organization, ["id", "organization_id", "organizationId"])
          if (id === null) return null
          return (
            <option key={`organization-${id}-${index}`} value={String(id)}>
              {readStringFromRecord(organization, ["org_name", "orgName", "name"]) ?? `Organization ${id}`}
            </option>
          )
        })}
      </select>
    )
  }

  if (field.key === "week_plan_id") {
    return (
      <select
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{lookupLoading ? "Loading week plans..." : "Select week plan"}</option>
        {weekPlans.map((plan, index) => {
          const id = readNumberFromRecord(plan, ["id", "week_plan_id", "weekPlanId"])
          if (id === null) return null
          const name =
            readStringFromRecord(plan, ["name", "hikvision_plan_no", "hikvisionPlanNo"]) ??
            `Week Plan ${id}`
          return (
            <option key={`week-plan-${id}-${index}`} value={String(id)}>
              {name}
            </option>
          )
        })}
      </select>
    )
  }

  if (field.type === "select") {
    return (
      <select
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select {field.label}</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === "boolean") {
    return (
      <select
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        value={value}
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
        className="min-h-20 w-full rounded-md border border-slate-300 p-2 font-mono text-xs"
        value={value}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  return (
    <input
      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      type={field.type === "number" ? "number" : "text"}
      value={value}
      placeholder={field.placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function AccessControlManagementView({
  section,
  moduleTitle = "Access Control",
}: {
  section: string
  moduleTitle?: string
}) {
  const activeSection = (Object.keys(ROUTE_TO_RESOURCE).includes(section) ? section : "doors") as AccessControlSectionKey
  const resource = ROUTE_TO_RESOURCE[activeSection]
  const fields = React.useMemo(() => SECTION_FIELDS[activeSection], [activeSection])
  const fieldAliases = React.useMemo(() => FIELD_VALUE_ALIASES[activeSection], [activeSection])
  const title = SECTION_TITLES[activeSection]

  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [devices, setDevices] = React.useState<AdminRecord[]>([])
  const [organizations, setOrganizations] = React.useState<AdminRecord[]>([])
  const [weekPlans, setWeekPlans] = React.useState<AdminRecord[]>([])
  const [lookupLoading, setLookupLoading] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [createValues, setCreateValues] = React.useState<Record<string, string>>(() => buildInitialState(fields))
  const [editValues, setEditValues] = React.useState<Record<string, string>>(() => buildInitialState(fields))
  const [editingId, setEditingId] = React.useState("")
  const [deletingId, setDeletingId] = React.useState("")
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  React.useEffect(() => {
    setCreateValues(buildInitialState(fields))
    setEditValues(buildInitialState(fields))
    setEditingId("")
    setDeletingId("")
    setError(null)
    setFormError(null)
    setMessage(null)
  }, [fields])

  React.useEffect(() => {
    const neededKeys = new Set(fields.map((field) => field.key))
    const needsLookups =
      neededKeys.has("branch_id") ||
      neededKeys.has("department_id") ||
      neededKeys.has("device_id") ||
      neededKeys.has("parent_id") ||
      neededKeys.has("week_plan_id")

    if (!needsLookups) {
      setBranches([])
      setDepartments([])
      setDevices([])
      setOrganizations([])
      setWeekPlans([])
      setLookupLoading(false)
      return
    }

    const token = readStoredToken()
    if (!token) {
      setBranches([])
      setDepartments([])
      setDevices([])
      setOrganizations([])
      setWeekPlans([])
      return
    }

    let cancelled = false

    const loadLookups = async () => {
      setLookupLoading(true)
      try {
        const [
          branchesResult,
          departmentsResult,
          devicesResult,
          organizationsResult,
          weekPlansResult,
        ] = await Promise.all([
          neededKeys.has("branch_id")
            ? listBranches(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
            : Promise.resolve({ rows: [] }),
          neededKeys.has("department_id")
            ? listDepartments(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
            : Promise.resolve({ rows: [] }),
          neededKeys.has("device_id")
            ? listAttendanceDevices(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
            : Promise.resolve({ rows: [] }),
          neededKeys.has("parent_id")
            ? listAccessControlResources(token, "organizations", {
                page: 1,
                limit: 100,
                sortBy: "created_at",
                sortOrder: "DESC",
              })
            : Promise.resolve({ rows: [] }),
          neededKeys.has("week_plan_id")
            ? listAccessControlResources(token, "week-plans", {
                page: 1,
                limit: 100,
                sortBy: "created_at",
                sortOrder: "DESC",
              })
            : Promise.resolve({ rows: [] }),
        ])

        if (cancelled) return

        setBranches(branchesResult.rows)
        setDepartments(departmentsResult.rows)
        setDevices(devicesResult.rows)
        setOrganizations(organizationsResult.rows)
        setWeekPlans(weekPlansResult.rows)
      } catch {
        if (cancelled) return
        setBranches([])
        setDepartments([])
        setDevices([])
        setOrganizations([])
        setWeekPlans([])
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
      const result = await listAccessControlResources(token, resource, {
        page: 1,
        limit: 100,
        sortBy: "created_at",
        sortOrder: "DESC",
      })
      setRows(result.rows)
    } catch (errorObject) {
      setRows([])
      setError(formatLoadError(errorObject, `Failed to load ${title.toLowerCase()}.`))
    } finally {
      setLoading(false)
    }
  }, [resource, title])

  React.useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  const columns = React.useMemo(() => resolveVisibleColumns(rows), [rows])
  const branchNameById = React.useMemo(
    () =>
      toLookupMap(branches, ["id", "branch_id"], (row, id) =>
        readStringFromRecord(row, ["name", "title", "display_name", "branch_name"]) ?? `Branch ${id}`
      ),
    [branches]
  )
  const departmentNameById = React.useMemo(
    () =>
      toLookupMap(departments, ["id", "department_id"], (row, id) =>
        readStringFromRecord(row, ["name", "title", "display_name", "department_name"]) ?? `Department ${id}`
      ),
    [departments]
  )
  const deviceNameById = React.useMemo(
    () =>
      toLookupMap(devices, ["id", "device_id"], (row, id) => {
        const name = readStringFromRecord(row, ["device_name", "deviceName", "name"]) ?? `Device ${id}`
        const code = readStringFromRecord(row, ["device_code", "deviceCode"])
        return code ? `${name} (${code})` : name
      }),
    [devices]
  )
  const organizationNameById = React.useMemo(
    () =>
      toLookupMap(organizations, ["id", "organization_id", "organizationId"], (row, id) =>
        readStringFromRecord(row, ["org_name", "orgName", "name"]) ?? `Organization ${id}`
      ),
    [organizations]
  )

  const resolveDisplayValue = React.useCallback(
    (row: AdminRecord, column: string) => {
      const branchId =
        column === "branch_id" || column === "branchId"
          ? readNumberFromRecord(row, [column])
          : null
      if (branchId !== null) {
        return branchNameById.get(branchId) ?? `Branch ${branchId}`
      }

      const departmentId =
        column === "department_id" || column === "departmentId"
          ? readNumberFromRecord(row, [column])
          : null
      if (departmentId !== null) {
        return departmentNameById.get(departmentId) ?? `Department ${departmentId}`
      }

      const deviceId =
        column === "device_id" || column === "deviceId"
          ? readNumberFromRecord(row, [column])
          : null
      if (deviceId !== null) {
        return deviceNameById.get(deviceId) ?? `Device ${deviceId}`
      }

      const parentId =
        column === "parent_id" || column === "parentId"
          ? readNumberFromRecord(row, [column])
          : null
      if (parentId !== null) {
        return organizationNameById.get(parentId) ?? `Organization ${parentId}`
      }

      return stringifyValue(row[column])
    },
    [branchNameById, departmentNameById, deviceNameById, organizationNameById]
  )

  const onCreate = async () => {
    if (!canCreate) {
      setFormError(`Missing permission: ${SECTION_PERMISSION_PREFIX[activeSection]}:create`)
      return
    }
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }
    try {
      const payload = toPayload(fields, createValues)
      await createAccessControlResource(token, resource, payload)
      setMessage("Created successfully.")
      setCreateOpen(false)
      setCreateValues(buildInitialState(fields))
      setFormError(null)
      await fetchRows()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Create failed.")
    }
  }

  const onEdit = async () => {
    if (!canUpdate) {
      setFormError(`Missing permission: ${SECTION_PERMISSION_PREFIX[activeSection]}:update`)
      return
    }
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
      await updateAccessControlResourceById(token, resource, editingId.trim(), payload)
      setMessage("Updated successfully.")
      setEditOpen(false)
      setFormError(null)
      await fetchRows()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Update failed.")
    }
  }

  const onDelete = async () => {
    if (!canDelete) {
      setFormError(`Missing permission: ${SECTION_PERMISSION_PREFIX[activeSection]}:delete`)
      return
    }
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
      await deleteAccessControlResourceById(token, resource, deletingId.trim())
      setMessage("Deleted successfully.")
      setDeleteOpen(false)
      setDeletingId("")
      setFormError(null)
      await fetchRows()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Delete failed.")
    }
  }

  const openEditDialog = (row: AdminRecord, fallbackIndex: number) => {
    const rowId = resolveRowId(row, fallbackIndex)
    setEditingId(String(rowId))
    setEditOpen(true)
    setFormError(null)
    setEditValues(buildEditState(fields, row, fieldAliases))

    const token = readStoredToken()
    if (!token) {
      setEditValues(buildEditState(fields, row, fieldAliases))
      return
    }

    void (async () => {
      try {
        const latest = await getAccessControlResourceById(token, resource, rowId)
        setEditValues(buildEditState(fields, latest ? { ...row, ...latest } : row, fieldAliases))
      } catch {
        setEditValues(buildEditState(fields, row, fieldAliases))
      }
    })()
  }

  const openDeleteDialog = (row: AdminRecord, fallbackIndex: number) => {
    setDeletingId(String(resolveRowId(row, fallbackIndex)))
    setDeleteOpen(true)
    setFormError(null)
  }

  const canCreate = canAccessControlAction(activeSection, "create")
  const canUpdate = canAccessControlAction(activeSection, "update")
  const canDelete = canAccessControlAction(activeSection, "delete")

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{moduleTitle}</p>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {canCreate ? (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--primary)] px-2.5 text-xs font-semibold text-white transition hover:brightness-95"
            onClick={() => setCreateOpen(true)}
            aria-label={`Create ${title}`}
            title="Create"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Create
          </button>
          ) : null}
          <button
            type="button"
            onClick={() => void fetchRows()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-primary hover:bg-slate-50"
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCwIcon className={`h-3.5 w-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <ResizableTable
        title={title}
        data={rows || []}
        columns={[
          ...columns.map((c: string) => ({
            key: c,
            label: prettifyLabel ? prettifyLabel(c) : c.replace(/_/g,' ').slice(0,12),
            defaultWidth: 65,
            sortable: true,
            render: (row: AdminRecord) => resolveDisplayValue(row, c),
          })),
          ...(canUpdate || canDelete
            ? [
                {
                  key: "actions",
                  label: "Actions",
                  defaultWidth: 55,
                  sortable: false,
                  render: (row: AdminRecord) => (
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {canUpdate ? (
                        <button
                          type="button"
                          className="admin-table-icon-button"
                          aria-label="Edit"
                          onClick={() => openEditDialog(row, rows.indexOf(row))}
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          className="admin-table-icon-button"
                          data-variant="danger"
                          aria-label="Delete"
                          onClick={() => openDeleteDialog(row, rows.indexOf(row))}
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ),
                },
              ]
            : []),
        ]}
        itemsPerPage={20}
        loading={loading}
        storageKey={`access-${activeSection}`}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create {title}</DialogTitle>
            <DialogDescription>Fill the fields and submit.</DialogDescription>
          </DialogHeader>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <div className="grid max-h-[60vh] gap-2 overflow-auto pr-1">
            {fields.map((field) => (
              <label key={`create-${field.key}`} className="grid gap-1">
                <span className="text-xs font-medium uppercase text-slate-600">
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                <FieldInput
                  field={field}
                  value={createValues[field.key] ?? ""}
                  branches={branches}
                  departments={departments}
                  devices={devices}
                  organizations={organizations}
                  weekPlans={weekPlans}
                  lookupLoading={lookupLoading}
                  onChange={(next) => setCreateValues((prev) => ({ ...prev, [field.key]: next }))}
                />
              </label>
            ))}
          </div>
          <DialogFooter>
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
            <button
              type="button"
              onClick={() => void onCreate()}
              className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm text-white transition hover:brightness-95"
            >
              Create
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogPopup className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {title}</DialogTitle>
            <DialogDescription>Update the selected record.</DialogDescription>
          </DialogHeader>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <div className="grid max-h-[60vh] gap-2 overflow-auto pr-1">
            {fields.map((field) => (
              <label key={`edit-${field.key}`} className="grid gap-1">
                <span className="text-xs font-medium uppercase text-slate-600">
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                <FieldInput
                  field={field}
                  value={editValues[field.key] ?? ""}
                  branches={branches}
                  departments={departments}
                  devices={devices}
                  organizations={organizations}
                  weekPlans={weekPlans}
                  lookupLoading={lookupLoading}
                  onChange={(next) => setEditValues((prev) => ({ ...prev, [field.key]: next }))}
                />
              </label>
            ))}
          </div>
          <DialogFooter>
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
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              Update
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {title}</DialogTitle>
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
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

    </div>
  )
}
