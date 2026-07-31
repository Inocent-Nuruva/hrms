"use client"

import * as React from "react"
import {
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  createScheduledReportSchedule,
  createScheduledReportSmtpConfiguration,
  createScheduledReportTemplate,
  deleteScheduledReportSchedule,
  deleteScheduledReportSmtpConfiguration,
  deleteScheduledReportTemplate,
  getScheduledReportExecution,
  listScheduledReportDefinitions,
  listScheduledReportExecutions,
  listScheduledReportSchedules,
  listScheduledReportSmtpConfigurations,
  listScheduledReportTemplates,
  testScheduledReportSmtpConfiguration,
  updateScheduledReportSchedule,
  updateScheduledReportSmtpConfiguration,
  updateScheduledReportTemplate,
  type AdminRecord,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { cn } from "@/lib/utils"
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
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

type ReportingTab = "templates" | "schedules" | "executions" | "smtp"

const TABS: Array<{ id: ReportingTab; label: string }> = [
  { id: "templates", label: "Templates" },
  { id: "schedules", label: "Schedules" },
  { id: "executions", label: "Executions" },
  { id: "smtp", label: "SMTP" },
]

const SCHEDULE_TYPES = ["DAILY", "WEEKLY", "MONTHLY", "ONE_TIME", "MANUAL"] as const
const OUTPUT_FORMATS = ["PDF", "XLSX", "CSV"] as const
const DATE_RANGE_STRATEGIES = [
  "CURRENT_DAY",
  "PREVIOUS_DAY",
  "CURRENT_WEEK",
  "PREVIOUS_WEEK",
  "CURRENT_MONTH",
  "PREVIOUS_MONTH",
  "CUSTOM",
  "SCHEDULE_RELATIVE",
] as const
const SECURITY_TYPES = ["NONE", "STARTTLS", "SSL_TLS", "AUTO"] as const
const MISFIRE_HANDLING = ["SKIP", "RUN_IMMEDIATELY", "DEFER_TO_NEXT_WINDOW"] as const
const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const
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
  recipientEmail: "",
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
const selectClass = inputClass
const textareaClass =
  "min-h-20 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"

export function ScheduledReportingView() {
  const [tab, setTab] = React.useState<ReportingTab>("templates")
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [definitions, setDefinitions] = React.useState<AdminRecord[]>([])
  const [templates, setTemplates] = React.useState<AdminRecord[]>([])
  const [smtpConfigs, setSmtpConfigs] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("")

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState("")
  const [deletingId, setDeletingId] = React.useState("")
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const [templateForm, setTemplateForm] = React.useState(emptyTemplateForm)
  const [scheduleForm, setScheduleForm] = React.useState(emptyScheduleForm)
  const [smtpForm, setSmtpForm] = React.useState(emptySmtpForm)

  const [executionSheetOpen, setExecutionSheetOpen] = React.useState(false)
  const [executionDetail, setExecutionDetail] = React.useState<AdminRecord | null>(null)
  const [executionLoading, setExecutionLoading] = React.useState(false)
  const [smtpTestOpen, setSmtpTestOpen] = React.useState(false)
  const [smtpTestId, setSmtpTestId] = React.useState("")
  const [smtpTestRecipient, setSmtpTestRecipient] = React.useState("")
  const [testingSmtpId, setTestingSmtpId] = React.useState("")
  const loadRequestIdRef = React.useRef(0)

  const loadLookups = React.useCallback(async (token: string) => {
    const [defsResult, tmplResult, smtpResult] = await Promise.allSettled([
      listScheduledReportDefinitions(token),
      listScheduledReportTemplates(token, { page: 1, limit: 100 }),
      listScheduledReportSmtpConfigurations(token, { page: 1, limit: 100 }),
    ])
    setDefinitions(
      defsResult.status === "fulfilled"
        ? Array.isArray(defsResult.value)
          ? defsResult.value
          : []
        : []
    )
    setTemplates(tmplResult.status === "fulfilled" ? (tmplResult.value.rows ?? []) : [])
    setSmtpConfigs(smtpResult.status === "fulfilled" ? (smtpResult.value.rows ?? []) : [])
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
      await loadLookups(token)
      const params = {
        page: 1,
        limit: 100,
        sortBy: "created_at",
        sortOrder: "DESC" as const,
        search: search.trim() || undefined,
        status: tab === "executions" && statusFilter ? statusFilter : undefined,
      }

      if (tab === "templates") {
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
  }, [loadLookups, search, statusFilter, tab])

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
    setTemplateForm(emptyTemplateForm())
    setScheduleForm(emptyScheduleForm())
    setSmtpForm(emptySmtpForm())
  }, [tab])

  const openCreate = () => {
    setFormError(null)
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
    if (tab === "templates") {
      setTemplateForm({
        reportDefinitionId: String(readNumber(row, ["reportDefinitionId", "report_definition_id"]) ?? ""),
        smtpConfigurationId: String(readNumber(row, ["smtpConfigurationId", "smtp_configuration_id"]) ?? ""),
        name: readString(row, ["name"]),
        description: readString(row, ["description"]),
        outputFormat: enumValue(readString(row, ["outputFormat", "output_format"], "PDF"), OUTPUT_FORMATS, "PDF"),
        filenamePattern: readString(row, ["filenamePattern", "filename_pattern"]),
        emailSubjectTemplate: readString(row, ["emailSubjectTemplate", "email_subject_template"]),
        emailBodyTemplate: readString(row, ["emailBodyTemplate", "email_body_template"]),
        dateRangeStrategy: enumValue(readString(row, ["dateRangeStrategy", "date_range_strategy"], "CURRENT_DAY"), DATE_RANGE_STRATEGIES, "CURRENT_DAY"),
        attachReport: readBool(row, ["attachReport", "attach_report"]) ? "true" : "false",
        isActive: readBool(row, ["isActive", "is_active"]) ? "true" : "false",
        recipientEmail: "",
      })
    } else if (tab === "schedules") {
      const weekdays = row.weekdays
      const weekdayValue = Array.isArray(weekdays)
        ? weekdays.map(String).join(",")
        : readString(row, ["weekdays"], "MONDAY")
      setScheduleForm({
        templateId: String(readNumber(row, ["templateId", "template_id"]) ?? ""),
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
    const payload: AdminRecord = {
      reportDefinitionId: Number(form.reportDefinitionId),
      smtpConfigurationId: Number(form.smtpConfigurationId),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      outputFormat: enumValue(form.outputFormat, OUTPUT_FORMATS, "PDF"),
      filenamePattern: form.filenamePattern.trim() || undefined,
      emailSubjectTemplate: form.emailSubjectTemplate.trim() || undefined,
      emailBodyTemplate: form.emailBodyTemplate.trim() || undefined,
      dateRangeStrategy: enumValue(form.dateRangeStrategy, DATE_RANGE_STRATEGIES, "CURRENT_DAY"),
      attachReport: form.attachReport === "true",
      isActive: form.isActive === "true",
    }
    if (form.recipientEmail.trim()) {
      payload.recipients = [
        {
          channel: "TO",
          recipientType: "EMAIL",
          emailAddress: form.recipientEmail.trim(),
          displayName: form.recipientEmail.trim(),
        },
      ]
    }
    return payload
  }

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
      dayOfMonth: form.scheduleType === "MONTHLY" ? Number(form.dayOfMonth) || 1 : undefined,
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
        if (!templateForm.smtpConfigurationId) {
          missing.push(
            smtpConfigs.length === 0
              ? "SMTP configuration (create one under the SMTP tab first)"
              : "SMTP configuration"
          )
        }
        if (missing.length) {
          throw new Error(`${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required.`)
        }
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
      setExecutionDetail(detail ?? row)
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Failed to load execution.")
    } finally {
      setExecutionLoading(false)
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

  const templateNameById = React.useMemo(() => {
    const map = new Map<number, string>()
    templates.forEach((row) => {
      const id = readNumber(row, ["id"])
      if (id !== null) map.set(id, optionLabel(row))
    })
    return map
  }, [templates])

  const definitionNameById = React.useMemo(() => {
    const map = new Map<number, string>()
    definitions.forEach((row) => {
      const id = readNumber(row, ["id"])
      if (id !== null) map.set(id, optionLabel(row))
    })
    return map
  }, [definitions])

  const columns = React.useMemo<Array<Column<AdminRecord>>>(() => {
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
          render: (row) => {
            const id = readNumber(row, ["reportDefinitionId", "report_definition_id"])
            return (
              <span className="text-xs text-muted-foreground">
                {id !== null ? definitionNameById.get(id) ?? `#${id}` : "—"}
              </span>
            )
          },
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
          defaultWidth: 70,
          sortable: false,
          render: (row) => (
            <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
              <button className="admin-table-icon-button" type="button" aria-label="Edit" onClick={() => fillEditFromRow(row)}>
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
          render: (row) => {
            const id = readNumber(row, ["templateId", "template_id"])
            return (
              <span className="text-xs text-muted-foreground">
                {id !== null ? templateNameById.get(id) ?? `#${id}` : "—"}
              </span>
            )
          },
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
          defaultWidth: 70,
          sortable: false,
          render: (row) => (
            <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
              <button className="admin-table-icon-button" type="button" aria-label="Edit" onClick={() => fillEditFromRow(row)}>
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
            const id = readNumber(row, ["templateId", "template_id"])
            return (
              <span className="text-xs">
                {id !== null ? templateNameById.get(id) ?? `#${id}` : readString(row, ["template_name", "name"], "—")}
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
          defaultWidth: 70,
          sortable: false,
          render: (row) => (
            <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                onClick={() => void openExecution(row)}
              >
                View
              </button>
            </div>
          ),
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
        defaultWidth: 95,
        sortable: false,
        render: (row) => (
          <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            <button
              className="admin-table-icon-button"
              type="button"
              aria-label="Test SMTP"
              title="Test"
              onClick={() => openSmtpTest(row)}
              disabled={testingSmtpId === getRowId(row)}
            >
              {testingSmtpId === getRowId(row) ? (
                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <SendIcon className="h-3.5 w-3.5" />
              )}
            </button>
            <button className="admin-table-icon-button" type="button" aria-label="Edit" onClick={() => fillEditFromRow(row)}>
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
  }, [
    definitionNameById,
    fillEditFromRow,
    openSmtpTest,
    openExecution,
    tab,
    templateNameById,
    testingSmtpId,
  ])

  const sectionTitle =
    tab === "templates"
      ? "Templates"
      : tab === "schedules"
        ? "Schedules"
        : tab === "executions"
          ? "Executions"
          : "SMTP configurations"

  const canCreate = tab !== "executions"

  const renderTemplateFields = (form: ReturnType<typeof emptyTemplateForm>, setForm: typeof setTemplateForm) => (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Name *">
        <input className={inputClass} value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} />
      </Field>
      <Field label="Output format">
        <select className={selectClass} value={form.outputFormat} onChange={(e) => setForm((c) => ({ ...c, outputFormat: e.target.value }))}>
          {OUTPUT_FORMATS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Report definition *">
        <select
          className={cn(selectClass, !form.reportDefinitionId && "border-amber-400")}
          value={form.reportDefinitionId}
          onChange={(e) => setForm((c) => ({ ...c, reportDefinitionId: e.target.value }))}
        >
          <option value="">Select definition</option>
          {definitions.map((row, index) => {
            const id = definitionId(row)
            if (id === null) return null
            return (
              <option key={`def-${id}-${index}`} value={String(id)}>
                {optionLabel(row)}
              </option>
            )
          })}
        </select>
        {definitions.length === 0 ? (
          <span className="text-[11px] text-amber-700 dark:text-amber-300">
            No report definitions loaded. Refresh the page or check permissions.
          </span>
        ) : null}
      </Field>
      <Field label="SMTP configuration *">
        <select
          className={cn(selectClass, !form.smtpConfigurationId && "border-amber-400")}
          value={form.smtpConfigurationId}
          onChange={(e) => setForm((c) => ({ ...c, smtpConfigurationId: e.target.value }))}
        >
          <option value="">Select SMTP</option>
          {smtpConfigs.map((row, index) => {
            const id = smtpConfigId(row)
            if (id === null) return null
            const label = optionLabel(row)
            const isDefault = readBool(row, ["isDefault", "is_default"])
            return (
              <option key={`smtp-${id}-${index}`} value={String(id)}>
                {isDefault ? `${label} (default)` : label}
              </option>
            )
          })}
        </select>
        {smtpConfigs.length === 0 ? (
          <span className="text-[11px] text-amber-700 dark:text-amber-300">
            No SMTP settings yet. Open the{" "}
            <button
              type="button"
              className="font-semibold underline underline-offset-2"
              onClick={() => {
                setCreateOpen(false)
                setTab("smtp")
              }}
            >
              SMTP tab
            </button>{" "}
            and create one first, then return to create the template.
          </span>
        ) : !form.smtpConfigurationId ? (
          <span className="text-[11px] text-amber-700 dark:text-amber-300">
            Choose which SMTP server should send this report.
          </span>
        ) : null}
      </Field>
      <Field label="Date range strategy">
        <select
          className={selectClass}
          value={form.dateRangeStrategy}
          onChange={(e) => setForm((c) => ({ ...c, dateRangeStrategy: e.target.value }))}
        >
          {DATE_RANGE_STRATEGIES.map((value) => (
            <option key={value} value={value}>
              {prettify(value)}
            </option>
          ))}
        </select>
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
      <Field label="Recipient email (optional)">
        <input
          className={inputClass}
          type="email"
          value={form.recipientEmail}
          onChange={(e) => setForm((c) => ({ ...c, recipientEmail: e.target.value }))}
          placeholder="hr@company.com"
        />
      </Field>
      <Field label="Description" className="md:col-span-2">
        <textarea
          className={textareaClass}
          value={form.description}
          onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
        />
      </Field>
      <Field label="Email body" className="md:col-span-2">
        <textarea
          className={textareaClass}
          value={form.emailBodyTemplate}
          onChange={(e) => setForm((c) => ({ ...c, emailBodyTemplate: e.target.value }))}
        />
      </Field>
      <Field label="Attach report">
        <select className={selectClass} value={form.attachReport} onChange={(e) => setForm((c) => ({ ...c, attachReport: e.target.value }))}>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </Field>
      <Field label="Active">
        <select className={selectClass} value={form.isActive} onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.value }))}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </Field>
    </div>
  )

  const renderScheduleFields = (form: ReturnType<typeof emptyScheduleForm>, setForm: typeof setScheduleForm) => (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Name *">
        <input className={inputClass} value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} />
      </Field>
      <Field label="Template *">
        <select className={selectClass} value={form.templateId} onChange={(e) => setForm((c) => ({ ...c, templateId: e.target.value }))}>
          <option value="">Select template</option>
          {templates.map((row, index) => {
            const id = readNumber(row, ["id"])
            if (id === null) return null
            return (
              <option key={`tmpl-${id}-${index}`} value={String(id)}>
                {optionLabel(row)}
              </option>
            )
          })}
        </select>
      </Field>
      <Field label="Schedule type">
        <select className={selectClass} value={form.scheduleType} onChange={(e) => setForm((c) => ({ ...c, scheduleType: e.target.value }))}>
          {SCHEDULE_TYPES.map((value) => (
            <option key={value} value={value}>
              {prettify(value)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Execution time">
        <input
          className={inputClass}
          value={form.executionTime}
          onChange={(e) => setForm((c) => ({ ...c, executionTime: e.target.value }))}
          placeholder="08:00"
        />
      </Field>
      {form.scheduleType === "MONTHLY" ? (
        <Field label="Day of month">
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
        <select className={selectClass} value={form.misfireHandling} onChange={(e) => setForm((c) => ({ ...c, misfireHandling: e.target.value }))}>
          <option value="SKIP">Skip</option>
          <option value="RUN_IMMEDIATELY">Run immediately</option>
          <option value="DEFER_TO_NEXT_WINDOW">Defer to next window</option>
        </select>
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
        <select className={selectClass} value={form.isActive} onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.value }))}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </Field>
    </div>
  )

  const renderSmtpFields = (form: ReturnType<typeof emptySmtpForm>, setForm: typeof setSmtpForm, isEdit: boolean) => (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Name *">
        <input className={inputClass} value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} />
      </Field>
      <Field label="Host *">
        <input className={inputClass} value={form.host} onChange={(e) => setForm((c) => ({ ...c, host: e.target.value }))} />
      </Field>
      <Field label="Port">
        <input className={inputClass} type="number" value={form.port} onChange={(e) => setForm((c) => ({ ...c, port: e.target.value }))} />
      </Field>
      <Field label="Security">
        <select className={selectClass} value={form.securityType} onChange={(e) => setForm((c) => ({ ...c, securityType: e.target.value }))}>
          {SECURITY_TYPES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Username">
        <input className={inputClass} value={form.username} onChange={(e) => setForm((c) => ({ ...c, username: e.target.value }))} />
      </Field>
      <Field label={isEdit ? "Password (leave blank to keep)" : "Password"}>
        <input
          className={inputClass}
          type="password"
          value={form.password}
          onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Sender name">
        <input className={inputClass} value={form.senderName} onChange={(e) => setForm((c) => ({ ...c, senderName: e.target.value }))} />
      </Field>
      <Field label="Sender email *">
        <input
          className={inputClass}
          type="email"
          value={form.senderEmail}
          onChange={(e) => setForm((c) => ({ ...c, senderEmail: e.target.value }))}
        />
      </Field>
      <Field label="Reply-to email">
        <input
          className={inputClass}
          type="email"
          value={form.replyToEmail}
          onChange={(e) => setForm((c) => ({ ...c, replyToEmail: e.target.value }))}
        />
      </Field>
      <Field label="Connection timeout (ms)">
        <input
          className={inputClass}
          type="number"
          value={form.connectionTimeoutMs}
          onChange={(e) => setForm((c) => ({ ...c, connectionTimeoutMs: e.target.value }))}
        />
      </Field>
      <Field label="Active">
        <select className={selectClass} value={form.isActive} onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.value }))}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </Field>
      <Field label="Default">
        <select className={selectClass} value={form.isDefault} onChange={(e) => setForm((c) => ({ ...c, isDefault: e.target.value }))}>
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </Field>
    </div>
  )

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Reports
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Scheduled Reporting</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Configure templates, schedules, SMTP delivery, and review execution history.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-border/80">
        {TABS.map((entry) => {
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
              Scheduled Reporting
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
            {tab === "executions" ? (
              <select
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                {EXECUTION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {prettify(status)}
                  </option>
                ))}
              </select>
            ) : null}
            {canCreate ? (
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold !text-white transition hover:brightness-95"
                onClick={openCreate}
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Create</span>
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
          if (tab === "executions") {
            void openExecution(row)
            return
          }
          fillEditFromRow(row)
        }}
      />

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
              {testingSmtpId === smtpTestId ? <Loader2Icon className="size-3.5 animate-spin" /> : <SendIcon className="size-3.5" />}
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
                <Loader2Icon className="size-4 animate-spin text-primary" />
                Loading…
              </div>
            ) : null}
            {executionDetail ? (
              <>
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
                {readString(executionDetail, ["error_message", "errorMessage", "message"]) ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                    {readString(executionDetail, ["error_message", "errorMessage", "message"])}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default ScheduledReportingView
