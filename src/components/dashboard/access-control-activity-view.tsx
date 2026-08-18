"use client"

import * as React from "react"
import { EyeIcon, Loader2Icon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react"

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ResizableTable } from "@/components/ui/resizable-table"
import {
  getAccessAuditLogById,
  getAccessCredentialById,
  getAccessCredentialDeviceActionRoutes,
  getAccessDeviceCommandLogById,
  getHikvisionSyncLogById,
  listAccessAuditLogs,
  listAccessCredentials,
  listAccessDeviceCommandLogs,
  listHikvisionSyncLogs,
  updateAccessCredentialStatus,
  type AdminRecord,
} from "@/lib/admin-api"
import { canAccessDashboardRoute, canPerformPermission } from "@/lib/dashboard-permissions"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useForbiddenRouteGuard, useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

type AccessControlActivitySectionKey =
  | "access-credentials"
  | "audit-logs"
  | "device-command-logs"
  | "hikvision-sync-logs"

type CredentialLifecycleAction = "enable" | "disable" | "block" | "lost" | "revoke"

type SectionConfig = {
  title: string
  description: string
  preferredColumns: string[]
}

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

const SECTION_CONFIG: Record<AccessControlActivitySectionKey, SectionConfig> = {
  "access-credentials": {
    title: "Cards and fingerprints",
    description: "See the cards, fingerprints, and PINs assigned to people, and turn them on or off.",
    preferredColumns: [
      "credential_type",
      "credential_status",
      "employee_no",
      "employee_name",
      "device_name",
      "card_no",
      "fingerprint_id",
      "updated_at",
    ],
  },
  "audit-logs": {
    title: "Audit log",
    description: "A history of who changed access for people and devices.",
    preferredColumns: ["action", "status", "employee_no", "employee_name", "device_name", "created_at"],
  },
  "device-command-logs": {
    title: "Device commands",
    description: "Commands sent to door devices, and whether they succeeded.",
    preferredColumns: ["commandType", "status", "device_name", "created_at", "updated_at"],
  },
  "hikvision-sync-logs": {
    title: "Device sync",
    description: "When people, doors, and schedules were copied to or from devices.",
    preferredColumns: ["syncType", "direction", "status", "device_name", "created_at", "updated_at"],
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

function resolveRowId(row: AdminRecord, fallbackIndex: number) {
  return readStringFromRecord(row, ["id", "credential_id", "log_id"]) ?? String(fallbackIndex + 1)
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

function prettifyLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return "-"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return "-"
    if (/^\d{4}-\d{2}-\d{2}(?:T|\s)/.test(trimmed)) {
      return formatDateTime(trimmed)
    }
    return trimmed
  }
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : "-"
  if (typeof value === "object") return "Available"
  return "-"
}

function rowSearchText(row: AdminRecord) {
  return Object.values(row)
    .flatMap((value) => {
      if (value === null || value === undefined) return []
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return [String(value)]
      }
      if (Array.isArray(value)) {
        return value.map((entry) => (typeof entry === "object" ? JSON.stringify(entry) : String(entry)))
      }
      if (typeof value === "object") {
        return [JSON.stringify(value)]
      }
      return []
    })
    .join(" ")
    .toLowerCase()
}

function resolveColumns(rows: AdminRecord[], preferred: string[]) {
  const keySet = new Set<string>()
  rows.forEach((row) => Object.keys(row).forEach((key) => keySet.add(key)))
  const ordered = preferred.filter((key) => keySet.has(key))
  const extras = Array.from(keySet).filter((key) => !ordered.includes(key)).sort((a, b) => a.localeCompare(b))
  return [...ordered, ...extras].slice(0, 8)
}

function resolveCredentialActionLabel(action: CredentialLifecycleAction) {
  if (action === "enable") return "Enable"
  if (action === "disable") return "Disable"
  if (action === "block") return "Block"
  if (action === "lost") return "Mark Lost"
  return "Revoke"
}

function buildDetailRows(record: AdminRecord | null) {
  if (!record) {
    return []
  }

  return Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  )
}

