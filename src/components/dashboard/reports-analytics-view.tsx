"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import Link from "next/link"
import { BarChart3Icon, DownloadIcon, FileSpreadsheetIcon, PlayIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store"

import {
  downloadOperationalAnalyticsReport,
  downloadAnalyticsExport,
  deleteSavedAnalyticsReport,
  exportAnalyticsReport,
  getAnalyticsDashboard,
  getAnalyticsReportCatalog,
  listDepartments,
  listOperationalAnalyticsReports,
  listAnalyticsDatasets,
  listSavedAnalyticsReports,
  runOperationalAnalyticsReport,
  runAnalyticsCustomReport,
  runSavedAnalyticsReport,
  saveAnalyticsReport,
  updateSavedAnalyticsReport,
  type AdminRecord,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

type CatalogReport = {
  code: string
  name: string
  data_source?: string | null
  required_permissions?: string[]
  implementation_status?: string
  exports?: string[]
}

type CatalogCategory = {
  name: string
  reports: CatalogReport[]
}

type ReportUiConfig = {
  columns: string[]
  cards: Array<{ label: string; field?: string; count?: true }>
}

const REPORT_UI: Record<string, ReportUiConfig> = {
  LEAVE_BALANCE: {
    columns: ["employee_number", "employee_name", "department", "leave_type", "used", "pending", "remaining_balance", "fiscal_year"],
    cards: [{ label: "Rows", count: true }, { label: "Remaining days", field: "remaining_balance" }, { label: "Used days", field: "used" }],
  },
  PAYROLL_REGISTER: {
    columns: ["run_no", "employee_number", "employee_name", "department", "gross_pay", "deductions", "net_pay", "status"],
    cards: [{ label: "Rows", count: true }, { label: "Gross pay", field: "gross_pay" }, { label: "Net pay", field: "net_pay" }],
  },
  BANK_TRANSFER: {
    columns: ["run_no", "employee_number", "employee_name", "bank", "account_number", "payment_amount", "status"],
    cards: [{ label: "Rows", count: true }, { label: "Payment amount", field: "payment_amount" }],
  },
  LOAN_OUTSTANDING: {
    columns: ["loan_reference", "employee_number", "employee_name", "department", "original_loan_amount", "amount_paid", "outstanding_amount", "remaining_installments", "status"],
    cards: [{ label: "Rows", count: true }, { label: "Outstanding", field: "outstanding_amount" }, { label: "Paid", field: "amount_paid" }],
  },
  FIELD_VISIT_MAP: {
    columns: ["visit_no", "visit_date", "employee_name", "event_type", "captured_at", "latitude", "longitude", "location_validation_status"],
    cards: [{ label: "Points", count: true }],
  },
  PENDING_ACTIVITY: {
    columns: ["activity_date", "employee_no", "employee_name", "department_name", "report_status", "is_workday", "is_holiday", "has_approved_leave", "assigned_task_count", "completed_task_count", "open_task_count"],
    cards: [{ label: "Pending employee-days", count: true }, { label: "Assigned tasks", field: "assigned_task_count" }, { label: "Open tasks", field: "open_task_count" }],
  },
  KPI_ASSIGNMENTS: {
    columns: ["employee_number", "employee_name", "kpi_code", "kpi_name", "target_value", "weight", "assignment_status", "effective_from"],
    cards: [{ label: "Assignments", count: true }, { label: "Total weight", field: "weight" }],
  },
  KPI_TARGET_VS_ACHIEVEMENT: {
    columns: ["employee_number", "employee_name", "period_name", "kpi_code", "target_value", "achievement_value", "raw_score", "weighted_score", "status"],
    cards: [{ label: "Rows", count: true }, { label: "Achievement", field: "achievement_value" }, { label: "Weighted score", field: "weighted_score" }],
  },
  MONTHLY_KPI_SCORE: {
    columns: ["employee_number", "employee_name", "period_name", "final_score", "rating_code", "status", "published_at", "locked_at"],
    cards: [{ label: "Rows", count: true }, { label: "Published final score", field: "final_score" }],
  },
  QUARTERLY_KPI_AVERAGE: {
    columns: ["employee_number", "employee_name", "period_name", "score", "rating_code", "published_at", "locked_at"],
    cards: [{ label: "Rows", count: true }, { label: "Score", field: "score" }],
  },
  ANNUAL_KPI_AVERAGE: {
    columns: ["employee_number", "employee_name", "period_name", "score", "rating_code", "published_at", "locked_at"],
    cards: [{ label: "Rows", count: true }, { label: "Score", field: "score" }],
  },
  KPI_SCORE_HISTORY: {
    columns: ["employee_number", "employee_name", "period_name", "kpi_score", "competency_score", "final_score", "rating_code", "status"],
    cards: [{ label: "Rows", count: true }, { label: "Final score", field: "final_score" }],
  },
  ATTENDANCE_EXCEPTIONS: {
    columns: ["attendance_date", "employee_number", "employee_name", "exception_type", "status", "message", "resolved_at"],
    cards: [{ label: "Exceptions", count: true }],
  },
  ATTENDANCE_CORRECTIONS: {
    columns: ["attendance_date", "employee_number", "employee_name", "original_status", "status_override", "work_minutes_override", "applied_at"],
    cards: [{ label: "Corrections", count: true }],
  },
}

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

function asRecord(value: unknown): AdminRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AdminRecord)
    : null
}

