"use client"

import * as React from "react"
import {
  DownloadIcon,
  FileSpreadsheetIcon,
  FileSearchIcon,
  Loader2Icon,
  RefreshCcwIcon,
  SendIcon,
  UploadIcon,
  XIcon,
} from "lucide-react"

import {
  confirmEmployeeImport,
  downloadEmployeeImportTemplate,
  getEmployeeImportResult,
  listEmployeeImportHistory,
  previewEmployeeImport,
  startEmployeeImport,
  type AdminRecord,
  type EmployeeImportMode,
  type EmployeeImportResultResponse,
} from "@/lib/admin-api"
import { subscribeToDashboardActorSnapshot } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const IMPORT_MODES: Array<{ value: EmployeeImportMode; label: string; hint: string }> = [
  {
    value: "CREATE_ONLY",
    label: "Add new only",
    hint: "Skip people who already exist",
  },
  {
    value: "UPDATE_EXIST",
    label: "Update existing only",
    hint: "Change current records, no new hires",
  },
  {
    value: "CREATE_OR_UPDATE",
    label: "Add & update",
    hint: "New people plus updates",
  },
]

const IMPORT_ISSUE_KEYS = [
  "invalid_rows",
  "invalidRows",
  "row_errors",
  "rowErrors",
  "validation_errors",
  "validationErrors",
  "failed_rows",
  "failedRows",
  "errors",
]

type ImportOverview = {
  totalRows: number | null
  validRows: number | null
  invalidRows: number | null
  newRows: number | null
  updatedRows: number | null
  skippedRows: number | null
  processedRows: number | null
  successRows: number | null
  failedRows: number | null
}

type ImportIssue = {
  rowLabel: string
  employeeLabel: string
  fieldLabel: string
  message: string
}

type PreviewDetails = {
  payload: AdminRecord | null
  previewToken: string
  importMode: string
  processValidRowsOnly: boolean | null
  overview: ImportOverview
  issues: ImportIssue[]
}

type BatchDetails = {
  payload: AdminRecord | null
  batchId: string
  importMode: string
  status: string
  processValidRowsOnly: boolean | null
  createdAt: string
  updatedAt: string
  completedAt: string
  overview: ImportOverview
  issues: ImportIssue[]
  /** When the /result endpoint returns an Excel report instead of JSON status. */
  resultReport: { blob: Blob; filename: string } | null
}

type HistorySummary = {
  batchId: string
  mode: string
  status: string
  createdAt: string
  totalRows: number | null
  validRows: number | null
  invalidRows: number | null
}

function readStoredToken(): string {
  return readStoredSessionTokens().accessToken.trim()
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as AdminRecord) : null
}

function asRecordArray(value: unknown): AdminRecord[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const records = value.filter(
    (entry): entry is AdminRecord => typeof entry === "object" && entry !== null && !Array.isArray(entry)
  )
  return records.length > 0 ? records : null
}

function readString(record: AdminRecord | null, keys: string[], fallback = "") {
  if (!record) return fallback
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return fallback
}

function readNumber(record: AdminRecord | null, keys: string[]) {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
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

function readBoolean(record: AdminRecord | null, keys: string[]) {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "boolean") {
      return value
    }
    if (typeof value === "string" && value.trim()) {
      const normalized = value.trim().toLowerCase()
      if (normalized === "true") return true
      if (normalized === "false") return false
    }
  }
  return null
}

function collectRecords(value: unknown, seen = new Set<AdminRecord>()): AdminRecord[] {
  const record = asRecord(value)
  if (!record || seen.has(record)) {
    return []
  }

  seen.add(record)
  const nested = Object.values(record).flatMap((entry) => {
    const nestedRecord = asRecord(entry)
    if (nestedRecord) {
      return collectRecords(nestedRecord, seen)
    }
    if (Array.isArray(entry)) {
      return entry.flatMap((item) => collectRecords(item, seen))
    }
    return []
  })

  return [record, ...nested]
}

function readStringFromCandidates(records: AdminRecord[], keys: string[], fallback = "") {
  for (const record of records) {
    const value = readString(record, keys, "")
    if (value) {
      return value
    }
  }
  return fallback
}

function readNumberFromCandidates(records: AdminRecord[], keys: string[]) {
  for (const record of records) {
    const value = readNumber(record, keys)
    if (value !== null) {
      return value
    }
  }
  return null
}

function readBooleanFromCandidates(records: AdminRecord[], keys: string[]) {
  for (const record of records) {
    const value = readBoolean(record, keys)
    if (value !== null) {
      return value
    }
  }
  return null
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim())
}

function formatDateTime(value: string) {
  if (!value.trim()) {
    return "—"
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed)
}

function formatModeLabel(value: string) {
  const match = IMPORT_MODES.find((mode) => mode.value === value)
  if (match) {
    return match.label
  }
  return value ? value.replace(/_/g, " ") : "—"
}

