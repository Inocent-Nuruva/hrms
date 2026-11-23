"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import Link from "next/link"
import {
  ArrowDownload16Regular,
  ArrowSync16Regular,
  Delete16Regular,
  DoorArrowRight16Regular,
  Edit16Regular,
  Eye16Regular,
  Add16Regular,
} from "@fluentui/react-icons"
import { Button as FluentButton, Input as FluentInput } from "@fluentui/react-components"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { FluentSelect } from "@/components/ui/fluent-select"
import { ResizableTable } from "@/components/ui/resizable-table"
import { Textarea } from "@/components/ui/textarea"
import { useFluentToastState } from "@/components/ui/use-fluent-toast-state"
import {
  commandAccessControlDoor,
  createAccessControlResource,
  createAccessScheduleTemplate,
  deleteAccessControlResourceById,
  deleteAccessScheduleTemplate,
  getAccessControlDoorDeviceConfig,
  getAccessControlResourceById,
  getAccessScheduleTemplate,
  listAttendanceDevices,
  listAccessControlResources,
  listAccessReconciliationOperations,
  scheduleDeployment, type ScheduleDeploymentState,
  type AccessReconciliationOperation,
  listAccessScheduleTemplates,
  listBranches,
  listDepartments,
  syncAccessControlDoorToDevice,
  syncAccessScheduleTemplateToDevice,
  syncAccessScheduleTemplatesFromDevice,
  syncAccessControlDeviceWeekPlans,
  syncAccessWeekPlanToDevice,
  previewAccessScheduleImpact,
  type AccessScheduleImpact,
  type AccessControlResourceKey,
  type AccessDoorLiveCommand,
  type AdminRecord,
  updateAccessControlResourceById,
  updateAccessScheduleTemplate,
} from "@/lib/admin-api"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { canSeeDashboardPage } from "@/lib/forbidden-routes"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useForbiddenRouteGuard } from "@/hooks/use-forbidden-route-guard"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { readStoredCompanyName } from "@/components/dashboard/admin-view-shared"

type AccessControlSectionKey = "doors" | "templates" | "organizations" | "groups" | "week-plans"
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
  "week-plans": "week-plans",
}

const SECTION_PERMISSION_PREFIX: Record<AccessControlSectionKey, string> = {
  doors: "access_doors",
  templates: "access_schedule_templates",
  organizations: "access_organizations",
  groups: "access_groups",
  "week-plans": "access_schedule_templates",
}

