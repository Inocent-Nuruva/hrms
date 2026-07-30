"use client"

import * as React from "react"
import {
  ArrowDownIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileSearchIcon,
  InfoIcon,
  Loader2Icon,
  RefreshCcwIcon,
  SendIcon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

import {
  confirmEmployeeImport,
  downloadEmployeeImportResult,
  downloadEmployeeImportTemplate,
  getEmployeeImportPreview,
  getEmployeeImportResult,
  listEmployeeImportHistory,
  previewEmployeeImport,
  type AdminRecord,
  type EmployeeImportMode,
  type EmployeeImportResultResponse,
} from "@/lib/admin-api"
import { subscribeToDashboardActorSnapshot } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BorderBeam } from "@/components/ui/border-beam"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

const IMPORT_MODES: Array<{ value: EmployeeImportMode; label: string; hint: string }> = [
  {
    value: "CREATE_ONLY",
    label: "Add new only",
    hint: "Skip people who already exist",
  },
  {
    value: "UPDATE_EXISTING",
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
  "error_rows",
  "errorRows",
  "errors",
  "issues",
  "problems",
  "failures",
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
  batchId: string
  previewToken: string
  importMode: string
  processValidRowsOnly: boolean | null
  overview: ImportOverview
  issues: ImportIssue[]
  rows: PreviewRowDetails[]
}

type PreviewRowIssue = {
  field: string
  value?: unknown
  message: string
  suggestion?: string
}

type PreviewRowDetails = {
  rowId: number | null
  rowNumber: number
  identifier: string
  employeeName: string
  employeeNumber: string
  status: string
  selectable: boolean
  selectedByDefault: boolean
  importAction: string
  matchedBy: string[]
  errors: string[]
  warnings: string[]
  issues: PreviewRowIssue[]
  deviceAssignmentStatus: string
  deviceAssignmentMessage: string
  deviceCodes: string[]
  providedDeviceEmployeeNumber: string
  effectiveDeviceEmployeeNumber: string
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

/** Ready/importable preview statuses when the API omits selectable flags. */
function isPreviewRowImportable(status: string) {
  const normalized = status.trim().toUpperCase().replace(/[\s-]+/g, "_")
  if (!normalized) return false

  if (
    normalized.includes("INVALID") ||
    normalized.includes("ERROR") ||
    normalized.includes("FAIL") ||
    normalized.includes("REJECT") ||
    normalized.includes("SKIP") ||
    normalized.includes("BLOCK") ||
    normalized.includes("DUPLICATE") ||
    normalized === "EXISTING" ||
    normalized === "NOT_READY"
  ) {
    return false
  }

  return (
    normalized === "READY" ||
    normalized === "READY_FOR_IMPORT" ||
    normalized === "VALID" ||
    normalized === "OK" ||
    normalized === "NEW" ||
    normalized === "CREATE" ||
    normalized === "UPDATE" ||
    normalized === "CREATE_OR_UPDATE" ||
    normalized.includes("READY") ||
    normalized.startsWith("VALID")
  )
}

function normalizePreviewRows(payload: AdminRecord | null): PreviewRowDetails[] {
  const rows = asRecordArray(payload?.rows)
  if (!rows) {
    return []
  }

  return rows.map((row) => {
    const status = readString(row, ["status"], "INVALID_RECORD")
    const rowNumber =
      readNumber(row, ["rowNumber", "row_number", "row", "line_number", "lineNumber"]) ?? 0
    // Many preview payloads only send rowNumber (no rowId). Confirm APIs accept that as the id.
    const rowId =
      readNumber(row, ["rowId", "row_id", "id"]) ?? (rowNumber > 0 ? rowNumber : null)
    const importable = isPreviewRowImportable(status)
    const selectable = readBoolean(row, ["selectable"]) ?? importable
    const selectedByDefault =
      readBoolean(row, ["selectedByDefault", "selected_by_default", "selected"]) ?? importable

    return {
      rowId,
      rowNumber,
      identifier: readString(
        row,
        ["identifier", "employeeName", "employee_name", "full_name", "fullName", "name"],
        "Employee row"
      ),
      employeeName: readString(
        row,
        ["employeeName", "employee_name", "full_name", "fullName", "name"],
        "—"
      ),
      employeeNumber: readString(
        row,
        ["employeeNumber", "employee_number", "employee_no", "employeeNo"],
        "—"
      ),
      status,
      selectable,
      selectedByDefault,
      importAction: readString(row, ["importAction", "import_action"], ""),
      matchedBy: readStringArray(row.matchedBy ?? row.matched_by),
      errors: readStringArray(row.errors),
      warnings: readStringArray(row.warnings),
      issues: (asRecordArray(row.issues) ?? []).map((issue) => ({
        field: readString(issue, ["field"], "—"),
        value: issue.value,
        message: readString(issue, ["message"], "Validation issue"),
        suggestion: readString(issue, ["suggestion"], ""),
      })),
      deviceAssignmentStatus: readString(
        row,
        ["deviceAssignmentStatus", "device_assignment_status"],
        "NO_DEVICE_ASSIGNMENT"
      ),
      deviceAssignmentMessage: readString(
        row,
        ["deviceAssignmentMessage", "device_assignment_message"],
        ""
      ),
      deviceCodes: readStringArray(row.deviceCodes ?? row.device_codes),
      providedDeviceEmployeeNumber: readString(
        row,
        ["providedDeviceEmployeeNumber", "provided_device_employee_number"],
        ""
      ),
      effectiveDeviceEmployeeNumber: readString(
        row,
        ["effectiveDeviceEmployeeNumber", "effective_device_employee_number"],
        ""
      ),
    }
  })
}

function previewRowDetailText(row: PreviewRowDetails) {
  return (
    row.issues[0]?.message ||
    row.errors[0] ||
    row.warnings[0] ||
    (row.deviceAssignmentStatus !== "NO_DEVICE_ASSIGNMENT"
      ? row.deviceAssignmentMessage
      : "") ||
    (row.importAction ? `${row.importAction.toLowerCase()} on confirm` : "Ready")
  )
}

function previewRowDeviceSummary(row: PreviewRowDetails) {
  if (
    row.deviceAssignmentStatus === "NO_DEVICE_ASSIGNMENT" &&
    row.deviceCodes.length === 0 &&
    !row.providedDeviceEmployeeNumber &&
    !row.effectiveDeviceEmployeeNumber
  ) {
    return ""
  }

  const codes = row.deviceCodes.length > 0 ? row.deviceCodes.join(", ") : ""
  const deviceEmployeeNumber =
    row.effectiveDeviceEmployeeNumber || row.providedDeviceEmployeeNumber
  const parts = [codes ? `Devices: ${codes}` : "", deviceEmployeeNumber ? `Device No: ${deviceEmployeeNumber}` : ""]
    .filter(Boolean)

  return parts.join(" • ")
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
  const trimmed = value?.trim()
  if (!trimmed) return "—"
  // Also match human labels already stored in history.
  const byLabel = IMPORT_MODES.find(
    (mode) => mode.label.toLowerCase() === trimmed.toLowerCase()
  )
  if (byLabel) return byLabel.label
  return trimmed.replace(/_/g, " ")
}

function modeToneClass(value: string) {
  const raw = value.trim().toUpperCase().replace(/\s+/g, "_")
  const label = formatModeLabel(value).toLowerCase()

  if (
    raw === "CREATE_ONLY" ||
    raw.includes("CREATE_ONLY") ||
    label.includes("add new")
  ) {
    return "text-sky-600 dark:text-sky-400"
  }
  if (
    raw === "UPDATE_EXISTING" ||
    raw.includes("UPDATE_EXISTING") ||
    label.includes("update existing")
  ) {
    return "text-violet-600 dark:text-violet-400"
  }
  if (
    raw === "CREATE_OR_UPDATE" ||
    raw.includes("CREATE_OR_UPDATE") ||
    label.includes("add & update") ||
    label.includes("add and update")
  ) {
    return "text-teal-600 dark:text-teal-400"
  }
  return "text-muted-foreground"
}

/** Compact colored mode label (no chip). */
function ModeText({ value, className }: { value: string; className?: string }) {
  const label = formatModeLabel(value)
  if (!value?.trim() || label === "—") {
    return <span className={cn("text-[11px] text-muted-foreground", className)}>—</span>
  }
  return (
    <span
      className={cn(
        "text-[11px] font-semibold whitespace-nowrap",
        modeToneClass(value),
        className
      )}
      title={label}
    >
      {label}
    </span>
  )
}

/** Prefer numeric field; if the field is an array of rows, use its length. */
function readCountOrListLength(records: AdminRecord[], keys: string[]): number | null {
  const asNumber = readNumberFromCandidates(records, keys)
  if (asNumber !== null) return asNumber

  for (const record of records) {
    for (const key of keys) {
      const value = record[key]
      if (Array.isArray(value)) {
        return value.length
      }
    }
  }
  return null
}

function buildOverview(records: AdminRecord[]): ImportOverview {
  return {
    totalRows: readCountOrListLength(records, [
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
    validRows: readCountOrListLength(records, [
      "valid_rows",
      "validRows",
      "valid_count",
      "validCount",
    ]),
    invalidRows: readCountOrListLength(records, [
      "invalid_rows",
      "invalidRows",
      "invalid_count",
      "invalidCount",
      "error_rows",
      "errorRows",
      "failed_rows",
      "failedRows",
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
      const value = record[key]
      // Skip pure numeric counters (e.g. invalid_rows: 1) — those are overview only.
      if (typeof value === "number") {
        continue
      }

      const rows = asRecordArray(value)
      if (rows) {
        for (const row of rows) {
          if (issues.length >= 50) {
            return issues
          }
          const issue = normalizeIssue(row)
          if (issue) {
            issues.push(issue)
          }
        }
        continue
      }

      // Array of plain strings
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (issues.length >= 50) {
            return issues
          }
          if (typeof entry === "string" && entry.trim()) {
            issues.push({
              rowLabel: "—",
              employeeLabel: "—",
              fieldLabel: "—",
              message: entry.trim(),
            })
          }
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
    batchId: readStringFromCandidates(records, ["batch_id", "batchId", "import_batch_id", "importBatchId"]),
    previewToken: readStringFromCandidates(records, ["preview_token", "previewToken"]),
    importMode: readStringFromCandidates(records, ["import_mode", "importMode", "mode"]),
    processValidRowsOnly: readBooleanFromCandidates(records, ["process_valid_rows_only", "processValidRowsOnly"]),
    overview: buildOverview(records),
    issues: extractIssues(payload, records),
    rows: normalizePreviewRows(payload),
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

type StatusTone = "success" | "partial" | "danger" | "info" | "warn" | "neutral"

function statusTone(value: string): StatusTone {
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ")

  // Finished but with problems — must win over plain "completed" / "error".
  if (
    normalized.includes("with error") ||
    normalized.includes("with errors") ||
    normalized.includes("partial") ||
    normalized.includes("completed with") ||
    normalized === "completed with errors" ||
    (normalized.includes("complete") && normalized.includes("error"))
  ) {
    return "partial"
  }

  if (
    normalized.includes("complete") ||
    normalized.includes("success") ||
    normalized === "done"
  ) {
    return "success"
  }
  if (
    normalized.includes("fail") ||
    normalized.includes("error") ||
    normalized.includes("reject") ||
    normalized.includes("cancel")
  ) {
    return "danger"
  }
  if (
    normalized.includes("process") ||
    normalized.includes("run") ||
    normalized.includes("progress") ||
    normalized.includes("import")
  ) {
    return "info"
  }
  if (
    normalized.includes("pend") ||
    normalized.includes("wait") ||
    normalized.includes("queue") ||
    normalized.includes("draft")
  ) {
    return "warn"
  }
  return "neutral"
}

const STATUS_TONE_STYLES: Record<StatusTone, { text: string; dot: string }> = {
  success: {
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  /** Completed with errors / partial success */
  partial: {
    text: "text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  danger: {
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  info: {
    text: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  warn: {
    text: "text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  neutral: {
    text: "text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
}

/** Status indicator — colored text + dot (no chip). */
function StatusText({ value }: { value: string }) {
  const display = formatStatusLabel(value)
  const tone = STATUS_TONE_STYLES[statusTone(value)]

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", tone.text)}
      title={display}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} />
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

function overviewReadyCount(overview: ImportOverview): number | null {
  return overview.validRows ?? overview.successRows
}

function overviewNeedsFixCount(overview: ImportOverview): number | null {
  return overview.invalidRows ?? overview.failedRows
}

/** True when counts say something is wrong (even if issue list is empty). */
function overviewHasProblems(overview: ImportOverview): boolean {
  const total = overview.totalRows
  const ready = overviewReadyCount(overview)
  const needsFix = overviewNeedsFixCount(overview)
  const skipped = overview.skippedRows
  if (typeof needsFix === "number" && needsFix > 0) return true
  if (typeof skipped === "number" && skipped > 0) return true
  if (typeof ready === "number" && ready === 0 && typeof total === "number" && total > 0) {
    return true
  }
  return false
}

/** At least one row is ready to import. */
function overviewCanImport(overview: ImportOverview): boolean {
  const ready = overviewReadyCount(overview)
  if (ready === null) return true
  return ready > 0
}

function batchHasErrorSignal(batch: BatchDetails): boolean {
  const tone = statusTone(batch.status)
  if (tone === "partial" || tone === "danger") return true
  return overviewHasProblems(batch.overview)
}

function buildOverviewIssueSummary(
  overview: ImportOverview,
  options?: { hasResultReport?: boolean; context?: "preview" | "batch" }
): ImportIssue {
  const invalid = overviewNeedsFixCount(overview)
  const total = overview.totalRows
  const ready = overviewReadyCount(overview)
  const skipped = overview.skippedRows
  const context = options?.context ?? "batch"

  const parts: string[] = []
  if (typeof invalid === "number" && invalid > 0) {
    parts.push(
      `${invalid} row${invalid === 1 ? "" : "s"} need${invalid === 1 ? "s" : ""} fixing`
    )
  }
  if (typeof skipped === "number" && skipped > 0) {
    parts.push(`${skipped} row${skipped === 1 ? "" : "s"} skipped`)
  }
  if (
    parts.length === 0 &&
    typeof ready === "number" &&
    ready === 0 &&
    typeof total === "number" &&
    total > 0
  ) {
    parts.push(`None of the ${total} row${total === 1 ? "" : "s"} imported successfully`)
  }
  if (parts.length === 0) {
    parts.push("Some rows need attention")
  }

  if (typeof ready === "number" && typeof total === "number") {
    parts.push(`${ready} of ${total} ready`)
  } else if (typeof ready === "number") {
    parts.push(`${ready} ready`)
  }

  if (context === "preview") {
    if (typeof ready === "number" && ready === 0) {
      parts.push("Fix the file and run Check file again before importing")
    } else {
      parts.push("You can still import ready rows if Skip bad rows is on")
    }
  } else if (options?.hasResultReport) {
    parts.push("Download the Excel result report for per-row error details")
  } else {
    parts.push("Fetch the Excel result report for per-row error details")
  }

  return {
    rowLabel: "—",
    employeeLabel: "—",
    fieldLabel: "Summary",
    message: parts.join(". ") + ".",
  }
}

/** Floating panel shell with the login-style animated border. */
function FloatingFlowPanel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl p-px shadow-lg dark:shadow-none",
        className
      )}
    >
      <BorderBeam duration={5} colorFrom="#ffffff" colorTo="#a5b4fc" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[11px] bg-card text-card-foreground">
        {children}
      </div>
    </div>
  )
}

function FlowStepArrow() {
  return (
    <div
      className="flex shrink-0 items-center justify-center self-center py-0.5 lg:px-1.5 lg:py-0"
      aria-hidden
    >
      <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/25 ring-2 ring-background">
        <ArrowDownIcon className="size-3.5 lg:hidden" strokeWidth={2.5} />
        <ArrowRightIcon className="hidden size-3.5 lg:block" strokeWidth={2.5} />
      </div>
    </div>
  )
}

/** Compact overview chips for quick scanning. */
function OverviewStatChips({
  overview,
  selectedCount,
  variant = "preview",
}: {
  overview: ImportOverview
  selectedCount?: number
  variant?: "preview" | "result"
}) {
  const chips: Array<{ label: string; value: string; tone: string }> = []
  if (typeof overview.totalRows === "number") {
    chips.push({
      label: "Total",
      value: String(overview.totalRows),
      tone: "bg-muted/70 text-foreground",
    })
  }

  if (variant === "preview") {
    const ready = overviewReadyCount(overview)
    if (typeof ready === "number") {
      chips.push({
        label: "Ready",
        value: String(ready),
        tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      })
    }
    const needsFix = overviewNeedsFixCount(overview)
    if (typeof needsFix === "number" && needsFix > 0) {
      chips.push({
        label: "Fix",
        value: String(needsFix),
        tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
      })
    }
  } else {
    if (typeof overview.successRows === "number") {
      chips.push({
        label: "OK",
        value: String(overview.successRows),
        tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      })
    } else {
      const ready = overviewReadyCount(overview)
      if (typeof ready === "number") {
        chips.push({
          label: "Ready",
          value: String(ready),
          tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        })
      }
    }
    if (typeof overview.failedRows === "number" && overview.failedRows > 0) {
      chips.push({
        label: "Failed",
        value: String(overview.failedRows),
        tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
      })
    } else {
      const needsFix = overviewNeedsFixCount(overview)
      if (typeof needsFix === "number" && needsFix > 0) {
        chips.push({
          label: "Fix",
          value: String(needsFix),
          tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
        })
      }
    }
    if (typeof overview.newRows === "number" && overview.newRows > 0) {
      chips.push({
        label: "New",
        value: String(overview.newRows),
        tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
      })
    }
    if (typeof overview.updatedRows === "number" && overview.updatedRows > 0) {
      chips.push({
        label: "Updated",
        value: String(overview.updatedRows),
        tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
      })
    }
  }

  if (typeof overview.skippedRows === "number" && overview.skippedRows > 0) {
    chips.push({
      label: "Skip",
      value: String(overview.skippedRows),
      tone: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    })
  }
  if (typeof selectedCount === "number") {
    chips.push({
      label: "Selected",
      value: String(selectedCount),
      tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
            chip.tone
          )}
        >
          <span className="text-[10px] font-normal opacity-70">{chip.label}</span>
          {chip.value}
        </span>
      ))}
    </div>
  )
}

/** Prefer API row issues; fall back to a clear summary from overview counts. */
function resolveDisplayIssues(
  overview: ImportOverview,
  issues: ImportIssue[],
  options?: { hasResultReport?: boolean; context?: "preview" | "batch"; forceProblems?: boolean }
): ImportIssue[] {
  if (issues.length > 0) {
    return issues
  }

  const hasProblems = options?.forceProblems || overviewHasProblems(overview)
  if (!hasProblems) {
    return []
  }

  return [buildOverviewIssueSummary(overview, options)]
}

function IssueTable({
  issues,
  emptyTitle = "All clear",
  emptyMessage,
  compactEmpty = false,
  emptyTone = "success",
  dense = false,
}: {
  issues: ImportIssue[]
  emptyTitle?: string
  emptyMessage: string
  /** Centered empty state for side column layout. */
  compactEmpty?: boolean
  emptyTone?: "success" | "warn"
  /** Tighter spacing for modal flow. */
  dense?: boolean
}) {
  if (issues.length === 0) {
    const isWarn = emptyTone === "warn"
    if (compactEmpty) {
      return (
        <div
          className={cn(
            "flex flex-col items-center justify-center px-2 text-center",
            dense ? "min-h-[4.5rem] py-2" : "min-h-[7.5rem] py-4"
          )}
        >
          <div
            className={cn(
              "mb-1.5 flex items-center justify-center rounded-full",
              dense ? "size-7" : "mb-2 size-9",
              isWarn
                ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            )}
          >
            {isWarn ? (
              <CircleAlertIcon className={dense ? "size-3.5" : "size-4"} />
            ) : (
              <CheckCircle2Icon className={dense ? "size-3.5" : "size-4"} />
            )}
          </div>
          <p className="text-xs font-medium text-foreground">{emptyTitle}</p>
          <p
            className={cn(
              "mt-0.5 max-w-[14rem] text-[11px] text-muted-foreground",
              dense ? "leading-snug" : "leading-relaxed"
            )}
          >
            {emptyMessage}
          </p>
        </div>
      )
    }

    return (
      <div className={cn("flex items-start gap-1.5", dense ? "gap-1.5" : "gap-2")}>
        {isWarn ? (
          <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-orange-600 dark:text-orange-400" />
        ) : (
          <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">{emptyTitle}</p>
          <p
            className={cn(
              "text-[11px] text-muted-foreground",
              dense ? "mt-0 leading-snug" : "mt-0.5 text-xs leading-relaxed"
            )}
          >
            {emptyMessage}
          </p>
        </div>
      </div>
    )
  }

  const isSummaryOnly =
    issues.length === 1 &&
    issues[0]?.fieldLabel === "Summary" &&
    issues[0]?.rowLabel === "—"

  return (
    <div className={dense ? "space-y-1" : "space-y-2"}>
      <p className="flex items-center gap-1.5 text-[11px] text-orange-700 dark:text-orange-300">
        <CircleAlertIcon className="size-3 shrink-0" />
        <span className="font-medium">
          {isSummaryOnly
            ? "Needs attention"
            : `${issues.length} row${issues.length === 1 ? "" : "s"} need attention`}
        </span>
      </p>
      <ul
        className={cn(
          "overflow-auto pr-0.5",
          dense ? "max-h-24 space-y-1" : "max-h-48 space-y-2.5"
        )}
      >
        {issues.map((issue, index) => (
          <li
            key={`${issue.rowLabel}-${issue.employeeLabel}-${index}`}
            className={cn("text-[11px]", dense ? "leading-snug" : "text-xs leading-relaxed")}
          >
            {isSummaryOnly ? (
              <p className="text-muted-foreground">{issue.message}</p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {issue.rowLabel.startsWith("Row") ? issue.rowLabel : `Row ${issue.rowLabel}`}
                  </span>
                  {issue.employeeLabel && issue.employeeLabel !== "—" ? (
                    <span className="font-medium text-foreground">{issue.employeeLabel}</span>
                  ) : null}
                </div>
                <p className="text-muted-foreground">
                  {issue.fieldLabel !== "—" ? (
                    <span className="font-medium text-foreground/80">{issue.fieldLabel}: </span>
                  ) : null}
                  {issue.message}
                </p>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ResultReportPanel({
  filename,
  onDownload,
  checkingResult,
  onFetch,
  canFetch,
  dense = false,
}: {
  filename?: string | null
  onDownload?: () => void
  checkingResult?: boolean
  onFetch?: () => void
  canFetch?: boolean
  dense?: boolean
}) {
  if (filename && onDownload) {
    return (
      <div className={cn("flex min-w-0", dense ? "items-center gap-2" : "flex-col gap-3")}>
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <FileSpreadsheetIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium leading-snug text-foreground" title={filename}>
              {filename}
            </p>
            {!dense ? (
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Excel result report
              </p>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 gap-1.5 px-2 text-[11px]"
          onClick={onDownload}
        >
          <DownloadIcon className="size-3" />
          Download
        </Button>
      </div>
    )
  }

  if (canFetch && onFetch) {
    return (
      <div className={cn("flex min-w-0", dense ? "items-center gap-2" : "flex-col gap-3")}>
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
          Report not loaded yet.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 gap-1.5 px-2 text-[11px]"
          disabled={checkingResult}
          onClick={onFetch}
        >
          {checkingResult ? (
            <Loader2Icon className="size-3 animate-spin" />
          ) : (
            <DownloadIcon className="size-3" />
          )}
          Fetch report
        </Button>
      </div>
    )
  }

  return (
    <p className="text-[11px] leading-snug text-muted-foreground">
      No result report for this import.
    </p>
  )
}

function BatchDetailsBody({
  batch,
  checkingResult,
  fetchingReport,
  onFetchReport,
  showFetchReport = true,
  dense = false,
}: {
  batch: BatchDetails
  checkingResult?: boolean
  fetchingReport?: boolean
  onFetchReport?: () => void
  showFetchReport?: boolean
  dense?: boolean
}) {
  const canFetch =
    showFetchReport && Boolean(batch.batchId && batch.batchId !== "—" && onFetchReport)
  const hasErrorSignal = batchHasErrorSignal(batch)
  const displayIssues = resolveDisplayIssues(batch.overview, batch.issues, {
    context: "batch",
    hasResultReport: Boolean(batch.resultReport),
    forceProblems: hasErrorSignal,
  })

  return (
    <div className={cn("grid gap-0", dense ? "gap-3" : "sm:grid-cols-2")}>
      {dense ? (
        <OverviewStatChips overview={batch.overview} variant="result" />
      ) : null}

      {/* Report */}
      <div
        className={cn(
          "min-w-0",
          dense
            ? "space-y-1 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2"
            : "space-y-2 border-b border-border pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-5"
        )}
      >
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Report
        </p>
        <ResultReportPanel
          filename={batch.resultReport?.filename}
          onDownload={
            batch.resultReport
              ? () => {
                  downloadBlob(batch.resultReport!.blob, batch.resultReport!.filename)
                }
              : undefined
          }
          checkingResult={checkingResult || fetchingReport}
          onFetch={onFetchReport}
          canFetch={canFetch && !batch.resultReport}
          dense={dense}
        />
      </div>

      {/* Issues */}
      <div
        className={cn(
          "min-w-0",
          dense
            ? "space-y-1"
            : "space-y-2 pt-4 sm:pl-5 sm:pt-0"
        )}
      >
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Issues
        </p>
        <IssueTable
          issues={displayIssues}
          emptyTitle={hasErrorSignal ? "Errors not listed" : "All clear"}
          emptyMessage={
            hasErrorSignal
              ? "Finished with errors — download the Excel report for row details."
              : "No row-level problems in this batch."
          }
          emptyTone={hasErrorSignal ? "warn" : "success"}
          compactEmpty={!dense}
          dense={dense}
        />
      </div>
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
  const [viewedBatch, setViewedBatch] = React.useState<BatchDetails | null>(null)
  const [viewedPreviewDetails, setViewedPreviewDetails] = React.useState<PreviewDetails | null>(
    null
  )
  const [selectedPreviewRowIds, setSelectedPreviewRowIds] = React.useState<number[]>([])
  const [previewStatusFilter, setPreviewStatusFilter] = React.useState("ALL")
  const [historyPreviewStatusFilter, setHistoryPreviewStatusFilter] = React.useState("ALL")
  const [flowDialogOpen, setFlowDialogOpen] = React.useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = React.useState(false)
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
  const [confirming, setConfirming] = React.useState(false)
  const [checkingResult, setCheckingResult] = React.useState(false)
  const [loadingPreviewBatchId, setLoadingPreviewBatchId] = React.useState("")
  const [loadingResultReportBatchId, setLoadingResultReportBatchId] = React.useState("")
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

  const applyBatchDetails = React.useCallback(
    (details: BatchDetails, asDialog: boolean, successMessage?: string | null) => {
      setInspectedBatchId(details.batchId)
      if (asDialog) {
        setViewedBatch(details)
        setHistoryDialogOpen(true)
        // Avoid noisy page-level toasts when browsing history in a dialog.
        if (successMessage) {
          setMessage(null)
        }
        return
      }
      setLatestBatch(details)
      if (successMessage) {
        setMessage(successMessage)
      }
    },
    []
  )

  const inspectBatch = React.useCallback(
    async (
      nextBatchId: string,
      successMessage?: string,
      options?: { asDialog?: boolean }
    ) => {
      if (!token) return
      const normalizedBatchId = nextBatchId.trim()
      if (!normalizedBatchId) {
        setError("No batch ID is available to inspect yet.")
        return
      }

      const asDialog = Boolean(options?.asDialog)

      setCheckingResult(true)
      setError(null)
      if (!asDialog) {
        setMessage(null)
      }

      const historyFallback = () => {
        const historyRow = historyRows.find((row) => {
          const summary = extractHistorySummary(row)
          return summary.batchId === normalizedBatchId
        })
        return historyRow ? batchDetailsFromHistorySummary(extractHistorySummary(historyRow)) : null
      }

      const mergeReportIntoExisting = (
        current: BatchDetails | null,
        report: NonNullable<BatchDetails["resultReport"]>,
        details: BatchDetails
      ): BatchDetails => {
        if (current?.batchId === normalizedBatchId) {
          return {
            ...current,
            resultReport: report,
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
      }

      const keepExistingIfSameBatch = () => {
        // Do not wipe a good start/confirm/history summary just because /result is unreadable.
        if (asDialog) {
          setViewedBatch((current) => {
            if (current?.batchId && current.batchId === normalizedBatchId) {
              return current
            }
            return historyFallback() ?? current
          })
          return
        }
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

          if (asDialog) {
            setViewedBatch((current) => mergeReportIntoExisting(current, report, details))
            setHistoryDialogOpen(true)
            setInspectedBatchId(normalizedBatchId)
          } else {
            setLatestBatch((current) => mergeReportIntoExisting(current, report, details))
            setInspectedBatchId(normalizedBatchId)
            setMessage(
              successMessage ??
                "Import finished. Download the Excel result report to review row-level details."
            )
          }
          return
        }

        const details = extractBatchDetails(response.payload, {
          fallbackBatchId: normalizedBatchId,
        })
        if (!details) {
          keepExistingIfSameBatch()
          const fallback = historyFallback()
          if (fallback) {
            applyBatchDetails(
              fallback,
              asDialog,
              asDialog ? null : (successMessage ?? "Showing summary from import history.")
            )
            if (asDialog) setHistoryDialogOpen(true)
            return
          }
          setError(
            "Could not read import status as JSON. If the import finished, check Past imports or export employees to verify the data."
          )
          return
        }
        applyBatchDetails(
          details,
          asDialog,
          asDialog ? null : (successMessage ?? "Import details loaded.")
        )
      } catch (resultError) {
        keepExistingIfSameBatch()
        const fallback = historyFallback()
        if (fallback) {
          applyBatchDetails(
            fallback,
            asDialog,
            asDialog ? null : (successMessage ?? "Showing summary from import history.")
          )
          if (asDialog) setHistoryDialogOpen(true)
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
    [applyBatchDetails, historyRows, token]
  )

  const loadViewedPreview = React.useCallback(
    async (nextBatchId: string) => {
      if (!token) return
      const normalizedBatchId = nextBatchId.trim()
      if (!normalizedBatchId) return

      setLoadingPreviewBatchId(normalizedBatchId)
      try {
        const response = await getEmployeeImportPreview(token, normalizedBatchId)
        setViewedPreviewDetails(extractPreviewDetails(response))
        setHistoryPreviewStatusFilter("ALL")
      } catch {
        setViewedPreviewDetails(null)
      } finally {
        setLoadingPreviewBatchId("")
      }
    },
    [token]
  )

  const openHistoryBatch = React.useCallback(
    (batchId: string) => {
      const normalizedBatchId = batchId.trim()
      if (!normalizedBatchId || normalizedBatchId === "—") return

      // Open immediately with history summary while full result loads.
      const historyRow = historyRows.find((row) => {
        const summary = extractHistorySummary(row)
        return summary.batchId === normalizedBatchId
      })
      if (historyRow) {
        setViewedBatch(batchDetailsFromHistorySummary(extractHistorySummary(historyRow)))
      } else {
        setViewedBatch(null)
      }
      setViewedPreviewDetails(null)
      setHistoryPreviewStatusFilter("ALL")
      setHistoryDialogOpen(true)
      void inspectBatch(normalizedBatchId, undefined, { asDialog: true })
      void loadViewedPreview(normalizedBatchId)
    },
    [historyRows, inspectBatch, loadViewedPreview]
  )

  const fetchResultReport = React.useCallback(
    async (batchId: string, options?: { asDialog?: boolean }) => {
      if (!token) return
      const normalizedBatchId = batchId.trim()
      if (!normalizedBatchId) return

      setLoadingResultReportBatchId(normalizedBatchId)
      setError(null)
      try {
        const report = await downloadEmployeeImportResult(token, normalizedBatchId)
        const payload = { blob: report.blob, filename: report.filename }
        if (options?.asDialog) {
          setViewedBatch((current) =>
            current?.batchId === normalizedBatchId
              ? { ...current, resultReport: payload }
              : current
          )
        } else {
          setLatestBatch((current) =>
            current?.batchId === normalizedBatchId
              ? { ...current, resultReport: payload }
              : current
          )
        }
      } catch (reportError) {
        setError(
          reportError instanceof Error
            ? reportError.message
            : "Failed to download the import result report."
        )
      } finally {
        setLoadingResultReportBatchId("")
      }
    },
    [token]
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
      // New file check starts a fresh flow — drop any previous import result panel.
      setLatestBatch(null)
      setSelectedPreviewRowIds(
        details?.rows
          .filter((row) => row.selectable && row.selectedByDefault && row.rowId !== null)
          .map((row) => row.rowId as number) ?? []
      )
      setPreviewStatusFilter("ALL")
      setFlowDialogOpen(true)
      setMessage("File checked. Review the preview dialog.")
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Could not check this file.")
    } finally {
      setPreviewing(false)
    }
  }, [importMode, processValidRowsOnly, selectedFile, token])

  const handleConfirm = React.useCallback(async () => {
    if (!token) return
    const previewToken = previewDetails?.previewToken.trim() ?? ""
    const batchId = previewDetails?.batchId.trim() ?? ""
    if (!previewToken && !batchId) {
      setError("Generate a preview first so there is a batch to confirm.")
      return
    }
    if (selectedPreviewRowIds.length === 0) {
      setError("Select at least one ready row before confirming the import.")
      return
    }

    setConfirming(true)
    setError(null)
    setMessage(null)
    try {
      const previewRowIds = previewDetails?.rows
        .map((row) => row.rowId)
        .filter((rowId): rowId is number => typeof rowId === "number") ?? []
      const response = await confirmEmployeeImport(token, {
        batch_id: batchId || undefined,
        preview_token: previewToken || undefined,
        row_ids: selectedPreviewRowIds,
        excluded_row_ids: previewRowIds.filter((rowId) => !selectedPreviewRowIds.includes(rowId)),
        skip_existing_records: true,
        exclude_invalid_records: true,
        process_valid_rows_only: processValidRowsOnly,
      })
      const details = extractBatchDetails(response)
      setLatestBatch(details)
      setFlowDialogOpen(true)
      const nextBatchId = details?.batchId ?? ""
      if (nextBatchId) {
        setInspectedBatchId(nextBatchId)
      }
      setMessage("Import confirmed. Review the result dialog.")
      void loadHistory()
      if (nextBatchId) {
        void inspectBatch(nextBatchId, "Import confirmed.")
      }
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Could not confirm import.")
    } finally {
      setConfirming(false)
    }
  }, [inspectBatch, loadHistory, previewDetails, processValidRowsOnly, selectedPreviewRowIds, token])

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
  const showFlowDialog = flowDialogOpen && (hasPreview || hasBatch)
  /** While confirm is in flight the backend processes rows one-by-one — keep the dialog locked. */
  const importInProgress = confirming

  const closeFlowDialog = React.useCallback(() => {
    if (importInProgress) return
    setFlowDialogOpen(false)
  }, [importInProgress])

  React.useEffect(() => {
    if (!showFlowDialog || typeof document === "undefined") return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (importInProgress) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
        setFlowDialogOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [importInProgress, showFlowDialog])

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

  const previewStatusOptions = React.useMemo(() => {
    const rows = previewDetails?.rows ?? []
    const keys = new Map<string, string>([["ALL", "All records"]])
    for (const row of rows) {
      const raw = row.status?.trim()
      if (!raw) continue
      keys.set(raw, formatStatusLabel(raw))
    }
    return Array.from(keys.entries()).map(([value, label]) => ({ value, label }))
  }, [previewDetails])

  const filteredPreviewRows = React.useMemo(() => {
    const rows = previewDetails?.rows ?? []
    if (previewStatusFilter === "ALL") {
      return rows
    }
    return rows.filter((row) => row.status === previewStatusFilter)
  }, [previewDetails, previewStatusFilter])

  const selectedPreviewCount = React.useMemo(
    () =>
      (previewDetails?.rows ?? []).filter(
        (row) => row.rowId !== null && selectedPreviewRowIds.includes(row.rowId)
      ).length,
    [previewDetails, selectedPreviewRowIds]
  )

  const historyPreviewStatusOptions = React.useMemo(() => {
    const rows = viewedPreviewDetails?.rows ?? []
    const keys = new Map<string, string>([["ALL", "All records"]])
    for (const row of rows) {
      const raw = row.status?.trim()
      if (!raw) continue
      keys.set(raw, formatStatusLabel(raw))
    }
    return Array.from(keys.entries()).map(([value, label]) => ({ value, label }))
  }, [viewedPreviewDetails])

  const filteredHistoryPreviewRows = React.useMemo(() => {
    const rows = viewedPreviewDetails?.rows ?? []
    if (historyPreviewStatusFilter === "ALL") {
      return rows
    }
    return rows.filter((row) => row.status === historyPreviewStatusFilter)
  }, [historyPreviewStatusFilter, viewedPreviewDetails])

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
        render: (row) => <ModeText value={row.mode} />,
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
              openHistoryBatch(row.batchId)
            }}
          >
            View
          </button>
        ),
      },
    ],
    [checkingResult, openHistoryBatch, token]
  )

  const clearSelectedFile = React.useCallback(() => {
    setSelectedFile(null)
    setPreviewDetails(null)
    setSelectedPreviewRowIds([])
    setPreviewStatusFilter("ALL")
    setLatestBatch(null)
    setFlowDialogOpen(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-border/50 pb-4">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight">Bulk import</CardTitle>
            <CardDescription className="text-[13px] leading-relaxed">
              Upload one Excel file to add or update many employees at once.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0"
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

        <CardContent className="space-y-5 pt-1">
          <input
            ref={fileInputRef}
            id="employee-import-file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={handleFileSelection}
          />

          {/* File picker */}
          <div
            className={cn(
              "rounded-2xl px-4 py-4 transition-colors",
              selectedFile
                ? "bg-muted/40 ring-1 ring-border/60"
                : "bg-muted/25 ring-1 ring-dashed ring-border/70"
            )}
          >
            {selectedFile ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#1D6F42]/10 text-[#1D6F42] dark:bg-emerald-500/10 dark:text-emerald-400">
                    <FileSpreadsheetIcon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium tracking-tight">{selectedFile.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB · ready to validate
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-muted-foreground"
                    onClick={clearSelectedFile}
                    aria-label="Clear selected file"
                  >
                    <XIcon className="size-3.5" />
                    Clear
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-1 text-center sm:flex-row sm:py-0 sm:text-left">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-background text-muted-foreground ring-1 ring-border/60">
                  <UploadIcon className="size-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-medium tracking-tight">Choose an Excel file</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Download the template first so columns match. Accepts .xlsx only.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon className="size-3.5" />
                  Select file
                </Button>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="employee-import-mode" className="text-[13px] font-medium">
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
              <p className="text-xs leading-relaxed text-muted-foreground">{selectedMode?.hint}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee-import-skip-bad-rows" className="text-[13px] font-medium">
                Skip bad rows
              </Label>
              <div className="flex h-9 items-center gap-3">
                <Switch
                  id="employee-import-skip-bad-rows"
                  checked={processValidRowsOnly}
                  onCheckedChange={(checked) => setProcessValidRowsOnly(checked)}
                  aria-label="Skip bad rows"
                />
                <span className="text-xs text-muted-foreground">
                  {processValidRowsOnly ? "On — import valid rows only" : "Off — fail if any row is invalid"}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Keep valid people even when a few rows fail validation
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
            <Button
              type="button"
              size="sm"
              className="h-8"
              onClick={handlePreview}
              disabled={previewing || !token || !selectedFile}
            >
              {previewing ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <FileSearchIcon className="size-3.5" />
              )}
              Check file
            </Button>
            {!selectedFile ? (
              <span className="ml-0.5 text-xs text-muted-foreground">Select a file to continue</span>
            ) : null}
          </div>

          {message ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-500/[0.07] px-3.5 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-500/15 dark:text-emerald-200">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="leading-relaxed">{message}</span>
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-rose-500/[0.07] px-3.5 py-2.5 text-sm text-rose-800 ring-1 ring-rose-500/15 dark:text-rose-200">
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span className="leading-relaxed">{error}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Re-open flow dialogs after dismiss */}
      {!flowDialogOpen && (hasPreview || hasBatch) ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setFlowDialogOpen(true)}
          >
            {hasPreview && hasBatch
              ? "Open preview & result"
              : hasPreview
                ? "Open file check"
                : "Open last import"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {hasPreview && hasBatch
              ? "Preview → result dialogs"
              : hasPreview
                ? "File check is ready to review"
                : "Import result is ready to review"}
          </span>
        </div>
      ) : null}

      {/* Modal flow: Preview dialog → Result dialog (compact, scannable) */}
      {showFlowDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-label={
              importInProgress
                ? "Import in progress — dialog cannot be closed"
                : "Close dialogs"
            }
            onClick={closeFlowDialog}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Import file check and result"
            aria-busy={importInProgress || undefined}
            className={cn(
              "relative z-10 flex w-full flex-col gap-1.5 lg:flex-row lg:items-stretch lg:gap-0",
              hasPreview && hasBatch
                ? "max-h-[min(94vh,40rem)] max-w-6xl lg:overflow-hidden"
                : "max-h-[min(94vh,36rem)] max-w-3xl overflow-hidden"
            )}
          >
            {hasPreview ? (
              <FloatingFlowPanel
                className={cn(
                  "max-h-[min(70vh,32rem)] shadow-xl lg:max-h-full",
                  hasPreview && hasBatch ? "lg:min-w-0 lg:flex-[1.35]" : "flex-1"
                )}
              >
                {(() => {
                  const previewOverview = previewDetails!.overview
                  const previewHasProblems = overviewHasProblems(previewOverview)
                  const previewCanProceed = selectedPreviewCount > 0
                  const previewReady = overviewReadyCount(previewOverview)
                  const previewNeedsFix = overviewNeedsFixCount(previewOverview)
                  const previewIssues = resolveDisplayIssues(
                    previewOverview,
                    previewDetails!.issues,
                    { context: "preview" }
                  )

                  return (
                    <div className="flex min-h-0 flex-1 flex-col">
                      {/* Compact header */}
                      <div className="shrink-0 border-b border-border px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                              {hasBatch ? "1" : "·"}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <h3 className="text-sm font-semibold tracking-tight">
                                  File check
                                </h3>
                                <ModeText value={previewDetails!.importMode || importMode} />
                              </div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                            onClick={closeFlowDialog}
                            disabled={importInProgress}
                            aria-label="Close"
                            title={
                              importInProgress
                                ? "Cannot close while import is in progress"
                                : "Close"
                            }
                          >
                            <XIcon className="size-3.5" />
                          </Button>
                        </div>

                        <div className="mt-1.5">
                          <OverviewStatChips
                            overview={previewOverview}
                            selectedCount={selectedPreviewCount}
                          />
                        </div>

                        {importInProgress ? (
                          <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-800 dark:text-sky-200">
                            <Loader2Icon className="size-3 shrink-0 animate-spin" />
                            Importing rows… stay on this dialog until finished.
                          </div>
                        ) : null}
                      </div>

                      {/* Scrollable body: validation + rows */}
                      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-2.5">
                        {(previewIssues.length > 0 || previewHasProblems) && (
                          <div className="rounded-lg border border-border/60 bg-muted/15 px-2.5 py-2">
                            <IssueTable
                              issues={previewIssues}
                              emptyTitle="Looks good"
                              emptyMessage="Every row is ready to import."
                              emptyTone="success"
                              dense
                            />
                            {previewHasProblems ? (
                              <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-sky-700 dark:text-sky-300">
                                <InfoIcon className="mt-0.5 size-3 shrink-0 text-sky-600 dark:text-sky-400" />
                                <span>
                                  {previewCanProceed ? (
                                    <>
                                      <span className="font-medium text-foreground">
                                        {previewReady ?? 0} ready
                                      </span>
                                      {typeof previewNeedsFix === "number" &&
                                      previewNeedsFix > 0 ? (
                                        <>
                                          {" "}
                                          ·{" "}
                                          <span className="font-medium text-foreground">
                                            {previewNeedsFix} need
                                            {previewNeedsFix === 1 ? "s" : ""} fix
                                          </span>
                                        </>
                                      ) : null}
                                      . Only ready rows import when Skip bad rows is on.
                                    </>
                                  ) : (
                                    <>
                                      Nothing ready. Fix the file, then run{" "}
                                      <span className="font-medium text-foreground">
                                        Check file
                                      </span>{" "}
                                      again.
                                    </>
                                  )}
                                </span>
                              </p>
                            ) : null}
                          </div>
                        )}

                        {!previewHasProblems && previewIssues.length === 0 ? (
                          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5">
                            <IssueTable
                              issues={[]}
                              emptyTitle="Looks good"
                              emptyMessage="Every row is ready. Confirm to import."
                              emptyTone="success"
                              dense
                            />
                          </div>
                        ) : null}

                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Rows
                              <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/80">
                                {selectedPreviewCount} selected
                              </span>
                            </p>
                            <Select
                              value={previewStatusFilter}
                              onValueChange={(value) =>
                                setPreviewStatusFilter(value ?? "ALL")
                              }
                            >
                              <SelectTrigger className="h-7 w-[150px] text-[11px]">
                                <SelectValue placeholder="Filter" />
                              </SelectTrigger>
                              <SelectContent>
                                {previewStatusOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="max-h-[min(40vh,16rem)] overflow-auto rounded-lg border border-border/60">
                            <table className="min-w-full text-[11px]">
                              <thead className="sticky top-0 z-[1] bg-muted/90 backdrop-blur">
                                <tr className="border-b border-border/60 text-left text-muted-foreground">
                                  <th className="w-8 px-2 py-1.5 font-medium"> </th>
                                  <th className="w-10 px-1.5 py-1.5 font-medium">#</th>
                                  <th className="px-1.5 py-1.5 font-medium">Employee</th>
                                  <th className="hidden px-1.5 py-1.5 font-medium sm:table-cell">
                                    Number
                                  </th>
                                  <th className="px-1.5 py-1.5 font-medium">Status</th>
                                  <th className="hidden px-1.5 py-1.5 font-medium md:table-cell">
                                    Details
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredPreviewRows.map((row) => {
                                  const checked =
                                    row.rowId !== null &&
                                    selectedPreviewRowIds.includes(row.rowId)
                                  const detailText = previewRowDetailText(row)
                                  const deviceSummary = previewRowDeviceSummary(row)

                                  return (
                                    <tr
                                      key={`${row.rowId ?? "row"}-${row.rowNumber}`}
                                      className="border-b border-border/40 last:border-0"
                                    >
                                      <td className="px-2 py-1 align-middle">
                                        <Checkbox
                                          checked={checked}
                                          disabled={
                                            hasBatch ||
                                            importInProgress ||
                                            !row.selectable ||
                                            row.rowId === null
                                          }
                                          onCheckedChange={(nextChecked) => {
                                            if (!row.selectable || row.rowId === null) return
                                            const rowId = row.rowId
                                            setSelectedPreviewRowIds((current) => {
                                              if (nextChecked) {
                                                return current.includes(rowId)
                                                  ? current
                                                  : [...current, rowId]
                                              }
                                              return current.filter((value) => value !== rowId)
                                            })
                                          }}
                                          aria-label={`Select preview row ${row.rowNumber}`}
                                        />
                                      </td>
                                      <td className="px-1.5 py-1 align-middle tabular-nums text-muted-foreground">
                                        {row.rowNumber}
                                      </td>
                                      <td className="max-w-[10rem] px-1.5 py-1 align-middle">
                                        <div className="min-w-0">
                                          <p
                                            className="truncate font-medium text-foreground"
                                            title={row.identifier}
                                          >
                                            {row.identifier}
                                          </p>
                                          {deviceSummary ? (
                                            <p
                                              className="truncate text-[10px] text-muted-foreground"
                                              title={deviceSummary}
                                            >
                                              {deviceSummary}
                                            </p>
                                          ) : null}
                                        </div>
                                      </td>
                                      <td className="hidden px-1.5 py-1 align-middle tabular-nums sm:table-cell">
                                        {row.employeeNumber || "—"}
                                      </td>
                                      <td className="px-1.5 py-1 align-middle">
                                        <StatusText value={row.status} />
                                      </td>
                                      <td
                                        className="hidden max-w-[12rem] truncate px-1.5 py-1 align-middle text-muted-foreground md:table-cell"
                                        title={detailText}
                                      >
                                        {detailText}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* Sticky footer: only before import completes (result panel takes over after). */}
                      {!hasBatch ? (
                        <div className="shrink-0 border-t border-border bg-card/95 px-3 py-2 backdrop-blur-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] text-muted-foreground">
                              {!previewCanProceed
                                ? "Select at least one ready row to import."
                                : `${selectedPreviewCount} row${selectedPreviewCount === 1 ? "" : "s"} will be imported.`}
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={handleConfirm}
                              disabled={
                                confirming ||
                                !token ||
                                !previewDetails!.previewToken ||
                                !previewCanProceed
                              }
                              title={
                                !previewCanProceed
                                  ? "No ready rows to import"
                                  : "Import only the rows that passed validation"
                              }
                            >
                              {confirming ? (
                                <Loader2Icon className="size-3.5 animate-spin" />
                              ) : (
                                <SendIcon className="size-3.5" />
                              )}
                              {confirming ? "Importing…" : "Confirm & import"}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })()}
              </FloatingFlowPanel>
            ) : null}

            {hasPreview && hasBatch ? <FlowStepArrow /> : null}

            {hasBatch ? (
              <FloatingFlowPanel
                className={cn(
                  "max-h-[min(70vh,32rem)] shadow-xl lg:max-h-full",
                  hasPreview && hasBatch ? "lg:min-w-0 lg:flex-1" : "flex-1"
                )}
              >
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="shrink-0 border-b border-border px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                          {hasPreview ? "2" : "·"}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <h3 className="text-sm font-semibold tracking-tight">
                              Import result
                            </h3>
                            <StatusText value={latestBatch!.status || "Unknown"} />
                          </div>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                            <span>
                              {formatDateTime(
                                latestBatch!.completedAt ||
                                  latestBatch!.updatedAt ||
                                  latestBatch!.createdAt
                              )}
                            </span>
                            {latestBatch!.importMode ? (
                              <>
                                <span className="text-border">·</span>
                                <ModeText value={latestBatch!.importMode} />
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground"
                          onClick={() => void inspectBatch(latestBatchId)}
                          disabled={checkingResult || !token || !latestBatchId}
                          aria-label="Refresh import details"
                          title="Refresh"
                        >
                          {checkingResult ? (
                            <Loader2Icon className="size-3.5 animate-spin" />
                          ) : (
                            <RefreshCcwIcon className="size-3.5" />
                          )}
                        </Button>
                        {!hasPreview ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={closeFlowDialog}
                            disabled={importInProgress}
                            aria-label="Close"
                            title={
                              importInProgress
                                ? "Cannot close while import is in progress"
                                : "Close"
                            }
                          >
                            <XIcon className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
                    <BatchDetailsBody
                      batch={latestBatch!}
                      checkingResult={checkingResult}
                      fetchingReport={loadingResultReportBatchId === latestBatch!.batchId}
                      onFetchReport={
                        latestBatchId
                          ? () => void fetchResultReport(latestBatchId)
                          : undefined
                      }
                      dense
                    />
                  </div>
                </div>
              </FloatingFlowPanel>
            ) : null}
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={historyDialogOpen}
        onOpenChange={(open) => {
          setHistoryDialogOpen(open)
          if (!open) {
            setViewedBatch(null)
            setViewedPreviewDetails(null)
            setHistoryPreviewStatusFilter("ALL")
          }
        }}
      >
        <AlertDialogContent className="max-h-[min(90vh,42rem)] max-w-lg overflow-hidden border-0 bg-transparent p-[2px] shadow-sm sm:max-w-2xl dark:shadow-none">
          {/* Same animated border shade as the login screen */}
          <BorderBeam duration={5} colorFrom="#ffffff" colorTo="#a5b4fc" />

          <div className="relative z-10 flex max-h-[min(90vh,calc(42rem-4px))] flex-col overflow-hidden rounded-[calc(0.75rem-1px)] bg-popover text-popover-foreground">
            <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-popover/95 px-5 pt-5 pb-4 backdrop-blur-sm">
              <AlertDialogHeader className="gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Past import
                    </p>
                    <AlertDialogTitle>Import details</AlertDialogTitle>
                    <AlertDialogDescription className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px]">
                      {viewedBatch ? (
                        <>
                          <span>
                            {formatDateTime(
                              viewedBatch.completedAt ||
                                viewedBatch.updatedAt ||
                                viewedBatch.createdAt
                            )}
                          </span>
                          {viewedBatch.importMode ? (
                            <>
                              <span className="text-border">·</span>
                              <ModeText value={viewedBatch.importMode} />
                            </>
                          ) : null}
                        </>
                      ) : (
                        "Loading import summary…"
                      )}
                    </AlertDialogDescription>
                  </div>
                  {viewedBatch ? <StatusText value={viewedBatch.status || "Unknown"} /> : null}
                </div>
              </AlertDialogHeader>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {checkingResult && !viewedBatch ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  Loading details…
                </div>
              ) : viewedBatch ? (
                <>
                  {loadingPreviewBatchId === viewedBatch.batchId || viewedPreviewDetails ? (
                    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground">
                            Saved preview
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {viewedPreviewDetails
                              ? `${overviewReadyCount(viewedPreviewDetails.overview) ?? 0} ready for import`
                              : "Loading validated rows..."}
                          </p>
                        </div>
                        {viewedPreviewDetails ? (
                          <Select
                            value={historyPreviewStatusFilter}
                            onValueChange={(value) =>
                              setHistoryPreviewStatusFilter(value ?? "ALL")
                            }
                          >
                            <SelectTrigger className="h-8 w-[190px]">
                              <SelectValue placeholder="Filter rows" />
                            </SelectTrigger>
                            <SelectContent>
                              {historyPreviewStatusOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                      </div>

                      {loadingPreviewBatchId === viewedBatch.batchId && !viewedPreviewDetails ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                          <Loader2Icon className="size-4 animate-spin" />
                          Loading preview rows...
                        </div>
                      ) : viewedPreviewDetails ? (
                        <>
                          <IssueTable
                            issues={resolveDisplayIssues(
                              viewedPreviewDetails.overview,
                              viewedPreviewDetails.issues,
                              { context: "preview" }
                            )}
                            emptyTitle="Preview looked good"
                            emptyMessage="These rows and classifications were saved with the batch."
                            emptyTone="success"
                          />

                          <div className="max-h-64 overflow-auto rounded-xl border border-border/60">
                            <table className="min-w-full text-xs">
                              <thead className="sticky top-0 bg-background/95 backdrop-blur">
                                <tr className="border-b border-border/60 text-left text-muted-foreground">
                                  <th className="px-3 py-2 font-medium">Row</th>
                                  <th className="px-3 py-2 font-medium">Employee</th>
                                  <th className="px-3 py-2 font-medium">Number</th>
                                  <th className="px-3 py-2 font-medium">Status</th>
                                  <th className="px-3 py-2 font-medium">Details</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredHistoryPreviewRows.map((row) => (
                                  <tr
                                    key={`${row.rowId ?? "row"}-${row.rowNumber}`}
                                    className="border-b border-border/40 align-top"
                                  >
                                    <td className="px-3 py-2 tabular-nums">{row.rowNumber}</td>
                                    <td className="px-3 py-2">
                                      <div className="min-w-0">
                                        <p className="truncate font-medium text-foreground">
                                          {row.identifier}
                                        </p>
                                        {row.matchedBy.length > 0 ? (
                                          <p className="truncate text-[11px] text-muted-foreground">
                                            Matched by {row.matchedBy.join(", ")}
                                          </p>
                                        ) : null}
                                        {previewRowDeviceSummary(row) ? (
                                          <p className="truncate text-[11px] text-muted-foreground">
                                            {previewRowDeviceSummary(row)}
                                          </p>
                                        ) : null}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2">{row.employeeNumber || "—"}</td>
                                    <td className="px-3 py-2">
                                      <StatusText value={row.status} />
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">
                                      {previewRowDetailText(row)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <BatchDetailsBody
                  batch={viewedBatch}
                  checkingResult={checkingResult}
                  fetchingReport={loadingResultReportBatchId === viewedBatch.batchId}
                  onFetchReport={
                    viewedBatch.batchId && viewedBatch.batchId !== "—"
                      ? () =>
                          void fetchResultReport(viewedBatch.batchId, { asDialog: true })
                      : undefined
                  }
                />
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No details available for this import.
                </p>
              )}
            </div>

            <AlertDialogFooter className="mt-0 shrink-0 border-t border-border px-5 py-3">
              {viewedBatch?.batchId && viewedBatch.batchId !== "—" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={checkingResult || !token}
                  onClick={() => {
                    void inspectBatch(viewedBatch.batchId, undefined, { asDialog: true })
                    void loadViewedPreview(viewedBatch.batchId)
                  }}
                >
                  {checkingResult ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCcwIcon className="size-3.5" />
                  )}
                  Refresh
                </Button>
              ) : null}
              <AlertDialogCancel className="h-8">Close</AlertDialogCancel>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

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
            openHistoryBatch(id)
          }}
          toolbarStart={
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight text-foreground">Past imports</div>
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