function buildOverview(records: AdminRecord[]): ImportOverview {
  return {
    totalRows: readNumberFromCandidates(records, [
      "total_rows",
      "totalRows",
      "row_count",
      "rowCount",
      "total",
      "rows_total",
      "rowsTotal",
      "records_total",
      "recordsTotal",
    ]),
    validRows: readNumberFromCandidates(records, [
      "valid_rows",
      "validRows",
      "valid_count",
      "validCount",
    ]),
    invalidRows: readNumberFromCandidates(records, [
      "invalid_rows",
      "invalidRows",
      "invalid_count",
      "invalidCount",
    ]),
    newRows: readNumberFromCandidates(records, [
      "new_rows",
      "newRows",
      "created_rows",
      "createdRows",
      "created_count",
      "createdCount",
      "inserted_rows",
      "insertedRows",
    ]),
    updatedRows: readNumberFromCandidates(records, [
      "updated_rows",
      "updatedRows",
      "updated_count",
      "updatedCount",
    ]),
    skippedRows: readNumberFromCandidates(records, [
      "skipped_rows",
      "skippedRows",
      "skipped_count",
      "skippedCount",
    ]),
    processedRows: readNumberFromCandidates(records, [
      "processed_rows",
      "processedRows",
      "processed_count",
      "processedCount",
    ]),
    successRows: readNumberFromCandidates(records, [
      "success_rows",
      "successRows",
      "successful_rows",
      "successfulRows",
      "success_count",
      "successCount",
      "succeeded",
      "successful",
    ]),
    // Prefer *count keys so an array named failed_rows is not misread as a number.
    failedRows: readNumberFromCandidates(records, [
      "failed_rows_count",
      "failedRowsCount",
      "failure_count",
      "failureCount",
      "failed_count",
      "failedCount",
      "error_count",
      "errorCount",
      "errors_count",
      "errorsCount",
      "failed_rows",
      "failedRows",
      "failed",
    ]),
  }
}

function looksLikeBinaryMessage(text: string): boolean {
  if (!text) return false
  if (text.startsWith("PK") || text.includes("[Content_Types].xml") || text.includes("xl/worksheets")) {
    return true
  }
  const sample = text.slice(0, 400)
  let nonPrintable = 0
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i)
    if (code === 0 || (code < 9) || (code > 13 && code < 32)) {
      nonPrintable += 1
    }
  }
  return sample.length > 40 && nonPrintable / sample.length > 0.04
}

function sanitizeIssueText(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ""
  if (looksLikeBinaryMessage(trimmed)) {
    return ""
  }
  return trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed
}

function extractIssueMessage(record: AdminRecord | null): string {
  if (!record) {
    return ""
  }

  // Never treat a binary/file payload marker as a row issue.
  if (record._binaryResponse === true) {
    return ""
  }

  const direct = sanitizeIssueText(
    readString(record, ["message", "error", "reason", "detail", "description"], "") ||
      readStringArray(record.messages).join("; ") ||
      readStringArray(record.errors).join("; ")
  )

  if (direct) {
    return direct
  }

  const fieldErrors = asRecord(record.field_errors) ?? asRecord(record.fieldErrors)
  if (fieldErrors) {
    const parts = Object.entries(fieldErrors).flatMap(([field, value]) => {
      const messages = readStringArray(value)
        .map((entry) => sanitizeIssueText(entry))
        .filter(Boolean)
      if (messages.length > 0) {
        return [`${field}: ${messages.join(", ")}`]
      }
      const nestedRecord = asRecord(value)
      if (!nestedRecord) {
        return []
      }
      const nestedMessage = extractIssueMessage(nestedRecord)
      return nestedMessage ? [`${field}: ${nestedMessage}`] : []
    })
    if (parts.length > 0) {
      return parts.join("; ")
    }
  }

  return ""
}

function normalizeIssue(row: AdminRecord): ImportIssue | null {
  const messages = extractIssueMessage(row)
  if (!messages) {
    // Skip empty / binary garbage issues entirely.
    const hasStructured =
      readNumber(row, ["row_number", "rowNumber", "row", "index", "line_number", "lineNumber"]) !== null
    if (!hasStructured) {
      return null
    }
  }
  const rowNumber =
    readNumber(row, ["row_number", "rowNumber", "row", "index", "line_number", "lineNumber"]) ?? null
  const employeeLabel =
    readString(row, ["employee_no", "employeeNo", "employee_number", "employeeNumber", "email", "full_name", "fullName"], "") ||
    "—"
  const fieldLabel =
    readString(row, ["field", "column", "attribute"], "") ||
    Object.keys(asRecord(row.field_errors) ?? asRecord(row.fieldErrors) ?? {})[0] ||
    "—"

  return {
    rowLabel: rowNumber !== null ? `Row ${rowNumber}` : "—",
    employeeLabel,
    fieldLabel,
    message: messages || "Row failed validation.",
  }
}