const SECTION_TITLES: Record<AccessControlSectionKey, string> = {
  doors: "Doors",
  templates: "Templates",
  organizations: "Organization",
  groups: "Groups",
  "week-plans": "Week Plans",
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
    {
      key: "schedule_type",
      label: "Schedule Type",
      type: "select",
      options: ["DOOR", "ATTENDANCE", "MIXED"],
      required: true,
    },
    { key: "status", label: "Status", type: "select", options: ["ACTIVE", "INACTIVE"], required: true },
    { key: "metadata", label: "Metadata", type: "json", placeholder: "{}" },
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
  "week-plans": [
    { key: "device_id", label: "Device", type: "number", required: true },
    { key: "hikvision_plan_no", label: "Hikvision Plan No", type: "text", required: true },
    { key: "name", label: "Plan Name", type: "text" },
    { key: "branch_id", label: "Branch", type: "number" },
    { key: "enable", label: "Enabled", type: "boolean" },
    { key: "description", label: "Description", type: "text" },
    {
      key: "segments",
      label: "Segments",
      type: "json",
      placeholder:
        '[{"week":"Monday","segment_no":1,"TimeSegment":{"beginTime":"08:00:00","endTime":"17:00:00"}}]',
    },
    { key: "metadata", label: "Metadata", type: "json", placeholder: "{\"source\":\"HQ\"}" },
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
  "week-plans": {
    device_id: ["deviceId"],
    hikvision_plan_no: ["hikvisionPlanNo", "hikvision_week_plan_no"],
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

function resolveVisibleColumns(rows: AdminRecord[], section?: AccessControlSectionKey) {
  const preferred =
    section === "templates"
      ? [
          "template_name",
          "templateName",
          "hikvision_template_no",
          "hikvisionTemplateNo",
          "schedule_type",
          "scheduleType",
          "status",
          "device_id",
          "deviceId",
          "week_plan_id",
          "weekPlanId",
          "hikvision_week_plan_no",
          "hikvisionWeekPlanNo",
          "branch_id",
          "branchId",
          "holiday_group_no",
          "holidayGroupNo",
          "id",
        ]
      : [
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
          "company_id",
          "companyId",
          "created_at",
          "updated_at",
        ]
  const keySet = new Set<string>()
  rows.forEach((row) => Object.keys(row).forEach((key) => keySet.add(key)))
  const ordered = preferred.filter((key) => keySet.has(key))
  const extras = Array.from(keySet).filter((key) => !ordered.includes(key)).sort((a, b) => a.localeCompare(b))
  return [...ordered, ...extras].slice(0, 8)
}

function getAccessControlColumnLabel(key: string) {
  if (key === "company_id" || key === "companyId") return "Company"
  if (key === "branch_id" || key === "branchId") return "Branch"
  if (key === "device_id" || key === "deviceId") return "Device"
  if (key === "department_id" || key === "departmentId") return "Department"
  if (key === "parent_id" || key === "parentId") return "Parent Organization"
  if (key === "week_plan_id" || key === "weekPlanId") return "Week Plan"
  if (key === "hikvision_template_no" || key === "hikvisionTemplateNo") return "Hik Template #"
  if (key === "hikvision_week_plan_no" || key === "hikvisionWeekPlanNo") return "Hik Week Plan #"
  if (key === "schedule_type" || key === "scheduleType") return "Type"
  if (key === "template_name" || key === "templateName") return "Template"
  if (key === "holiday_group_no" || key === "holidayGroupNo") return "Holiday Group"

  return prettifyLabel ? prettifyLabel(key) : key.replace(/_/g, " ").slice(0, 12)
}

function emptyTemplateCreateValues() {
  return {
    device_id: "",
    template_name: "",
    hikvision_template_no: "",
    week_plan_id: "",
    hikvision_week_plan_no: "",
    branch_id: "",
    holiday_group_no: "",
    schedule_type: "DOOR",
    status: "ACTIVE",
    metadata: "{}",
  }
}

function resolveWeekPlanHikvisionNo(plan: AdminRecord | null | undefined) {
  if (!plan) return ""
  return (
    readStringFromRecord(plan, [
      "hikvision_plan_no",
      "hikvisionPlanNo",
      "hikvision_week_plan_no",
      "hikvisionWeekPlanNo",
      "plan_no",
      "planNo",
    ]) ?? ""
  )
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
  onWeekPlanSelected,
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
  onWeekPlanSelected?: (plan: AdminRecord | null) => void
}) {
  if (field.key === "branch_id") {
    const emptyLabel = lookupLoading ? "Loading branches..." : "Select branch"
    return (
      <FluentSelect
        ariaLabel={field.label}
        className="w-full"
        value={value}
        placeholder={emptyLabel}
        onChange={onChange}
        options={[
          { value: "", label: emptyLabel },
          ...branches.flatMap((branch) => {
            const id = readNumberFromRecord(branch, ["id", "branch_id"])
            if (id === null) return []
            return [{
              value: String(id),
              label: readStringFromRecord(branch, ["name", "title", "display_name"]) ?? `Branch ${id}`,
            }]
          }),
        ]}
      />
    )
  }

  if (field.key === "department_id") {
    const emptyLabel = lookupLoading ? "Loading departments..." : "Select department"
    return (
      <FluentSelect
        ariaLabel={field.label}
        className="w-full"
        value={value}
        placeholder={emptyLabel}
        onChange={onChange}
        options={[
          { value: "", label: emptyLabel },
          ...departments.flatMap((department) => {
            const id = readNumberFromRecord(department, ["id", "department_id"])
            if (id === null) return []
            return [{
              value: String(id),
              label: readStringFromRecord(department, ["name", "title", "display_name"]) ?? `Department ${id}`,
            }]
          }),
        ]}
      />
    )
  }

  if (field.key === "device_id") {
    const emptyLabel = lookupLoading ? "Loading devices..." : "Select device"
    return (
      <FluentSelect
        ariaLabel={field.label}
        className="w-full"
        value={value}
        placeholder={emptyLabel}
        onChange={onChange}
        options={[
          { value: "", label: emptyLabel },
          ...devices.flatMap((device) => {
            const id = readNumberFromRecord(device, ["id", "device_id"])
            if (id === null) return []
            const name =
              readStringFromRecord(device, ["device_name", "deviceName", "name"]) ??
              `Device ${id}`
            const code = readStringFromRecord(device, ["device_code", "deviceCode"])
            return [{
              value: String(id),
              label: code ? `${name} (${code})` : name,
            }]
          }),
        ]}
      />
    )
  }

  if (field.key === "parent_id") {
    const emptyLabel = lookupLoading ? "Loading organizations..." : "Select parent organization"
    return (
      <FluentSelect
        ariaLabel={field.label}
        className="w-full"
        value={value}
        placeholder={emptyLabel}
        onChange={onChange}
        options={[
          { value: "", label: emptyLabel },
          ...organizations.flatMap((organization) => {
            const id = readNumberFromRecord(organization, ["id", "organization_id", "organizationId"])
            if (id === null) return []
            return [{
              value: String(id),
              label: readStringFromRecord(organization, ["org_name", "orgName", "name"]) ?? `Organization ${id}`,
            }]
          }),
        ]}
      />
    )
  }

  if (field.key === "week_plan_id") {
    const emptyLabel = lookupLoading ? "Loading week plans..." : "Select week plan"
    return (
      <FluentSelect
        ariaLabel={field.label}
        className="w-full"
        value={value}
        placeholder={emptyLabel}
        onChange={(next) => {
          onChange(next)
          if (!onWeekPlanSelected) return
          if (!next.trim()) {
            onWeekPlanSelected(null)
            return
          }
          const selected =
            weekPlans.find((plan) => {
              const id = readNumberFromRecord(plan, ["id", "week_plan_id", "weekPlanId"])
              return id !== null && String(id) === next
            }) ?? null
          onWeekPlanSelected(selected)
        }}
        options={[
          { value: "", label: emptyLabel },
          ...weekPlans.flatMap((plan) => {
            const id = readNumberFromRecord(plan, ["id", "week_plan_id", "weekPlanId"])
            if (id === null) return []
            const hikNo = resolveWeekPlanHikvisionNo(plan)
            const name =
              readStringFromRecord(plan, ["name", "plan_name", "planName"]) ??
              (hikNo ? `Week Plan ${hikNo}` : null) ??
              `Week Plan ${id}`
            return [{
              value: String(id),
              label: hikNo ? `${name} (#${hikNo})` : name,
            }]
          }),
        ]}
      />
    )
  }

  if (field.type === "select") {
    return (
      <FluentSelect
        ariaLabel={field.label}
        className="w-full"
        value={value}
        placeholder={`Select ${field.label}`}
        onChange={onChange}
        options={[
          { value: "", label: `Select ${field.label}` },
          ...(field.options ?? []).map((option) => ({ value: option, label: option })),
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
        placeholder={`Select ${field.label}`}
        onChange={onChange}
        options={[
          { value: "", label: `Select ${field.label}` },
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]}
      />
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
  const actor = useDashboardActor()
  const [currentCompanyName, setCurrentCompanyName] = React.useState<string | null>(() =>
    readStoredCompanyName()
  )
  const activeSection = (Object.keys(ROUTE_TO_RESOURCE).includes(section) ? section : "doors") as AccessControlSectionKey
  const sectionPath = `/dashboard/access-control/${activeSection}`
  const canAccess =
    actor.ready &&
    canSeeDashboardPage(sectionPath, actor.permissionLabels, actor.accessMode)
  useForbiddenRouteGuard(canAccess)
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
  const [accessChanges, setAccessChanges] = React.useState<Array<AccessReconciliationOperation & { group_id: number | null }> | null>(null)
  const [changesLoading, setChangesLoading] = React.useState(false)
  const [changesError, setChangesError] = React.useState<string | null>(null)

  useFluentToastState(message, setMessage, "success")
  const [createValues, setCreateValues] = React.useState<Record<string, string>>(() =>
    activeSection === "templates" ? emptyTemplateCreateValues() : buildInitialState(fields)
  )
  const [editValues, setEditValues] = React.useState<Record<string, string>>(() => buildInitialState(fields))
  const [editingId, setEditingId] = React.useState("")
  const [deletingId, setDeletingId] = React.useState("")
  const [deletingName, setDeletingName] = React.useState("")
  const [deleteConfirmation, setDeleteConfirmation] = React.useState("")
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [templateSearch, setTemplateSearch] = React.useState("")
  const debouncedTemplateSearch = useDebouncedValue(templateSearch, 350)
  const [templateStatusFilter, setTemplateStatusFilter] = React.useState("")
  const [templateTypeFilter, setTemplateTypeFilter] = React.useState("")
  const [syncFromDeviceId, setSyncFromDeviceId] = React.useState("")
  const [syncToOpen, setSyncToOpen] = React.useState(false)
  const [syncToRecordId, setSyncToRecordId] = React.useState("")
  const [syncToDeviceId, setSyncToDeviceId] = React.useState("")
  const [syncing, setSyncing] = React.useState(false)
  const [doorControlOpen, setDoorControlOpen] = React.useState(false)
  const [doorControlRow, setDoorControlRow] = React.useState<AdminRecord | null>(null)
  const [doorControlId, setDoorControlId] = React.useState("")
  const [doorBusy, setDoorBusy] = React.useState("")
  const [doorConfig, setDoorConfig] = React.useState<AdminRecord | null>(null)
  const [impactOpen, setImpactOpen] = React.useState(false)
  const [historyId, setHistoryId] = React.useState<string | null>(null)
  const [history, setHistory] = React.useState<AdminRecord[] | null>(null)
  const [historyError, setHistoryError] = React.useState("")
  const [deployment, setDeployment] = React.useState<ScheduleDeploymentState | null>(null)
  const [deploymentBusy, setDeploymentBusy] = React.useState(false)
  const [deploymentError, setDeploymentError] = React.useState("")
  const canDeploySchedule = actor.ready && ["access_control_sync:execute","data_scope:company",activeSection === "templates" ? "access_schedule_templates:update" : "access_week_plans:update"].every(permission => canPerformPermission(actor.permissionLabels, permission))
  React.useEffect(() => {
    const token = readStoredToken()
    if (!historyId || !token || (activeSection !== "templates" && activeSection !== "week-plans")) return
    let active = true
    setHistory(null)
    setHistoryError("")
    setDeployment(null)
    setDeploymentError("")
    if (canDeploySchedule) {
      scheduleDeployment(token, activeSection === "templates" ? "template" : "week-plan", historyId)
        .then(state => { if (active && token === readStoredToken()) setDeployment(state) })
        .catch((error: Error) => { if (active) setDeploymentError(error.message) })
    }
    const detail = activeSection === "templates" ? getAccessScheduleTemplate(token, historyId) : getAccessControlResourceById(token, "week-plans", historyId)
    detail.then(record => {
      if (active && token === readStoredToken()) setHistory(Array.isArray(record?.revisions) ? record.revisions : [])
    }).catch((error: Error) => { if (active) setHistoryError(error.message) })
    return () => { active = false }
  }, [historyId, activeSection, canDeploySchedule])
  async function toggleDeployment() {
    const token = readStoredToken()
    const revision = Number(history?.[0]?.revision)
    if (!token || !historyId || !deployment || !canDeploySchedule || !revision) return
    setDeploymentBusy(true)
    setDeploymentError("")
    try {
      const state = await scheduleDeployment(token, activeSection === "templates" ? "template" : "week-plan", historyId, {enabled:!deployment.enabled,revision})
      if (token === readStoredToken()) setDeployment(state)
    } catch (error) { setDeploymentError(error instanceof Error ? error.message : "Could not change deployment settings.") }
    finally { setDeploymentBusy(false) }
  }
  const [impact, setImpact] = React.useState<AccessScheduleImpact | null>(null)
  const [impactLoading, setImpactLoading] = React.useState(false)
  const [impactError, setImpactError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setCreateValues(activeSection === "templates" ? emptyTemplateCreateValues() : buildInitialState(fields))
    setEditValues(buildInitialState(fields))
    setEditingId("")
    setDeletingId("")
    setDeletingName("")
    setDeleteConfirmation("")
    setError(null)
    setFormError(null)
    setMessage(null)
    setTemplateSearch("")
    setTemplateStatusFilter("")
    setTemplateTypeFilter("")
    setSyncFromDeviceId("")
    setSyncToOpen(false)
    setSyncToRecordId("")
    setSyncToDeviceId("")
    setDoorControlOpen(false)
    setDoorControlRow(null)
    setDoorControlId("")
    setDoorBusy("")
    setDoorConfig(null)
  }, [activeSection, fields])

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
      if (activeSection === "templates") {
        const result = await listAccessScheduleTemplates(token, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
          search: debouncedTemplateSearch.trim() || undefined,
          status: templateStatusFilter || undefined,
          schedule_type: templateTypeFilter || undefined,
        })
        setRows(result.rows)
      } else if (activeSection === "week-plans") {
        const result = await listAccessControlResources(token, resource, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
          search: debouncedTemplateSearch.trim() || undefined,
        })
        setRows(result.rows)
      } else {
        const result = await listAccessControlResources(token, resource, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        })
        setRows(result.rows)
      }
    } catch (errorObject) {
      setRows([])
      setError(formatLoadError(errorObject, `Failed to load ${title.toLowerCase()}.`))
    } finally {
      setLoading(false)
    }
  }, [activeSection, debouncedTemplateSearch, resource, templateStatusFilter, templateTypeFilter, title])

  React.useEffect(() => {
    if (!canAccess) return
    void fetchRows()
  }, [canAccess, fetchRows])

  React.useEffect(() => {
    setCurrentCompanyName(readStoredCompanyName())
  }, [])

  const columns = React.useMemo(() => resolveVisibleColumns(rows, activeSection), [activeSection, rows])
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
  const weekPlanNameById = React.useMemo(
    () =>
      toLookupMap(weekPlans, ["id", "week_plan_id", "weekPlanId"], (row, id) => {
        const hikNo = resolveWeekPlanHikvisionNo(row)
        const name =
          readStringFromRecord(row, ["name", "plan_name", "planName"]) ??
          (hikNo ? `Week Plan ${hikNo}` : null) ??
          `Week Plan ${id}`
        return hikNo ? `${name} (#${hikNo})` : name
      }),
    [weekPlans]
  )

  const applyWeekPlanAutoFill = React.useCallback(
    (setter: React.Dispatch<React.SetStateAction<Record<string, string>>>, plan: AdminRecord | null) => {
      const hikNo = resolveWeekPlanHikvisionNo(plan)
      if (!hikNo) return
      setter((prev) => ({
        ...prev,
        hikvision_week_plan_no: prev.hikvision_week_plan_no?.trim() ? prev.hikvision_week_plan_no : hikNo,
      }))
    },
    []
  )

  const resolveDisplayValue = React.useCallback(
    (row: AdminRecord, column: string) => {
      const companyId =
        column === "company_id" || column === "companyId"
          ? readNumberFromRecord(row, [column])
          : null
      if (companyId !== null) {
        return (
          currentCompanyName ??
          readStringFromRecord(row, ["company_name", "companyName", "name", "display_name"]) ??
          `Company ${companyId}`
        )
      }

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

      const weekPlanId =
        column === "week_plan_id" || column === "weekPlanId"
          ? readNumberFromRecord(row, [column])
          : null
      if (weekPlanId !== null) {
        return weekPlanNameById.get(weekPlanId) ?? `Week Plan ${weekPlanId}`
      }

      return stringifyValue(row[column])
    },
    [
      branchNameById,
      currentCompanyName,
      departmentNameById,
      deviceNameById,
      organizationNameById,
      weekPlanNameById,
    ]
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
      if (activeSection === "templates") {
        if (!payload.metadata || typeof payload.metadata !== "object") {
          payload.metadata = {}
        }
        await createAccessScheduleTemplate(token, payload)
      } else {
        await createAccessControlResource(token, resource, payload)
      }
      setMessage("Created successfully.")
      setCreateOpen(false)
      setCreateValues(activeSection === "templates" ? emptyTemplateCreateValues() : buildInitialState(fields))
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
      if (activeSection === "templates") {
        await updateAccessScheduleTemplate(token, editingId.trim(), payload)
      } else {
        await updateAccessControlResourceById(token, resource, editingId.trim(), payload)
      }
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
      if (activeSection === "templates") {
        await deleteAccessScheduleTemplate(token, deletingId.trim())
      } else {
        await deleteAccessControlResourceById(token, resource, deletingId.trim())
      }
      setMessage("Deleted successfully.")
      setDeleteOpen(false)
      setDeletingId("")
      setDeletingName("")
      setDeleteConfirmation("")
      setFormError(null)
      await fetchRows()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Delete failed.")
    }
  }

  const openSyncToDevice = (row: AdminRecord, fallbackIndex: number) => {
    const rowId = String(resolveRowId(row, fallbackIndex))
    const deviceId = readNumberFromRecord(row, ["device_id", "deviceId"])
    setSyncToRecordId(rowId)
    setSyncToDeviceId(deviceId !== null ? String(deviceId) : "")
    setFormError(null)
    setSyncToOpen(true)
  }

  const openDoorControl = (row: AdminRecord, fallbackIndex: number) => {
    setDoorControlRow(row)
    setDoorControlId(String(resolveRowId(row, fallbackIndex)))
    setDoorConfig(null)
    setFormError(null)
    setMessage(null)
    setDoorControlOpen(true)
  }

  const onDoorCommand = async (command: AccessDoorLiveCommand | "sync" | "config") => {
    if (!canUpdate) {
      setFormError("Missing permission: access_doors:update")
      return
    }
    const token = readStoredToken()
    if (!token || !doorControlId.trim()) {
      setFormError("Authentication required. Please log in again.")
      return
    }
    setDoorBusy(command)
    setFormError(null)
    try {
      if (command === "config") {
        const config = await getAccessControlDoorDeviceConfig(token, doorControlId)
        setDoorConfig(config)
        setMessage("Loaded device configuration for this door.")
        return
      }
      if (command === "sync") {
        await syncAccessControlDoorToDevice(token, doorControlId)
        setMessage("Door settings were sent to the device.")
      } else {
        const labels: Record<AccessDoorLiveCommand, string> = {
          open: "Door opened.",
          close: "Door closed.",
          "always-open": "Door set to always open.",
          "always-close": "Door set to always closed.",
        }
        await commandAccessControlDoor(token, doorControlId, command)
        setMessage(labels[command])
      }
      await fetchRows()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Door command failed.")
    } finally {
      setDoorBusy("")
    }
  }

  const onSyncResourceToDevice = async () => {
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }
    if (!syncToRecordId.trim()) {
      setFormError(activeSection === "week-plans" ? "Week plan id is missing." : "Template id is missing.")
      return
    }
    const deviceId = Number(syncToDeviceId)
    if (!Number.isFinite(deviceId) || deviceId < 1) {
      setFormError("Select a valid device to sync to.")
      return
    }
    setSyncing(true)
    setFormError(null)
    try {
      const response = activeSection === "week-plans"
        ? await syncAccessWeekPlanToDevice(token, syncToRecordId.trim(), { device_id: deviceId })
        : await syncAccessScheduleTemplateToDevice(token, syncToRecordId.trim(), { device_id: deviceId })
      const result = response as { ok?: boolean; message?: string } | null
      if (result?.ok !== true) throw new Error(result?.message || "Device read-back could not confirm the schedule.")
      setMessage(result.message || "Schedule verified on the device.")
      setSyncToOpen(false)
      setSyncToRecordId("")
      setSyncToDeviceId("")
      await fetchRows()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Sync to device failed.")
    } finally {
      setSyncing(false)
    }
  }

  const onSyncResourcesFromDevice = async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }
    const deviceId = Number(syncFromDeviceId)
    if (!Number.isFinite(deviceId) || deviceId < 1) {
      setError(activeSection === "week-plans" ? "Select a device to pull week plans from." : "Select a device to pull templates from.")
      return
    }
    setSyncing(true)
    setError(null)
    try {
      const response = activeSection === "week-plans"
        ? await syncAccessControlDeviceWeekPlans(token, deviceId)
        : await syncAccessScheduleTemplatesFromDevice(token, deviceId)
      if (response && typeof response === "object" && Number((response as AdminRecord).failed ?? 0) > 0) {
        throw new Error("Some device records could not be imported. Review the synchronization results.")
      }
      setMessage(activeSection === "week-plans" ? "Week plans synced from device." : "Templates synced from device.")
      await fetchRows()
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Sync from device failed.")
    } finally {
      setSyncing(false)
    }
  }

  const openImpact = async (row: AdminRecord, index: number) => {
    const token = readStoredToken()
    setImpactOpen(true)
    setImpact(null)
    setImpactError(null)
    if (!token) { setImpactError("Authentication required."); return }
    setImpactLoading(true)
    try { setImpact(await previewAccessScheduleImpact(token, activeSection === "week-plans" ? "week-plan" : "template", resolveRowId(row, index))) }
    catch (errorObject) { setImpactError(errorObject instanceof Error ? errorObject.message : "Unable to load configuration impact.") }
    finally { setImpactLoading(false) }
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
        const latest =
          activeSection === "templates"
            ? await getAccessScheduleTemplate(token, rowId)
            : await getAccessControlResourceById(token, resource, rowId)
        setEditValues(buildEditState(fields, latest ? { ...row, ...latest } : row, fieldAliases))
      } catch {
        setEditValues(buildEditState(fields, row, fieldAliases))
      }
    })()
  }

  const openDeleteDialog = (row: AdminRecord, fallbackIndex: number) => {
    setDeletingId(String(resolveRowId(row, fallbackIndex)))
    const nameKeys: Record<AccessControlSectionKey, string[]> = {
      doors: ["door_name", "doorName", "name"],
      templates: ["template_name", "templateName", "name"],
      organizations: ["org_name", "orgName", "name", "display_name"],
      groups: ["group_name", "groupName", "name"],
      "week-plans": ["name", "plan_name", "planName", "hikvision_plan_no", "hikvisionPlanNo"],
    }
    setDeletingName(readStringFromRecord(row, nameKeys[activeSection]) ?? `${title} record`)
    setDeleteConfirmation("")
    setDeleteOpen(true)
    setFormError(null)
  }

  const canCreate =
    actor.ready &&
    canPerformPermission(actor.permissionLabels, `${SECTION_PERMISSION_PREFIX[activeSection]}:create`)
  const canUpdate =
    actor.ready &&
    canPerformPermission(actor.permissionLabels, `${SECTION_PERMISSION_PREFIX[activeSection]}:update`)
  const canDelete =
    actor.ready &&
    canPerformPermission(actor.permissionLabels, `${SECTION_PERMISSION_PREFIX[activeSection]}:delete`)

  if (!canAccess) return null

  return (
    <div className="w-full space-y-2">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {activeSection === "groups" && ["access_groups:read", "data_scope:company"].every((permission) => canPerformPermission(actor.permissionLabels, permission)) ? <section className="space-y-2 rounded border p-3 text-sm">
        <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">Recent access changes</p><p className="text-slate-600">Review records do not confirm that device access has changed.</p></div><FluentButton disabled={changesLoading} onClick={() => { const token = readStoredToken(); setChangesLoading(true); setChangesError(null); void listAccessReconciliationOperations(token).then((result) => setAccessChanges(result.data)).catch((err: unknown) => setChangesError(err instanceof Error ? err.message : "Could not load access changes")).finally(() => setChangesLoading(false)) }}>{changesLoading ? "Loading…" : "Load changes"}</FluentButton></div>
        {changesError ? <p className="text-red-700">{changesError}</p> : null}
        {accessChanges ? accessChanges.length ? <ul className="max-h-48 space-y-1 overflow-auto">{accessChanges.map((change) => <li key={change.id}>{change.employee_id === null ? `Unlinked device user ${change.unresolved_employee_no || "(number missing)"}` : `Employee #${change.employee_id}`} · Device #{change.device_id} · {change.group_id === null ? "Direct assignment" : `Group #${change.group_id}`} · {change.reason.replaceAll("_", " ")} · {change.status.replaceAll("_", " ")}{change.effective_date ? ` · Effective ${change.effective_date}` : ""}</li>)}</ul> : <p>No access changes recorded.</p> : null}
      </section> : null}

      <ResizableTable
        title={title}
        data={rows || []}
        columns={[
          ...columns.map((c: string) => ({
            key: c,
            label: getAccessControlColumnLabel(c),
            defaultWidth: 65,
            sortable: true,
            render: (row: AdminRecord) => resolveDisplayValue(row, c),
          })),
          ...(canUpdate ||
          canDelete ||
          activeSection === "templates" ||
          activeSection === "week-plans" ||
          activeSection === "groups" ||
          activeSection === "organizations" ||
          activeSection === "doors"
            ? [
                {
                  key: "actions",
                  label: "Actions",
                  defaultWidth:
                    activeSection === "templates" ||
                    activeSection === "week-plans" ||
                    activeSection === "groups" ||
                    activeSection === "organizations" ||
                    activeSection === "doors"
                      ? 100
                      : 55,
                  sortable: false,
                  render: (row: AdminRecord) => (
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {activeSection === "groups" || activeSection === "organizations" ? (
                        <Link
                          href={`/dashboard/access-control/${activeSection}/${resolveRowId(row, rows.indexOf(row))}`}
                          className="admin-table-icon-button"
                          aria-label="View details"
                          title="View details"
                        >
                          <Eye16Regular className="size-4 text-blue-600 dark:text-blue-400" />
                        </Link>
                      ) : null}
                      {activeSection === "doors" && canUpdate ? (
                        <button
                          type="button"
                          className="admin-table-icon-button"
                          aria-label="Control door"
                          title="Live door control"
                          onClick={() => openDoorControl(row, rows.indexOf(row))}
                        >
                          <DoorArrowRight16Regular className="size-4 text-emerald-600 dark:text-emerald-400" />
                        </button>
                      ) : null}
                      {(activeSection === "templates" || activeSection === "week-plans") && <button type="button" className="admin-table-icon-button" aria-label="Schedule history" title="Schedule history" onClick={() => setHistoryId(String(resolveRowId(row, rows.indexOf(row))))}><Eye16Regular className="size-4" /></button>}
                      {(activeSection === "templates" || activeSection === "week-plans") && canUpdate ? (
                        <button
                          type="button"
                          className="admin-table-icon-button"
                          aria-label={
                            activeSection === "week-plans"
                              ? "Sync week plan to device"
                              : "Sync template to device"
                          }
                          title="Sync to device"
                          onClick={() => openSyncToDevice(row, rows.indexOf(row))}
                          disabled={syncing}
                        >
                          <ArrowDownload16Regular className="size-4 text-blue-600 dark:text-blue-400" />
                        </button>
                      ) : null}
                      {(activeSection === "templates" || activeSection === "week-plans") && ["access_schedule_templates:read", "access_groups:read", "data_scope:company"].every((permission) => canPerformPermission(actor.permissionLabels, permission)) ? (
                        <button type="button" className="admin-table-icon-button" aria-label="Preview configuration impact" title="Preview configuration impact" onClick={() => void openImpact(row, rows.indexOf(row))}><Eye16Regular className="size-4 text-blue-600 dark:text-blue-400" /></button>
                      ) : null}
                      {canUpdate ? (
                        <button
                          type="button"
                          className="admin-table-icon-button"
                          aria-label="Edit"
                          onClick={() => openEditDialog(row, rows.indexOf(row))}
                        >
                          <Edit16Regular className="size-4 text-blue-600 dark:text-blue-400" />
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
                          <Delete16Regular className="size-4 text-red-600 dark:text-red-400" />
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
        showExport={false}
        enableColumnVisibility
        hiddenColumnKeys={["id"]}
        storageKey={`access-${activeSection}`}
        toolbarStart={
          <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {moduleTitle}
            </span>
            <h2 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {title}
            </h2>
          </div>
        }
        toolbarActions={
          <>
            {activeSection === "templates" || activeSection === "week-plans" ? (
              <>
                <FluentInput
                  size="small"
                  className="!h-8 w-32 sm:w-40"
                  placeholder={activeSection === "week-plans" ? "Search week plans…" : "Search templates…"}
                  value={templateSearch}
                  onChange={(event) => setTemplateSearch(event.target.value)}
                />
                {activeSection === "templates" ? (
                  <>
                    <FluentSelect
                      ariaLabel="Filter by status"
                      size="small"
                      value={templateStatusFilter}
                      placeholder="All statuses"
                      onChange={setTemplateStatusFilter}
                      options={[
                        { value: "", label: "All statuses" },
                        { value: "ACTIVE", label: "Active" },
                        { value: "INACTIVE", label: "Inactive" },
                      ]}
                    />
                    <FluentSelect
                      ariaLabel="Filter by schedule type"
                      size="small"
                      value={templateTypeFilter}
                      placeholder="All types"
                      onChange={setTemplateTypeFilter}
                      options={[
                        { value: "", label: "All types" },
                        { value: "DOOR", label: "Door" },
                        { value: "ATTENDANCE", label: "Attendance" },
                        { value: "MIXED", label: "Mixed" },
                      ]}
                    />
                  </>
                ) : null}
                <FluentSelect
                  ariaLabel="Device for sync from"
                  size="small"
                  className="max-w-[10rem]"
                  value={syncFromDeviceId}
                  placeholder="Device to pull…"
                  onChange={setSyncFromDeviceId}
                  options={[
                    { value: "", label: "Device to pull…" },
                    ...devices.flatMap((device) => {
                      const id = readNumberFromRecord(device, ["id", "device_id"])
                      if (id === null) return []
                      const name =
                        readStringFromRecord(device, ["device_name", "deviceName", "name"]) ??
                        `Device ${id}`
                      return [{ value: String(id), label: name }]
                    }),
                  ]}
                />
                <FluentButton
                  type="button"
                  className="!h-[30px] !min-h-[30px] !w-[107px] !min-w-[107px]"
                  appearance="outline"
                  size="small"
                  icon={syncing ? undefined : <ArrowDownload16Regular className="size-4 text-blue-600" />}
                  onClick={() => void onSyncResourcesFromDevice()}
                  disabled={syncing || !syncFromDeviceId}
                  title={activeSection === "week-plans" ? "Pull week plans from device" : "Pull templates from device"}
                >
                  {syncing ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  From device
                </FluentButton>
              </>
            ) : null}
            {canCreate ? (
              <FluentButton
                type="button"
                className="!h-8 !min-h-8"
                appearance="primary"
                size="small"
                icon={<Add16Regular />}
                onClick={() => {
                  setFormError(null)
                  setCreateValues(
                    activeSection === "templates" ? emptyTemplateCreateValues() : buildInitialState(fields)
                  )
                  setCreateOpen(true)
                }}
                aria-label={`Create ${title}`}
                title="Create"
              >
                Create
              </FluentButton>
            ) : null}
            <FluentButton
              type="button"
              onClick={() => void fetchRows()}
              className="!h-8 !min-h-8 !px-[14px]"
              appearance="outline"
              size="small"
              disabled={loading}
              aria-label="Refresh"
              title="Refresh"
              icon={<ArrowSync16Regular className={`size-4 text-blue-600 ${loading ? "animate-spin" : ""}`} />}
            >
            </FluentButton>
          </>
        }
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
                  onWeekPlanSelected={
                    activeSection === "templates"
                      ? (plan) => applyWeekPlanAutoFill(setCreateValues, plan)
                      : undefined
                  }
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
              className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm !text-white transition hover:brightness-95"
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
                  onWeekPlanSelected={
                    activeSection === "templates"
                      ? (plan) => applyWeekPlanAutoFill(setEditValues, plan)
                      : undefined
                  }
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

      <Dialog open={deleteOpen} onOpenChange={(open) => {
        setDeleteOpen(open)
        if (!open) {
          setDeleteConfirmation("")
          setDeletingName("")
        }
      }}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {title}</DialogTitle>
            <DialogDescription>This will permanently remove the selected record. Type its name to confirm.</DialogDescription>
          </DialogHeader>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <div className="grid gap-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              Name: {deletingName || "-"}
            </div>
            <FluentInput
              size="small"
              aria-label={`Type ${deletingName} to confirm deletion`}
              placeholder={`Type ${deletingName} to confirm`}
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              onClick={() => {
                setDeleteOpen(false)
                setFormError(null)
                setDeleteConfirmation("")
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onDelete()}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700"
              disabled={deleteConfirmation.trim().toLocaleLowerCase() !== deletingName.trim().toLocaleLowerCase()}
            >
              Delete
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={doorControlOpen}
        onOpenChange={(open) => {
          setDoorControlOpen(open)
          if (!open) {
            setDoorControlRow(null)
            setDoorControlId("")
            setDoorConfig(null)
            setDoorBusy("")
          }
        }}
      >
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Live door control</DialogTitle>
            <DialogDescription>
              Send an open, close, or lock command to door #{doorControlId || "—"}.
              {readStringFromRecord(doorControlRow ?? {}, ["door_name", "doorName", "name"])
                ? ` ${readStringFromRecord(doorControlRow ?? {}, ["door_name", "doorName", "name"])}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["open", "Open"],
                ["close", "Close"],
                ["always-open", "Always open"],
                ["always-close", "Always closed"],
              ] as const
            ).map(([command, label]) => (
              <button
                key={command}
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-60"
                disabled={Boolean(doorBusy)}
                onClick={() => void onDoorCommand(command)}
              >
                {doorBusy === command ? "Sending…" : label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-60"
              disabled={Boolean(doorBusy)}
              onClick={() => void onDoorCommand("sync")}
            >
              {doorBusy === "sync" ? <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownload16Regular className="size-4 text-blue-600" />}
              {doorBusy === "sync" ? "Syncing…" : "Sync to device"}
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-60"
              disabled={Boolean(doorBusy)}
              onClick={() => void onDoorCommand("config")}
            >
              {doorBusy === "config" ? "Loading…" : "Load device config"}
            </button>
          </div>
          {doorConfig ? (
            <pre className="max-h-48 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-700">
              {JSON.stringify(doorConfig, null, 2)}
            </pre>
          ) : null}
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              onClick={() => setDoorControlOpen(false)}
            >
              Close
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={historyId !== null} onOpenChange={open => { if (!open) setHistoryId(null) }}>
        <DialogPopup className="max-h-[80dvh] overflow-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Schedule history</DialogTitle><DialogDescription>Latest 20 saved revisions, newest first.</DialogDescription></DialogHeader>
          {deployment && canDeploySchedule && <div className="space-y-2 rounded border p-3 text-sm">
            <p>Automatic deployment to the assigned device is {deployment.enabled ? "on" : "off"}. {deployment.result}{deployment.verified_revision > 0 ? ` · Last verified revision ${deployment.verified_revision}` : ""}</p>
            <FluentButton disabled={deploymentBusy || !history?.length} onClick={() => void toggleDeployment()}>{deployment.enabled ? "Pause automatic deployment" : "Deploy this and future revisions automatically"}</FluentButton>
          </div>}
          {deploymentError && <p role="alert">{deploymentError}</p>}
          {historyError ? <p role="alert">{historyError}</p> : history === null ? <p>Loading history…</p> : history.length === 0 ? <p>No revisions recorded.</p> : history.map(row => (
            <details key={String(row.revision)} className="rounded border p-2">
              <summary className="cursor-pointer">Revision {String(row.revision)} · {new Date(String(row.recorded_at)).toLocaleString()}</summary>
              <dl className="mt-2 grid gap-1 text-sm">{Object.entries((row.configuration ?? {}) as AdminRecord).map(([key, value]) => <div key={key}><dt className="font-medium capitalize">{key.replaceAll("_", " ")}</dt><dd className="break-words">{Array.isArray(value) ? value.map(item => Array.isArray(item) ? item.join(" · ") : String(item)).join(", ") || "None" : String(value ?? "None")}</dd></div>)}</dl>
            </details>
          ))}
          <DialogFooter><FluentButton onClick={() => setHistoryId(null)}>Close</FluentButton></DialogFooter>
        </DialogPopup>
      </Dialog>
      <Dialog open={impactOpen} onOpenChange={setImpactOpen}>
        <DialogPopup className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Configuration impact</DialogTitle><DialogDescription>Review dependencies before changing this schedule.</DialogDescription></DialogHeader>
          {impactLoading ? <p className="text-sm">Loading impact…</p> : null}
          {impactError ? <p className="text-sm text-red-700">{impactError}</p> : null}
          {impact ? <div className="space-y-3 text-sm"><p className="font-medium">{impact.name}</p><p>{impact.devices.length} device(s), {impact.groups.length} group(s), {impact.linked_employee_count} linked employee(s)</p><p>Devices: {impact.devices.map((device) => device.name).join(", ") || "None"}</p><p>Groups: {impact.groups.map((group) => group.name).join(", ") || "None"}</p><p className="text-amber-700">{impact.warning}</p></div> : null}
          <DialogFooter><button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={() => setImpactOpen(false)}>Close</button></DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={syncToOpen} onOpenChange={setSyncToOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {activeSection === "week-plans" ? "Sync week plan to device" : "Sync template to device"}
            </DialogTitle>
            <DialogDescription>
              {activeSection === "week-plans"
                ? `Push week plan #${syncToRecordId || "—"} to a Hikvision device.`
                : `Push schedule template #${syncToRecordId || "—"} to a Hikvision device.`}
            </DialogDescription>
          </DialogHeader>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <label className="grid gap-1">
            <span className="text-xs font-medium uppercase text-slate-600">Device *</span>
            <FluentSelect
              ariaLabel="Device"
              className="w-full"
              value={syncToDeviceId}
              placeholder="Select device"
              onChange={setSyncToDeviceId}
              options={[
                { value: "", label: "Select device" },
                ...devices.flatMap((device) => {
                  const id = readNumberFromRecord(device, ["id", "device_id"])
                  if (id === null) return []
                  const name =
                    readStringFromRecord(device, ["device_name", "deviceName", "name"]) ??
                    `Device ${id}`
                  const code = readStringFromRecord(device, ["device_code", "deviceCode"])
                  return [{ value: String(id), label: code ? `${name} (${code})` : name }]
                }),
              ]}
            />
          </label>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              onClick={() => {
                setSyncToOpen(false)
                setFormError(null)
              }}
              disabled={syncing}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onSyncResourceToDevice()}
              disabled={syncing || !syncToDeviceId}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm !text-white transition hover:brightness-95 disabled:opacity-60"
            >
              {syncing ? <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownload16Regular className="size-4" />}
              {syncing ? "Syncing…" : "Sync to device"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

    </div>
  )
}
