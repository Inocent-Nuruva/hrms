"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"
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

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return "-"
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
      <textarea
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
  const router = useRouter()
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

  const onCreate = async () => {
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-5 shadow-sm lg:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{moduleTitle}</h2>
          <p className="text-sm text-slate-500">{title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-900 text-white"
            onClick={() => setCreateOpen(true)}
            aria-label={`Create ${title}`}
            title="Create"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void fetchRows()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mb-3 text-sm text-green-700">{message}</p> : null}

      <TableScrollContainer>
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50/90">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap"
                >
                  {prettifyLabel(column)}
                </th>
              ))}
              <th className="w-24 px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="[&_tr:nth-child(odd)]:bg-slate-50/35 [&_tr]:border-t [&_tr]:border-slate-100 [&_tr:hover]:bg-slate-50/80">
            {!loading && !error && rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-sm text-slate-500" colSpan={Math.max(columns.length + 1, 1)}>
                  No records found for this section.
                </td>
              </tr>
            ) : null}
            {rows.map((row, index) => {
              const rowId = resolveRowId(row, index)
              return (
                <tr
                  key={String(rowId)}
                  className={activeSection === "groups" ? "cursor-pointer hover:bg-slate-50" : undefined}
                  onClick={
                    activeSection === "groups"
                      ? () => {
                          router.push(`/dashboard/attendance/groups/${rowId}`)
                        }
                      : undefined
                  }
                >
                  {columns.map((column) => (
                    <td
                      key={`${String(rowId)}-${column}`}
                      className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap"
                    >
                      {stringifyValue(row[column])}
                    </td>
                  ))}
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                        onClick={(event) => {
                          event.stopPropagation()
                          openEditDialog(row, index)
                        }}
                        aria-label="Edit record"
                        title="Edit"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 text-red-700 hover:bg-red-50"
                        onClick={(event) => {
                          event.stopPropagation()
                          openDeleteDialog(row, index)
                        }}
                        aria-label="Delete record"
                        title="Delete"
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
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
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