function extractIssues(root: AdminRecord | null, records: AdminRecord[]): ImportIssue[] {
  const issues: ImportIssue[] = []

  for (const record of records) {
    for (const key of IMPORT_ISSUE_KEYS) {
      const rows = asRecordArray(record[key])
      if (!rows) {
        continue
      }
      for (const row of rows) {
        if (issues.length >= 25) {
          return issues
        }
        const issue = normalizeIssue(row)
        if (issue) {
          issues.push(issue)
        }
      }
    }
  }

  if (issues.length === 0 && root && root._binaryResponse !== true) {
    const rootMessage = extractIssueMessage(root)
    if (rootMessage) {
      issues.push({
        rowLabel: "—",
        employeeLabel: "—",
        fieldLabel: "General",
        message: rootMessage,
      })
    }
  }

  return issues
}

function isUsableImportPayload(payload: AdminRecord | null): boolean {
  if (!payload) return false
  if (payload._binaryResponse === true) return false
  const message = typeof payload.message === "string" ? payload.message : ""
  if (message && looksLikeBinaryMessage(message)) return false
  return true
}

function extractPreviewDetails(payload: AdminRecord | null): PreviewDetails | null {
  if (!isUsableImportPayload(payload)) {
    return null
  }
  const records = collectRecords(payload)
  return {
    payload,
    previewToken: readStringFromCandidates(records, ["preview_token", "previewToken"]),
    importMode: readStringFromCandidates(records, ["import_mode", "importMode", "mode"]),
    processValidRowsOnly: readBooleanFromCandidates(records, ["process_valid_rows_only", "processValidRowsOnly"]),
    overview: buildOverview(records),
    issues: extractIssues(payload, records),
  }
}

function extractBatchDetails(
  payload: AdminRecord | null,
  options?: { fallbackBatchId?: string; resultReport?: BatchDetails["resultReport"] }
): BatchDetails | null {
  if (!isUsableImportPayload(payload)) {
    return null
  }
  const records = collectRecords(payload)
  // Require at least one recognizable import field so binary-as-JSON stubs don't become "Last import".
  const batchId =
    readStringFromCandidates(records, [
      "batch_id",
      "batchId",
      "import_batch_id",
      "importBatchId",
      "job_id",
      "jobId",
      "import_id",
      "importId",
      "uuid",
      "id",
    ]) || (options?.fallbackBatchId?.trim() ?? "")
  const status = readStringFromCandidates(records, [
    "status",
    "state",
    "import_status",
    "importStatus",
    "job_status",
    "jobStatus",
    "batch_status",
    "batchStatus",
  ])
  const overview = buildOverview(records)
  const hasOverviewNumber = Object.values(overview).some((value) => value !== null)
  const issues = extractIssues(payload, records)
  if (!batchId && !status && !hasOverviewNumber && issues.length === 0) {
    return null
  }
  return {
    payload,
    batchId,
    importMode: readStringFromCandidates(records, ["import_mode", "importMode", "mode"]),
    status,
    processValidRowsOnly: readBooleanFromCandidates(records, [
      "process_valid_rows_only",
      "processValidRowsOnly",
    ]),
    createdAt: readStringFromCandidates(records, ["created_at", "createdAt"]),
    updatedAt: readStringFromCandidates(records, ["updated_at", "updatedAt"]),
    completedAt: readStringFromCandidates(records, [
      "completed_at",
      "completedAt",
      "finished_at",
      "finishedAt",
    ]),
    overview,
    issues,
    resultReport: options?.resultReport ?? null,
  }
}

function batchDetailsFromHistorySummary(
  summary: HistorySummary,
  resultReport: BatchDetails["resultReport"] = null
): BatchDetails | null {
  if (!summary.batchId || summary.batchId === "—") {
    return null
  }
  return {
    payload: null,
    batchId: summary.batchId,
    importMode: summary.mode === "—" ? "" : summary.mode,
    status: summary.status === "—" ? "" : summary.status,
    processValidRowsOnly: null,
    createdAt: summary.createdAt === "—" ? "" : summary.createdAt,
    updatedAt: "",
    completedAt: "",
    overview: {
      totalRows: summary.totalRows,
      validRows: summary.validRows,
      invalidRows: summary.invalidRows,
      newRows: null,
      updatedRows: null,
      skippedRows: null,
      processedRows: null,
      successRows: null,
      failedRows: null,
    },
    issues: [],
    resultReport,
  }
}

