"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeftIcon, CheckCircle2Icon, CircleMinusIcon, CircleXIcon, DownloadIcon, FileSpreadsheetIcon, HistoryIcon, InfoIcon, RefreshCcwIcon, TriangleAlertIcon, UploadIcon, XIcon } from "lucide-react";
import {
  cancelLeaveBalanceImport,
  confirmLeaveBalanceImport,
  downloadLeaveBalanceImportReport,
  downloadLeaveBalanceImportTemplate,
  getLeaveBalanceImport,
  listBranches,
  listDepartments,
  listLeaveBalanceImportHistory,
  listLeaveBalanceImportRows,
  listLeaveTypes,
  uploadLeaveBalanceImport,
  type AdminRecord,
  type LeaveBalanceImportBatch,
  type LeaveBalanceImportBatchDetail,
  type LeaveBalanceImportMode,
  type LeaveBalanceImportRow,
  type LeaveBalanceImportRowFilter,
} from "@/lib/admin-api"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
import {
  LEAVE_BALANCE_IMPORT_PERMISSIONS,
  LEAVE_BALANCE_IMPORT_STEPS,
  buildImportSummary,
  buildRowFilterOptions,
  defaultImportMode,
  describeBatchStatus,
  describeRowStatus,
  evaluateConfirmation,
  formatAdjustmentDays,
  formatBalanceDays,
  importProgress,
  isBatchFinished,
  resolveImportStep,
  templateYearOptions,
  type ImportTone,
  type LeaveBalanceImportStep,
} from "@/lib/leave-balance-import"
import { readStoredSessionTokens } from "@/lib/session-client"
import { cn } from "@/lib/utils"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FluentSelect } from "@/components/ui/fluent-select"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

type LookupOption = { id: number; label: string }

const ROWS_PER_PAGE = 50
const HISTORY_PER_PAGE = 10

const TONE_STYLES: Record<ImportTone, { text: string; dot: string; panel: string }> = {
  success: {
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    panel: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
  },
  partial: {
    text: "text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
    panel: "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-100",
  },
  danger: {
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    panel: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100",
  },
  warn: {
    text: "text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
    panel: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
  },
  info: {
    text: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
    panel: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100",
  },
  neutral: {
    text: "text-muted-foreground",
    dot: "bg-muted-foreground/50",
    panel: "border-border bg-muted/30 text-foreground",
  },
}

const TONE_ICONS: Record<ImportTone, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2Icon,
  partial: TriangleAlertIcon,
  danger: CircleXIcon,
  warn: TriangleAlertIcon,
  info: InfoIcon,
  neutral: CircleMinusIcon,
}

const BUTTON = "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
const PRIMARY_BUTTON = "inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold !text-white disabled:cursor-not-allowed disabled:opacity-60"
function readToken(): string | null {
  return readStoredSessionTokens().accessToken ?? null
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

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
}

function toLookupOptions(rows: AdminRecord[], labelKeys: string[]): LookupOption[] {
  return rows
    .map((row) => {
      const id = Number(row.id)
      const label = labelKeys.map((key) => row[key]).find((value) => typeof value === "string" && value.trim())
      return Number.isInteger(id) && typeof label === "string" ? { id, label } : null
    })
    .filter((option): option is LookupOption => option !== null)
    .sort((left, right) => left.label.localeCompare(right.label))
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function StatusLabel({ label, tone }: { label: string; tone: ImportTone }) {
  const Icon = TONE_ICONS[tone]
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium", TONE_STYLES[tone].text)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  )
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: React.ReactNode; tone?: ImportTone }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background px-3 py-2">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("text-base font-semibold tabular-nums", tone === "neutral" ? "text-foreground" : TONE_STYLES[tone].text)}>{value}</p>
    </div>
  )
}