function AccessControlDetailContent({
  section,
  record,
  routes,
}: {
  section: AccessControlActivitySectionKey
  record: AdminRecord | null
  routes: AdminRecord | null
}) {
  if (!record) {
    return <p className="text-sm text-muted-foreground">No details are available for this record.</p>
  }

  const credentialType = stringifyValue(record.credential_type ?? record.credentialType)
  const status = stringifyValue(record.credential_status ?? record.status ?? record.state)
  const employee = stringifyValue(
    readStringFromRecord(record, ["employee_name", "full_name", "fullName"]) ??
      readStringFromRecord(record, ["employee_no"]) ??
      "-"
  )
  const device = stringifyValue(readStringFromRecord(record, ["device_name", "deviceName", "terminal_name"]))
  const createdAt = stringifyValue(record.created_at ?? record.createdAt)
  const updatedAt = stringifyValue(record.updated_at ?? record.updatedAt)

  if (section === "access-credentials") {
    return (
      <div className="grid max-h-[60vh] gap-4 overflow-auto pr-1">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Access credential
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">{employee}</p>
              <p className="mt-1 text-sm text-muted-foreground">{device}</p>
            </div>
            <div className="rounded-full border border-border bg-muted/40 px-3 py-1 text-sm font-medium text-foreground">
              {status}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Credential type" value={credentialType} />
          <DetailField label="Employee no" value={stringifyValue(record.employee_no ?? record.employeeNo)} />
          <DetailField label="Card no" value={stringifyValue(record.card_no ?? record.cardNo)} />
          <DetailField label="Fingerprint id" value={stringifyValue(record.fingerprint_id ?? record.fingerprintId)} />
          <DetailField label="Face template id" value={stringifyValue(record.face_template_id ?? record.faceTemplateId)} />
          <DetailField label="Credential code" value={stringifyValue(record.credential_code ?? record.credentialCode)} />
          <DetailField label="Created" value={createdAt} />
          <DetailField label="Updated" value={updatedAt} />
        </div>
        {routes ? (
          <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Device action routes</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {Object.entries(routes).map(([key, value]) => (
                <DetailField key={key} label={prettifyLabel(key)} value={stringifyValue(value)} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  if (section === "audit-logs") {
    return (
      <div className="grid max-h-[60vh] gap-4 overflow-auto pr-1">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Audit log
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {stringifyValue(record.action ?? record.event_name ?? record.eventName)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{employee}</p>
            </div>
            <div className="rounded-full border border-border bg-muted/40 px-3 py-1 text-sm font-medium text-foreground">
              {stringifyValue(record.status)}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Device" value={device} />
          <DetailField label="Actor" value={stringifyValue(record.actor_name ?? record.actorName ?? record.performed_by ?? record.performedBy)} />
          <DetailField label="Reference" value={stringifyValue(record.reference_id ?? record.referenceId ?? record.id)} />
          <DetailField label="Created" value={createdAt} />
        </div>
        {readStringFromRecord(record, ["message", "description", "details"]) ? (
          <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Details</h3>
            <p className="mt-2 text-sm text-foreground">
              {stringifyValue(record.message ?? record.description ?? record.details)}
            </p>
          </div>
        ) : null}
      </div>
    )
  }

  if (section === "device-command-logs") {
    return (
      <div className="grid max-h-[60vh] gap-4 overflow-auto pr-1">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Device command
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {stringifyValue(record.commandType ?? record.command_type ?? record.command)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{device}</p>
            </div>
            <div className="rounded-full border border-border bg-muted/40 px-3 py-1 text-sm font-medium text-foreground">
              {stringifyValue(record.status)}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Direction" value={stringifyValue(record.direction)} />
          <DetailField label="Command id" value={stringifyValue(record.command_id ?? record.commandId ?? record.id)} />
          <DetailField label="Created" value={createdAt} />
          <DetailField label="Updated" value={updatedAt} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailField label="Response code" value={stringifyValue(record.response_code ?? record.responseCode)} />
          <DetailField label="Message" value={stringifyValue(record.message ?? record.response_message ?? record.responseMessage)} />
        </div>
      </div>
    )
  }

  return (
    <div className="grid max-h-[60vh] gap-4 overflow-auto pr-1">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Sync log
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {stringifyValue(record.syncType ?? record.sync_type)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{device}</p>
          </div>
          <div className="rounded-full border border-border bg-muted/40 px-3 py-1 text-sm font-medium text-foreground">
            {stringifyValue(record.status)}
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DetailField label="Direction" value={stringifyValue(record.direction)} />
        <DetailField label="Scope" value={stringifyValue(record.scope ?? record.entity_type ?? record.entityType)} />
        <DetailField label="Started" value={stringifyValue(record.started_at ?? record.startedAt ?? record.created_at ?? record.createdAt)} />
        <DetailField label="Completed" value={stringifyValue(record.completed_at ?? record.completedAt ?? record.updated_at ?? record.updatedAt)} />
        <DetailField label="Processed" value={stringifyValue(record.processed_count ?? record.processedCount)} />
        <DetailField label="Succeeded" value={stringifyValue(record.success_count ?? record.successCount)} />
        <DetailField label="Failed" value={stringifyValue(record.failed_count ?? record.failedCount)} />
        <DetailField label="Skipped" value={stringifyValue(record.skipped_count ?? record.skippedCount)} />
      </div>
      {readStringFromRecord(record, ["error_message", "errorMessage", "message"]) ? (
        <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Result</h3>
          <p className="mt-2 text-sm text-foreground">
            {stringifyValue(record.error_message ?? record.errorMessage ?? record.message)}
          </p>
        </div>
      ) : null}
    </div>
  )
}

export function AccessControlActivityView({
  section,
  moduleTitle = "Access Control",
}: {
  section: string
  moduleTitle?: string
}) {
  const actor = useDashboardActor()
  const leaveIfForbidden = useLeaveIfForbidden()
  const activeSection = (
    Object.keys(SECTION_CONFIG).includes(section) ? section : "access-credentials"
  ) as AccessControlActivitySectionKey
  const config = SECTION_CONFIG[activeSection]
  const sectionPath = `/dashboard/access-control/${activeSection}`
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute(sectionPath, actor.permissionLabels, actor.accessMode)
  useForbiddenRouteGuard(canAccess)

  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState("")
  const [directionFilter, setDirectionFilter] = React.useState("")
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [detailError, setDetailError] = React.useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = React.useState<AdminRecord | null>(null)
  const [selectedRoutes, setSelectedRoutes] = React.useState<AdminRecord | null>(null)
  const [actionOpen, setActionOpen] = React.useState(false)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [actionTarget, setActionTarget] = React.useState<AdminRecord | null>(null)
  const [actionKind, setActionKind] = React.useState<CredentialLifecycleAction>("disable")
  const [actionReason, setActionReason] = React.useState("")
  const debouncedSearch = useDebouncedValue(search, 350)

  const canManageCredentials =
    actor.ready &&
    canPerformPermission(actor.permissionLabels, {
      permissions: ["attendance_devices:update", "employees:update", "view_company_data"],
      mode: "any",
    })

  const loadRows = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setRows([])
      setError("Authentication required. Please log in again.")
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      if (activeSection === "access-credentials") {
        const result = await listAccessCredentials(token, {
          page: 1,
          limit: 100,
          search: debouncedSearch.trim() || undefined,
          credential_status: statusFilter || undefined,
          credential_type: typeFilter || undefined,
          sort_order: "DESC",
        })
        setRows(result.rows)
        return
      }

      if (activeSection === "audit-logs") {
        const result = await listAccessAuditLogs(token, {
          page: 1,
          limit: 100,
          status: statusFilter || undefined,
        })
        setRows(result.rows)
        return
      }

      if (activeSection === "device-command-logs") {
        const result = await listAccessDeviceCommandLogs(token, {
          page: 1,
          limit: 100,
          status: statusFilter || undefined,
          commandType: typeFilter || undefined,
        })
        setRows(result.rows)
        return
      }

      const result = await listHikvisionSyncLogs(token, {
        page: 1,
        limit: 100,
        status: statusFilter || undefined,
        syncType: typeFilter || undefined,
        direction: directionFilter || undefined,
      })
      setRows(result.rows)
    } catch (errorObject) {
      if (leaveIfForbidden(errorObject)) {
        setLoading(false)
        return
      }
      setRows([])
      setError(errorObject instanceof Error ? errorObject.message : `Failed to load ${config.title.toLowerCase()}.`)
    } finally {
      setLoading(false)
    }
  }, [activeSection, config.title, debouncedSearch, directionFilter, leaveIfForbidden, statusFilter, typeFilter])

  React.useEffect(() => {
    if (!canAccess) return
    void loadRows()
  }, [canAccess, loadRows])

  const filteredRows = React.useMemo(() => {
    const searchTerm = debouncedSearch.trim().toLowerCase()
    if (!searchTerm || activeSection === "access-credentials") {
      return rows
    }
    return rows.filter((row) => rowSearchText(row).includes(searchTerm))
  }, [activeSection, debouncedSearch, rows])

  const columns = React.useMemo(
    () => resolveColumns(filteredRows, config.preferredColumns),
    [config.preferredColumns, filteredRows]
  )

  const openDetail = async (row: AdminRecord, index: number) => {
    const token = readStoredToken()
    if (!token) {
      setDetailError("Authentication required. Please log in again.")
      setDetailOpen(true)
      return
    }

    const id = resolveRowId(row, index)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setSelectedRecord(row)
    setSelectedRoutes(null)

    try {
      const detail =
        activeSection === "access-credentials"
          ? await getAccessCredentialById(token, id)
          : activeSection === "audit-logs"
            ? await getAccessAuditLogById(token, id)
            : activeSection === "device-command-logs"
              ? await getAccessDeviceCommandLogById(token, id)
              : await getHikvisionSyncLogById(token, id)
      setSelectedRecord(detail ? { ...row, ...detail } : row)

      if (activeSection === "access-credentials") {
        const routes = await getAccessCredentialDeviceActionRoutes(token, id)
        setSelectedRoutes(routes)
      }
    } catch (errorObject) {
      setDetailError(errorObject instanceof Error ? errorObject.message : "Failed to load details.")
      setSelectedRecord(row)
      setSelectedRoutes(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const openActionDialog = (row: AdminRecord) => {
    setActionTarget(row)
    setActionKind("disable")
    setActionReason("")
    setActionError(null)
    setActionOpen(true)
  }

  const submitAction = async () => {
    const token = readStoredToken()
    if (!token) {
      setActionError("Authentication required. Please log in again.")
      return
    }
    if (!actionTarget) {
      setActionError("Select a credential first.")
      return
    }

    const id =
      readStringFromRecord(actionTarget, ["id", "credential_id"]) ??
      String(readNumberFromRecord(actionTarget, ["id", "credential_id"]) ?? "")
    if (!id.trim()) {
      setActionError("Credential id is missing.")
      return
    }

    setActionLoading(true)
    setActionError(null)
    try {
      await updateAccessCredentialStatus(token, id, actionKind, {
        reason: actionReason.trim() || undefined,
        metadata: {
          source: "dashboard-access-control",
          note: "Backend lifecycle update only. Device sync remains explicit.",
        },
      })
      setMessage(`${resolveCredentialActionLabel(actionKind)} completed.`)
      setActionOpen(false)
      await loadRows()
    } catch (errorObject) {
      setActionError(errorObject instanceof Error ? errorObject.message : "Credential lifecycle update failed.")
    } finally {
      setActionLoading(false)
    }
  }

  if (!canAccess) return null

  return (
    <div className="w-full space-y-2">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <ResizableTable
        title={config.title}
        data={filteredRows}
        columns={[
          ...columns.map((column) => ({
            key: column,
            label: prettifyLabel(column),
            defaultWidth: 65,
            sortable: true,
            render: (row: AdminRecord) => stringifyValue(row[column]),
          })),
          {
            key: "actions",
            label: "Actions",
            defaultWidth: activeSection === "access-credentials" && canManageCredentials ? 95 : 55,
            sortable: false,
            render: (row: AdminRecord) => (
              <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="admin-table-icon-button"
                  aria-label="View details"
                  onClick={() => void openDetail(row, filteredRows.indexOf(row))}
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                </button>
                {activeSection === "access-credentials" && canManageCredentials ? (
                  <button
                    type="button"
                    className="admin-table-icon-button"
                    aria-label="Manage credential status"
                    onClick={() => openActionDialog(row)}
                  >
                    <ShieldCheckIcon className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
        itemsPerPage={20}
        loading={loading}
        showExport={false}
        enableColumnVisibility
        hiddenColumnKeys={["id"]}
        storageKey={`access-control-${activeSection}`}
        toolbarStart={
          <div className="min-w-0 flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {moduleTitle}
            </span>
            <h2 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {config.title}
            </h2>
            <p className="max-w-3xl text-xs text-muted-foreground">{config.description}</p>
          </div>
        }
        toolbarActions={
          <>
            <input
              className="h-8 w-32 rounded-lg border border-border bg-background px-2 text-xs sm:w-44"
              placeholder={`Search ${config.title.toLowerCase()}…`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {activeSection === "access-credentials" ? (
              <select
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                aria-label="Filter credentials by type"
              >
                <option value="">All types</option>
                <option value="CARD">Card</option>
                <option value="FINGERPRINT">Fingerprint</option>
                <option value="FACE">Face</option>
                <option value="PASSWORD">Password</option>
                <option value="PIN">PIN</option>
                <option value="QR">QR</option>
              </select>
            ) : activeSection === "device-command-logs" ? (
              <input
                className="h-8 w-32 rounded-lg border border-border bg-background px-2 text-xs sm:w-40"
                placeholder="Command type…"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              />
            ) : activeSection === "hikvision-sync-logs" ? (
              <>
                <input
                  className="h-8 w-32 rounded-lg border border-border bg-background px-2 text-xs sm:w-40"
                  placeholder="Sync type…"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                />
                <select
                  className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
                  value={directionFilter}
                  onChange={(event) => setDirectionFilter(event.target.value)}
                  aria-label="Filter by sync direction"
                >
                  <option value="">All directions</option>
                  <option value="PULL">Pull</option>
                  <option value="PUSH">Push</option>
                </select>
              </>
            ) : null}
            <select
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {activeSection === "access-credentials" ? (
                <>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="LOST">Lost</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="DELETED">Deleted</option>
                </>
              ) : activeSection === "hikvision-sync-logs" ? (
                <>
                  <option value="SUCCESS">Success</option>
                  <option value="FAILED">Failed</option>
                  <option value="PARTIAL">Partial</option>
                </>
              ) : (
                <>
                  <option value="PENDING">Pending</option>
                  <option value="SUCCESS">Success</option>
                  <option value="FAILED">Failed</option>
                </>
              )}
            </select>
            <button
              type="button"
              onClick={() => void loadRows()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCwIcon className={`h-3.5 w-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
            </button>
          </>
        }
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogPopup className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{config.title} details</DialogTitle>
            <DialogDescription>Review the selected backend record in a readable field-by-field format.</DialogDescription>
          </DialogHeader>
          {detailError ? <p className="text-sm text-red-600">{detailError}</p> : null}
          {detailLoading ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              Loading details…
            </div>
          ) : (
            <AccessControlDetailContent
              section={activeSection}
              record={selectedRecord}
              routes={selectedRoutes}
            />
          )}
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              onClick={() => setDetailOpen(false)}
            >
              Close
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage credential lifecycle</DialogTitle>
            <DialogDescription>
              Update the backend credential state first. Device enable, disable, or removal stays explicit in the device flows.
            </DialogDescription>
          </DialogHeader>
          {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-medium uppercase text-slate-600">Action</span>
              <select
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                value={actionKind}
                onChange={(event) => setActionKind(event.target.value as CredentialLifecycleAction)}
              >
                <option value="enable">Enable</option>
                <option value="disable">Disable</option>
                <option value="block">Block</option>
                <option value="lost">Mark lost</option>
                <option value="revoke">Revoke</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium uppercase text-slate-600">Reason</span>
              <Textarea
                className="min-h-24"
                placeholder="Explain why you are updating this credential status."
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
              />
            </label>
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              onClick={() => setActionOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitAction()}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm !text-white transition hover:brightness-95 disabled:opacity-60"
            >
              {actionLoading ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : null}
              {actionLoading ? "Updating…" : resolveCredentialActionLabel(actionKind)}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
