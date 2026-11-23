"use client"

import { MailRoutingNotice } from "@/components/dashboard/mail-routing-notice"
import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import {
  Button as FluentButton,
  Card,
  Field as FluentField,
  Input as FluentInput,
  Switch,
  Text,
} from "@fluentui/react-components"
import {
  DownloadIcon, PencilIcon, PlayIcon, PlusIcon, RefreshCwIcon, RotateCcwIcon, SendIcon, Trash2Icon } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store"

import { formatAdminValue } from "@/components/dashboard/admin-view-shared"
import {
  createScheduledReportSchedule,
  createScheduledReportSmtpConfiguration,
  createScheduledReportTemplate,
  deleteScheduledReportSchedule,
  deleteScheduledReportSmtpConfiguration,
  deleteScheduledReportTemplate,
  downloadScheduledReportExecution,
  getScheduledReportExecution,
  getScheduledReportSchedule,
  getScheduledReportSmtpConfiguration,
  getScheduledReportTemplate,
  listScheduledReportDefinitions,
  listScheduledReportExecutions,
  listScheduledReportSchedules,
  listScheduledReportSmtpConfigurations,
  listScheduledReportTemplates,
  retryScheduledReportExecution,
  runScheduledReportTemplate,
  testScheduledReportSmtpConfiguration,
  testScheduledReportSmtpConfigurationDraft,
  updateScheduledReportSchedule,
  updateScheduledReportSmtpConfiguration,
  updateScheduledReportTemplate,
  type AdminRecord,
} from "@/lib/admin-api"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  SCHEDULED_REPORTING_MUTATE_PERMISSION,
  SCHEDULED_REPORTING_SMTP_PERMISSION,
  canPerformPermission,
} from "@/lib/dashboard-permissions"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { cn } from "@/lib/utils"
import { nullablePositiveInteger } from "@/lib/scheduled-reporting-payload"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { Badge } from "@/components/ui/badge"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { FluentSelect } from "@/components/ui/fluent-select"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

type ReportingTab = "definitions" | "templates" | "schedules" | "executions" | "smtp"

const TABS: Array<{ id: ReportingTab; label: string }> = [
  { id: "definitions", label: "Definitions" },
  { id: "templates", label: "Templates" },
  { id: "schedules", label: "Schedules" },
  { id: "executions", label: "Executions" },
  { id: "smtp", label: "SMTP" },
]

const SCHEDULE_TYPES = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME", "MANUAL"] as const
const OUTPUT_FORMATS = ["PDF", "XLSX", "CSV"] as const
const DATE_RANGE_STRATEGIES = [
  "CURRENT_DAY",
  "PREVIOUS_DAY",
  "CURRENT_WEEK",
  "PREVIOUS_WEEK",
  "CURRENT_MONTH",
  "PREVIOUS_MONTH",
  "CURRENT_QUARTER",
  "PREVIOUS_QUARTER",
  "CURRENT_YEAR",
  "PREVIOUS_YEAR",
  "CUSTOM",
  "SCHEDULE_RELATIVE",
] as const
const SECURITY_TYPES = ["NONE", "STARTTLS", "SSL_TLS", "AUTO"] as const
const MISFIRE_HANDLING = ["SKIP", "RUN_IMMEDIATELY", "DEFER_TO_NEXT_WINDOW"] as const
const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const
const RECIPIENT_CHANNELS = ["TO", "CC", "BCC"] as const
const RECIPIENT_TYPES = [
  "EMAIL",
  "COMPANY_USER",
  "EMPLOYEE",
  "ROLE",
  "DEPARTMENT",
  "DEPARTMENT_MANAGER",
  "DYNAMIC_GROUP",
] as const
const EXECUTION_STATUSES = [
  "PENDING",
  "QUEUED",
  "GENERATING",
  "GENERATED",
  "SENDING",
  "SENT",
  "PARTIALLY_SENT",
  "FAILED",
  "CANCELLED",
  "SKIPPED",
] as const
const EXECUTION_EMAIL_DELIVERY_STATUSES = [
  "PENDING",
  "SENT",
  "PARTIALLY_SENT",
  "FAILED",
  "SKIPPED",
] as const
const EXECUTION_SOURCES = [
  "SCHEDULER",
  "MANUAL",
  "API",
  "RETRY",
  "SYSTEM",
] as const
const RETRYABLE_EXECUTION_STATUSES = new Set(["FAILED", "CANCELLED", "SKIPPED"])
const DOWNLOADABLE_EXECUTION_STATUSES = new Set(["GENERATED", "SENT", "PARTIALLY_SENT"])

function readStoredToken(): string {
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

function readString(row: AdminRecord | null | undefined, keys: string[], fallback = ""): string {
  if (!row) return fallback
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    if (typeof value === "boolean") return value ? "true" : "false"
  }
  return fallback
}

function readNumber(row: AdminRecord | null | undefined, keys: string[]): number | null {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value)
    }
  }
  return null
}

function readBool(row: AdminRecord | null | undefined, keys: string[]): boolean {
  if (!row) return false
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "boolean") return value
    if (value === 1 || value === "1" || value === "true") return true
    if (value === 0 || value === "0" || value === "false") return false
  }
  return false
}

function readStringArray(row: AdminRecord | null | undefined, keys: string[]): string[] {
  if (!row) return []
  for (const key of keys) {
    const value = row[key]
    if (Array.isArray(value)) {
      return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry ?? "").trim()))
        .filter(Boolean)
    }
  }
  return []
}

function enumValue<T extends readonly string[]>(
  value: string,
  values: T,
  fallback: T[number]
): T[number] {
  return (values as readonly string[]).includes(value) ? (value as T[number]) : fallback
}

function getRowId(row: AdminRecord): string {
  const id = readNumber(row, ["id", "smtpConfigurationId", "smtp_configuration_id", "templateId", "template_id"])
  return id !== null ? String(id) : ""
}

function smtpConfigId(row: AdminRecord): number | null {
  return readNumber(row, ["id", "smtpConfigurationId", "smtp_configuration_id"])
}

function definitionId(row: AdminRecord): number | null {
  return readNumber(row, ["id", "reportDefinitionId", "report_definition_id", "definitionId", "definition_id"])
}

function pickDefaultSmtpId(configs: AdminRecord[]): string {
  if (!configs.length) return ""
  const active = configs.filter((row) => {
    // Prefer explicitly active rows; treat missing status as usable.
    if (Object.prototype.hasOwnProperty.call(row, "isActive") || Object.prototype.hasOwnProperty.call(row, "is_active")) {
      return readBool(row, ["isActive", "is_active"])
    }
    const status = readString(row, ["status"]).toUpperCase()
    return !status || status === "ACTIVE"
  })
  const pool = active.length ? active : configs
  const preferred =
    pool.find((row) => readBool(row, ["isDefault", "is_default"])) ?? pool[0]
  const id = smtpConfigId(preferred)
  return id !== null ? String(id) : ""
}

function prettify(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDateTime(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function statusTone(status: string): string {
  const s = status.toUpperCase()
  if (["SENT", "GENERATED", "ACTIVE", "TRUE"].includes(s)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
  }
  if (["FAILED", "CANCELLED"].includes(s)) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
  }
  if (["PENDING", "QUEUED", "GENERATING", "SENDING", "PARTIALLY_SENT"].includes(s)) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
  }
  return "border-border bg-muted/40 text-muted-foreground"
}

function optionLabel(row: AdminRecord): string {
  return (
    readString(row, ["name", "title", "label", "code", "email"]) ||
    (readNumber(row, ["id"]) !== null ? `#${readNumber(row, ["id"])}` : "—")
  )
}

function executionStatus(row: AdminRecord | null | undefined): string {
  return readString(row, ["status"], "").toUpperCase()
}

function canRetryExecution(row: AdminRecord | null | undefined): boolean {
  return RETRYABLE_EXECUTION_STATUSES.has(executionStatus(row))
}

function canDownloadExecution(row: AdminRecord | null | undefined): boolean {
  if (DOWNLOADABLE_EXECUTION_STATUSES.has(executionStatus(row))) {
    return true
  }
  return Boolean(
    readString(row, [
      "filename",
      "file_name",
      "generatedFilename",
      "generated_filename",
      "downloadUrl",
      "download_url",
    ])
  )
}

function definitionFormatsLabel(row: AdminRecord | null | undefined): string {
  const formats = readStringArray(row, ["supportedFormats", "supported_formats"])
  return formats.length ? formats.join(", ") : "—"
}

function definitionFilterKeysLabel(row: AdminRecord | null | undefined): string {
  if (!row) return "—"
  const rawValue = row.supportedFilters ?? row.supported_filters
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) return "—"
  const keys = Object.keys(rawValue as Record<string, unknown>)
  return keys.length ? keys.map(prettify).join(", ") : "—"
}

function relatedCount(row: AdminRecord | null | undefined, key: string): string {
  if (!row) return "0"
  const value = row[key]
  return Array.isArray(value) ? String(value.length) : "0"
}

type TemplateRecipientForm = {
  channel: (typeof RECIPIENT_CHANNELS)[number]
  recipientType: (typeof RECIPIENT_TYPES)[number]
  emailAddress: string
  companyUserId: string
  employeeId: string
  roleId: string
  departmentId: string
  dynamicGroupCode: string
  displayName: string
}

function emptyTemplateRecipientForm(): TemplateRecipientForm {
  return {
    channel: "TO",
    recipientType: "EMAIL",
    emailAddress: "",
    companyUserId: "",
    employeeId: "",
    roleId: "",
    departmentId: "",
    dynamicGroupCode: "",
    displayName: "",
  }
}

function asRecordArray(value: unknown): AdminRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is AdminRecord =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry),
  )
}

function asRelatedRecord(value: unknown): AdminRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as AdminRecord
}

function readRelatedId(
  row: AdminRecord | null | undefined,
  idKeys: string[],
  relationKeys: string[],
): number | null {
  const direct = readNumber(row, idKeys)
  if (direct !== null) return direct
  for (const key of relationKeys) {
    const related = asRelatedRecord(row?.[key])
    const id = readNumber(related, ["id"])
    if (id !== null) return id
  }
  return null
}

function readRelatedLabel(
  row: AdminRecord | null | undefined,
  idKeys: string[],
  relationKeys: string[],
  nameById: Map<number, string>,
): string {
  for (const key of relationKeys) {
    const related = asRelatedRecord(row?.[key])
    if (!related) continue
    const label = optionLabel(related)
    if (label && label !== "—") return label
  }
  const id = readRelatedId(row, idKeys, relationKeys)
  if (id !== null) return nameById.get(id) ?? `#${id}`
  return "—"
}

function hasOwnReportingKey(row: AdminRecord | null | undefined, keys: string[]): boolean {
  if (!row) return false
  return keys.some((key) => Object.prototype.hasOwnProperty.call(row, key))
}

function formatActiveLabel(row: AdminRecord | null | undefined): string {
  if (hasOwnReportingKey(row, ["isActive", "is_active"])) {
    return readBool(row, ["isActive", "is_active"]) ? "Active" : "Inactive"
  }
  const status = readString(row, ["status"]).toUpperCase()
  if (status === "ACTIVE" || status === "INACTIVE") return prettify(status)
  return "—"
}

function formatAttachLabel(row: AdminRecord | null | undefined): string {
  if (!hasOwnReportingKey(row, ["attachReport", "attach_report"])) return "—"
  return readBool(row, ["attachReport", "attach_report"]) ? "Yes" : "No"
}

function reportingDetailIsUsable(detail: AdminRecord | null | undefined): boolean {
  if (!detail) return false
  return (
    readRelatedId(
      detail,
      ["reportDefinitionId", "report_definition_id"],
      ["reportDefinition", "report_definition"],
    ) !== null ||
    readRelatedId(
      detail,
      ["smtpConfigurationId", "smtp_configuration_id"],
      ["smtpConfiguration", "smtp_configuration"],
    ) !== null ||
    readRelatedId(detail, ["templateId", "template_id"], ["template"]) !== null ||
    Boolean(
      readString(detail, [
        "outputFormat",
        "output_format",
        "dateRangeStrategy",
        "date_range_strategy",
        "host",
        "scheduleType",
        "schedule_type",
      ]),
    ) ||
    hasOwnReportingKey(detail, [
      "isActive",
      "is_active",
      "attachReport",
      "attach_report",
      "outputFormat",
      "output_format",
      "dateRangeStrategy",
      "date_range_strategy",
      "scheduleType",
      "schedule_type",
      "host",
    ])
  )
}

function mergeReportingDetail(row: AdminRecord, detail: AdminRecord | null): AdminRecord {
  if (!detail || !reportingDetailIsUsable(detail)) return row
  return { ...row, ...detail }
}