function ImportStepper({ current }: { current: LeaveBalanceImportStep }) {
  const currentIndex = LEAVE_BALANCE_IMPORT_STEPS.findIndex((step) => step.id === current)
  return (
    <ol className="grid grid-cols-3 border-b border-border bg-muted/[0.12] md:grid-cols-6" aria-label="Leave balance import steps">
      {LEAVE_BALANCE_IMPORT_STEPS.map((step, index) => {
        const complete = index < currentIndex
        const active = index === currentIndex
        return (
          <li
            key={step.id}
            className={cn("flex min-w-0 items-center gap-2 px-3 py-2", active ? "bg-primary/[0.06]" : undefined)}
            aria-current={active ? "step" : undefined}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                complete
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground",
              )}
            >
              {complete ? <CheckCircle2Icon className="size-3.5" aria-label="Done" /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className={cn("block truncate text-[11px] font-semibold", active ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
              <span className="hidden truncate text-[10px] text-muted-foreground sm:block">{step.description}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function LeaveBalanceImportView() {
  const actor = useDashboardActor()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requestedBatchId = searchParams?.get("batch") ?? null

  const can = React.useCallback(
    (permission: string) => canPerformPermission(actor.permissionLabels, permission),
    [actor.permissionLabels],
  )
  const canExport = can(LEAVE_BALANCE_IMPORT_PERMISSIONS.export)
  const canImport = can(LEAVE_BALANCE_IMPORT_PERMISSIONS.bulkImport)
  const canViewHistory = canImport || can(LEAVE_BALANCE_IMPORT_PERMISSIONS.history)

  // Template
  const yearOptions = React.useMemo(() => templateYearOptions(), [])
  const [fiscalYear, setFiscalYear] = React.useState(yearOptions[0])
  const [branchFilter, setBranchFilter] = React.useState("")
  const [departmentFilter, setDepartmentFilter] = React.useState("")
  const [leaveTypeFilter, setLeaveTypeFilter] = React.useState("")
  const [branches, setBranches] = React.useState<LookupOption[]>([])
  const [departments, setDepartments] = React.useState<LookupOption[]>([])
  const [leaveTypes, setLeaveTypes] = React.useState<LookupOption[]>([])
  const [templateBusy, setTemplateBusy] = React.useState(false)

  // Upload
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [file, setFile] = React.useState<File | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const [defaultReason, setDefaultReason] = React.useState("")
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)

  // Batch + preview
  const [batch, setBatch] = React.useState<LeaveBalanceImportBatchDetail | null>(null)
  const [rows, setRows] = React.useState<LeaveBalanceImportRow[]>([])
  const [rowsPage, setRowsPage] = React.useState(1)
  const [rowsTotalPages, setRowsTotalPages] = React.useState(1)
  const [rowsTotal, setRowsTotal] = React.useState(0)
  const [rowsLoading, setRowsLoading] = React.useState(false)
  const [rowFilter, setRowFilter] = React.useState<LeaveBalanceImportRowFilter>("ALL")
  const [rowSearch, setRowSearch] = React.useState("")
  const [rowLeaveType, setRowLeaveType] = React.useState("")
  const [rowBranch, setRowBranch] = React.useState("")
  const [rowDepartment, setRowDepartment] = React.useState("")
  const [selectedRow, setSelectedRow] = React.useState<LeaveBalanceImportRow | null>(null)
  const [reportBusy, setReportBusy] = React.useState(false)

  // Confirmation
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const [importMode, setImportMode] = React.useState<LeaveBalanceImportMode>("STRICT")
  const [acknowledgeWarnings, setAcknowledgeWarnings] = React.useState(false)
  const [acknowledgeSkippedRows, setAcknowledgeSkippedRows] = React.useState(false)

  // History
  const [history, setHistory] = React.useState<LeaveBalanceImportBatch[]>([])
  const [historyPage, setHistoryPage] = React.useState(1)
  const [historyTotalPages, setHistoryTotalPages] = React.useState(1)
  const [historyTotal, setHistoryTotal] = React.useState(0)
  const [historyLoading, setHistoryLoading] = React.useState(false)

  const step = resolveImportStep({ uploading, confirming, batch })

  React.useEffect(() => {
    const token = readToken()
    if (!token || !canExport) return
    let cancelled = false
    void Promise.allSettled([
      listBranches(token, { limit: 100 }),
      listDepartments(token, { limit: 100 }),
      listLeaveTypes(token, { limit: 100 }),
    ]).then(([branchResult, departmentResult, leaveTypeResult]) => {
      if (cancelled) return
      if (branchResult.status === "fulfilled") setBranches(toLookupOptions(branchResult.value.rows, ["name"]))
      if (departmentResult.status === "fulfilled") setDepartments(toLookupOptions(departmentResult.value.rows, ["name"]))
      if (leaveTypeResult.status === "fulfilled") setLeaveTypes(toLookupOptions(leaveTypeResult.value.rows, ["name", "code"]))
    })
    return () => {
      cancelled = true
    }
  }, [canExport])

  const loadHistory = React.useCallback(async () => {
    const token = readToken()
    if (!token || !canViewHistory) return
    setHistoryLoading(true)
    try {
      const result = await listLeaveBalanceImportHistory(token, { page: historyPage, limit: HISTORY_PER_PAGE })
      setHistory(result.rows)
      setHistoryTotalPages(result.totalPages)
      setHistoryTotal(result.total)
    } catch (error) {
      showErrorAlert(errorMessage(error, "Could not load the import history."))
    } finally {
      setHistoryLoading(false)
    }
  }, [canViewHistory, historyPage])

  React.useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const activeBatchId = batch?.batch_id ?? null
  // Status is a reload trigger: rows gain result statuses once a batch is processed.
  const activeBatchStatus = batch?.status ?? null

  const loadRows = React.useCallback(async () => {
    const token = readToken()
    if (!token || !activeBatchId || !activeBatchStatus) return
    setRowsLoading(true)
    try {
      const result = await listLeaveBalanceImportRows(token, activeBatchId, {
        page: rowsPage,
        limit: ROWS_PER_PAGE,
        status: rowFilter,
        search: rowSearch.trim() || undefined,
        leave_type_id: rowLeaveType ? Number(rowLeaveType) : undefined,
        branch_id: rowBranch ? Number(rowBranch) : undefined,
        department_id: rowDepartment ? Number(rowDepartment) : undefined,
      })
      setRows(result.rows)
      setRowsTotalPages(result.totalPages)
      setRowsTotal(result.total)
    } catch (error) {
      showErrorAlert(errorMessage(error, "Could not load the import rows."))
    } finally {
      setRowsLoading(false)
    }
  }, [activeBatchId, activeBatchStatus, rowsPage, rowFilter, rowSearch, rowLeaveType, rowBranch, rowDepartment])

  React.useEffect(() => {
    const timer = window.setTimeout(() => void loadRows(), rowSearch ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [loadRows, rowSearch])

  const showBatch = React.useCallback(
    (next: LeaveBalanceImportBatchDetail | null) => {
      setBatch(next)
      setRowsPage(1)
      setRowSearch("")
      setRowLeaveType("")
      setRowBranch("")
      setRowDepartment("")
      setRowFilter(next && next.invalid_rows > 0 && !isBatchFinished(next.status) ? "INVALID" : "ALL")
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      if (next) params.set("batch", next.batch_id)
      else params.delete("batch")
      const query = params.toString()
      const basePath = pathname ?? "/dashboard/leave-management/balance-import"
      router.replace(query ? `${basePath}?${query}` : basePath, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const openBatch = React.useCallback(
    async (batchId: string) => {
      const token = readToken()
      if (!token) return
      try {
        showBatch(await getLeaveBalanceImport(token, batchId))
      } catch (error) {
        showErrorAlert(errorMessage(error, "Could not open the import batch."))
      }
    },
    [showBatch],
  )

  // Deep link (?batch=LBI-...) so a batch survives refresh and can be shared.
  React.useEffect(() => {
    if (!actor.ready || !requestedBatchId || batch?.batch_id === requestedBatchId) return
    void openBatch(requestedBatchId)
  }, [actor.ready, batch?.batch_id, openBatch, requestedBatchId])

  const announceResult = React.useCallback(
    (result: LeaveBalanceImportBatchDetail) => {
      setRowFilter(result.failed_rows > 0 ? "FAILED" : "IMPORTED")
      if (result.status === "COMPLETED" || result.status === "PARTIALLY_COMPLETED") {
        showSuccessAlert(`${result.imported_rows} leave balance${result.imported_rows === 1 ? "" : "s"} updated. Batch ${result.batch_id}.`)
      } else if (result.status === "FAILED") {
        showErrorAlert(result.failure_reason ?? "The import did not complete.", "Import not completed")
      }
      void loadHistory()
    },
    [loadHistory],
  )

  // Imports run in the background: follow progress until the batch finishes.
  React.useEffect(() => {
    if (!batch || !["PROCESSING", "VALIDATING", "UPLOADED"].includes(batch.status)) return
    const timer = window.setInterval(() => {
      const token = readToken()
      if (!token) return
      void getLeaveBalanceImport(token, batch.batch_id)
        .then((next) => {
          if (next.status !== batch.status && isBatchFinished(next.status)) {
            showBatch(next)
            announceResult(next)
          } else if (next.status !== batch.status || next.processed_rows !== batch.processed_rows) {
            setBatch(next)
          }
        })
        .catch(() => undefined)
    }, 2000)
    return () => window.clearInterval(timer)
  }, [announceResult, batch, showBatch])

  async function downloadTemplate() {
    const token = readToken()
    if (!token) return
    setTemplateBusy(true)
    try {
      const result = await downloadLeaveBalanceImportTemplate(token, {
        fiscal_year: fiscalYear,
        branch_id: branchFilter ? Number(branchFilter) : undefined,
        department_id: departmentFilter ? Number(departmentFilter) : undefined,
        leave_type_id: leaveTypeFilter ? Number(leaveTypeFilter) : undefined,
      })
      downloadBlob(result.blob, result.filename)
    } catch (error) {
      showErrorAlert(errorMessage(error, "Template download failed."))
    } finally {
      setTemplateBusy(false)
    }
  }

  function selectFile(next: File | null) {
    setUploadError(null)
    if (next && !next.name.toLowerCase().endsWith(".xlsx")) {
      setFile(null)
      setUploadError("Select the downloaded template saved as an Excel Workbook (.xlsx).")
      return
    }
    setFile(next)
  }

  async function validateFile() {
    const token = readToken()
    if (!token || !file) return
    setUploading(true)
    setUploadError(null)
    try {
      const result = await uploadLeaveBalanceImport(token, file, { default_reason: defaultReason })
      showBatch(result)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      void loadHistory()
    } catch (error) {
      setUploadError(errorMessage(error, "The file could not be validated."))
    } finally {
      setUploading(false)
    }
  }

  function openConfirmation() {
    if (!batch) return
    setImportMode(defaultImportMode(batch))
    setAcknowledgeWarnings(false)
    setAcknowledgeSkippedRows(false)
    setConfirmOpen(true)
  }

  async function confirmImport() {
    const token = readToken()
    if (!token || !batch) return
    setConfirming(true)
    try {
      const result = await confirmLeaveBalanceImport(token, batch.batch_id, {
        import_mode: importMode,
        acknowledge_warnings: acknowledgeWarnings,
        acknowledge_skipped_rows: acknowledgeSkippedRows,
      })
      setConfirmOpen(false)
      if (isBatchFinished(result.status)) {
        showBatch(result)
        announceResult(result)
      } else {
        // Accepted: processing continues in the background (polled above).
        setBatch(result)
        void loadHistory()
      }
    } catch (error) {
      showErrorAlert(errorMessage(error, "The import could not be confirmed."))
      void openBatch(batch.batch_id)
    } finally {
      setConfirming(false)
    }
  }

  async function cancelBatch() {
    const token = readToken()
    if (!token || !batch) return
    try {
      showBatch(await cancelLeaveBalanceImport(token, batch.batch_id))
      void loadHistory()
    } catch (error) {
      showErrorAlert(errorMessage(error, "The import could not be cancelled."))
    }
  }

  async function downloadReport(batchId: string) {
    const token = readToken()
    if (!token) return
    setReportBusy(true)
    try {
      const result = await downloadLeaveBalanceImportReport(token, batchId)
      downloadBlob(result.blob, result.filename)
    } catch (error) {
      showErrorAlert(errorMessage(error, "The report could not be downloaded."))
    } finally {
      setReportBusy(false)
    }
  }

  const rowColumns = React.useMemo<Column<LeaveBalanceImportRow>[]>(
    () => [
      { key: "row_number", label: "Row", defaultWidth: 60, render: (row) => <span className="tabular-nums">{row.row_number}</span> },
      {
        key: "employee",
        label: "Employee",
        defaultWidth: 190,
        render: (row) => (
          <span className="block min-w-0">
            <span className="block truncate font-medium">{row.employee_no ?? "—"}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{row.employee_name ?? ""}</span>
          </span>
        ),
      },
      {
        key: "organisation",
        label: "Branch / Department",
        defaultWidth: 170,
        render: (row) => (
          <span className="block min-w-0 text-xs">
            <span className="block truncate">{row.branch_name ?? "—"}</span>
            <span className="block truncate text-muted-foreground">{row.department_name ?? ""}</span>
          </span>
        ),
      },
      {
        key: "leave_type",
        label: "Leave type",
        defaultWidth: 160,
        render: (row) => (
          <span className="block min-w-0">
            <span className="block truncate">{row.leave_type_name ?? row.leave_type_code ?? "—"}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{row.leave_type_code ?? ""}</span>
          </span>
        ),
      },
      { key: "db_current_balance", label: "DB balance", defaultWidth: 95, render: (row) => <span className="tabular-nums">{formatBalanceDays(row.db_current_balance)}</span> },
      {
        key: "uploaded_current_balance",
        label: "Uploaded",
        defaultWidth: 90,
        render: (row) => {
          const conflict =
            row.db_current_balance !== null &&
            row.uploaded_current_balance !== null &&
            Number(row.db_current_balance) !== Number(row.uploaded_current_balance)
          return (
            <span className={cn("tabular-nums", conflict ? "font-semibold text-rose-700 dark:text-rose-300" : undefined)}>
              {formatBalanceDays(row.uploaded_current_balance)}
              {conflict ? <span className="sr-only"> (does not match database)</span> : null}
            </span>
          )
        },
      },
      { key: "new_balance", label: "New", defaultWidth: 80, render: (row) => <span className="font-medium tabular-nums">{formatBalanceDays(row.new_balance)}</span> },
      {
        key: "adjustment_days",
        label: "Adjustment",
        defaultWidth: 95,
        render: (row) => {
          const value = Number(row.adjustment_days)
          return (
            <span
              className={cn(
                "tabular-nums",
                value > 0 ? "text-emerald-700 dark:text-emerald-300" : value < 0 ? "text-rose-700 dark:text-rose-300" : undefined,
              )}
            >
              {formatAdjustmentDays(row.adjustment_days)}
            </span>
          )
        },
      },
      { key: "reason", label: "Reason", defaultWidth: 170, render: (row) => <span className="block truncate text-xs" title={row.reason ?? ""}>{row.reason ?? "—"}</span> },
      {
        key: "status",
        label: "Status",
        defaultWidth: 150,
        render: (row) => <StatusLabel {...describeRowStatus(row)} />,
      },
      {
        key: "message",
        label: "Message",
        defaultWidth: 320,
        render: (row) => (
          <span className="block truncate text-xs text-muted-foreground" title={row.message ?? ""}>
            {row.message ?? "—"}
          </span>
        ),
      },
    ],
    [],
  )

  const historyColumns = React.useMemo<Column<LeaveBalanceImportBatch>[]>(
    () => [
      { key: "batch_id", label: "Batch ID", defaultWidth: 180, render: (item) => <span className="font-mono text-[11px]">{item.batch_id}</span> },
      { key: "uploaded_at", label: "Date", defaultWidth: 160, render: (item) => formatDateTime(item.uploaded_at) },
      { key: "original_file_name", label: "File name", defaultWidth: 200, render: (item) => <span className="block truncate" title={item.original_file_name}>{item.original_file_name}</span> },
      { key: "uploaded_by", label: "Imported by", defaultWidth: 150, render: (item) => item.confirmed_by?.name ?? item.uploaded_by?.name ?? "—" },
      { key: "total_rows", label: "Records", defaultWidth: 80, render: (item) => <span className="tabular-nums">{item.total_rows}</span> },
      { key: "imported_rows", label: "Successful", defaultWidth: 90, render: (item) => <span className="tabular-nums">{item.imported_rows}</span> },
      { key: "failed_rows", label: "Failed", defaultWidth: 70, render: (item) => <span className="tabular-nums">{item.failed_rows}</span> },
      { key: "skipped_rows", label: "Skipped", defaultWidth: 80, render: (item) => <span className="tabular-nums">{item.skipped_rows}</span> },
      { key: "status", label: "Status", defaultWidth: 160, render: (item) => <StatusLabel {...describeBatchStatus(item.status)} /> },
    ],
    [],
  )

  const confirmation = batch
    ? evaluateConfirmation(batch, { mode: importMode, acknowledgeWarnings, acknowledgeSkippedRows })
    : null
  const batchStatus = batch ? describeBatchStatus(batch.status) : null
  const facets = batch?.summary?.facets
  const finished = batch ? isBatchFinished(batch.status) : false
  const canContinue = Boolean(batch && (batch.actions.can_confirm_strict || batch.actions.can_confirm_valid_rows_only))

  if (actor.ready && !canExport && !canImport && !canViewHistory) {
    return (
      <div className="rounded-lg border border-border bg-background p-6 text-sm text-muted-foreground">
        You do not have access to leave balance bulk import.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Leave Balance Bulk Import</h2>
          <p className="max-w-3xl text-xs text-muted-foreground">
            Correct many Employee + Leave Type balances at once. Each balance is validated against current HRMS data, previewed, and only changed after you confirm; every change is recorded as a leave balance adjustment.
          </p>
        </div>
        <Link href="/dashboard/leave-management/balances" className={BUTTON}>
          <ArrowLeftIcon className="size-3.5" />
          Leave Balances
        </Link>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-background">
        <ImportStepper current={step} />

        {!batch || step === "validation" ? (
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            {canExport ? (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">1. Download template</h3>
                  <p className="text-xs text-muted-foreground">
                    The template lists every active employee you manage with each leave type they are eligible for. Current balances are generated from the system, the same figures shown in Leave Balances.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium">
                    <span>Leave year</span>
                    <FluentSelect
                      ariaLabel="Leave year"
                      size="small"
                      className="w-full"
                      value={fiscalYear}
                      onChange={setFiscalYear}
                      options={yearOptions.map((year) => ({ value: year, label: year }))}
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium">
                    <span>Leave type</span>
                    <FluentSelect
                      ariaLabel="Leave type"
                      size="small"
                      className="w-full"
                      value={leaveTypeFilter}
                      placeholder="All eligible leave types"
                      onChange={setLeaveTypeFilter}
                      options={[
                        { value: "", label: "All eligible leave types" },
                        ...leaveTypes.map((option) => ({ value: String(option.id), label: option.label })),
                      ]}
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium">
                    <span>Branch</span>
                    <FluentSelect
                      ariaLabel="Branch"
                      size="small"
                      className="w-full"
                      value={branchFilter}
                      placeholder="All branches"
                      onChange={setBranchFilter}
                      options={[
                        { value: "", label: "All branches" },
                        ...branches.map((option) => ({ value: String(option.id), label: option.label })),
                      ]}
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium">
                    <span>Department</span>
                    <FluentSelect
                      ariaLabel="Department"
                      size="small"
                      className="w-full"
                      value={departmentFilter}
                      placeholder="All departments"
                      onChange={setDepartmentFilter}
                      options={[
                        { value: "", label: "All departments" },
                        ...departments.map((option) => ({ value: String(option.id), label: option.label })),
                      ]}
                    />
                  </label>
                </div>
                <button type="button" className={PRIMARY_BUTTON} disabled={templateBusy} onClick={() => void downloadTemplate()}>
                  {templateBusy ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <DownloadIcon className="size-3.5" />}
                  {templateBusy ? "Preparing template…" : "Download Leave Balance Template"}
                </button>
                <p className="text-[11px] text-muted-foreground">
                  Enter the corrected figure in <strong>New Leave Balance</strong> and a reason in <strong>Adjustment Reason / Remarks</strong>. Leave New Leave Balance blank to keep a balance unchanged.
                </p>
              </div>
            ) : null}

            {canImport ? (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">2. Upload completed template</h3>
                  <p className="text-xs text-muted-foreground">Uploading validates the file only. No balance changes until you review the preview and confirm.</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  aria-label="Completed leave balance template"
                  onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDragging(false)
                    selectFile(event.dataTransfer.files?.[0] ?? null)
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-5 text-sm transition-colors",
                    dragging ? "border-primary bg-primary/[0.06]" : "border-border hover:bg-muted/40",
                  )}
                >
                  <FileSpreadsheetIcon className="size-8 shrink-0 text-emerald-600" aria-hidden />
                  <span className="min-w-0 flex-1">
                    {file ? (
                      <>
                        <span className="block truncate font-medium">{file.name}</span>
                        <span className="block text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB · ready to validate</span>
                      </>
                    ) : (
                      <>
                        <span className="block font-medium">Drop the completed template here</span>
                        <span className="block text-xs text-muted-foreground">or click to choose an .xlsx file (max 10 MB)</span>
                      </>
                    )}
                  </span>
                  {file ? (
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-muted"
                      aria-label="Remove file"
                      onClick={(event) => {
                        event.stopPropagation()
                        selectFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ""
                      }}
                    >
                      <XIcon className="size-4" />
                    </button>
                  ) : null}
                </div>
                <label className="block space-y-1 text-xs font-medium">
                  <span>Default adjustment reason (optional)</span>
                  <input
                    type="text"
                    maxLength={500}
                    value={defaultReason}
                    onChange={(event) => setDefaultReason(event.target.value)}
                    placeholder="Used for changed rows with a blank Adjustment Reason / Remarks"
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                  />
                </label>
                {uploadError ? (
                  <div role="alert" className={cn("flex gap-2 rounded-md border px-3 py-2 text-xs", TONE_STYLES.danger.panel)}>
                    <CircleXIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>{uploadError}</span>
                  </div>
                ) : null}
                <button type="button" className={PRIMARY_BUTTON} disabled={!file || uploading} onClick={() => void validateFile()}>
                  {uploading ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <UploadIcon className="size-3.5" />}
                  {uploading ? "Validating…" : "Validate file"}
                </button>
                {uploading ? (
                  <p className="text-xs text-muted-foreground" aria-live="polite">
                    Checking every Employee + Leave Type row against current employee, eligibility and balance data…
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {batch && step !== "validation" ? (
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">{finished ? "Import result" : "Import preview"}</h3>
                  {batchStatus ? <StatusLabel {...batchStatus} /> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Batch <span className="font-mono">{batch.batch_id}</span> · {batch.original_file_name} · leave year {batch.fiscal_year} · uploaded {formatDateTime(batch.uploaded_at)}
                  {batch.uploaded_by ? ` by ${batch.uploaded_by.name}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={BUTTON} disabled={reportBusy} onClick={() => void downloadReport(batch.batch_id)}>
                  {reportBusy ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <DownloadIcon className="size-3.5" />}
                  {batch.invalid_rows > 0 || batch.failed_rows > 0 ? "Download error report" : "Download report"}
                </button>
                {batch.actions.can_cancel ? (
                  <button type="button" className={BUTTON} onClick={() => void cancelBatch()}>
                    Cancel import
                  </button>
                ) : null}
                <button type="button" className={BUTTON} onClick={() => showBatch(null)}>
                  <UploadIcon className="size-3.5" />
                  New import
                </button>
                {!finished && canImport ? (
                  <button type="button" className={PRIMARY_BUTTON} disabled={!canContinue} onClick={openConfirmation}>
                    Continue to confirmation
                  </button>
                ) : null}
              </div>
            </div>

            {finished ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Successful updates" value={batch.imported_rows} tone="success" />
                <Stat label="Failed" value={batch.failed_rows} tone={batch.failed_rows ? "danger" : "neutral"} />
                <Stat label="Skipped" value={batch.skipped_rows} />
                <Stat label="Employees affected" value={batch.employees_affected} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                <Stat label="Records" value={batch.total_rows} />
                <Stat label="Employees" value={batch.total_employees} />
                <Stat label="Valid" value={batch.valid_rows} tone="success" />
                <Stat label="Warnings" value={batch.warning_rows} tone={batch.warning_rows ? "warn" : "neutral"} />
                <Stat label="Invalid" value={batch.invalid_rows} tone={batch.invalid_rows ? "danger" : "neutral"} />
                <Stat label="No change" value={batch.no_change_rows} />
                <Stat label="Net adjustment" value={formatAdjustmentDays(batch.summary?.net_adjustment_days ?? null)} />
              </div>
            )}

            {batch.status === "PROCESSING" ? (
              <div role="status" aria-live="polite" className={cn("space-y-2 rounded-md border px-3 py-2 text-xs", TONE_STYLES.info.panel)}>
                <p className="flex items-center gap-2 font-medium">
                  <FluentLoadingIndicator className="size-3.5 animate-spin" aria-hidden />
                  Importing in the background · {importProgress(batch).processed} / {importProgress(batch).total} records processed
                </p>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-sky-100 dark:bg-sky-950"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={importProgress(batch).percent}
                  aria-label="Import progress"
                >
                  <div className="h-full bg-sky-500 transition-all" style={{ width: `${importProgress(batch).percent}%` }} />
                </div>
                <p>You can leave this page; the import continues and appears in Import History with batch {batch.batch_id}.</p>
              </div>
            ) : null}
            {batch.failure_reason ? (
              <div role="alert" className={cn("flex gap-2 rounded-md border px-3 py-2 text-xs", TONE_STYLES.danger.panel)}>
                <CircleXIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{batch.failure_reason}</span>
              </div>
            ) : null}
            {!finished && batch.invalid_rows > 0 ? (
              <div className={cn("flex gap-2 rounded-md border px-3 py-2 text-xs", TONE_STYLES.danger.panel)}>
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {batch.invalid_rows} row(s) cannot be imported. Download the error report, correct them (download a new template for balance mismatches) and upload again
                  {batch.actions.can_confirm_valid_rows_only ? ", or import only the valid rows." : "."}
                </span>
              </div>
            ) : null}
            {!finished && batch.status === "VALIDATED" ? (
              <div className={cn("flex gap-2 rounded-md border px-3 py-2 text-xs", TONE_STYLES.neutral.panel)}>
                <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>The file contains no balance changes. Enter values in New Leave Balance for the balances you want to correct.</span>
              </div>
            ) : null}

            <ResizableTable
              title="Employee + Leave Type records"
              compact
              showExport={false}
              showSort={false}
              storageKey="leave-balance-import-rows"
              data={rows}
              columns={rowColumns}
              loading={rowsLoading}
              getRowId={(row) => String(row.id)}
              onRowSelect={(_, row) => setSelectedRow(row ?? null)}
              page={rowsPage}
              totalPages={rowsTotalPages}
              totalItems={rowsTotal}
              onPageChange={setRowsPage}
              toolbarActions={
                <>
                  <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter records by status">
                    {buildRowFilterOptions(batch).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={rowFilter === option.value}
                        className={cn(
                          "h-7 rounded-md border px-2 text-[11px] font-medium",
                          rowFilter === option.value ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted",
                        )}
                        onClick={() => {
                          setRowFilter(option.value)
                          setRowsPage(1)
                        }}
                      >
                        {option.label}
                        {option.count !== null ? <span className="ml-1 tabular-nums">{option.count}</span> : null}
                      </button>
                    ))}
                  </div>
                  <input
                    type="search"
                    value={rowSearch}
                    onChange={(event) => {
                      setRowSearch(event.target.value)
                      setRowsPage(1)
                    }}
                    placeholder="Employee number or name"
                    aria-label="Search by employee number or name"
                    className="h-8 w-44 rounded-md border border-border bg-background px-2 text-xs"
                  />
                  {facets?.leave_types?.length ? (
                    <FluentSelect
                      ariaLabel="Filter by leave type"
                      size="small"
                      value={rowLeaveType}
                      placeholder="All leave types"
                      onChange={(value) => { setRowLeaveType(value); setRowsPage(1) }}
                      options={[
                        { value: "", label: "All leave types" },
                        ...facets.leave_types.map((option) => ({ value: String(option.id), label: option.name })),
                      ]}
                    />
                  ) : null}
                  {facets?.branches && facets.branches.length > 1 ? (
                    <FluentSelect
                      ariaLabel="Filter by branch"
                      size="small"
                      value={rowBranch}
                      placeholder="All branches"
                      onChange={(value) => { setRowBranch(value); setRowsPage(1) }}
                      options={[
                        { value: "", label: "All branches" },
                        ...facets.branches.map((option) => ({ value: String(option.id), label: option.name })),
                      ]}
                    />
                  ) : null}
                  {facets?.departments && facets.departments.length > 1 ? (
                    <FluentSelect
                      ariaLabel="Filter by department"
                      size="small"
                      value={rowDepartment}
                      placeholder="All departments"
                      onChange={(value) => { setRowDepartment(value); setRowsPage(1) }}
                      options={[
                        { value: "", label: "All departments" },
                        ...facets.departments.map((option) => ({ value: String(option.id), label: option.name })),
                      ]}
                    />
                  ) : null}
                </>
              }
            />
          </div>
        ) : null}
      </section>

      {canViewHistory ? (
        <section className="space-y-2">
          <ResizableTable
            title="Import History"
            compact
            showExport={false}
            storageKey="leave-balance-import-history"
            data={history}
            columns={historyColumns}
            loading={historyLoading}
            getRowId={(item) => item.batch_id}
            onRowSelect={(batchId) => void openBatch(batchId)}
            page={historyPage}
            totalPages={historyTotalPages}
            totalItems={historyTotal}
            onPageChange={setHistoryPage}
            toolbarStart={
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <HistoryIcon className="size-3.5" aria-hidden />
                Select a batch to inspect its records
              </span>
            }
            toolbarActions={
              <button type="button" className={BUTTON} disabled={historyLoading} onClick={() => void loadHistory()}>
                <RefreshCcwIcon className={cn("size-3.5", historyLoading ? "animate-spin" : undefined)} />
                Refresh
              </button>
            }
          />
        </section>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={(open) => { if (!confirming) setConfirmOpen(open) }}>
        <AlertDialogContent className="max-w-lg sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Balance Import Summary</AlertDialogTitle>
            <AlertDialogDescription>
              Review the summary before any balance changes. Every changed balance is re-checked against the database immediately before it is written.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {batch && confirmation ? (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-border bg-muted/30 p-3 text-xs">
                {buildImportSummary(batch).map((item) => (
                  <React.Fragment key={item.label}>
                    <dt className="text-muted-foreground">{item.label}</dt>
                    <dd className="text-right font-semibold tabular-nums">{item.value}</dd>
                  </React.Fragment>
                ))}
              </dl>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold">Import mode</legend>
                <label className={cn("flex gap-2 rounded-md border p-2 text-xs", importMode === "STRICT" ? "border-primary bg-primary/[0.05]" : "border-border")}>
                  <input
                    type="radio"
                    name="leave-balance-import-mode"
                    className="mt-0.5"
                    checked={importMode === "STRICT"}
                    disabled={!batch.actions.can_confirm_strict}
                    onChange={() => setImportMode("STRICT")}
                  />
                  <span>
                    <span className="block font-medium">Strict (recommended)</span>
                    <span className="block text-muted-foreground">All changes are imported together. If any row is invalid or any balance changed, nothing is imported.</span>
                  </span>
                </label>
                {batch.actions.can_confirm_valid_rows_only ? (
                  <label className={cn("flex gap-2 rounded-md border p-2 text-xs", importMode === "VALID_ROWS_ONLY" ? "border-primary bg-primary/[0.05]" : "border-border")}>
                    <input
                      type="radio"
                      name="leave-balance-import-mode"
                      className="mt-0.5"
                      checked={importMode === "VALID_ROWS_ONLY"}
                      onChange={() => setImportMode("VALID_ROWS_ONLY")}
                    />
                    <span>
                      <span className="block font-medium">Valid rows only</span>
                      <span className="block text-muted-foreground">
                        Import {confirmation.importing} changed balance(s) and skip {batch.invalid_rows} invalid row(s). Rows whose balance changed after validation are also skipped.
                      </span>
                    </span>
                  </label>
                ) : null}
              </fieldset>

              {batch.warning_rows > 0 ? (
                <label className={cn("flex gap-2 rounded-md border px-3 py-2 text-xs", TONE_STYLES.warn.panel)}>
                  <input type="checkbox" className="mt-0.5" checked={acknowledgeWarnings} onChange={(event) => setAcknowledgeWarnings(event.target.checked)} />
                  <span>I reviewed the {batch.warning_rows} row(s) with warnings and want to import them.</span>
                </label>
              ) : null}
              {importMode === "VALID_ROWS_ONLY" && batch.invalid_rows > 0 ? (
                <label className={cn("flex gap-2 rounded-md border px-3 py-2 text-xs", TONE_STYLES.danger.panel)}>
                  <input type="checkbox" className="mt-0.5" checked={acknowledgeSkippedRows} onChange={(event) => setAcknowledgeSkippedRows(event.target.checked)} />
                  <span>I understand {batch.invalid_rows} invalid row(s) will be skipped and not imported.</span>
                </label>
              ) : null}
              {confirmation.reason ? <p className="text-xs text-muted-foreground">{confirmation.reason}</p> : null}
              {confirming ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
                  <FluentLoadingIndicator className="size-3.5 animate-spin" />
                  Submitting {confirmation.importing} balance change(s) for import…
                </p>
              ) : null}
            </div>
          ) : null}
          <AlertDialogFooter>
            <button type="button" className={BUTTON} disabled={confirming} onClick={() => setConfirmOpen(false)}>
              Back to preview
            </button>
            <button type="button" className={PRIMARY_BUTTON} disabled={!confirmation?.allowed || confirming} onClick={() => void confirmImport()}>
              {confirming ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <CheckCircle2Icon className="size-3.5" />}
              Confirm Import
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={selectedRow !== null} onOpenChange={(open) => { if (!open) setSelectedRow(null) }}>
        <AlertDialogContent className="max-w-lg">
          {selectedRow ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Row {selectedRow.row_number}: {selectedRow.employee_no ?? "—"} · {selectedRow.leave_type_name ?? selectedRow.leave_type_code ?? "—"}
                </AlertDialogTitle>
                <AlertDialogDescription>{selectedRow.employee_name ?? ""}</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3 text-xs">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border bg-muted/30 p-3">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="text-right"><StatusLabel {...describeRowStatus(selectedRow)} /></dd>
                  <dt className="text-muted-foreground">Database balance</dt>
                  <dd className="text-right tabular-nums">{formatBalanceDays(selectedRow.db_current_balance)}</dd>
                  <dt className="text-muted-foreground">Template balance</dt>
                  <dd className="text-right tabular-nums">{formatBalanceDays(selectedRow.uploaded_current_balance)}</dd>
                  <dt className="text-muted-foreground">New balance</dt>
                  <dd className="text-right tabular-nums">{formatBalanceDays(selectedRow.new_balance)}</dd>
                  <dt className="text-muted-foreground">Adjustment</dt>
                  <dd className="text-right tabular-nums">{formatAdjustmentDays(selectedRow.adjustment_days)}</dd>
                  {selectedRow.result_status === "IMPORTED" ? (
                    <>
                      <dt className="text-muted-foreground">Balance at import</dt>
                      <dd className="text-right tabular-nums">
                        {formatBalanceDays(selectedRow.previous_balance_at_import)} → {formatBalanceDays(selectedRow.new_balance_at_import)}
                      </dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">Reason</dt>
                  <dd className="text-right">{selectedRow.reason ?? "—"}</dd>
                </dl>
                {selectedRow.issues.length ? (
                  <ul className="space-y-1.5">
                    {selectedRow.issues.map((issue, index) => {
                      const tone: ImportTone = issue.severity === "error" ? "danger" : issue.severity === "warning" ? "warn" : "neutral"
                      const Icon = TONE_ICONS[tone]
                      return (
                        <li key={`${issue.code}-${index}`} className={cn("flex gap-2 rounded-md border px-2.5 py-1.5", TONE_STYLES[tone].panel)}>
                          <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                          <span>
                            <span className="block font-mono text-[10px] opacity-80">{issue.code}</span>
                            {issue.message}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
              <AlertDialogFooter>
                <button type="button" className={BUTTON} onClick={() => setSelectedRow(null)}>
                  Close
                </button>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