function extractHistorySummary(row: AdminRecord): HistorySummary {
  const records = collectRecords(row)
  return {
    batchId: readStringFromCandidates(
      records,
      ["batch_id", "batchId", "import_batch_id", "importBatchId", "job_id", "jobId", "import_id", "importId", "uuid", "id"],
      "—"
    ),
    mode: readStringFromCandidates(records, ["import_mode", "importMode", "mode"], "—"),
    status: readStringFromCandidates(
      records,
      ["status", "state", "import_status", "importStatus", "job_status", "jobStatus"],
      "—"
    ),
    createdAt: readStringFromCandidates(
      records,
      ["created_at", "createdAt", "generated_at", "generatedAt"],
      "—"
    ),
    totalRows: readNumberFromCandidates(records, [
      "total_rows",
      "totalRows",
      "row_count",
      "rowCount",
      "total",
    ]),
    validRows: readNumberFromCandidates(records, ["valid_rows", "validRows", "valid_count", "validCount"]),
    invalidRows: readNumberFromCandidates(records, [
      "invalid_rows",
      "invalidRows",
      "invalid_count",
      "invalidCount",
    ]),
  }
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

function isSupportedEmployeeImportFile(file: File | null) {
  if (!file) {
    return false
  }

  const normalizedName = file.name.trim().toLowerCase()
  return normalizedName.endsWith(".xlsx")
}

function formatStatusLabel(value: string) {
  const trimmed = value.trim()
  if (!trimmed || trimmed === "—") return "Unknown"
  return trimmed.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/** Colored text + dot (no chip/badge) — matches employees list status style. */
function StatusText({ value }: { value: string }) {
  const normalized = value.trim().toLowerCase()
  const display = formatStatusLabel(value)

  const tone =
    normalized.includes("complete") ||
    normalized.includes("success") ||
    normalized === "done"
      ? "text-emerald-600 dark:text-emerald-400"
      : normalized.includes("fail") ||
          normalized.includes("error") ||
          normalized.includes("reject") ||
          normalized.includes("cancel")
        ? "text-rose-600 dark:text-rose-400"
        : normalized.includes("process") ||
            normalized.includes("run") ||
            normalized.includes("progress") ||
            normalized.includes("import")
          ? "text-sky-600 dark:text-sky-400"
          : normalized.includes("pend") ||
              normalized.includes("wait") ||
              normalized.includes("queue") ||
              normalized.includes("draft")
            ? "text-amber-600 dark:text-amber-400"
            : "text-slate-600 dark:text-slate-300"

  const dot =
    normalized.includes("complete") ||
    normalized.includes("success") ||
    normalized === "done"
      ? "bg-emerald-500"
      : normalized.includes("fail") ||
          normalized.includes("error") ||
          normalized.includes("reject") ||
          normalized.includes("cancel")
        ? "bg-rose-500"
        : normalized.includes("process") ||
            normalized.includes("run") ||
            normalized.includes("progress") ||
            normalized.includes("import")
          ? "bg-sky-500"
          : normalized.includes("pend") ||
              normalized.includes("wait") ||
              normalized.includes("queue") ||
              normalized.includes("draft")
            ? "bg-amber-500"
            : "bg-slate-400"

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${tone}`}
      title={display}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      {display}
    </span>
  )
}

type HistoryTableRow = HistorySummary & {
  id: string
}

function statusFilterKey(status: string) {
  return status.trim().toLowerCase()
}

function OverviewGrid({ overview }: { overview: ImportOverview }) {
  // Keep only the clearest numbers for a non-technical user.
  const primary = [
    { label: "In file", value: overview.totalRows, tone: "default" as const },
    { label: "Ready", value: overview.validRows ?? overview.successRows, tone: "good" as const },
    {
      label: "Needs fix",
      value: overview.invalidRows ?? overview.failedRows,
      tone: "bad" as const,
    },
  ].filter((item) => item.value !== null)

  const secondary = [
    { label: "New", value: overview.newRows },
    { label: "Updated", value: overview.updatedRows },
    { label: "Skipped", value: overview.skippedRows },
  ].filter((item) => item.value !== null)

  if (primary.length === 0 && secondary.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No summary yet.</p>
    )
  }

  return (
    <div className="space-y-2">
      {primary.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {primary.map((item) => (
            <div
              key={item.label}
              className={`rounded-lg border px-2.5 py-2 ${
                item.tone === "good"
                  ? "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                  : item.tone === "bad"
                    ? "border-destructive/25 bg-destructive/5"
                    : "border-border/70 bg-muted/20"
              }`}
            >
              <div className="text-[11px] text-muted-foreground">{item.label}</div>
              <div className="text-xl font-semibold tabular-nums text-foreground">{item.value}</div>
            </div>
          ))}
        </div>
      ) : null}
      {secondary.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {secondary.map((item) => (
            <span key={item.label}>
              {item.label}: <span className="font-medium text-foreground">{item.value}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function IssueTable({
  issues,
  emptyMessage,
}: {
  issues: ImportIssue[]
  emptyMessage: string
}) {
  if (issues.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="max-h-56 overflow-auto rounded-lg border border-border/70">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 w-16">Row</TableHead>
            <TableHead className="h-8">Who</TableHead>
            <TableHead className="h-8">Problem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue, index) => (
            <TableRow key={`${issue.rowLabel}-${issue.employeeLabel}-${index}`}>
              <TableCell className="py-1.5 text-xs">{issue.rowLabel}</TableCell>
              <TableCell className="py-1.5 text-xs">{issue.employeeLabel}</TableCell>
              <TableCell className="max-w-md whitespace-normal break-words py-1.5 text-xs">
                {issue.fieldLabel !== "—" ? (
                  <span className="text-muted-foreground">{issue.fieldLabel}: </span>
                ) : null}
                {issue.message}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function EmployeeImportView() {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [token, setToken] = React.useState("")
  const [importMode, setImportMode] = React.useState<EmployeeImportMode>("CREATE_ONLY")
  const [processValidRowsOnly, setProcessValidRowsOnly] = React.useState(true)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [previewDetails, setPreviewDetails] = React.useState<PreviewDetails | null>(null)
  const [latestBatch, setLatestBatch] = React.useState<BatchDetails | null>(null)
  const [inspectedBatchId, setInspectedBatchId] = React.useState("")
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const [historyRows, setHistoryRows] = React.useState<AdminRecord[]>([])
  const [historyPage, setHistoryPage] = React.useState(1)
  const [historyLimit] = React.useState(20)
  const [historyTotal, setHistoryTotal] = React.useState<number | null>(null)
  const [historyStatusFilter, setHistoryStatusFilter] = React.useState("")

  const [loadingHistory, setLoadingHistory] = React.useState(false)
  const [previewing, setPreviewing] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const [checkingResult, setCheckingResult] = React.useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = React.useState(false)

  const syncTokenFromSession = React.useCallback(() => {
    const nextToken = readStoredToken()
    setToken((currentToken) => (currentToken === nextToken ? currentToken : nextToken))
  }, [])

  React.useEffect(() => {
    syncTokenFromSession()

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncTokenFromSession()
      }
    }

    const handleFocus = () => {
      syncTokenFromSession()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    const unsubscribe = subscribeToDashboardActorSnapshot(() => {
      syncTokenFromSession()
    })

    return () => {
      unsubscribe()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [syncTokenFromSession])

  const loadHistory = React.useCallback(async () => {
    if (!token) return
    setLoadingHistory(true)
    try {
      const history = await listEmployeeImportHistory(token, {
        page: historyPage,
        limit: historyLimit,
      })
      setHistoryRows(history.rows)
      setHistoryTotal(history.total)
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : "Failed to load employee import history.")
    } finally {
      setLoadingHistory(false)
    }
  }, [historyLimit, historyPage, token])

  React.useEffect(() => {
    if (!token) {
      setError("Authentication token not found. Please log in again.")
      return
    }
    setError((currentError) =>
      currentError === "Authentication token not found. Please log in again." ? null : currentError
    )
    void loadHistory()
  }, [loadHistory, token])

  const inspectBatch = React.useCallback(
    async (nextBatchId: string, successMessage?: string) => {
      if (!token) return
      const normalizedBatchId = nextBatchId.trim()
      if (!normalizedBatchId) {
        setError("No batch ID is available to inspect yet.")
        return
      }

      setCheckingResult(true)
      setError(null)
      setMessage(null)

      const historyFallback = () => {
        const historyRow = historyRows.find((row) => {
          const summary = extractHistorySummary(row)
          return summary.batchId === normalizedBatchId
        })
        return historyRow ? batchDetailsFromHistorySummary(extractHistorySummary(historyRow)) : null
      }

      const keepExistingIfSameBatch = () => {
        // Do not wipe a good start/confirm/history summary just because /result is unreadable.
        setLatestBatch((current) => {
          if (current?.batchId && current.batchId === normalizedBatchId) {
            return current
          }
          return historyFallback() ?? current
        })
      }

      try {
        const response: EmployeeImportResultResponse = await getEmployeeImportResult(
          token,
          normalizedBatchId
        )

        if (response.type === "file") {
          const report = { blob: response.blob, filename: response.filename }
          const fromHistory = historyFallback()
          const details: BatchDetails = fromHistory
            ? { ...fromHistory, resultReport: report }
            : {
                payload: null,
                batchId: normalizedBatchId,
                importMode: "",
                status: "Completed",
                processValidRowsOnly: null,
                createdAt: "",
                updatedAt: "",
                completedAt: "",
                overview: {
                  totalRows: null,
                  validRows: null,
                  invalidRows: null,
                  newRows: null,
                  updatedRows: null,
                  skippedRows: null,
                  processedRows: null,
                  successRows: null,
                  failedRows: null,
                },
                issues: [],
                resultReport: report,
              }

          setLatestBatch((current) => {
            if (current?.batchId === normalizedBatchId) {
              return {
                ...current,
                resultReport: report,
                // Prefer non-empty fields from existing start/confirm payload.
                status: current.status || details.status,
                importMode: current.importMode || details.importMode,
                overview: {
                  totalRows: current.overview.totalRows ?? details.overview.totalRows,
                  validRows: current.overview.validRows ?? details.overview.validRows,
                  invalidRows: current.overview.invalidRows ?? details.overview.invalidRows,
                  newRows: current.overview.newRows ?? details.overview.newRows,
                  updatedRows: current.overview.updatedRows ?? details.overview.updatedRows,
                  skippedRows: current.overview.skippedRows ?? details.overview.skippedRows,
                  processedRows: current.overview.processedRows ?? details.overview.processedRows,
                  successRows: current.overview.successRows ?? details.overview.successRows,
                  failedRows: current.overview.failedRows ?? details.overview.failedRows,
                },
              }
            }
            return details
          })
          setInspectedBatchId(normalizedBatchId)
          setMessage(
            successMessage ??
              "Import finished. Download the Excel result report to review row-level details."
          )
          return
        }

        const details = extractBatchDetails(response.payload, {
          fallbackBatchId: normalizedBatchId,
        })
        if (!details) {
          keepExistingIfSameBatch()
          const fallback = historyFallback()
          if (fallback) {
            setLatestBatch(fallback)
            setInspectedBatchId(normalizedBatchId)
            setMessage(successMessage ?? "Showing summary from import history.")
            return
          }
          setError(
            "Could not read import status as JSON. If the import finished, check Past imports or export employees to verify the data."
          )
          return
        }
        setLatestBatch(details)
        setInspectedBatchId(normalizedBatchId)
        setMessage(successMessage ?? "Import details loaded.")
      } catch (resultError) {
        keepExistingIfSameBatch()
        const fallback = historyFallback()
        if (fallback) {
          setLatestBatch(fallback)
          setInspectedBatchId(normalizedBatchId)
          setMessage(successMessage ?? "Showing summary from import history.")
          return
        }
        setError(
          resultError instanceof Error
            ? resultError.message
            : "Failed to fetch employee import result."
        )
      } finally {
        setCheckingResult(false)
      }
    },
    [historyRows, token]
  )

  const handleFileSelection = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    if (!isSupportedEmployeeImportFile(nextFile)) {
      setSelectedFile(null)
      setPreviewDetails(null)
      setLatestBatch(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      setError(nextFile ? "Only .xlsx employee import files are supported." : null)
      setMessage(null)
      return
    }

    setSelectedFile(nextFile)
    setPreviewDetails(null)
    setLatestBatch(null)
    setError((currentError) =>
      currentError === "Excel file is required." || currentError === "Only .xlsx employee import files are supported."
        ? null
        : currentError
    )
    setMessage(null)
  }, [])

  const handlePreview = React.useCallback(async () => {
    if (!token) return
    if (!selectedFile) {
      setError("Excel file is required.")
      return
    }

    setPreviewing(true)
    setError(null)
    setMessage(null)
    try {
      const response = await previewEmployeeImport(
        token,
        {
          import_mode: importMode,
          process_valid_rows_only: processValidRowsOnly,
        },
        selectedFile,
        selectedFile.name
      )
      const details = extractPreviewDetails(response)
      setPreviewDetails(details)
      setMessage("File checked. Review the results below.")
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Could not check this file.")
    } finally {
      setPreviewing(false)
    }
  }, [importMode, processValidRowsOnly, selectedFile, token])

  const handleImport = React.useCallback(async () => {
    if (!token) return
    if (!selectedFile) {
      setError("Excel file is required.")
      return
    }

    setImporting(true)
    setError(null)
    setMessage(null)
    try {
      const response = await startEmployeeImport(
        token,
        {
          import_mode: importMode,
          process_valid_rows_only: processValidRowsOnly,
        },
        selectedFile,
        selectedFile.name
      )
      const details = extractBatchDetails(response)
      if (!details) {
        setLatestBatch(null)
        setError("Import started, but the server did not return a usable status. Check Past imports.")
        void loadHistory()
        return
      }
      setLatestBatch(details)
      const nextBatchId = details.batchId ?? ""
      if (nextBatchId) {
        setInspectedBatchId(nextBatchId)
      }
      setMessage("Import started.")
      void loadHistory()
      if (nextBatchId) {
        void inspectBatch(nextBatchId, "Import started.")
      }
    } catch (importError) {
      setLatestBatch(null)
      setError(importError instanceof Error ? importError.message : "Could not start import.")
    } finally {
      setImporting(false)
    }
  }, [importMode, inspectBatch, loadHistory, processValidRowsOnly, selectedFile, token])

  const handleConfirm = React.useCallback(async () => {
    if (!token) return
    const previewToken = previewDetails?.previewToken.trim() ?? ""
    if (!previewToken) {
      setError("Generate a preview first so there is a token to confirm.")
      return
    }

    setConfirming(true)
    setError(null)
    setMessage(null)
    try {
      const response = await confirmEmployeeImport(token, {
        preview_token: previewToken,
        process_valid_rows_only: processValidRowsOnly,
      })
      const details = extractBatchDetails(response)
      setLatestBatch(details)
      const nextBatchId = details?.batchId ?? ""
      if (nextBatchId) {
        setInspectedBatchId(nextBatchId)
      }
      setMessage("Import confirmed.")
      void loadHistory()
      if (nextBatchId) {
        void inspectBatch(nextBatchId, "Import confirmed.")
      }
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Could not confirm import.")
    } finally {
      setConfirming(false)
    }
  }, [inspectBatch, loadHistory, previewDetails, processValidRowsOnly, token])

  const handleTemplateDownload = React.useCallback(async () => {
    if (!token) return
    setDownloadingTemplate(true)
    setError(null)
    setMessage(null)
    try {
      const result = await downloadEmployeeImportTemplate(token)
      downloadBlob(result.blob, result.filename)
      setMessage("Template downloaded.")
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not download template.")
    } finally {
      setDownloadingTemplate(false)
    }
  }, [token])

  const selectedMode = IMPORT_MODES.find((mode) => mode.value === importMode)
  const latestBatchId = latestBatch?.batchId || inspectedBatchId
  const hasPreview = Boolean(previewDetails)
  const hasBatch = Boolean(latestBatch)

  const historyTableRows = React.useMemo<HistoryTableRow[]>(() => {
    return historyRows.map((row, index) => {
      const summary = extractHistorySummary(row)
      return {
        ...summary,
        id: summary.batchId && summary.batchId !== "—" ? summary.batchId : `import-row-${index}`,
      }
    })
  }, [historyRows])

  const historyStatusOptions = React.useMemo(() => {
    const keys = new Map<string, string>()
    for (const row of historyTableRows) {
      const raw = row.status?.trim()
      if (!raw || raw === "—") continue
      const key = statusFilterKey(raw)
      if (!keys.has(key)) {
        keys.set(key, formatStatusLabel(raw))
      }
    }
    return Array.from(keys.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [historyTableRows])

  const filteredHistoryRows = React.useMemo(() => {
    if (!historyStatusFilter) return historyTableRows
    return historyTableRows.filter(
      (row) => statusFilterKey(row.status || "") === historyStatusFilter
    )
  }, [historyStatusFilter, historyTableRows])

  const historyColumns = React.useMemo<Column<HistoryTableRow>[]>(
    () => [
      {
        key: "createdAt",
        label: "When",
        defaultWidth: 160,
        sortable: true,
        render: (row) => (
          <span className="text-xs text-foreground">{formatDateTime(row.createdAt)}</span>
        ),
      },
      {
        key: "mode",
        label: "Type",
        defaultWidth: 130,
        sortable: true,
        render: (row) => (
          <span className="text-xs text-foreground">{formatModeLabel(row.mode)}</span>
        ),
      },
      {
        key: "status",
        label: "Status",
        defaultWidth: 130,
        sortable: true,
        render: (row) => <StatusText value={row.status || "Unknown"} />,
      },
      {
        key: "totalRows",
        label: "Rows",
        defaultWidth: 110,
        sortable: true,
        render: (row) => (
          <span className="text-xs tabular-nums text-foreground">
            {row.totalRows !== null ? row.totalRows : "—"}
            {row.invalidRows !== null && row.invalidRows > 0 ? (
              <span className="text-rose-600 dark:text-rose-400"> · {row.invalidRows} fix</span>
            ) : null}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        defaultWidth: 90,
        sortable: false,
        render: (row) => (
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
            disabled={checkingResult || !token || !row.batchId || row.batchId === "—"}
            onClick={(event) => {
              event.stopPropagation()
              void inspectBatch(row.batchId, "Import details loaded.")
            }}
          >
            View
          </button>
        ),
      },
    ],
    [checkingResult, inspectBatch, token]
  )

  const clearSelectedFile = React.useCallback(() => {
    setSelectedFile(null)
    setPreviewDetails(null)
    setLatestBatch(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">Bulk import</CardTitle>
            <CardDescription>
              Upload one Excel file to add or update many employees at once.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={handleTemplateDownload}
            disabled={downloadingTemplate || !token}
          >
            {downloadingTemplate ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <DownloadIcon className="size-3.5" />
            )}
            Template
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            id="employee-import-file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={handleFileSelection}
          />

          {/* File picker — primary focus */}
          <div
            className={
              selectedFile
                ? "rounded-xl border border-border bg-muted/10 px-4 py-3"
                : "rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-5"
            }
          >
            {selectedFile ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileSpreadsheetIcon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB · ready to check or import
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={clearSelectedFile}
                    aria-label="Clear selected file"
                  >
                    <XIcon className="size-3.5" />
                    Clear
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <UploadIcon className="size-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-medium">Choose an Excel file</p>
                  <p className="text-xs text-muted-foreground">
                    Use the template for the correct columns. Accepts .xlsx only.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon className="size-3.5" />
                  Select file
                </Button>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="employee-import-mode" className="text-sm font-medium">
                Import mode
              </Label>
              <Select
                value={importMode}
                onValueChange={(value) => setImportMode(value as EmployeeImportMode)}
              >
                <SelectTrigger id="employee-import-mode" className="h-9 w-full">
                  <SelectValue placeholder="Choose mode">
                    {selectedMode?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {IMPORT_MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{selectedMode?.hint}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="employee-import-skip-bad-rows" className="text-sm font-medium">
                Skip bad rows
              </Label>
              <div className="flex h-9 items-center">
                <Switch
                  id="employee-import-skip-bad-rows"
                  checked={processValidRowsOnly}
                  onCheckedChange={(checked) => setProcessValidRowsOnly(checked)}
                  aria-label="Skip bad rows"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Import valid rows even if some fail
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <Button
              type="button"
              size="sm"
              onClick={handlePreview}
              disabled={previewing || importing || !token || !selectedFile}
            >
              {previewing ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <FileSearchIcon className="size-3.5" />
              )}
              Check file
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleImport}
              disabled={importing || previewing || !token || !selectedFile}
            >
              {importing ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <UploadIcon className="size-3.5" />
              )}
              Import now
            </Button>
            {!selectedFile ? (
              <span className="text-xs text-muted-foreground">Select a file to continue</span>
            ) : null}
          </div>

          {message ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Results — only when something is ready */}
      {(hasPreview || hasBatch) && (
        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          {hasPreview ? (
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">File check</CardTitle>
                  <Badge variant="outline">{formatModeLabel(previewDetails!.importMode || importMode)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <OverviewGrid overview={previewDetails!.overview} />

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirm}
                    disabled={confirming || !token || !previewDetails!.previewToken}
                  >
                    {confirming ? <Loader2Icon className="size-3.5 animate-spin" /> : <SendIcon className="size-3.5" />}
                    Confirm &amp; import
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleImport}
                    disabled={importing || previewing || !token}
                  >
                    {importing ? <Loader2Icon className="size-3.5 animate-spin" /> : <UploadIcon className="size-3.5" />}
                    Import without confirm
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <div className="text-sm font-medium">Rows to fix</div>
                  <IssueTable issues={previewDetails!.issues} emptyMessage="No problems found." />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {hasBatch ? (
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">Last import</CardTitle>
                  <div className="flex items-center gap-1.5">
                    <StatusText value={latestBatch!.status || "Unknown"} />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => void inspectBatch(latestBatchId)}
                      disabled={checkingResult || !token || !latestBatchId}
                    >
                      {checkingResult ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCcwIcon className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  {formatDateTime(latestBatch!.completedAt || latestBatch!.updatedAt || latestBatch!.createdAt)}
                  {" · "}
                  {formatModeLabel(latestBatch!.importMode)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <OverviewGrid overview={latestBatch!.overview} />

                {latestBatch!.resultReport ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/15 px-3 py-2">
                    <FileSpreadsheetIcon className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{latestBatch!.resultReport.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        Server returned an Excel result report for this batch
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const report = latestBatch?.resultReport
                        if (!report) return
                        downloadBlob(report.blob, report.filename)
                      }}
                    >
                      <DownloadIcon className="size-3.5" />
                      Download report
                    </Button>
                  </div>
                ) : latestBatchId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={checkingResult || !token}
                    onClick={() => void inspectBatch(latestBatchId, "Import details refreshed.")}
                  >
                    {checkingResult ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <DownloadIcon className="size-3.5" />
                    )}
                    Fetch result report
                  </Button>
                ) : null}

                <div className="space-y-1.5">
                  <div className="text-sm font-medium">Issues</div>
                  <IssueTable issues={latestBatch!.issues} emptyMessage="No issues." />
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      <div className="min-w-0 space-y-2">
        <ResizableTable
          title="Past imports"
          data={filteredHistoryRows}
          columns={historyColumns}
          loading={loadingHistory}
          storageKey="employee-import-history"
          itemsPerPage={historyLimit}
          showCheckboxes={false}
          enableAnimations={false}
          getRowId={(row) => row.id}
          onRowSelect={(id) => {
            if (!id || id.startsWith("import-row-")) return
            void inspectBatch(id, "Import details loaded.")
          }}
          toolbarStart={
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">Past imports</div>
              <div className="text-xs text-muted-foreground">
                {typeof historyTotal === "number" ? `${historyTotal} total` : "Recent uploads"}
                {historyStatusFilter
                  ? ` · ${filteredHistoryRows.length} shown`
                  : ""}
              </div>
            </div>
          }
          toolbarActions={
            <>
              <select
                className="h-8 min-w-[8.5rem] rounded-md border border-border bg-background px-2 text-xs text-foreground"
                value={historyStatusFilter}
                onChange={(event) => setHistoryStatusFilter(event.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {historyStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => void loadHistory()}
                disabled={loadingHistory || !token}
              >
                {loadingHistory ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCcwIcon className="size-3.5" />
                )}
                Refresh
              </Button>
            </>
          }
        />

        {(historyPage > 1 ||
          (historyTotal !== null && historyPage * historyLimit < historyTotal) ||
          historyRows.length >= historyLimit) && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={historyPage <= 1 || loadingHistory}
              onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                loadingHistory ||
                (historyTotal !== null && historyPage * historyLimit >= historyTotal)
              }
              onClick={() => setHistoryPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