function readTemplateRecipients(row: AdminRecord | null | undefined): TemplateRecipientForm[] {
  return asRecordArray(row?.recipients).map((recipient) => ({
    channel: enumValue(
      readString(recipient, ["channel"], "TO"),
      RECIPIENT_CHANNELS,
      "TO",
    ),
    recipientType: enumValue(
      readString(recipient, ["recipientType", "recipient_type"], "EMAIL"),
      RECIPIENT_TYPES,
      "EMAIL",
    ),
    emailAddress: readString(recipient, ["emailAddress", "email_address"]),
    companyUserId: readString(recipient, ["companyUserId", "company_user_id"]),
    employeeId: readString(recipient, ["employeeId", "employee_id"]),
    roleId: readString(recipient, ["roleId", "role_id"]),
    departmentId: readString(recipient, ["departmentId", "department_id"]),
    dynamicGroupCode: readString(recipient, ["dynamicGroupCode", "dynamic_group_code"]),
    displayName: readString(recipient, ["displayName", "display_name"]),
  }))
}

function recipientTargetLabel(recipient: AdminRecord | TemplateRecipientForm): string {
  const formRecipient = recipient as Partial<TemplateRecipientForm>
  const adminRecipient = recipient as AdminRecord
  const recipientType =
    typeof formRecipient.recipientType === "string"
      ? formRecipient.recipientType
      : readString(adminRecipient, ["recipientType", "recipient_type"], "EMAIL")
  if (recipientType === "EMAIL") {
    return typeof formRecipient.emailAddress === "string" && formRecipient.emailAddress.trim()
      ? formRecipient.emailAddress.trim()
      : readString(adminRecipient, ["emailAddress", "email_address"], "—")
  }
  if (recipientType === "COMPANY_USER") {
    const value =
      typeof formRecipient.companyUserId === "string"
        ? formRecipient.companyUserId
        : readString(adminRecipient, ["companyUserId", "company_user_id"])
    return value ? `Company user #${value}` : "—"
  }
  if (recipientType === "EMPLOYEE") {
    const value =
      typeof formRecipient.employeeId === "string"
        ? formRecipient.employeeId
        : readString(adminRecipient, ["employeeId", "employee_id"])
    return value ? `Employee #${value}` : "—"
  }
  if (recipientType === "ROLE") {
    const value =
      typeof formRecipient.roleId === "string"
        ? formRecipient.roleId
        : readString(adminRecipient, ["roleId", "role_id"])
    return value ? `Role #${value}` : "—"
  }
  if (recipientType === "DYNAMIC_GROUP") {
    return typeof formRecipient.dynamicGroupCode === "string" &&
      formRecipient.dynamicGroupCode.trim()
      ? formRecipient.dynamicGroupCode.trim()
      : readString(adminRecipient, ["dynamicGroupCode", "dynamic_group_code"], "—")
  }
  const value =
    typeof formRecipient.departmentId === "string"
      ? formRecipient.departmentId
      : readString(adminRecipient, ["departmentId", "department_id"])
  return value ? `Department #${value}` : "—"
}

function recipientRowHasValue(recipient: TemplateRecipientForm): boolean {
  return Boolean(
    recipient.emailAddress.trim() ||
      recipient.companyUserId.trim() ||
      recipient.employeeId.trim() ||
      recipient.roleId.trim() ||
      recipient.departmentId.trim() ||
      recipient.dynamicGroupCode.trim() ||
      recipient.displayName.trim(),
  )
}

function objectEntries(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  return Object.entries(value as Record<string, unknown>).filter(
    ([, entry]) => entry !== null && entry !== undefined && formatAdminValue(entry) !== "-",
  )
}

const emptyTemplateForm = () => ({
  reportDefinitionId: "",
  smtpConfigurationId: "",
  name: "",
  description: "",
  outputFormat: "PDF",
  filenamePattern: "",
  emailSubjectTemplate: "",
  emailBodyTemplate: "",
  dateRangeStrategy: "CURRENT_DAY",
  attachReport: "true",
  isActive: "true",
  recipients: [] as TemplateRecipientForm[],
})

const emptyTemplateRunForm = () => ({
  dateFrom: "",
  dateTo: "",
  outputFormat: "PDF",
})

const emptyScheduleForm = () => ({
  templateId: "",
  name: "",
  scheduleType: "DAILY",
  executionTime: "08:00",
  dayOfMonth: "1",
  timezone: "Africa/Dar_es_Salaam",
  startDate: "",
  endDate: "",
  oneTimeRunAt: "",
  cronExpression: "",
  misfireHandling: "SKIP",
  maxRetryAttempts: "0",
  isActive: "true",
  weekdays: "MONDAY",
})

const emptySmtpForm = () => ({
  name: "",
  host: "",
  port: "587",
  securityType: "STARTTLS",
  username: "",
  password: "",
  senderName: "",
  senderEmail: "",
  replyToEmail: "",
  connectionTimeoutMs: "10000",
  isActive: "true",
  isDefault: "false",
})

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn("grid min-w-0 gap-1 text-xs", className)}>
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
const textareaClass =
  "min-h-20 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"