function asRecordArray(value: unknown): AdminRecord[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is AdminRecord => Boolean(asRecord(entry)))
    : []
}

function readString(row: AdminRecord | null | undefined, keys: string[], fallback = "") {
  if (!row) return fallback
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return fallback
}

function readStringArray(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return [] as string[]
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

function readNumber(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
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

function formatStatus(value: string | null | undefined) {
  return (value || "unknown")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

function setMonthRange(setFrom: (value: string) => void, setTo: (value: string) => void) {
  const now = new Date()
  setFrom(dateOnly(new Date(now.getFullYear(), now.getMonth(), 1)))
  setTo(dateOnly(new Date(now.getFullYear(), now.getMonth() + 1, 0)))
}

function setQuarterRange(setFrom: (value: string) => void, setTo: (value: string) => void) {
  const now = new Date()
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
  setFrom(dateOnly(new Date(now.getFullYear(), quarterStartMonth, 1)))
  setTo(dateOnly(new Date(now.getFullYear(), quarterStartMonth + 3, 0)))
}

function metricValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString()
  if (typeof value === "string" && value.trim()) return value
  return "0"
}

function numericSum(rows: AdminRecord[], field: string) {
  return rows.reduce((sum, row) => {
    const value = readNumber(row, [field])
    return sum + (value ?? 0)
  }, 0)
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function Surface({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("border-b border-border/70 px-4 py-5 sm:px-6", className)}>
      {children}
    </section>
  )
}

export function ReportsAnalyticsView() {
  const [token, setToken] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [loadIssues, setLoadIssues] = React.useState<string[]>([])
  const [reloadKey, setReloadKey] = React.useState(0)
  const [catalog, setCatalog] = React.useState<CatalogCategory[]>([])
  const [operationalReports, setOperationalReports] = React.useState<AdminRecord[]>([])
  const [datasets, setDatasets] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [savedReports, setSavedReports] = React.useState<AdminRecord[]>([])
  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null)

  const [activeCategory, setActiveCategory] = React.useState("Dashboard")
  const [datasetCode, setDatasetCode] = React.useState("")
  const [dimensions, setDimensions] = React.useState("")
  const [measures, setMeasures] = React.useState("")
  const [fromDate, setFromDate] = React.useState("")
  const [toDate, setToDate] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("")
  const [reportName, setReportName] = React.useState("")
  const [visibility, setVisibility] = React.useState<"PRIVATE" | "DEPARTMENT" | "SHARED" | "ADMIN_ONLY">("PRIVATE")
  const [departmentScopeId, setDepartmentScopeId] = React.useState("")
  const [editingSavedId, setEditingSavedId] = React.useState("")
  const [outputFormat, setOutputFormat] = React.useState<"CSV" | "XLSX" | "PDF">("XLSX")
  const [selectedOperationalCode, setSelectedOperationalCode] = React.useState("")
  const [previewRows, setPreviewRows] = React.useState<AdminRecord[]>([])
  const [previewMeta, setPreviewMeta] = React.useState<AdminRecord | null>(null)
  const [running, setRunning] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [deletingSavedId, setDeletingSavedId] = React.useState("")

  React.useEffect(() => {
    setToken(readStoredToken())
  }, [])

  React.useEffect(() => {
    if (!token) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [
          catalogResult,
          operationalResult,
          datasetResult,
          departmentResult,
          savedResult,
          dashboardResult,
        ] =
          await Promise.allSettled([
            getAnalyticsReportCatalog(token),
            listOperationalAnalyticsReports(token),
            listAnalyticsDatasets(token),
            listDepartments(token, { limit: 200 }, { cacheTtlMs: 60_000, dedupe: true }),
            listSavedAnalyticsReports(token),
            getAnalyticsDashboard(token, "hr"),
          ])
        if (cancelled) return

        const sources = [
          ["report catalog", catalogResult],
          ["operational reports", operationalResult],
          ["data sources", datasetResult],
          ["departments", departmentResult],
          ["saved reports", savedResult],
          ["dashboard summary", dashboardResult],
        ] as const
        setLoadIssues(
          sources
            .filter(([, result]) => result.status === "rejected")
            .map(([label]) => label),
        )

        if (catalogResult.status === "fulfilled") {
          const categories = asRecordArray(asRecord(catalogResult.value)?.categories)
            .map((category) => ({
              name: readString(category, ["name"]),
              reports: asRecordArray(category.reports).map((report) => ({
                code: readString(report, ["code"]),
                name: readString(report, ["name"]),
                data_source: readString(report, ["data_source"]) || null,
                required_permissions: readStringArray(report, ["required_permissions"]),
                implementation_status: readString(report, ["implementation_status"]),
                exports: readStringArray(report, ["exports"]),
              })),
            }))
            .filter((category) => category.name)
          setCatalog(categories)
          if (categories[0]?.name) setActiveCategory(categories[0].name)
        }
        if (operationalResult.status === "fulfilled") {
          const rows = operationalResult.value || []
          setOperationalReports(rows)
          const firstCode = readString(rows[0], ["code"])
          if (firstCode) setSelectedOperationalCode(firstCode)
        }
        if (datasetResult.status === "fulfilled") {
          const seenDatasetCodes = new Set<string>()
          const rows = (datasetResult.value || []).filter((row) => {
            const code = readString(row, ["code", "datasetCode"])
            if (!code) return false
            if (seenDatasetCodes.has(code)) return false
            seenDatasetCodes.add(code)
            return true
          })
          setDatasets(rows)
          const firstCode = readString(rows[0], ["code", "datasetCode"])
          if (firstCode) {
            setDatasetCode(firstCode)
            setDimensions(readStringArray(rows[0], ["allowedDimensions", "allowed_dimensions"]).slice(0, 2).join(", "))
            setMeasures(readStringArray(rows[0], ["allowedMeasures", "allowed_measures"]).slice(0, 2).join(", "))
          }
        }
        if (savedResult.status === "fulfilled") {
          setSavedReports(savedResult.value || [])
        }
        if (departmentResult.status === "fulfilled") {
          setDepartments(asRecordArray(asRecord(departmentResult.value)?.data))
        }
        if (dashboardResult.status === "fulfilled") {
          setDashboard(asRecord(dashboardResult.value))
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load reports")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [reloadKey, token])

  const selectedDataset = React.useMemo(
    () => datasets.find((row) => readString(row, ["code", "datasetCode"]) === datasetCode) ?? null,
    [datasetCode, datasets],
  )
  const dimensionOptions = readStringArray(selectedDataset, ["allowedDimensions", "allowed_dimensions"])
  const measureOptions = readStringArray(selectedDataset, ["allowedMeasures", "allowed_measures"])
  const selectedCategory = catalog.find((category) => category.name === activeCategory) ?? catalog[0]
  const selectedOperationalReport = React.useMemo(
    () => operationalReports.find((row) => readString(row, ["code"]) === selectedOperationalCode) ?? null,
    [operationalReports, selectedOperationalCode],
  )
  const reportUi = REPORT_UI[selectedOperationalCode] ?? null
  const mapPoints = React.useMemo(
    () =>
      previewRows
        .map((row) => ({
          latitude: readNumber(row, ["latitude", "lat"]),
          longitude: readNumber(row, ["longitude", "lng", "lon"]),
          label: readString(row, ["employee_name", "employeeName", "visit_no", "visitNo"], "Visit"),
          status: readString(row, ["visit_status", "status", "location_validation_status"]),
        }))
        .filter((point): point is { latitude: number; longitude: number; label: string; status: string } =>
          point.latitude !== null && point.longitude !== null,
        )
        .slice(0, 80),
    [previewRows],
  )
  const previewColumns = React.useMemo(() => {
    if (reportUi?.columns.length) return reportUi.columns
    const keys = new Set<string>()
    previewRows.slice(0, 20).forEach((row) => Object.keys(row).forEach((key) => keys.add(key)))
    return Array.from(keys).slice(0, 10)
  }, [previewRows, reportUi])
  const summaryCards = React.useMemo(
    () =>
      (reportUi?.cards ?? [{ label: "Rows", count: true }]).map((card) => ({
        label: card.label,
        value: card.count
          ? previewRows.length
          : card.field
            ? numericSum(previewRows, card.field)
            : 0,
      })),
    [previewRows, reportUi],
  )

  function payload() {
    return {
      dataset_code: datasetCode,
      dimensions: parseCsv(dimensions),
      measures: parseCsv(measures),
      date_from: fromDate || undefined,
      date_to: toDate || undefined,
      limit: 1000,
      purpose: "Reports & Analytics",
    }
  }

  function operationalParams(): Record<string, string | number | undefined> {
    return {
      date_from: fromDate || undefined,
      date_to: toDate || undefined,
      status: statusFilter || undefined,
      output_format: outputFormat,
      limit: 1000,
    }
  }

  async function runOperational() {
    if (!selectedOperationalCode) {
      toast.error("Choose an operational report first.")
      return
    }
    setRunning(true)
    try {
      const result = await runOperationalAnalyticsReport(token, selectedOperationalCode, operationalParams())
      const record = asRecord(result)
      const rows = asRecordArray(record?.rows)
      setPreviewRows(rows)
      setPreviewMeta(record)
      toast.success(`Operational report ready (${rows.length} rows)`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operational report failed")
    } finally {
      setRunning(false)
    }
  }

  async function exportOperational() {
    if (!selectedOperationalCode) {
      toast.error("Choose an operational report first.")
      return
    }
    setExporting(true)
    try {
      const file = await downloadOperationalAnalyticsReport(token, selectedOperationalCode, operationalParams())
      downloadBlob(file.blob, file.filename)
      toast.success(`${outputFormat} operational export generated`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operational export failed")
    } finally {
      setExporting(false)
    }
  }

  async function runPreview() {
    if (!datasetCode || !dimensions.trim() || !measures.trim()) {
      toast.error("Choose a data source, at least one group by column, and at least one measure.")
      return
    }
    setRunning(true)
    try {
      const result = await runAnalyticsCustomReport(token, payload())
      const record = asRecord(result)
      const rows = asRecordArray(record?.rows)
      setPreviewRows(rows)
      setPreviewMeta(record)
      toast.success(`Report preview ready (${rows.length} rows)`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Report preview failed")
    } finally {
      setRunning(false)
    }
  }

  async function saveCurrentReport() {
    if (!reportName.trim()) {
      toast.error("Enter a report name before saving.")
      return
    }
    setSaving(true)
    try {
      const body = {
        ...payload(),
        name: reportName.trim(),
        visibility,
        department_scope_id:
          visibility === "DEPARTMENT" && departmentScopeId
            ? Number(departmentScopeId)
            : undefined,
      }
      const saved = editingSavedId
        ? await updateSavedAnalyticsReport(token, editingSavedId, body)
        : await saveAnalyticsReport(token, body)
      setSavedReports((current) =>
        editingSavedId
          ? current.map((report) => (readString(report, ["id"]) === editingSavedId ? (saved as AdminRecord) : report))
          : [saved as AdminRecord, ...current],
      )
      setEditingSavedId("")
      toast.success(editingSavedId ? "Saved report updated" : "Report configuration saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save report")
    } finally {
      setSaving(false)
    }
  }

  async function exportCurrentReport() {
    setExporting(true)
    try {
      const exportJob = (await exportAnalyticsReport(token, {
        ...payload(),
        output_format: outputFormat,
      })) as AdminRecord
      const id = readString(exportJob, ["id"])
      if (id) {
        const file = await downloadAnalyticsExport(token, id)
        downloadBlob(file.blob, file.filename)
      }
      toast.success(`${outputFormat} export generated`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  async function runSaved(row: AdminRecord) {
    const id = readString(row, ["id"])
    if (!id) return
    setRunning(true)
    try {
      const result = await runSavedAnalyticsReport(token, id, {
        date_from: fromDate || undefined,
        date_to: toDate || undefined,
      })
      const record = asRecord(result)
      setPreviewRows(asRecordArray(record?.rows))
      setPreviewMeta(record)
      setDatasetCode(readString(row, ["datasetCode", "dataset_code"]))
      setDimensions(readStringArray(row, ["selectedDimensions", "selected_dimensions"]).join(", "))
      setMeasures(readStringArray(row, ["selectedMeasures", "selected_measures"]).join(", "))
      setReportName(readString(row, ["name"], ""))
      const nextVisibility = readString(row, ["visibility"], "PRIVATE")
      if (
        nextVisibility === "PRIVATE" ||
        nextVisibility === "DEPARTMENT" ||
        nextVisibility === "SHARED" ||
        nextVisibility === "ADMIN_ONLY"
      ) {
        setVisibility(nextVisibility)
      }
      setDepartmentScopeId(readString(row, ["departmentScopeId", "department_scope_id"]))
      setEditingSavedId(id)
      toast.success("Saved report preview ready")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saved report failed")
    } finally {
      setRunning(false)
    }
  }

  async function deleteSaved(row: AdminRecord) {
    const id = readString(row, ["id"])
    if (!id) return
    setDeletingSavedId(id)
    try {
      await deleteSavedAnalyticsReport(token, id)
      setSavedReports((current) => current.filter((report) => readString(report, ["id"]) !== id))
      toast.success("Saved report deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete saved report")
    } finally {
      setDeletingSavedId("")
    }
  }

  const workforce = asRecord(dashboard?.workforce)
  const attendance = asRecord(dashboard?.attendance)
  const leave = asRecord(dashboard?.leave)
  const payroll = asRecord(dashboard?.payroll)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Surface className="pt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Reports & Analytics
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Operational reports from live HRMS data
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="p-0">
              <Link className="inline-flex h-full items-center gap-2 px-3" href="/dashboard/operations/scheduled-reporting">
                <FileSpreadsheetIcon data-icon="inline-start" />
                Scheduled reports
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Print
            </Button>
          </div>
        </div>
      </Surface>

      {loadIssues.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:px-6" role="status">
          <div>
            <p className="font-semibold">Some report sources are unavailable</p>
            <p className="text-xs text-amber-800">
              Could not load {loadIssues.join(", ")}. This can be caused by missing permissions or a temporary API failure.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setReloadKey((value) => value + 1)}>
            Retry
          </Button>
        </div>
      ) : null}

      <Surface>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total employees", metricValue(workforce?.period_end_headcount ?? workforce?.active_headcount)],
            ["New employees", metricValue(workforce?.joiners)],
            ["Attendance days", metricValue(attendance?.days)],
            ["Leave days", metricValue(leave?.approved_days)],
            ["Locked payroll runs", metricValue(payroll?.locked_runs)],
            ["Gross pay", metricValue(payroll?.gross_pay)],
            ["Net pay", metricValue(payroll?.net_pay)],
            ["Employer cost", metricValue(payroll?.employer_cost)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-border bg-card px-3 py-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </Surface>

      <Surface>
        <div className="flex flex-wrap gap-2">
          {(catalog.length ? catalog : [{ name: "Dashboard", reports: [] }]).map((category) => (
            <button
              key={category.name}
              type="button"
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium",
                activeCategory === category.name
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
              onClick={() => setActiveCategory(category.name)}
            >
              {category.name}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {(selectedCategory?.reports ?? []).map((report) => (
            <div key={report.code} className="rounded-md border border-border bg-card px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{report.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {report.data_source || "Module runner required"}
                  </p>
                </div>
                <span className="rounded bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {formatStatus(report.implementation_status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Surface>

      <Surface>
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-muted">
                <FileSpreadsheetIcon className="size-4" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Operational report runner</h2>
                <p className="text-sm text-muted-foreground">
                  Run dedicated HR, leave, payroll, loan, document, and field visit reports from source modules.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Report">
                <Select
                  value={selectedOperationalCode || "none"}
                  onValueChange={(value) => {
                    if (value && value !== "none") setSelectedOperationalCode(value)
                  }}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select report" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select report</SelectItem>
                    {operationalReports.map((report) => {
                      const code = readString(report, ["code"])
                      return (
                        <SelectItem key={code} value={code}>
                          {readString(report, ["name"], code)}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Export format">
                <Select
                  value={outputFormat}
                  onValueChange={(value) => {
                    if (value === "CSV" || value === "XLSX" || value === "PDF") setOutputFormat(value)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XLSX">Excel (.xlsx)</SelectItem>
                    <SelectItem value="CSV">CSV (.csv)</SelectItem>
                    <SelectItem value="PDF">PDF (.pdf)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="From">
                <DatePickerPresets value={fromDate} onChange={setFromDate} placeholder="Start date" />
              </Field>
              <Field label="To">
                <DatePickerPresets value={toDate} onChange={setToDate} placeholder="End date" />
              </Field>
              <Field label="Status">
                <Input value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} placeholder="Optional status" />
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                onClick={() => setMonthRange(setFromDate, setToDate)}
              >
                This month
              </button>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                onClick={() => setQuarterRange(setFromDate, setToDate)}
              >
                This quarter
              </button>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                onClick={() => {
                  setFromDate("")
                  setToDate("")
                  setStatusFilter("")
                }}
              >
                Clear filters
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => void runOperational()} disabled={running || loading || !selectedOperationalCode}>
                {running ? <FluentLoadingIndicator data-icon="inline-start" className="animate-spin" /> : <PlayIcon data-icon="inline-start" />}
                Run report
              </Button>
              <Button type="button" variant="outline" onClick={() => void exportOperational()} disabled={exporting || loading || !selectedOperationalCode}>
                {exporting ? <FluentLoadingIndicator data-icon="inline-start" className="animate-spin" /> : <DownloadIcon data-icon="inline-start" />}
                Export {outputFormat}
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">
                  {readString(selectedOperationalReport, ["name"], "No operational report selected")}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {readString(selectedOperationalReport, ["category"], "Report catalog")} / {formatStatus(readString(selectedOperationalReport, ["sensitivity"]))}
                </p>
              </div>
              <span className="rounded bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {formatStatus(readString(selectedOperationalReport, ["implementation_status"], "dedicated runner"))}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div className="rounded border border-border bg-background px-2 py-2">
                Strict tenant and scope checks
              </div>
              <div className="rounded border border-border bg-background px-2 py-2">
                CSV, Excel, PDF, and print coverage
              </div>
              <div className="rounded border border-border bg-background px-2 py-2">
                Payroll uses locked/final records
              </div>
              <div className="rounded border border-border bg-background px-2 py-2">
                Bank accounts are masked on-screen
              </div>
            </div>
          </div>
        </div>
      </Surface>

      <Surface>
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-muted">
                <BarChart3Icon className="size-4" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Custom report builder</h2>
                <p className="text-sm text-muted-foreground">
                  Preview and export governed datasets with backend tenant and permission checks.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Data source">
                <Select
                  value={datasetCode || "none"}
                  onValueChange={(value) => {
                    const nextValue = value ?? ""
                    if (nextValue === "none") return
                    const dataset = datasets.find((row) => readString(row, ["code", "datasetCode"]) === nextValue)
                    setDatasetCode(nextValue)
                    setDimensions(readStringArray(dataset, ["allowedDimensions", "allowed_dimensions"]).slice(0, 2).join(", "))
                    setMeasures(readStringArray(dataset, ["allowedMeasures", "allowed_measures"]).slice(0, 2).join(", "))
                  }}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select data source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select data source</SelectItem>
                    {datasets.map((dataset, index) => {
                      const code = readString(dataset, ["code", "datasetCode"])
                      return (
                        <SelectItem key={`dataset-${code}-${index}`} value={code}>
                          {readString(dataset, ["name"], code)}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Export format">
                <Select
                  value={outputFormat}
                  onValueChange={(value) => {
                    if (value === "CSV" || value === "XLSX" || value === "PDF") setOutputFormat(value)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XLSX">Excel (.xlsx)</SelectItem>
                    <SelectItem value="CSV">CSV (.csv)</SelectItem>
                    <SelectItem value="PDF">PDF (.pdf)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Group by columns">
                <Input value={dimensions} onChange={(event) => setDimensions(event.target.value)} />
              </Field>
              <Field label="Measures">
                <Input value={measures} onChange={(event) => setMeasures(event.target.value)} />
              </Field>
              <Field label="From">
                <DatePickerPresets value={fromDate} onChange={setFromDate} placeholder="Start date" />
              </Field>
              <Field label="To">
                <DatePickerPresets value={toDate} onChange={setToDate} placeholder="End date" />
              </Field>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {dimensionOptions.slice(0, 10).map((option) => (
                <button
                  key={`dim-${option}`}
                  type="button"
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                  onClick={() => setDimensions((current) => parseCsv(current).includes(option) ? current : [current, option].filter(Boolean).join(", "))}
                >
                  {option}
                </button>
              ))}
              {measureOptions.slice(0, 8).map((option) => (
                <button
                  key={`measure-${option}`}
                  type="button"
                  className="rounded border border-primary/25 px-2 py-1 text-xs text-primary hover:bg-primary/10"
                  onClick={() => setMeasures((current) => parseCsv(current).includes(option) ? current : [current, option].filter(Boolean).join(", "))}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void runPreview()} disabled={running || loading}>
                {running ? <FluentLoadingIndicator data-icon="inline-start" className="animate-spin" /> : <PlayIcon data-icon="inline-start" />}
                Preview
              </Button>
              <Button type="button" variant="outline" onClick={() => void exportCurrentReport()} disabled={exporting || loading}>
                {exporting ? <FluentLoadingIndicator data-icon="inline-start" className="animate-spin" /> : <DownloadIcon data-icon="inline-start" />}
                Export {outputFormat}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-md border border-border bg-card p-3">
              <h3 className="text-sm font-semibold">Save configuration</h3>
              <div className="mt-3 grid gap-3">
                <Field label="Report name">
                  <Input value={reportName} onChange={(event) => setReportName(event.target.value)} placeholder="Finance headcount summary" />
                </Field>
                <Field label="Visibility">
                  <Select
                    value={visibility}
                    onValueChange={(value) => {
                      if (
                        value === "PRIVATE" ||
                        value === "DEPARTMENT" ||
                        value === "SHARED" ||
                        value === "ADMIN_ONLY"
                      ) {
                        setVisibility(value)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRIVATE">Private</SelectItem>
                      <SelectItem value="DEPARTMENT">Department</SelectItem>
                      <SelectItem value="SHARED">Shared</SelectItem>
                      <SelectItem value="ADMIN_ONLY">Admin only</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {visibility === "DEPARTMENT" ? (
                  <Field label="Department scope">
                    <Select
                      value={departmentScopeId || "own"}
                      onValueChange={(value) => setDepartmentScopeId(!value || value === "own" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Own department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="own">Own department</SelectItem>
                        {departments.map((department) => {
                          const id = readString(department, ["id"])
                          return (
                            <SelectItem key={id} value={id}>
                              {readString(department, ["name"], id)}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
                <Button type="button" variant="outline" onClick={() => void saveCurrentReport()} disabled={saving}>
                  {saving ? <FluentLoadingIndicator data-icon="inline-start" className="animate-spin" /> : <SaveIcon data-icon="inline-start" />}
                  {editingSavedId ? "Update report" : "Save report"}
                </Button>
                {editingSavedId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingSavedId("")
                      setReportName("")
                      setVisibility("PRIVATE")
                      setDepartmentScopeId("")
                    }}
                  >
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="rounded-md border border-border bg-card p-3">
              <h3 className="text-sm font-semibold">Saved reports</h3>
              <div className="mt-3 grid gap-2">
                {savedReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved reports yet.</p>
                ) : (
                  savedReports.slice(0, 8).map((report) => {
                    const id = readString(report, ["id"])
                    return (
                    <div
                      key={readString(report, ["id"])}
                      className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left hover:text-primary"
                        onClick={() => void runSaved(report)}
                      >
                        <p className="truncate text-sm font-medium">{readString(report, ["name"], "Saved report")}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {readString(report, ["datasetCode", "dataset_code"])} / {formatStatus(readString(report, ["visibility"]))}
                        </p>
                      </button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => void deleteSaved(report)}
                        disabled={deletingSavedId === id}
                        aria-label="Delete saved report"
                      >
                        {deletingSavedId === id ? (
                          <FluentLoadingIndicator className="size-4 animate-spin" />
                        ) : (
                          <Trash2Icon className="size-4" />
                        )}
                      </Button>
                    </div>
                  )})
                )}
              </div>
            </div>
          </div>
        </div>
      </Surface>

      <Surface>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Preview</h2>
            <p className="text-sm text-muted-foreground">
              {previewMeta ? `${readString(previewMeta, ["dataset_code"], datasetCode)} / ${previewRows.length} rows` : "Run a report to preview results."}
            </p>
          </div>
        </div>
        {previewRows.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-md border border-border bg-card px-3 py-3">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{metricValue(card.value)}</p>
              </div>
            ))}
          </div>
        ) : null}
        {mapPoints.length > 0 ? (
          <div className="mt-4 rounded-md border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Map view</h3>
                <p className="text-xs text-muted-foreground">{mapPoints.length} coordinate points in the current preview</p>
              </div>
            </div>
            <div className="relative mt-3 h-72 overflow-hidden rounded border border-border bg-[linear-gradient(0deg,hsl(var(--muted))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--muted))_1px,transparent_1px)] bg-[size:40px_40px]">
              {mapPoints.map((point, index) => {
                const x = ((point.longitude + 180) / 360) * 100
                const y = ((90 - point.latitude) / 180) * 100
                return (
                  <span
                    key={`${point.latitude}-${point.longitude}-${index}`}
                    title={`${point.label}: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`}
                    className="absolute size-3 rounded-full border-2 border-background bg-primary shadow-sm"
                    style={{
                      left: `calc(${Math.max(1, Math.min(99, x))}% - 6px)`,
                      top: `calc(${Math.max(1, Math.min(99, y))}% - 6px)`,
                    }}
                  />
                )
              })}
            </div>
          </div>
        ) : null}
        <div className="mt-4 overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {(previewColumns.length ? previewColumns : ["No preview"]).map((column) => (
                  <th key={column} className="px-3 py-2 font-medium">
                    {column.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {previewRows.length > 0 ? (
                previewRows.slice(0, 20).map((row, index) => (
                  <tr key={`preview-${index}`}>
                    {previewColumns.map((column) => (
                      <td key={`${index}-${column}`} className="px-3 py-2 text-xs">
                        {typeof row[column] === "object" && row[column] !== null
                          ? JSON.stringify(row[column])
                          : String(row[column] ?? "-")}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-6 text-sm text-muted-foreground">
                    {loading
                      ? "Loading report data and checking access…"
                      : loadIssues.length
                        ? "A preview is unavailable because one or more report sources could not be loaded."
                        : "No report preview yet. Choose a report and run it to see results."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Surface>
    </div>
  )
}

export default ReportsAnalyticsView