export function ScheduledReportingView({ smtpOnly = false }: { smtpOnly?: boolean }) {
  const actor = useDashboardActor()
  const canMutateReports =
    !actor.ready ||
    canPerformPermission(actor.permissionLabels, SCHEDULED_REPORTING_MUTATE_PERMISSION)
  const canManageSmtp =
    !actor.ready ||
    canPerformPermission(actor.permissionLabels, SCHEDULED_REPORTING_SMTP_PERMISSION)
  const [tab, setTab] = React.useState<ReportingTab>(smtpOnly ? "smtp" : "templates")
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [definitions, setDefinitions] = React.useState<AdminRecord[]>([])
  const [templates, setTemplates] = React.useState<AdminRecord[]>([])
  const [schedules, setSchedules] = React.useState<AdminRecord[]>([])
  const [smtpConfigs, setSmtpConfigs] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("")
  const [templateDefinitionFilter, setTemplateDefinitionFilter] = React.useState("")
  const [templateSmtpFilter, setTemplateSmtpFilter] = React.useState("")
  const [isActiveFilter, setIsActiveFilter] = React.useState("")
  const [scheduleTemplateFilter, setScheduleTemplateFilter] = React.useState("")
  const [scheduleTypeFilter, setScheduleTypeFilter] = React.useState("")
  const [smtpDefaultFilter, setSmtpDefaultFilter] = React.useState("")
  const [executionTemplateFilter, setExecutionTemplateFilter] = React.useState("")
  const [executionScheduleFilter, setExecutionScheduleFilter] = React.useState("")
  const [executionEmailFilter, setExecutionEmailFilter] = React.useState("")
  const [executionSourceFilter, setExecutionSourceFilter] = React.useState("")

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState("")
  const [deletingId, setDeletingId] = React.useState("")
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const [templateForm, setTemplateForm] = React.useState(emptyTemplateForm)
  const [runTemplateForm, setRunTemplateForm] = React.useState(emptyTemplateRunForm)
  const [scheduleForm, setScheduleForm] = React.useState(emptyScheduleForm)
  const [smtpForm, setSmtpForm] = React.useState(emptySmtpForm)

  const [runTemplateOpen, setRunTemplateOpen] = React.useState(false)
  const [runTemplateId, setRunTemplateId] = React.useState("")
  const [definitionSheetOpen, setDefinitionSheetOpen] = React.useState(false)
  const [definitionDetail, setDefinitionDetail] = React.useState<AdminRecord | null>(null)
  const [detailSheetOpen, setDetailSheetOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [detailRecord, setDetailRecord] = React.useState<AdminRecord | null>(null)
  const [executionSheetOpen, setExecutionSheetOpen] = React.useState(false)
  const [executionDetail, setExecutionDetail] = React.useState<AdminRecord | null>(null)
  const [executionLoading, setExecutionLoading] = React.useState(false)
  const [runningTemplateId, setRunningTemplateId] = React.useState("")
  const [retryingExecutionId, setRetryingExecutionId] = React.useState("")
  const [downloadingExecutionId, setDownloadingExecutionId] = React.useState("")
  const [smtpTestOpen, setSmtpTestOpen] = React.useState(false)
  const [smtpTestId, setSmtpTestId] = React.useState("")
  const [smtpTestRecipient, setSmtpTestRecipient] = React.useState("")
  const [testingSmtpId, setTestingSmtpId] = React.useState("")
  const [smtpDraftTestRecipient, setSmtpDraftTestRecipient] = React.useState("")
  const [testingDraftSmtp, setTestingDraftSmtp] = React.useState(false)
  const loadRequestIdRef = React.useRef(0)

  React.useEffect(() => {
    if (smtpOnly && tab !== "smtp") setTab("smtp")
  }, [smtpOnly, tab])

  const loadLookups = React.useCallback(async (token: string) => {
    const [defsResult, tmplResult, scheduleResult, smtpResult] = await Promise.allSettled([
      listScheduledReportDefinitions(token),
      listScheduledReportTemplates(token, { page: 1, limit: 100 }),
      listScheduledReportSchedules(token, { page: 1, limit: 100 }),
      listScheduledReportSmtpConfigurations(token, { page: 1, limit: 100 }),
    ])
    const nextDefinitions =
      defsResult.status === "fulfilled"
        ? Array.isArray(defsResult.value)
          ? defsResult.value
          : []
        : []
    const nextTemplates = tmplResult.status === "fulfilled" ? (tmplResult.value.rows ?? []) : []
    const nextSchedules =
      scheduleResult.status === "fulfilled" ? (scheduleResult.value.rows ?? []) : []
    const nextSmtpConfigs = smtpResult.status === "fulfilled" ? (smtpResult.value.rows ?? []) : []
    setDefinitions(nextDefinitions)
    setTemplates(nextTemplates)
    setSchedules(nextSchedules)
    setSmtpConfigs(nextSmtpConfigs)
    return {
      definitions: nextDefinitions,
      templates: nextTemplates,
      schedules: nextSchedules,
      smtpConfigs: nextSmtpConfigs,
    }
  }, [])

  const loadRows = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setRows([])
      return
    }

    const requestId = loadRequestIdRef.current + 1
    loadRequestIdRef.current = requestId
    setLoading(true)
    setError(null)
    setRows([])
    try {
      const lookups = await loadLookups(token)
      const params = {
        page: 1,
        limit: 100,
        sortBy: "created_at",
        sortOrder: "DESC" as const,
        search: search.trim() || undefined,
        status: tab === "executions" && statusFilter ? statusFilter : undefined,
        reportDefinitionId:
          tab === "templates" && templateDefinitionFilter
            ? Number(templateDefinitionFilter)
            : undefined,
        smtpConfigurationId:
          tab === "templates" && templateSmtpFilter ? Number(templateSmtpFilter) : undefined,
        templateId:
          tab === "schedules" && scheduleTemplateFilter
            ? Number(scheduleTemplateFilter)
            : tab === "executions" && executionTemplateFilter
              ? Number(executionTemplateFilter)
              : undefined,
        scheduleId:
          tab === "executions" && executionScheduleFilter
            ? Number(executionScheduleFilter)
            : undefined,
        scheduleType: tab === "schedules" && scheduleTypeFilter ? scheduleTypeFilter : undefined,
        isActive:
          (tab === "templates" || tab === "schedules" || tab === "smtp") && isActiveFilter
            ? isActiveFilter === "true"
            : undefined,
        isDefault:
          tab === "smtp" && smtpDefaultFilter ? smtpDefaultFilter === "true" : undefined,
        emailDeliveryStatus:
          tab === "executions" && executionEmailFilter ? executionEmailFilter : undefined,
        source:
          tab === "executions" && executionSourceFilter ? executionSourceFilter : undefined,
      }

      if (tab === "definitions") {
        const query = search.trim().toLowerCase()
        const filtered = !query
          ? lookups.definitions
          : lookups.definitions.filter((row) => {
              const haystack = [
                readString(row, ["name"]),
                readString(row, ["reportCode", "report_code"]),
                readString(row, ["description"]),
                readString(row, ["generatorService", "generator_service"]),
                definitionFormatsLabel(row),
                definitionFilterKeysLabel(row),
              ]
                .join(" ")
                .toLowerCase()
              return haystack.includes(query)
            })
        if (loadRequestIdRef.current === requestId) {
          setRows(filtered)
        }
      } else if (tab === "templates") {
        const result = await listScheduledReportTemplates(token, params)
        if (loadRequestIdRef.current === requestId) {
          setRows(result.rows)
        }
      } else if (tab === "schedules") {
        const result = await listScheduledReportSchedules(token, params)
        if (loadRequestIdRef.current === requestId) {
          setRows(result.rows)
        }
      } else if (tab === "executions") {
        const result = await listScheduledReportExecutions(token, params)
        if (loadRequestIdRef.current === requestId) {
          setRows(result.rows)
        }
      } else {
        const result = await listScheduledReportSmtpConfigurations(token, params)
        if (loadRequestIdRef.current === requestId) {
          setRows(result.rows)
        }
      }
    } catch (errorObject) {
      if (loadRequestIdRef.current === requestId) {
        setError(errorObject instanceof Error ? errorObject.message : "Failed to load data.")
        setRows([])
      }
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [
    executionEmailFilter,
    executionScheduleFilter,
    executionSourceFilter,
    executionTemplateFilter,
    isActiveFilter,
    loadLookups,
    scheduleTemplateFilter,
    scheduleTypeFilter,
    search,
    smtpDefaultFilter,
    statusFilter,
    tab,
    templateDefinitionFilter,
    templateSmtpFilter,
  ])

  React.useEffect(() => {
    void loadRows()
  }, [loadRows])

  React.useEffect(() => {
    setCreateOpen(false)
    setEditOpen(false)
    setDeleteOpen(false)
    setEditingId("")
    setDeletingId("")
    setFormError(null)
    setSearch("")
    setStatusFilter("")
    setTemplateDefinitionFilter("")
    setTemplateSmtpFilter("")
    setIsActiveFilter("")
    setScheduleTemplateFilter("")
    setScheduleTypeFilter("")
    setSmtpDefaultFilter("")
    setExecutionTemplateFilter("")
    setExecutionScheduleFilter("")
    setExecutionEmailFilter("")
    setExecutionSourceFilter("")
    setTemplateForm(emptyTemplateForm())
    setRunTemplateForm(emptyTemplateRunForm())
    setScheduleForm(emptyScheduleForm())
    setSmtpForm(emptySmtpForm())
    setSmtpDraftTestRecipient("")
    setTestingDraftSmtp(false)
    setRunTemplateOpen(false)
    setRunTemplateId("")
    setDefinitionSheetOpen(false)
    setDefinitionDetail(null)
    setDetailSheetOpen(false)
    setDetailLoading(false)
    setDetailRecord(null)
  }, [tab])

  const openCreate = () => {
    setFormError(null)
    setSmtpDraftTestRecipient("")
    const nextTemplate = emptyTemplateForm()
    // Prefill SMTP when only one config exists or a default is marked.
    nextTemplate.smtpConfigurationId = pickDefaultSmtpId(smtpConfigs)
    if (definitions.length === 1) {
      const onlyId = definitionId(definitions[0])
      if (onlyId !== null) {
        nextTemplate.reportDefinitionId = String(onlyId)
      }
    }
    setTemplateForm(nextTemplate)
    setScheduleForm(emptyScheduleForm())
    setSmtpForm(emptySmtpForm())
    setCreateOpen(true)

    // Refresh lookups if SMTP options are empty so newly created configs appear.
    if (tab === "templates" && smtpConfigs.length === 0) {
      const token = readStoredToken()
      if (token) {
        void loadLookups(token).then(() => {
          setTemplateForm((prev) => {
            if (prev.smtpConfigurationId) return prev
            // re-read from latest state via a second set after loadLookups finishes
            return prev
          })
        })
      }
    }
  }

  // When SMTP configs load while create dialog is open, prefill if still empty.
  React.useEffect(() => {
    if (!createOpen || tab !== "templates") return
    if (smtpConfigs.length === 0) return
    setTemplateForm((prev) => {
      if (prev.smtpConfigurationId) return prev
      const defaultId = pickDefaultSmtpId(smtpConfigs)
      if (!defaultId) return prev
      return { ...prev, smtpConfigurationId: defaultId }
    })
  }, [createOpen, smtpConfigs, tab])

  const fillEditFromRow = React.useCallback((row: AdminRecord) => {
    setEditingId(getRowId(row))
    setFormError(null)
    setSmtpDraftTestRecipient("")
    setTestingDraftSmtp(false)
    if (tab === "templates") {
      setTemplateForm({
        reportDefinitionId: String(
          readRelatedId(
            row,
            ["reportDefinitionId", "report_definition_id"],
            ["reportDefinition", "report_definition"],
          ) ?? "",
        ),
        smtpConfigurationId: String(
          readRelatedId(
            row,
            ["smtpConfigurationId", "smtp_configuration_id"],
            ["smtpConfiguration", "smtp_configuration"],
          ) ?? "",
        ),
        name: readString(row, ["name"]),
        description: readString(row, ["description"]),
        outputFormat: enumValue(readString(row, ["outputFormat", "output_format"], "PDF"), OUTPUT_FORMATS, "PDF"),
        filenamePattern: readString(row, ["filenamePattern", "filename_pattern"]),
        emailSubjectTemplate: readString(row, ["emailSubjectTemplate", "email_subject_template"]),
        emailBodyTemplate: readString(row, ["emailBodyTemplate", "email_body_template"]),
        dateRangeStrategy: enumValue(readString(row, ["dateRangeStrategy", "date_range_strategy"], "CURRENT_DAY"), DATE_RANGE_STRATEGIES, "CURRENT_DAY"),
        attachReport: readBool(row, ["attachReport", "attach_report"]) ? "true" : "false",
        isActive: readBool(row, ["isActive", "is_active"]) ? "true" : "false",
        recipients: readTemplateRecipients(row),
      })
    } else if (tab === "schedules") {
      const weekdays = row.weekdays
      const weekdayValue = Array.isArray(weekdays)
        ? weekdays.map(String).join(",")
        : readString(row, ["weekdays"], "MONDAY")
      setScheduleForm({
        templateId: String(readRelatedId(row, ["templateId", "template_id"], ["template"]) ?? ""),
        name: readString(row, ["name"]),
        scheduleType: enumValue(readString(row, ["scheduleType", "schedule_type"], "DAILY"), SCHEDULE_TYPES, "DAILY"),
        executionTime: readString(row, ["executionTime", "execution_time"], "08:00"),
        dayOfMonth: String(readNumber(row, ["dayOfMonth", "day_of_month"]) ?? 1),
        timezone: readString(row, ["timezone"], "Africa/Dar_es_Salaam"),
        startDate: readString(row, ["startDate", "start_date"]).slice(0, 10),
        endDate: readString(row, ["endDate", "end_date"]).slice(0, 10),
        oneTimeRunAt: readString(row, ["oneTimeRunAt", "one_time_run_at"]),
        cronExpression: readString(row, ["cronExpression", "cron_expression"]),
        misfireHandling: enumValue(readString(row, ["misfireHandling", "misfire_handling"], "SKIP"), MISFIRE_HANDLING, "SKIP"),
        maxRetryAttempts: String(readNumber(row, ["maxRetryAttempts", "max_retry_attempts"]) ?? 0),
        isActive: readBool(row, ["isActive", "is_active"]) ? "true" : "false",
        weekdays: weekdayValue,
      })
    } else if (tab === "smtp") {
      setSmtpForm({
        name: readString(row, ["name"]),
        host: readString(row, ["host"]),
        port: String(readNumber(row, ["port"]) ?? 587),
        securityType: enumValue(readString(row, ["securityType", "security_type"], "STARTTLS"), SECURITY_TYPES, "STARTTLS"),
        username: readString(row, ["username"]),
        password: "",
        senderName: readString(row, ["senderName", "sender_name"]),
        senderEmail: readString(row, ["senderEmail", "sender_email"]),
        replyToEmail: readString(row, ["replyToEmail", "reply_to_email"]),
        connectionTimeoutMs: String(readNumber(row, ["connectionTimeoutMs", "connection_timeout_ms"]) ?? 10000),
        isActive: readBool(row, ["isActive", "is_active"]) ? "true" : "false",
        isDefault: readBool(row, ["isDefault", "is_default"]) ? "true" : "false",
      })
    }
    setEditOpen(true)
  }, [tab])

  const buildTemplatePayload = (form: ReturnType<typeof emptyTemplateForm>) => {
    const recipients = form.recipients
      .filter((recipient) => recipientRowHasValue(recipient))
      .map((recipient) => {
        const payload: AdminRecord = {
          channel: recipient.channel,
          recipientType: recipient.recipientType,
          displayName: recipient.displayName.trim() || undefined,
        }

        if (recipient.recipientType === "EMAIL") {
          payload.emailAddress = recipient.emailAddress.trim()
          if (!payload.displayName && payload.emailAddress) {
            payload.displayName = payload.emailAddress
          }
        } else if (recipient.recipientType === "COMPANY_USER") {
          payload.companyUserId = Number(recipient.companyUserId)
        } else if (recipient.recipientType === "EMPLOYEE") {
          payload.employeeId = Number(recipient.employeeId)
        } else if (recipient.recipientType === "ROLE") {
          payload.roleId = Number(recipient.roleId)
        } else if (recipient.recipientType === "DYNAMIC_GROUP") {
          payload.dynamicGroupCode = recipient.dynamicGroupCode.trim()
        } else {
          payload.departmentId = Number(recipient.departmentId)
        }

        return payload
      })

    const payload: AdminRecord = {
      reportDefinitionId: Number(form.reportDefinitionId),
      // The API accepts a missing SMTP relation as null. Number("") is 0,
      // which fails the backend's minimum-id validation.
      smtpConfigurationId: nullablePositiveInteger(form.smtpConfigurationId),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      outputFormat: enumValue(form.outputFormat, OUTPUT_FORMATS, "PDF"),
      filenamePattern: form.filenamePattern.trim() || undefined,
      emailSubjectTemplate: form.emailSubjectTemplate.trim() || undefined,
      emailBodyTemplate: form.emailBodyTemplate.trim() || undefined,
      dateRangeStrategy: enumValue(form.dateRangeStrategy, DATE_RANGE_STRATEGIES, "CURRENT_DAY"),
      attachReport: form.attachReport === "true",
      isActive: form.isActive === "true",
      recipients,
    }
    return payload
  }

  const validateTemplateRecipients = React.useCallback(
    (form: ReturnType<typeof emptyTemplateForm>) => {
      const activeRecipients = form.recipients.filter((recipient) =>
        recipientRowHasValue(recipient),
      )

      for (const recipient of activeRecipients) {
        if (recipient.recipientType === "EMAIL" && !recipient.emailAddress.trim()) {
          return "Each email recipient needs an email address."
        }
        if (recipient.recipientType === "COMPANY_USER" && !recipient.companyUserId.trim()) {
          return "Each company-user recipient needs a company user ID."
        }
        if (recipient.recipientType === "EMPLOYEE" && !recipient.employeeId.trim()) {
          return "Each employee recipient needs an employee ID."
        }
        if (recipient.recipientType === "ROLE" && !recipient.roleId.trim()) {
          return "Each role recipient needs a role ID."
        }
        if (
          ["DEPARTMENT", "DEPARTMENT_MANAGER"].includes(recipient.recipientType) &&
          !recipient.departmentId.trim()
        ) {
          return "Each department recipient needs a department ID."
        }
        if (
          recipient.recipientType === "DYNAMIC_GROUP" &&
          !recipient.dynamicGroupCode.trim()
        ) {
          return "Each dynamic-group recipient needs a group code."
        }
      }

      return null
    },
    [],
  )

  const buildSchedulePayload = (form: ReturnType<typeof emptyScheduleForm>) => {
    const weekdays = form.weekdays
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean)
    return {
      templateId: Number(form.templateId),
      name: form.name.trim(),
      scheduleType: enumValue(form.scheduleType, SCHEDULE_TYPES, "DAILY"),
      executionTime: form.executionTime.trim() || undefined,
      dayOfMonth: ["MONTHLY", "QUARTERLY", "ANNUAL"].includes(form.scheduleType)
        ? Number(form.dayOfMonth) || 1
        : undefined,
      timezone: form.timezone.trim() || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      oneTimeRunAt: form.oneTimeRunAt || undefined,
      cronExpression: form.cronExpression.trim() || undefined,
      misfireHandling: enumValue(form.misfireHandling, MISFIRE_HANDLING, "SKIP"),
      maxRetryAttempts: Number(form.maxRetryAttempts) || 0,
      isActive: form.isActive === "true",
      weekdays: form.scheduleType === "WEEKLY" ? weekdays : undefined,
    } as AdminRecord
  }

  const buildSmtpPayload = (form: ReturnType<typeof emptySmtpForm>, isEdit: boolean) => {
    const payload: AdminRecord = {
      name: form.name.trim(),
      host: form.host.trim(),
      port: Number(form.port) || 587,
      securityType: enumValue(form.securityType, SECURITY_TYPES, "STARTTLS"),
      username: form.username.trim() || undefined,
      senderName: form.senderName.trim() || undefined,
      senderEmail: form.senderEmail.trim(),
      replyToEmail: form.replyToEmail.trim() || undefined,
      connectionTimeoutMs: Number(form.connectionTimeoutMs) || 10000,
      isActive: form.isActive === "true",
      isDefault: form.isDefault === "true",
    }
    if (form.password.trim() || !isEdit) {
      payload.password = form.password
    }
    return payload
  }

  const onCreate = async () => {
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required.")
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (tab === "templates") {
        const missing: string[] = []
        if (!templateForm.name.trim()) missing.push("Name")
        if (!templateForm.reportDefinitionId) missing.push("Report definition")
        if (missing.length) {
          throw new Error(`${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required.`)
        }
        const recipientError = validateTemplateRecipients(templateForm)
        if (recipientError) throw new Error(recipientError)
        await createScheduledReportTemplate(token, buildTemplatePayload(templateForm))
      } else if (tab === "schedules") {
        if (!scheduleForm.name.trim() || !scheduleForm.templateId) {
          throw new Error("Name and template are required.")
        }
        await createScheduledReportSchedule(token, buildSchedulePayload(scheduleForm))
      } else if (tab === "smtp") {
        if (!smtpForm.name.trim() || !smtpForm.host.trim() || !smtpForm.senderEmail.trim()) {
          throw new Error("Name, host, and sender email are required.")
        }
        await createScheduledReportSmtpConfiguration(token, buildSmtpPayload(smtpForm, false))
      }
      toast.success("Created successfully.")
      setCreateOpen(false)
      await loadRows()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Create failed.")
    } finally {
      setSaving(false)
    }
  }

  const onEdit = async () => {
    const token = readStoredToken()
    if (!token || !editingId) {
      setFormError("Authentication required.")
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (tab === "templates") {
        const missing: string[] = []
        if (!templateForm.name.trim()) missing.push("Name")
        if (!templateForm.reportDefinitionId) missing.push("Report definition")
        if (missing.length) {
          throw new Error(`${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required.`)
        }
        const recipientError = validateTemplateRecipients(templateForm)
        if (recipientError) throw new Error(recipientError)
        await updateScheduledReportTemplate(token, editingId, buildTemplatePayload(templateForm))
      } else if (tab === "schedules") {
        await updateScheduledReportSchedule(token, editingId, buildSchedulePayload(scheduleForm))
      } else if (tab === "smtp") {
        await updateScheduledReportSmtpConfiguration(token, editingId, buildSmtpPayload(smtpForm, true))
      }
      toast.success("Updated successfully.")
      setEditOpen(false)
      await loadRows()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Update failed.")
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    const token = readStoredToken()
    if (!token || !deletingId) return
    setSaving(true)
    setFormError(null)
    try {
      if (tab === "templates") {
        await deleteScheduledReportTemplate(token, deletingId)
      } else if (tab === "schedules") {
        await deleteScheduledReportSchedule(token, deletingId)
      } else if (tab === "smtp") {
        await deleteScheduledReportSmtpConfiguration(token, deletingId)
      }
      toast.success("Deleted successfully.")
      setDeleteOpen(false)
      setDeletingId("")
      await loadRows()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Delete failed.")
    } finally {
      setSaving(false)
    }
  }

  const openExecution = React.useCallback(async (row: AdminRecord) => {
    const token = readStoredToken()
    const id = getRowId(row)
    if (!token || !id) return
    setExecutionSheetOpen(true)
    setExecutionDetail(row)
    setExecutionLoading(true)
    try {
      const detail = await getScheduledReportExecution(token, id)
      setExecutionDetail(mergeReportingDetail(row, detail))
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Failed to load execution.")
    } finally {
      setExecutionLoading(false)
    }
  }, [])

  const openDefinition = React.useCallback((row: AdminRecord) => {
    setDefinitionDetail(row)
    setDefinitionSheetOpen(true)
  }, [])

  const openEditRecord = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken()
      const id = getRowId(row)
      if (!token || !id) {
        fillEditFromRow(row)
        return
      }

      try {
        if (tab === "templates") {
          const detail = await getScheduledReportTemplate(token, id)
          fillEditFromRow(mergeReportingDetail(row, detail as AdminRecord | null))
          return
        }
        if (tab === "schedules") {
          const detail = await getScheduledReportSchedule(token, id)
          fillEditFromRow(mergeReportingDetail(row, detail as AdminRecord | null))
          return
        }
        if (tab === "smtp") {
          const detail = await getScheduledReportSmtpConfiguration(token, id)
          fillEditFromRow(mergeReportingDetail(row, detail as AdminRecord | null))
          return
        }
      } catch (errorObject) {
        toast.error(errorObject instanceof Error ? errorObject.message : "Failed to load edit details.")
      }

      fillEditFromRow(row)
    },
    [fillEditFromRow, tab],
  )

  const openConfigDetail = React.useCallback(
    async (row: AdminRecord) => {
      const token = readStoredToken()
      const id = getRowId(row)
      if (!id) return

      setDetailSheetOpen(true)
      setDetailRecord(row)
      if (!token) return

      setDetailLoading(true)
      try {
        if (tab === "templates") {
          const detail = await getScheduledReportTemplate(token, id)
          setDetailRecord(mergeReportingDetail(row, detail))
        } else if (tab === "schedules") {
          const detail = await getScheduledReportSchedule(token, id)
          setDetailRecord(mergeReportingDetail(row, detail))
        } else if (tab === "smtp") {
          const detail = await getScheduledReportSmtpConfiguration(token, id)
          setDetailRecord(mergeReportingDetail(row, detail))
        }
      } catch (errorObject) {
        toast.error(errorObject instanceof Error ? errorObject.message : "Failed to load details.")
      } finally {
        setDetailLoading(false)
      }
    },
    [tab],
  )

  const openRunTemplate = React.useCallback((row: AdminRecord) => {
    const id = getRowId(row)
    if (!id) return
    setRunTemplateId(id)
    setRunTemplateForm({
      dateFrom: "",
      dateTo: "",
      outputFormat: enumValue(
        readString(row, ["outputFormat", "output_format"], "PDF"),
        OUTPUT_FORMATS,
        "PDF"
      ),
    })
    setRunTemplateOpen(true)
  }, [])

  const onRunTemplate = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token || !runTemplateId) {
      setFormError("Authentication required.")
      return
    }
    if (runTemplateForm.dateFrom && runTemplateForm.dateTo && runTemplateForm.dateFrom > runTemplateForm.dateTo) {
      setFormError("End date cannot be earlier than the start date.")
      return
    }

    setFormError(null)
    setRunningTemplateId(runTemplateId)
    try {
      const execution = await runScheduledReportTemplate(token, runTemplateId, {
        date_from: runTemplateForm.dateFrom || undefined,
        date_to: runTemplateForm.dateTo || undefined,
        output_format: enumValue(runTemplateForm.outputFormat, OUTPUT_FORMATS, "PDF"),
      })
      toast.success("Template run started. Check the execution history for progress.")
      setRunTemplateOpen(false)
      setTab("executions")
      if (execution) {
        setExecutionDetail(execution)
        setExecutionSheetOpen(true)
      }
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Could not run template.")
    } finally {
      setRunningTemplateId("")
    }
  }, [runTemplateForm, runTemplateId])

  const onRetryExecution = React.useCallback(async (row: AdminRecord) => {
    const token = readStoredToken()
    const id = getRowId(row)
    if (!token || !id) return

    setRetryingExecutionId(id)
    try {
      const execution = await retryScheduledReportExecution(token, id)
      toast.success("Execution retry queued.")
      await loadRows()
      if (executionDetail && getRowId(executionDetail) === id) {
        setExecutionLoading(true)
        try {
          const detail = await getScheduledReportExecution(token, id)
          setExecutionDetail(mergeReportingDetail(row, detail ?? execution))
        } finally {
          setExecutionLoading(false)
        }
      }
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not retry execution.")
    } finally {
      setRetryingExecutionId("")
    }
  }, [executionDetail, loadRows])

  const onDownloadExecution = React.useCallback(async (row: AdminRecord) => {
    const token = readStoredToken()
    const id = getRowId(row)
    if (!token || !id) return

    setDownloadingExecutionId(id)
    try {
      const result = await downloadScheduledReportExecution(token, id)
      downloadBlob(result.blob, result.filename)
      toast.success("Report download started.")
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not download the report.")
    } finally {
      setDownloadingExecutionId("")
    }
  }, [])

  const openSmtpTest = React.useCallback((row: AdminRecord) => {
    const id = getRowId(row)
    if (!id) return
    setSmtpTestId(id)
    setSmtpTestRecipient("")
    setSmtpTestOpen(true)
  }, [])

  const onTestSmtp = React.useCallback(async () => {
    const token = readStoredToken()
    const id = smtpTestId
    if (!token || !id) return
    if (!smtpTestRecipient.trim()) {
      toast.error("Enter a test recipient email address.")
      return
    }
    setTestingSmtpId(id)
    try {
      await testScheduledReportSmtpConfiguration(token, id, {
        toEmail: smtpTestRecipient.trim(),
        sendTestEmail: true,
      })
      toast.success("SMTP test sent.")
      setSmtpTestOpen(false)
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "SMTP test failed.")
    } finally {
      setTestingSmtpId("")
    }
  }, [smtpTestId, smtpTestRecipient])

  const onTestDraftSmtp = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required.")
      return
    }
    if (!smtpDraftTestRecipient.trim()) {
      setFormError("Enter a draft test recipient email address.")
      return
    }
    if (!smtpForm.name.trim() || !smtpForm.host.trim() || !smtpForm.senderEmail.trim()) {
      setFormError("Name, host, and sender email are required before a draft SMTP test.")
      return
    }

    setFormError(null)
    setTestingDraftSmtp(true)
    try {
      await testScheduledReportSmtpConfigurationDraft(token, {
        ...buildSmtpPayload(smtpForm, editOpen),
        testRecipientEmail: smtpDraftTestRecipient.trim(),
        sendTestEmail: true,
      })
      toast.success("Draft SMTP test sent.")
    } catch (errorObject) {
      setFormError(
        errorObject instanceof Error ? errorObject.message : "Draft SMTP test failed.",
      )
    } finally {
      setTestingDraftSmtp(false)
    }
  }, [editOpen, smtpDraftTestRecipient, smtpForm])

  const templateNameById = React.useMemo(() => {
    const map = new Map<number, string>()
    templates.forEach((row) => {
      const id = readNumber(row, ["id"])
      if (id !== null) map.set(id, optionLabel(row))
    })
    return map
  }, [templates])

  const scheduleNameById = React.useMemo(() => {
    const map = new Map<number, string>()
    schedules.forEach((row) => {
      const id = readNumber(row, ["id"])
      if (id !== null) map.set(id, optionLabel(row))
    })
    return map
  }, [schedules])

  const definitionNameById = React.useMemo(() => {
    const map = new Map<number, string>()
    definitions.forEach((row) => {
      const id = readNumber(row, ["id"])
      if (id !== null) map.set(id, optionLabel(row))
    })
    return map
  }, [definitions])

  const smtpNameById = React.useMemo(() => {
    const map = new Map<number, string>()
    smtpConfigs.forEach((row) => {
      const id = smtpConfigId(row)
      if (id !== null) map.set(id, optionLabel(row))
    })
    return map
  }, [smtpConfigs])

  const columns = React.useMemo<Array<Column<AdminRecord>>>(() => {
    if (tab === "definitions") {
      return [
        {
          key: "name",
          label: "Definition",
          defaultWidth: 220,
          render: (row) => (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {readString(row, ["name"], "—")}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {readString(row, ["reportCode", "report_code"], "—")}
              </p>
            </div>
          ),
        },
        {
          key: "supportedFormats",
          label: "Formats",
          defaultWidth: 120,
          render: (row) => (
            <span className="text-xs text-muted-foreground">
              {definitionFormatsLabel(row)}
            </span>
          ),
        },
        {
          key: "generatorService",
          label: "Generator",
          defaultWidth: 140,
          render: (row) => (
            <span className="text-xs text-muted-foreground">
              {readString(row, ["generatorService", "generator_service"], "—")}
            </span>
          ),
        },
        {
          key: "isActive",
          label: "Status",
          defaultWidth: 80,
          render: (row) => {
            const active = readBool(row, ["isActive", "is_active"])
            return (
              <Badge variant="outline" className={cn("text-[10px]", statusTone(active ? "ACTIVE" : "INACTIVE"))}>
                {active ? "Active" : "Inactive"}
              </Badge>
            )
          },
        },
        {
          key: "actions",
          label: "Actions",
          defaultWidth: 72,
          sortable: false,
          render: (row) => (
            <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                onClick={() => openDefinition(row)}
              >
                View
              </button>
            </div>
          ),
        },
      ]
    }

    if (tab === "templates") {
      return [
        {
          key: "name",
          label: "Name",
          defaultWidth: 160,
          render: (row) => <span className="text-xs font-medium">{readString(row, ["name"], "—")}</span>,
        },
        {
          key: "reportDefinitionId",
          label: "Report",
          defaultWidth: 140,
          render: (row) => (
            <span className="text-xs text-muted-foreground">
              {readRelatedLabel(
                row,
                ["reportDefinitionId", "report_definition_id"],
                ["reportDefinition", "report_definition"],
                definitionNameById,
              )}
            </span>
          ),
        },
        {
          key: "outputFormat",
          label: "Format",
          defaultWidth: 80,
          render: (row) => (
            <span className="text-xs">{readString(row, ["outputFormat", "output_format"], "—")}</span>
          ),
        },
        {
          key: "isActive",
          label: "Active",
          defaultWidth: 80,
          render: (row) => {
            const active = readBool(row, ["isActive", "is_active"])
            return (
              <Badge variant="outline" className={cn("text-[10px]", statusTone(active ? "ACTIVE" : "INACTIVE"))}>
                {active ? "Active" : "Inactive"}
              </Badge>
            )
          },
        },
        {
          key: "actions",
          label: "Actions",
          defaultWidth: 146,
          sortable: false,
          render: (row) => (
            <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                onClick={() => void openConfigDetail(row)}
              >
                View
              </button>
              <button
                className="admin-table-icon-button"
                type="button"
                aria-label="Run now"
                title="Run now"
                onClick={() => openRunTemplate(row)}
                disabled={runningTemplateId === getRowId(row)}
              >
                {runningTemplateId === getRowId(row) ? (
                  <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PlayIcon className="h-3.5 w-3.5" />
                )}
              </button>
              <button className="admin-table-icon-button" type="button" aria-label="Edit" onClick={() => void openEditRecord(row)}>
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
              <button
                className="admin-table-icon-button"
                data-variant="danger"
                type="button"
                aria-label="Delete"
                onClick={() => {
                  setDeletingId(getRowId(row))
                  setDeleteOpen(true)
                }}
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </button>
            </div>
          ),
        },
      ]
    }

    if (tab === "schedules") {
      return [
        {
          key: "name",
          label: "Name",
          defaultWidth: 150,
          render: (row) => <span className="text-xs font-medium">{readString(row, ["name"], "—")}</span>,
        },
        {
          key: "templateId",
          label: "Template",
          defaultWidth: 140,
          render: (row) => (
            <span className="text-xs text-muted-foreground">
              {readRelatedLabel(row, ["templateId", "template_id"], ["template"], templateNameById)}
            </span>
          ),
        },
        {
          key: "scheduleType",
          label: "Type",
          defaultWidth: 90,
          render: (row) => (
            <span className="text-xs">{prettify(readString(row, ["scheduleType", "schedule_type"], "—"))}</span>
          ),
        },
        {
          key: "executionTime",
          label: "Time",
          defaultWidth: 80,
          render: (row) => (
            <span className="text-xs tabular-nums">
              {readString(row, ["executionTime", "execution_time"], "—")}
            </span>
          ),
        },
        {
          key: "isActive",
          label: "Active",
          defaultWidth: 80,
          render: (row) => {
            const active = readBool(row, ["isActive", "is_active"])
            return (
              <Badge variant="outline" className={cn("text-[10px]", statusTone(active ? "ACTIVE" : "INACTIVE"))}>
                {active ? "Active" : "Inactive"}
              </Badge>
            )
          },
        },
        {
          key: "actions",
          label: "Actions",
          defaultWidth: 108,
          sortable: false,
          render: (row) => (
            <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                onClick={() => void openConfigDetail(row)}
              >
                View
              </button>
              <button className="admin-table-icon-button" type="button" aria-label="Edit" onClick={() => void openEditRecord(row)}>
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
              <button
                className="admin-table-icon-button"
                data-variant="danger"
                type="button"
                aria-label="Delete"
                onClick={() => {
                  setDeletingId(getRowId(row))
                  setDeleteOpen(true)
                }}
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </button>
            </div>
          ),
        },
      ]
    }

    if (tab === "executions") {
      return [
        {
          key: "id",
          label: "ID",
          defaultWidth: 60,
          render: (row) => <span className="text-xs tabular-nums">{getRowId(row) || "—"}</span>,
        },
        {
          key: "templateId",
          label: "Template",
          defaultWidth: 140,
          render: (row) => {
            const label = readRelatedLabel(
              row,
              ["templateId", "template_id"],
              ["template"],
              templateNameById,
            )
            return (
              <span className="text-xs">
                {label !== "—" ? label : readString(row, ["template_name", "name"], "—")}
              </span>
            )
          },
        },
        {
          key: "status",
          label: "Status",
          defaultWidth: 110,
          render: (row) => {
            const status = readString(row, ["status"], "—")
            return (
              <Badge variant="outline" className={cn("text-[10px]", statusTone(status))}>
                {prettify(status)}
              </Badge>
            )
          },
        },
        {
          key: "source",
          label: "Source",
          defaultWidth: 90,
          render: (row) => <span className="text-xs">{prettify(readString(row, ["source"], "—"))}</span>,
        },
        {
          key: "created_at",
          label: "Created",
          defaultWidth: 130,
          render: (row) => (
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDateTime(row.created_at ?? row.createdAt)}
            </span>
          ),
        },
        {
          key: "actions",
          label: "",
          defaultWidth: 142,
          sortable: false,
          render: (row) => {
            const rowId = getRowId(row)
            const downloading = downloadingExecutionId === rowId
            const retrying = retryingExecutionId === rowId
            return (
            <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                onClick={() => void openExecution(row)}
              >
                View
              </button>
              <button
                type="button"
                className="admin-table-icon-button"
                aria-label="Download"
                title="Download"
                disabled={!canDownloadExecution(row) || downloading}
                onClick={() => void onDownloadExecution(row)}
              >
                {downloading ? (
                  <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <DownloadIcon className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                className="admin-table-icon-button"
                aria-label="Retry"
                title="Retry"
                disabled={!canRetryExecution(row) || retrying}
                onClick={() => void onRetryExecution(row)}
              >
                {retrying ? (
                  <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcwIcon className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            )
          },
        },
      ]
    }

    return [
      {
        key: "name",
        label: "Name",
        defaultWidth: 80,
        render: (row) => <span className="block truncate text-xs font-medium">{readString(row, ["name"], "—")}</span>,
      },
      {
        key: "host",
        label: "Host",
        defaultWidth: 100,
        render: (row) => (
          <span className="block truncate text-xs text-muted-foreground">
            {readString(row, ["host"], "—")}:{readString(row, ["port"], "")}
          </span>
        ),
      },
      {
        key: "senderEmail",
        label: "Sender",
        defaultWidth: 110,
        render: (row) => (
          <span className="block truncate text-xs">{readString(row, ["senderEmail", "sender_email"], "—")}</span>
        ),
      },
      {
        key: "status",
        label: "Status",
        defaultWidth: 80,
        render: (row) => {
          const active = readBool(row, ["isActive", "is_active"])
          const isDefault = readBool(row, ["isDefault", "is_default"])
          return (
            <div className="flex items-center gap-1" title={`${isDefault ? "Default, " : ""}${active ? "active" : "inactive"}`}>
              {isDefault ? <Badge variant="outline" className="px-1 text-[9px]">Default</Badge> : null}
              <span className={cn("size-2 shrink-0 rounded-full", active ? "bg-emerald-500" : "bg-muted-foreground/40")} />
            </div>
          )
        },
      },
      {
        key: "actions",
        label: "Actions",
        defaultWidth: 220,
        sortable: false,
        render: (row) => (
          <div className="flex flex-wrap justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
              onClick={() => void openConfigDetail(row)}
            >
              View
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
              onClick={() => openSmtpTest(row)}
              disabled={testingSmtpId === getRowId(row)}
            >
              {testingSmtpId === getRowId(row) ? (
                <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <SendIcon className="h-3.5 w-3.5" />
              )}
              Test
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
              onClick={() => void openEditRecord(row)}
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
              onClick={() => {
                setDeletingId(getRowId(row))
                setDeleteOpen(true)
              }}
            >
              <Trash2Icon className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        ),
      },
    ]
  }, [
    definitionNameById,
    downloadingExecutionId,
    openConfigDetail,
    openDefinition,
    openEditRecord,
    openExecution,
    openRunTemplate,
    openSmtpTest,
    onDownloadExecution,
    onRetryExecution,
    retryingExecutionId,
    runningTemplateId,
    tab,
    templateNameById,
    testingSmtpId,
  ])

  const sectionTitle =
    tab === "definitions"
      ? "Report Definitions"
      : tab === "templates"
        ? "Templates"
        : tab === "schedules"
          ? "Schedules"
          : tab === "executions"
            ? "Executions"
            : "SMTP configurations"

  const canCreate =
    (tab === "smtp" ? canManageSmtp : canMutateReports) &&
    tab !== "definitions" &&
    tab !== "executions"

  const renderTemplateFields = (form: ReturnType<typeof emptyTemplateForm>, setForm: typeof setTemplateForm) => (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Name *">
        <input className={inputClass} value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} />
      </Field>
      <Field label="Output format">
        <FluentSelect
          ariaLabel="Output format"
          className="w-full"
          value={form.outputFormat}
          onChange={(value) => setForm((c) => ({ ...c, outputFormat: value }))}
          options={OUTPUT_FORMATS.map((value) => ({ value, label: value }))}
        />
      </Field>
      <Field label="Report definition *">
        <FluentSelect
          ariaLabel="Report definition"
          className="w-full"
          value={form.reportDefinitionId}
          placeholder="Select definition"
          onChange={(value) => setForm((c) => ({ ...c, reportDefinitionId: value }))}
          options={[
            { value: "", label: "Select definition" },
            ...definitions.flatMap((row) => {
              const id = definitionId(row)
              if (id === null) return []
              return [{ value: String(id), label: optionLabel(row) }]
            }),
          ]}
        />
        {definitions.length === 0 ? (
          <span className="text-[11px] text-amber-700 dark:text-amber-300">
            No report definitions loaded. Refresh the page or check permissions.
          </span>
        ) : null}
      </Field>
      <Field label="SMTP configuration (optional)">
        <FluentSelect
          ariaLabel="SMTP configuration"
          className="w-full"
          value={form.smtpConfigurationId}
          placeholder="Select company SMTP"
          onChange={(value) => setForm((c) => ({ ...c, smtpConfigurationId: value }))}
          options={[
            { value: "", label: "Select company SMTP" },
            ...smtpConfigs.flatMap((row) => {
              const id = smtpConfigId(row)
              if (id === null) return []
              const label = optionLabel(row)
              const isDefault = readBool(row, ["isDefault", "is_default"])
              return [{ value: String(id), label: isDefault ? `${label} (default)` : label }]
            }),
          ]}
        />
        {smtpConfigs.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">
            No company SMTP settings are available. Active scheduled reports require one. You can{" "}
            <Link
              href="/dashboard/smtp"
              className="font-semibold text-foreground underline underline-offset-2"
              onClick={() => {
                setCreateOpen(false)
                setEditOpen(false)
              }}
            >
              open SMTP settings
            </Link>{" "}
            to add a company-specific server.
          </span>
        ) : !form.smtpConfigurationId ? (
          <span className="text-[11px] text-muted-foreground">
            Select a tested company SMTP profile before activating this report template.
          </span>
        ) : null}
      </Field>
      <Field label="Date range strategy">
        <FluentSelect
          ariaLabel="Date range strategy"
          className="w-full"
          value={form.dateRangeStrategy}
          onChange={(value) => setForm((c) => ({ ...c, dateRangeStrategy: value }))}
          options={DATE_RANGE_STRATEGIES.map((value) => ({ value, label: prettify(value) }))}
        />
      </Field>
      <Field label="Filename pattern">
        <input
          className={inputClass}
          value={form.filenamePattern}
          onChange={(e) => setForm((c) => ({ ...c, filenamePattern: e.target.value }))}
          placeholder="attendance-{{date}}.pdf"
        />
      </Field>
      <Field label="Email subject">
        <input
          className={inputClass}
          value={form.emailSubjectTemplate}
          onChange={(e) => setForm((c) => ({ ...c, emailSubjectTemplate: e.target.value }))}
        />
      </Field>
      <Field label="Description" className="md:col-span-2">
        <Textarea
          className={textareaClass}
          value={form.description}
          onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
        />
      </Field>
      <Field label="Email body" className="md:col-span-2">
        <Textarea
          className={textareaClass}
          value={form.emailBodyTemplate}
          onChange={(e) => setForm((c) => ({ ...c, emailBodyTemplate: e.target.value }))}
        />
      </Field>
      <Field label="Attach report">
        <FluentSelect
          ariaLabel="Attach report"
          className="w-full"
          value={form.attachReport}
          onChange={(value) => setForm((c) => ({ ...c, attachReport: value }))}
          options={[
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ]}
        />
      </Field>
      <Field label="Active">
        <FluentSelect
          ariaLabel="Active"
          className="w-full"
          value={form.isActive}
          onChange={(value) => setForm((c) => ({ ...c, isActive: value }))}
          options={[
            { value: "true", label: "Active" },
            { value: "false", label: "Inactive" },
          ]}
        />
      </Field>
      <div className="grid gap-3 md:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Recipients</p>
            <p className="text-[11px] text-muted-foreground">
              Add one or more recipients using the backend-supported delivery targets.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium"
            onClick={() =>
              setForm((current) => ({
                ...current,
                recipients: [...current.recipients, emptyTemplateRecipientForm()],
              }))
            }
          >
            <PlusIcon className="size-3.5" />
            Add recipient
          </button>
        </div>
        {form.recipients.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            No explicit recipients yet. Add one if this template should deliver to email, employee, role, department, or group targets.
          </div>
        ) : null}
        {form.recipients.map((recipient, index) => (
          <div key={`recipient-${index}`} className="grid gap-3 rounded-md border border-border bg-muted/10 p-3 md:grid-cols-2">
            <Field label="Channel">
              <FluentSelect
                ariaLabel="Channel"
                className="w-full"
                value={recipient.channel}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    recipients: current.recipients.map((entry, entryIndex) =>
                      entryIndex === index
                        ? {
                            ...entry,
                            channel: enumValue(
                              value,
                              RECIPIENT_CHANNELS,
                              "TO",
                            ),
                          }
                        : entry,
                    ),
                  }))
                }
                options={RECIPIENT_CHANNELS.map((channel) => ({ value: channel, label: channel }))}
              />
            </Field>
            <Field label="Recipient type">
              <FluentSelect
                ariaLabel="Recipient type"
                className="w-full"
                value={recipient.recipientType}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    recipients: current.recipients.map((entry, entryIndex) =>
                      entryIndex === index
                        ? {
                            ...emptyTemplateRecipientForm(),
                            channel: entry.channel,
                            recipientType: enumValue(
                              value,
                              RECIPIENT_TYPES,
                              "EMAIL",
                            ),
                          }
                        : entry,
                    ),
                  }))
                }
                options={RECIPIENT_TYPES.map((type) => ({ value: type, label: prettify(type) }))}
              />
            </Field>
            {recipient.recipientType === "EMAIL" ? (
              <Field label="Email address">
                <input
                  className={inputClass}
                  type="email"
                  value={recipient.emailAddress}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      recipients: current.recipients.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, emailAddress: e.target.value }
                          : entry,
                      ),
                    }))
                  }
                  placeholder="hr@company.com"
                />
              </Field>
            ) : null}
            {recipient.recipientType === "COMPANY_USER" ? (
              <Field label="Company user ID">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={recipient.companyUserId}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      recipients: current.recipients.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, companyUserId: e.target.value }
                          : entry,
                      ),
                    }))
                  }
                />
              </Field>
            ) : null}
            {recipient.recipientType === "EMPLOYEE" ? (
              <Field label="Employee ID">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={recipient.employeeId}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      recipients: current.recipients.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, employeeId: e.target.value }
                          : entry,
                      ),
                    }))
                  }
                />
              </Field>
            ) : null}
            {recipient.recipientType === "ROLE" ? (
              <Field label="Role ID">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={recipient.roleId}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      recipients: current.recipients.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, roleId: e.target.value }
                          : entry,
                      ),
                    }))
                  }
                />
              </Field>
            ) : null}
            {recipient.recipientType === "DEPARTMENT" ||
            recipient.recipientType === "DEPARTMENT_MANAGER" ? (
              <Field label="Department ID">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={recipient.departmentId}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      recipients: current.recipients.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, departmentId: e.target.value }
                          : entry,
                      ),
                    }))
                  }
                />
              </Field>
            ) : null}
            {recipient.recipientType === "DYNAMIC_GROUP" ? (
              <Field label="Dynamic group code">
                <input
                  className={inputClass}
                  value={recipient.dynamicGroupCode}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      recipients: current.recipients.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, dynamicGroupCode: e.target.value }
                          : entry,
                      ),
                    }))
                  }
                  placeholder="TEAM_LEADS"
                />
              </Field>
            ) : null}
            <Field label="Display name (optional)">
              <input
                className={inputClass}
                value={recipient.displayName}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    recipients: current.recipients.map((entry, entryIndex) =>
                      entryIndex === index
                        ? { ...entry, displayName: e.target.value }
                        : entry,
                    ),
                  }))
                }
                placeholder="HR Team"
              />
            </Field>
            <div className="flex items-end justify-end md:col-span-2">
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:text-rose-300"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    recipients: current.recipients.filter((_, entryIndex) => entryIndex !== index),
                  }))
                }
              >
                <Trash2Icon className="size-3.5" />
                Remove recipient
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderScheduleFields = (form: ReturnType<typeof emptyScheduleForm>, setForm: typeof setScheduleForm) => (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Name *">
        <input className={inputClass} value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} />
      </Field>
      <Field label="Template *">
        <FluentSelect
          ariaLabel="Template"
          className="w-full"
          value={form.templateId}
          placeholder="Select template"
          onChange={(value) => setForm((c) => ({ ...c, templateId: value }))}
          options={[
            { value: "", label: "Select template" },
            ...templates.flatMap((row) => {
              const id = readNumber(row, ["id"])
              if (id === null) return []
              return [{ value: String(id), label: optionLabel(row) }]
            }),
          ]}
        />
      </Field>
      <Field label="Schedule type">
        <FluentSelect
          ariaLabel="Schedule type"
          className="w-full"
          value={form.scheduleType}
          onChange={(value) => setForm((c) => ({ ...c, scheduleType: value }))}
          options={SCHEDULE_TYPES.map((value) => ({ value, label: prettify(value) }))}
        />
      </Field>
      <Field label="Execution time">
        <input
          className={inputClass}
          value={form.executionTime}
          onChange={(e) => setForm((c) => ({ ...c, executionTime: e.target.value }))}
          placeholder="08:00"
        />
      </Field>
      {["MONTHLY", "QUARTERLY", "ANNUAL"].includes(form.scheduleType) ? (
        <Field label={
          form.scheduleType === "MONTHLY"
            ? "Day of month"
            : form.scheduleType === "QUARTERLY"
              ? "Day in first month of quarter"
              : "Day in January"
        }>
          <input
            className={inputClass}
            type="number"
            min={1}
            max={31}
            value={form.dayOfMonth}
            onChange={(e) => setForm((c) => ({ ...c, dayOfMonth: e.target.value }))}
          />
        </Field>
      ) : null}
      {form.scheduleType === "WEEKLY" ? (
        <Field label="Weekdays (comma-separated)">
          <input
            className={inputClass}
            value={form.weekdays}
            onChange={(e) => setForm((c) => ({ ...c, weekdays: e.target.value }))}
            placeholder={WEEKDAYS.join(",")}
          />
        </Field>
      ) : null}
      <Field label="Timezone">
        <input className={inputClass} value={form.timezone} onChange={(e) => setForm((c) => ({ ...c, timezone: e.target.value }))} />
      </Field>
      <Field label="Start date">
        <DatePickerPresets value={form.startDate} onChange={(value) => setForm((c) => ({ ...c, startDate: value }))} placeholder="Start" className="h-9" />
      </Field>
      <Field label="End date">
        <DatePickerPresets value={form.endDate} onChange={(value) => setForm((c) => ({ ...c, endDate: value }))} placeholder="End" className="h-9" />
      </Field>
      <Field label="Misfire handling">
        <FluentSelect
          ariaLabel="Misfire handling"
          className="w-full"
          value={form.misfireHandling}
          onChange={(value) => setForm((c) => ({ ...c, misfireHandling: value }))}
          options={[
            { value: "SKIP", label: "Skip" },
            { value: "RUN_IMMEDIATELY", label: "Run immediately" },
            { value: "DEFER_TO_NEXT_WINDOW", label: "Defer to next window" },
          ]}
        />
      </Field>
      <Field label="Max retries">
        <input
          className={inputClass}
          type="number"
          min={0}
          value={form.maxRetryAttempts}
          onChange={(e) => setForm((c) => ({ ...c, maxRetryAttempts: e.target.value }))}
        />
      </Field>
      <Field label="Active">
        <FluentSelect
          ariaLabel="Active"
          className="w-full"
          value={form.isActive}
          onChange={(value) => setForm((c) => ({ ...c, isActive: value }))}
          options={[
            { value: "true", label: "Active" },
            { value: "false", label: "Inactive" },
          ]}
        />
      </Field>
    </div>
  )

  const renderSmtpFields = (form: ReturnType<typeof emptySmtpForm>, setForm: typeof setSmtpForm, isEdit: boolean) => (
    <div className="grid gap-3 md:grid-cols-2">
      <FluentField label="Name" required>
        <FluentInput value={form.name} onChange={(_, data) => setForm((c) => ({ ...c, name: data.value }))} />
      </FluentField>
      <FluentField label="Host" required>
        <FluentInput value={form.host} onChange={(_, data) => setForm((c) => ({ ...c, host: data.value }))} />
      </FluentField>
      <FluentField label="Port">
        <FluentInput type="number" value={form.port} onChange={(_, data) => setForm((c) => ({ ...c, port: data.value }))} />
      </FluentField>
      <FluentField label="Security">
        <FluentSelect
          ariaLabel="Security"
          className="w-full"
          value={form.securityType}
          onChange={(value) => setForm((c) => ({ ...c, securityType: value }))}
          options={SECURITY_TYPES.map((value) => ({ value, label: value }))}
        />
      </FluentField>
      <FluentField label="Username">
        <FluentInput value={form.username} onChange={(_, data) => setForm((c) => ({ ...c, username: data.value }))} />
      </FluentField>
      <FluentField label={isEdit ? "Password (leave blank to keep)" : "Password"}>
        <FluentInput
          type="password"
          value={form.password}
          onChange={(_, data) => setForm((c) => ({ ...c, password: data.value }))}
          autoComplete="new-password"
        />
      </FluentField>
      <FluentField label="Sender name">
        <FluentInput value={form.senderName} onChange={(_, data) => setForm((c) => ({ ...c, senderName: data.value }))} />
      </FluentField>
      <FluentField label="Sender email" required>
        <FluentInput
          type="email"
          value={form.senderEmail}
          onChange={(_, data) => setForm((c) => ({ ...c, senderEmail: data.value }))}
        />
      </FluentField>
      <FluentField label="Reply-to email">
        <FluentInput
          type="email"
          value={form.replyToEmail}
          onChange={(_, data) => setForm((c) => ({ ...c, replyToEmail: data.value }))}
        />
      </FluentField>
      <FluentField label="Connection timeout (ms)">
        <FluentInput
          type="number"
          value={form.connectionTimeoutMs}
          onChange={(_, data) => setForm((c) => ({ ...c, connectionTimeoutMs: data.value }))}
        />
      </FluentField>
      <FluentField label="Status">
        <Switch
          checked={form.isActive === "true"}
          label={form.isActive === "true" ? "Active" : "Inactive"}
          onChange={(_, data) => setForm((c) => ({ ...c, isActive: String(data.checked) }))}
        />
      </FluentField>
      <FluentField label="Default configuration">
        <Switch
          checked={form.isDefault === "true"}
          label={form.isDefault === "true" ? "Default" : "Not default"}
          onChange={(_, data) => setForm((c) => ({ ...c, isDefault: String(data.checked) }))}
        />
      </FluentField>
      <Card className="grid gap-3 p-4 md:col-span-2" appearance="subtle">
        <div>
          <Text weight="semibold" size={200}>Draft SMTP test</Text>
          <Text as="p" size={200} className="mt-1 text-muted-foreground">
            Test the form values before saving. If you are editing an authenticated SMTP server, include the password if the connection needs it.
          </Text>
        </div>
        <FluentField label="Test recipient email" required>
          <FluentInput
            type="email"
            value={smtpDraftTestRecipient}
            onChange={(_, data) => setSmtpDraftTestRecipient(data.value)}
            placeholder="name@example.com"
          />
        </FluentField>
        <div className="flex justify-end">
          <FluentButton
            type="button"
            appearance="outline"
            icon={testingDraftSmtp ? <FluentLoadingIndicator className="size-3.5" /> : <SendIcon className="size-3.5" />}
            disabled={testingDraftSmtp || !smtpDraftTestRecipient.trim()}
            onClick={() => void onTestDraftSmtp()}
          >
            {testingDraftSmtp ? "Testing…" : "Send draft test"}
          </FluentButton>
        </div>
      </Card>
    </div>
  )

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {smtpOnly ? "Email delivery" : "Reports"}
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {smtpOnly ? "SMTP Settings" : "Scheduled Reporting"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {smtpOnly
              ? "Manage the company SMTP used by employee invitations and scheduled reports."
              : "Review available report definitions, then configure templates, schedules, and execution history."}
          </p>
        </div>
      </div>

      {smtpOnly && <MailRoutingNotice />}
      {!smtpOnly ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-border/80">
        {TABS.filter((entry) => entry.id !== "smtp").map((entry) => {
          const active = tab === entry.id
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                "border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {entry.label}
            </button>
          )
        })}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <ResizableTable
        title={sectionTitle}
        data={rows}
        columns={columns}
        loading={loading}
        itemsPerPage={20}
        showExport={false}
        storageKey={`scheduled-reporting-${tab}`}
        toolbarStart={
          <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {smtpOnly ? "Company email" : "Scheduled Reporting"}
            </span>
            <h2 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {sectionTitle}
            </h2>
          </div>
        }
        toolbarActions={
          <>
            <input
              className="h-8 w-36 rounded-lg border border-border bg-background px-2 text-xs sm:w-48"
              placeholder="Search…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {tab === "templates" ? (
              <>
                <FluentSelect
                  ariaLabel="Filter by definition"
                  size="small"
                  value={templateDefinitionFilter}
                  placeholder="All definitions"
                  onChange={(value) => setTemplateDefinitionFilter(value)}
                  options={[
                    { value: "", label: "All definitions" },
                    ...definitions.flatMap((row) => {
                      const id = definitionId(row)
                      if (id === null) return []
                      return [{ value: String(id), label: optionLabel(row) }]
                    }),
                  ]}
                />
                <FluentSelect
                  ariaLabel="Filter by SMTP"
                  size="small"
                  value={templateSmtpFilter}
                  placeholder="All SMTP"
                  onChange={(value) => setTemplateSmtpFilter(value)}
                  options={[
                    { value: "", label: "All SMTP" },
                    ...smtpConfigs.flatMap((row) => {
                      const id = smtpConfigId(row)
                      if (id === null) return []
                      return [{ value: String(id), label: optionLabel(row) }]
                    }),
                  ]}
                />
                <FluentSelect
                  ariaLabel="Filter by status"
                  size="small"
                  value={isActiveFilter}
                  placeholder="All status"
                  onChange={(value) => setIsActiveFilter(value)}
                  options={[
                    { value: "", label: "All status" },
                    { value: "true", label: "Active" },
                    { value: "false", label: "Inactive" },
                  ]}
                />
              </>
            ) : null}
            {tab === "schedules" ? (
              <>
                <FluentSelect
                  ariaLabel="Filter by template"
                  size="small"
                  value={scheduleTemplateFilter}
                  placeholder="All templates"
                  onChange={(value) => setScheduleTemplateFilter(value)}
                  options={[
                    { value: "", label: "All templates" },
                    ...templates.flatMap((row) => {
                      const id = readNumber(row, ["id"])
                      if (id === null) return []
                      return [{ value: String(id), label: optionLabel(row) }]
                    }),
                  ]}
                />
                <FluentSelect
                  ariaLabel="Filter by schedule type"
                  size="small"
                  value={scheduleTypeFilter}
                  placeholder="All types"
                  onChange={(value) => setScheduleTypeFilter(value)}
                  options={[
                    { value: "", label: "All types" },
                    ...SCHEDULE_TYPES.map((value) => ({ value, label: prettify(value) })),
                  ]}
                />
                <FluentSelect
                  ariaLabel="Filter by status"
                  size="small"
                  value={isActiveFilter}
                  placeholder="All status"
                  onChange={(value) => setIsActiveFilter(value)}
                  options={[
                    { value: "", label: "All status" },
                    { value: "true", label: "Active" },
                    { value: "false", label: "Inactive" },
                  ]}
                />
              </>
            ) : null}
            {tab === "executions" ? (
              <>
                <FluentSelect
                  ariaLabel="Filter by execution status"
                  size="small"
                  value={statusFilter}
                  placeholder="All statuses"
                  onChange={(value) => setStatusFilter(value)}
                  options={[
                    { value: "", label: "All statuses" },
                    ...EXECUTION_STATUSES.map((status) => ({ value: status, label: prettify(status) })),
                  ]}
                />
                <FluentSelect
                  ariaLabel="Filter by template"
                  size="small"
                  value={executionTemplateFilter}
                  placeholder="All templates"
                  onChange={(value) => setExecutionTemplateFilter(value)}
                  options={[
                    { value: "", label: "All templates" },
                    ...templates.flatMap((row) => {
                      const id = readNumber(row, ["id"])
                      if (id === null) return []
                      return [{ value: String(id), label: optionLabel(row) }]
                    }),
                  ]}
                />
                <FluentSelect
                  ariaLabel="Filter by schedule"
                  size="small"
                  value={executionScheduleFilter}
                  placeholder="All schedules"
                  onChange={(value) => setExecutionScheduleFilter(value)}
                  options={[
                    { value: "", label: "All schedules" },
                    ...schedules.flatMap((row) => {
                      const id = readNumber(row, ["id"])
                      if (id === null) return []
                      return [{ value: String(id), label: optionLabel(row) }]
                    }),
                  ]}
                />
                <FluentSelect
                  ariaLabel="Filter by email delivery"
                  size="small"
                  value={executionEmailFilter}
                  placeholder="All email delivery"
                  onChange={(value) => setExecutionEmailFilter(value)}
                  options={[
                    { value: "", label: "All email delivery" },
                    ...EXECUTION_EMAIL_DELIVERY_STATUSES.map((status) => ({
                      value: status,
                      label: prettify(status),
                    })),
                  ]}
                />
                <FluentSelect
                  ariaLabel="Filter by source"
                  size="small"
                  value={executionSourceFilter}
                  placeholder="All sources"
                  onChange={(value) => setExecutionSourceFilter(value)}
                  options={[
                    { value: "", label: "All sources" },
                    ...EXECUTION_SOURCES.map((source) => ({ value: source, label: prettify(source) })),
                  ]}
                />
              </>
            ) : null}
            {tab === "smtp" ? (
              <>
                <FluentSelect
                  ariaLabel="Filter by status"
                  size="small"
                  value={isActiveFilter}
                  placeholder="All status"
                  onChange={(value) => setIsActiveFilter(value)}
                  options={[
                    { value: "", label: "All status" },
                    { value: "true", label: "Active" },
                    { value: "false", label: "Inactive" },
                  ]}
                />
                <FluentSelect
                  ariaLabel="Filter by default state"
                  size="small"
                  value={smtpDefaultFilter}
                  placeholder="All default states"
                  onChange={(value) => setSmtpDefaultFilter(value)}
                  options={[
                    { value: "", label: "All default states" },
                    { value: "true", label: "Default only" },
                    { value: "false", label: "Non-default" },
                  ]}
                />
              </>
            ) : null}
            {canCreate ? (
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold !text-white transition hover:brightness-95"
                onClick={openCreate}
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab === "smtp" ? "Add SMTP" : "Create"}</span>
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border transition hover:bg-muted disabled:opacity-60"
              disabled={loading}
              onClick={() => void loadRows()}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCwIcon className={cn("h-3.5 w-3.5 text-primary", loading && "animate-spin")} />
            </button>
          </>
        }
        onRowSelect={(_, row) => {
          if (!row) return
          if (tab === "definitions") {
            openDefinition(row)
            return
          }
          if (tab === "executions") {
            void openExecution(row)
            return
          }
          void openConfigDetail(row)
        }}
      />

      {tab === "smtp" && !loading && rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground">No SMTP configurations yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a mail server so scheduled reports can be delivered to recipients.
          </p>
          <button
            type="button"
            className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold !text-white transition hover:brightness-95"
            onClick={openCreate}
          >
            <PlusIcon className="size-3.5" />
            Add SMTP configuration
          </button>
        </div>
      ) : null}

      {/* Create / Edit dialogs */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="flex max-h-[90vh] w-[min(920px,96vw)] flex-col overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create {sectionTitle.toLowerCase()}</DialogTitle>
            <DialogDescription>
              {tab === "smtp"
                ? "Fill in SMTP details and save. You can test a saved configuration from its row."
                : "Fill in the required fields and save."}
            </DialogDescription>
          </DialogHeader>
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {tab === "templates"
              ? renderTemplateFields(templateForm, setTemplateForm)
              : tab === "schedules"
                ? renderScheduleFields(scheduleForm, setScheduleForm)
                : tab === "smtp"
                  ? renderSmtpFields(smtpForm, setSmtpForm, false)
                  : null}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-semibold !text-white disabled:opacity-60"
                disabled={saving}
                onClick={() => void onCreate()}
              >
                {saving ? "Saving…" : "Create"}
              </button>
            </div>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogPopup className="flex max-h-[90vh] w-[min(920px,96vw)] flex-col overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit {sectionTitle.toLowerCase()}</DialogTitle>
            <DialogDescription>Update configuration and save changes.</DialogDescription>
          </DialogHeader>
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {tab === "templates"
              ? renderTemplateFields(templateForm, setTemplateForm)
              : tab === "schedules"
                ? renderScheduleFields(scheduleForm, setScheduleForm)
                : tab === "smtp"
                  ? renderSmtpFields(smtpForm, setSmtpForm, true)
                  : null}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-semibold !text-white disabled:opacity-60"
                disabled={saving}
                onClick={() => void onEdit()}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={runTemplateOpen}
        onOpenChange={(open) => {
          setRunTemplateOpen(open)
          if (!open) {
            setRunTemplateId("")
            setRunTemplateForm(emptyTemplateRunForm())
            setFormError(null)
          }
        }}
      >
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Run template now</DialogTitle>
            <DialogDescription>
              Start a one-off execution for template #{runTemplateId || "—"}. Dates are optional and only needed when you want a custom range.
            </DialogDescription>
          </DialogHeader>
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Start date">
              <DatePickerPresets
                value={runTemplateForm.dateFrom}
                onChange={(value) => setRunTemplateForm((current) => ({ ...current, dateFrom: value }))}
                placeholder="Start date"
                className="h-9"
              />
            </Field>
            <Field label="End date">
              <DatePickerPresets
                value={runTemplateForm.dateTo}
                onChange={(value) => setRunTemplateForm((current) => ({ ...current, dateTo: value }))}
                placeholder="End date"
                className="h-9"
              />
            </Field>
            <Field label="Output format" className="md:col-span-2">
              <FluentSelect
                ariaLabel="Output format"
                className="w-full"
                value={runTemplateForm.outputFormat}
                onChange={(value) =>
                  setRunTemplateForm((current) => ({ ...current, outputFormat: value }))
                }
                options={OUTPUT_FORMATS.map((value) => ({ value, label: value }))}
              />
            </Field>
          </div>
          <DialogFooter>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium"
              disabled={runningTemplateId === runTemplateId}
              onClick={() => setRunTemplateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold !text-white disabled:opacity-60"
              disabled={runningTemplateId === runTemplateId}
              onClick={() => void onRunTemplate()}
            >
              {runningTemplateId === runTemplateId ? (
                <FluentLoadingIndicator className="size-3.5 animate-spin" />
              ) : (
                <PlayIcon className="size-3.5" />
              )}
              {runningTemplateId === runTemplateId ? "Starting…" : "Run template"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={smtpTestOpen}
        onOpenChange={(open) => {
          setSmtpTestOpen(open)
          if (!open) setSmtpTestRecipient("")
        }}
      >
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Test SMTP</DialogTitle>
            <DialogDescription>
              Send a test message using this saved SMTP configuration.
            </DialogDescription>
          </DialogHeader>
          <Field label="Test recipient email">
            <input
              className={inputClass}
              type="email"
              placeholder="name@example.com"
              value={smtpTestRecipient}
              onChange={(event) => setSmtpTestRecipient(event.target.value)}
              autoComplete="email"
              autoFocus
            />
          </Field>
          <DialogFooter>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium"
              disabled={testingSmtpId === smtpTestId}
              onClick={() => setSmtpTestOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold !text-white disabled:opacity-60"
              disabled={testingSmtpId === smtpTestId || !smtpTestRecipient.trim()}
              onClick={() => void onTestSmtp()}
            >
              {testingSmtpId === smtpTestId ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <SendIcon className="size-3.5" />}
              {testingSmtpId === smtpTestId ? "Testing…" : "Send test"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {sectionTitle.toLowerCase()}</DialogTitle>
            <DialogDescription>
              This permanently removes record #{deletingId || "—"}. Continue only if you are sure.
            </DialogDescription>
          </DialogHeader>
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          <DialogFooter>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg bg-rose-600 px-3 text-sm font-semibold !text-white disabled:opacity-60"
              disabled={saving}
              onClick={() => void onDelete()}
            >
              {saving ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Sheet
        open={detailSheetOpen}
        onOpenChange={(open) => {
          setDetailSheetOpen(open)
          if (!open) {
            setDetailLoading(false)
            setDetailRecord(null)
          }
        }}
      >
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border bg-muted/20 px-4 py-3 pr-12">
            <SheetDescription className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {tab === "templates"
                ? "Template detail"
                : tab === "schedules"
                  ? "Schedule detail"
                  : "SMTP configuration detail"}
            </SheetDescription>
            <SheetTitle className="text-base font-semibold">
              {detailRecord
                ? readString(
                    detailRecord,
                    ["name"],
                    tab === "templates"
                      ? "Template"
                      : tab === "schedules"
                        ? "Schedule"
                        : "SMTP configuration",
                  )
                : tab === "templates"
                  ? "Template"
                  : tab === "schedules"
                    ? "Schedule"
                    : "SMTP configuration"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-3 overflow-y-auto p-4">
            {detailLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FluentLoadingIndicator className="size-4 animate-spin text-primary" />
                Loading…
              </div>
            ) : null}
            {detailRecord ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {tab === "smtp" ? (
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium"
                      onClick={() => openSmtpTest(detailRecord)}
                    >
                      <SendIcon className="size-3.5" />
                      Test SMTP
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium"
                    onClick={() => {
                      setDetailSheetOpen(false)
                      void openEditRecord(detailRecord)
                    }}
                  >
                    <PencilIcon className="size-3.5" />
                    Edit
                  </button>
                  {tab === "smtp" ? (
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:text-rose-300"
                      onClick={() => {
                        setDeletingId(getRowId(detailRecord))
                        setDetailSheetOpen(false)
                        setDeleteOpen(true)
                      }}
                    >
                      <Trash2Icon className="size-3.5" />
                      Delete
                    </button>
                  ) : null}
                </div>

                {tab === "templates" ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        [
                          "Report",
                          readRelatedLabel(
                            detailRecord,
                            ["reportDefinitionId", "report_definition_id"],
                            ["reportDefinition", "report_definition"],
                            definitionNameById,
                          ),
                        ],
                        [
                          "SMTP",
                          readRelatedLabel(
                            detailRecord,
                            ["smtpConfigurationId", "smtp_configuration_id"],
                            ["smtpConfiguration", "smtp_configuration"],
                            smtpNameById,
                          ),
                        ],
                        ["Format", readString(detailRecord, ["outputFormat", "output_format"], "—")],
                        ["Date range", prettify(readString(detailRecord, ["dateRangeStrategy", "date_range_strategy"], "—"))],
                        ["Attach report", formatAttachLabel(detailRecord)],
                        ["Status", formatActiveLabel(detailRecord)],
                        ["Created", formatDateTime(detailRecord.createdAt ?? detailRecord.created_at)],
                        ["Updated", formatDateTime(detailRecord.updatedAt ?? detailRecord.updated_at)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {label}
                          </p>
                          <p className="text-xs font-medium text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                    {readString(detailRecord, ["description"]) ? (
                      <div className="rounded-md border border-border bg-background px-3 py-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Description
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                          {readString(detailRecord, ["description"])}
                        </p>
                      </div>
                    ) : null}
                    {readString(detailRecord, ["filenamePattern", "filename_pattern"]) ? (
                      <div className="rounded-md border border-border bg-background px-3 py-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Filename pattern
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {readString(detailRecord, ["filenamePattern", "filename_pattern"])}
                        </p>
                      </div>
                    ) : null}
                    {readString(detailRecord, ["emailSubjectTemplate", "email_subject_template"]) ? (
                      <div className="rounded-md border border-border bg-background px-3 py-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Email subject
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {readString(detailRecord, ["emailSubjectTemplate", "email_subject_template"])}
                        </p>
                      </div>
                    ) : null}
                    {readString(detailRecord, ["emailBodyTemplate", "email_body_template"]) ? (
                      <div className="rounded-md border border-border bg-background px-3 py-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Email body
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                          {readString(detailRecord, ["emailBodyTemplate", "email_body_template"])}
                        </p>
                      </div>
                    ) : null}
                    {asRecordArray(detailRecord.recipients).length > 0 ? (
                      <div className="rounded-md border border-border bg-background px-3 py-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Recipients
                        </p>
                        <div className="mt-2 grid gap-2">
                          {asRecordArray(detailRecord.recipients).map((recipient, index) => (
                            <div key={`detail-template-recipient-${index}`} className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2">
                              <p className="text-xs font-medium text-foreground">
                                {prettify(readString(recipient, ["channel"], "TO"))} · {prettify(readString(recipient, ["recipientType", "recipient_type"], "EMAIL"))}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {recipientTargetLabel(recipient)}
                              </p>
                              {readString(recipient, ["displayName", "display_name"]) ? (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  {readString(recipient, ["displayName", "display_name"])}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {tab === "schedules" ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        [
                          "Template",
                          readRelatedLabel(
                            detailRecord,
                            ["templateId", "template_id"],
                            ["template"],
                            templateNameById,
                          ),
                        ],
                        ["Type", prettify(readString(detailRecord, ["scheduleType", "schedule_type"], "—"))],
                        ["Execution time", readString(detailRecord, ["executionTime", "execution_time"], "—")],
                        ["Timezone", readString(detailRecord, ["timezone"], "—")],
                        ["Misfire", prettify(readString(detailRecord, ["misfireHandling", "misfire_handling"], "—"))],
                        [
                          "Max retries",
                          String(readNumber(detailRecord, ["maxRetryAttempts", "max_retry_attempts"]) ?? "—"),
                        ],
                        ["Status", formatActiveLabel(detailRecord)],
                        ["Created", formatDateTime(detailRecord.createdAt ?? detailRecord.created_at)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {label}
                          </p>
                          <p className="text-xs font-medium text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-2">
                      {[
                        ["Start date", formatDateTime(detailRecord.startDate ?? detailRecord.start_date)],
                        ["End date", formatDateTime(detailRecord.endDate ?? detailRecord.end_date)],
                        ["One-time run", formatDateTime(detailRecord.oneTimeRunAt ?? detailRecord.one_time_run_at)],
                        ["Day of month", readString(detailRecord, ["dayOfMonth", "day_of_month"], "—")],
                        ["Weekdays", Array.isArray(detailRecord.weekdays) ? detailRecord.weekdays.join(", ") : readString(detailRecord, ["weekdays"], "—")],
                        ["Cron expression", readString(detailRecord, ["cronExpression", "cron_expression"], "—")],
                      ]
                        .filter(([, value]) => value && value !== "—")
                        .map(([label, value]) => (
                          <div key={label} className="rounded-md border border-border bg-background px-3 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {label}
                            </p>
                            <p className="text-xs text-foreground">{value}</p>
                          </div>
                        ))}
                    </div>
                  </>
                ) : null}

                {tab === "smtp" ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["Host", `${readString(detailRecord, ["host"], "—")}:${readString(detailRecord, ["port"], "—")}`],
                        ["Security", readString(detailRecord, ["securityType", "security_type"], "—")],
                        ["Sender", readString(detailRecord, ["senderEmail", "sender_email"], "—")],
                        ["Reply-to", readString(detailRecord, ["replyToEmail", "reply_to_email"], "—")],
                        ["Username", readString(detailRecord, ["username"], "—")],
                        ["Timeout", `${readString(detailRecord, ["connectionTimeoutMs", "connection_timeout_ms"], "—")} ms`],
                        ["Default", readBool(detailRecord, ["isDefault", "is_default"]) ? "Yes" : "No"],
                        ["Status", formatActiveLabel(detailRecord)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {label}
                          </p>
                          <p className="text-xs font-medium text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                    {readString(detailRecord, ["senderName", "sender_name"]) ? (
                      <div className="rounded-md border border-border bg-background px-3 py-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Sender name
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {readString(detailRecord, ["senderName", "sender_name"])}
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a record to review its details.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={executionSheetOpen} onOpenChange={setExecutionSheetOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border bg-muted/20 px-4 py-3 pr-12">
            <SheetDescription className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Execution detail
            </SheetDescription>
            <SheetTitle className="text-base font-semibold">
              {executionDetail
                ? `Execution #${getRowId(executionDetail) || "—"}`
                : "Execution"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-3 overflow-y-auto p-4">
            {executionLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FluentLoadingIndicator className="size-4 animate-spin text-primary" />
                Loading…
              </div>
            ) : null}
            {executionDetail ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium disabled:opacity-60"
                    disabled={!canDownloadExecution(executionDetail) || downloadingExecutionId === getRowId(executionDetail)}
                    onClick={() => void onDownloadExecution(executionDetail)}
                  >
                    {downloadingExecutionId === getRowId(executionDetail) ? (
                      <FluentLoadingIndicator className="size-3.5 animate-spin" />
                    ) : (
                      <DownloadIcon className="size-3.5" />
                    )}
                    Download
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium disabled:opacity-60"
                    disabled={!canRetryExecution(executionDetail) || retryingExecutionId === getRowId(executionDetail)}
                    onClick={() => void onRetryExecution(executionDetail)}
                  >
                    {retryingExecutionId === getRowId(executionDetail) ? (
                      <FluentLoadingIndicator className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcwIcon className="size-3.5" />
                    )}
                    Retry
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Status", prettify(readString(executionDetail, ["status"], "—"))],
                    ["Source", prettify(readString(executionDetail, ["source"], "—"))],
                    [
                      "Email delivery",
                      prettify(
                        readString(executionDetail, ["emailDeliveryStatus", "email_delivery_status"], "—")
                      ),
                    ],
                    [
                      "Template",
                      (() => {
                        const id = readNumber(executionDetail, ["templateId", "template_id"])
                        return id !== null ? templateNameById.get(id) ?? `#${id}` : "—"
                      })(),
                    ],
                    [
                      "Schedule",
                      (() => {
                        const id = readNumber(executionDetail, ["scheduleId", "schedule_id"])
                        return id !== null ? scheduleNameById.get(id) ?? `#${id}` : "—"
                      })(),
                    ],
                    [
                      "Retry count",
                      String(readNumber(executionDetail, ["retryCount", "retry_count"]) ?? "—"),
                    ],
                    [
                      "Max retries",
                      String(readNumber(executionDetail, ["maxRetryAttempts", "max_retry_attempts"]) ?? "—"),
                    ],
                    ["Created", formatDateTime(executionDetail.created_at ?? executionDetail.createdAt)],
                    ["Updated", formatDateTime(executionDetail.updated_at ?? executionDetail.updatedAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {label}
                      </p>
                      <p className="text-xs font-medium text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2">
                  {[
                    ["Report file", readString(executionDetail, ["generatedFilename", "generated_filename", "filename", "file_name"], "—")],
                    ["Started", formatDateTime(executionDetail.started_at ?? executionDetail.startedAt)],
                    ["Completed", formatDateTime(executionDetail.completed_at ?? executionDetail.completedAt)],
                    ["Report date from", formatDateTime(executionDetail.reportDateFrom ?? executionDetail.report_date_from)],
                    ["Report date to", formatDateTime(executionDetail.reportDateTo ?? executionDetail.report_date_to)],
                    ["Queue job", readString(executionDetail, ["queueJobId", "queue_job_id"], "—")],
                    ["Idempotency key", readString(executionDetail, ["idempotencyKey", "idempotency_key"], "—")],
                    ["File type", readString(executionDetail, ["generatedFileMimeType", "generated_file_mime_type"], "—")],
                    ["File size", readString(executionDetail, ["generatedFileSize", "generated_file_size"], "—")],
                    [
                      "Records processed",
                      (() => {
                        const count = readNumber(executionDetail, ["recordCount", "record_count", "rowsProcessed", "rows_processed"])
                        return count !== null ? String(count) : "—"
                      })(),
                    ],
                  ]
                    .filter(([, value]) => value && value !== "—")
                    .map(([label, value]) => (
                      <div key={label} className="rounded-md border border-border bg-background px-3 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {label}
                        </p>
                        <p className="text-xs text-foreground">{value}</p>
                      </div>
                    ))}
                </div>
                {asRecordArray(executionDetail.resolvedRecipients).length > 0 ? (
                  <div className="rounded-md border border-border bg-background px-3 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Resolved recipients
                    </p>
                    <div className="mt-2 grid gap-2">
                      {asRecordArray(executionDetail.resolvedRecipients).map((recipient, index) => (
                        <div key={`resolved-recipient-${index}`} className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2">
                          <p className="text-xs font-medium text-foreground">
                            {prettify(readString(recipient, ["channel"], "TO"))} · {prettify(readString(recipient, ["recipientType", "recipient_type"], "EMAIL"))}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {recipientTargetLabel(recipient)}
                          </p>
                          {readString(recipient, ["displayName", "display_name"]) ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {readString(recipient, ["displayName", "display_name"])}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {objectEntries(executionDetail.appliedFilters).length > 0 ? (
                  <div className="rounded-md border border-border bg-background">
                    <div className="border-b border-border px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Applied filters
                      </p>
                    </div>
                    <div className="grid gap-x-4 gap-y-2 px-3 py-3 md:grid-cols-2">
                      {objectEntries(executionDetail.appliedFilters).map(([key, value]) => (
                        <div key={key} className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {prettify(key)}
                          </p>
                          <p className="mt-1 text-xs text-foreground">
                            {formatAdminValue(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {objectEntries(executionDetail.executionMetadata).length > 0 ? (
                  <div className="rounded-md border border-border bg-background">
                    <div className="border-b border-border px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Execution metadata
                      </p>
                    </div>
                    <div className="grid gap-x-4 gap-y-2 px-3 py-3 md:grid-cols-2">
                      {objectEntries(executionDetail.executionMetadata).map(([key, value]) => (
                        <div key={key} className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {prettify(key)}
                          </p>
                          <p className="mt-1 text-xs text-foreground">
                            {formatAdminValue(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {readString(executionDetail, ["error_message", "errorMessage", "message"]) ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                    {readString(executionDetail, ["error_message", "errorMessage", "message"])}
                  </div>
                ) : null}
                {readString(executionDetail, ["technicalDetails", "technical_details"]) ? (
                  <div className="rounded-md border border-border bg-background px-3 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Technical details
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {readString(executionDetail, ["technicalDetails", "technical_details"])}
                    </p>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={definitionSheetOpen}
        onOpenChange={(open) => {
          setDefinitionSheetOpen(open)
          if (!open) setDefinitionDetail(null)
        }}
      >
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border bg-muted/20 px-4 py-3 pr-12">
            <SheetDescription className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Report definition detail
            </SheetDescription>
            <SheetTitle className="text-base font-semibold">
              {definitionDetail
                ? readString(definitionDetail, ["name"], "Report definition")
                : "Report definition"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-3 overflow-y-auto p-4">
            {definitionDetail ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Code", readString(definitionDetail, ["reportCode", "report_code"], "—")],
                    ["Status", readBool(definitionDetail, ["isActive", "is_active"]) ? "Active" : "Inactive"],
                    ["Formats", definitionFormatsLabel(definitionDetail)],
                    ["Generator", readString(definitionDetail, ["generatorService", "generator_service"], "—")],
                    ["Templates", relatedCount(definitionDetail, "templates")],
                    ["Executions", relatedCount(definitionDetail, "executions")],
                    ["Created", formatDateTime(definitionDetail.createdAt ?? definitionDetail.created_at)],
                    ["Updated", formatDateTime(definitionDetail.updatedAt ?? definitionDetail.updated_at)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {label}
                      </p>
                      <p className="text-xs font-medium text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border border-border bg-background px-3 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Description
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {readString(definitionDetail, ["description"], "No description provided.")}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-background px-3 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Supported filters
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {definitionFilterKeysLabel(definitionDetail)}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a definition to review its details.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default ScheduledReportingView
