"use client"

import * as React from "react"
import {
  DownloadIcon,
  FileSearchIcon,
  Loader2Icon,
  RefreshCcwIcon,
  SendIcon,
  UploadIcon,
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
} from "@/lib/admin-api"
import { subscribeToDashboardActorSnapshot } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const IMPORT_MODES: Array<{ value: EmployeeImportMode; label: string; description: string }> = [
  {
    value: "CREATE_ONLY",
    label: "Create Only",
    description: "Adds only new employees and leaves existing records untouched.",
  },
  {
    value: "UPDATE_EXIST",
    label: "Update Existing",
    description: "Updates matching employees without creating brand-new records.",
  },
  {
    value: "CREATE_OR_UPDATE",
    label: "Create Or Update",
    description: "Creates missing employees and updates the ones already in the system.",
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
    totalRows: readNumberFromCandidates(records, ["total_rows", "totalRows", "row_count", "rowCount"]),
    validRows: readNumberFromCandidates(records, ["valid_rows", "validRows"]),
    invalidRows: readNumberFromCandidates(records, ["invalid_rows", "invalidRows"]),
    newRows: readNumberFromCandidates(records, ["new_rows", "newRows", "created_rows", "createdRows"]),
    updatedRows: readNumberFromCandidates(records, ["updated_rows", "updatedRows"]),
    skippedRows: readNumberFromCandidates(records, ["skipped_rows", "skippedRows"]),
    processedRows: readNumberFromCandidates(records, ["processed_rows", "processedRows"]),
    successRows: readNumberFromCandidates(records, ["success_rows", "successRows", "successful_rows", "successfulRows"]),
    failedRows: readNumberFromCandidates(records, ["failed_rows_count", "failedRowsCount", "failed_rows", "failedRows"]),
  }
}

function extractIssueMessage(record: AdminRecord | null): string {
  if (!record) {
    return ""
  }

  const direct =
    readString(record, ["message", "error", "reason", "detail", "description"], "") ||
    readStringArray(record.messages).join("; ") ||
    readStringArray(record.errors).join("; ")

  if (direct) {
    return direct
  }

  const fieldErrors = asRecord(record.field_errors) ?? asRecord(record.fieldErrors)
  if (fieldErrors) {
    const parts = Object.entries(fieldErrors).flatMap(([field, value]) => {
      const messages = readStringArray(value)
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

function normalizeIssue(row: AdminRecord): ImportIssue {
  const messages = extractIssueMessage(row) || "Row failed validation."
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
    message: messages,
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
        issues.push(normalizeIssue(row))
      }
    }
  }

  if (issues.length === 0 && root) {
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

function extractPreviewDetails(payload: AdminRecord | null): PreviewDetails | null {
  if (!payload) {
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

function extractBatchDetails(payload: AdminRecord | null): BatchDetails | null {
  if (!payload) {
    return null
  }
  const records = collectRecords(payload)
  return {
    payload,
    batchId: readStringFromCandidates(records, ["batch_id", "batchId", "id"]),
    importMode: readStringFromCandidates(records, ["import_mode", "importMode", "mode"]),
    status: readStringFromCandidates(records, ["status", "state"]),
    processValidRowsOnly: readBooleanFromCandidates(records, ["process_valid_rows_only", "processValidRowsOnly"]),
    createdAt: readStringFromCandidates(records, ["created_at", "createdAt"]),
    updatedAt: readStringFromCandidates(records, ["updated_at", "updatedAt"]),
    completedAt: readStringFromCandidates(records, ["completed_at", "completedAt", "finished_at", "finishedAt"]),
    overview: buildOverview(records),
    issues: extractIssues(payload, records),
  }
}

function extractHistorySummary(row: AdminRecord): HistorySummary {
  const records = collectRecords(row)
  return {
    batchId: readStringFromCandidates(records, ["batch_id", "batchId", "id"], "—"),
    mode: readStringFromCandidates(records, ["import_mode", "importMode", "mode"], "—"),
    status: readStringFromCandidates(records, ["status", "state"], "—"),
    createdAt: readStringFromCandidates(records, ["created_at", "createdAt", "generated_at", "generatedAt"], "—"),
    totalRows: readNumberFromCandidates(records, ["total_rows", "totalRows", "row_count", "rowCount"]),
    validRows: readNumberFromCandidates(records, ["valid_rows", "validRows"]),
    invalidRows: readNumberFromCandidates(records, ["invalid_rows", "invalidRows"]),
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

function StatusBadge({ value }: { value: string }) {
  const normalized = value.trim().toLowerCase()
  const variant =
    normalized === "completed" || normalized === "success" || normalized === "successful"
      ? "default"
      : normalized === "failed" || normalized === "error" || normalized === "rejected"
        ? "destructive"
        : "outline"

  return <Badge variant={variant}>{value || "Unknown"}</Badge>
}

function OverviewGrid({ overview }: { overview: ImportOverview }) {
  const items = [
    { label: "Total Rows", value: overview.totalRows },
    { label: "Valid Rows", value: overview.validRows },
    { label: "Invalid Rows", value: overview.invalidRows },
    { label: "New Rows", value: overview.newRows },
    { label: "Updated Rows", value: overview.updatedRows },
    { label: "Skipped Rows", value: overview.skippedRows },
    { label: "Processed Rows", value: overview.processedRows },
    { label: "Succeeded", value: overview.successRows },
    { label: "Failed", value: overview.failedRows },
  ].filter((item) => item.value !== null)

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-sm text-muted-foreground">
        Summary details are not available for this response yet.
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
          <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.label}</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{item.value}</div>
        </div>
      ))}
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
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Row</TableHead>
          <TableHead>Employee</TableHead>
          <TableHead>Field</TableHead>
          <TableHead>Issue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue, index) => (
          <TableRow key={`${issue.rowLabel}-${issue.employeeLabel}-${index}`}>
            <TableCell>{issue.rowLabel}</TableCell>
            <TableCell>{issue.employeeLabel}</TableCell>
            <TableCell>{issue.fieldLabel}</TableCell>
            <TableCell className="max-w-xl whitespace-normal break-words">{issue.message}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
  const [historyLimit] = React.useState(10)
  const [historyTotal, setHistoryTotal] = React.useState<number | null>(null)

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
      try {
        const response = await getEmployeeImportResult(token, normalizedBatchId)
        const details = extractBatchDetails(response)
        setLatestBatch(details)
        setInspectedBatchId(normalizedBatchId)
        setMessage(successMessage ?? "Import result loaded successfully.")
      } catch (resultError) {
        setError(resultError instanceof Error ? resultError.message : "Failed to fetch employee import result.")
      } finally {
        setCheckingResult(false)
      }
    },
    [token]
  )

  const handleFileSelection = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    if (!isSupportedEmployeeImportFile(nextFile)) {
      setSelectedFile(null)
      setPreviewDetails(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      setError(nextFile ? "Only .xlsx employee import files are supported." : null)
      setMessage(null)
      return
    }

    setSelectedFile(nextFile)
    setPreviewDetails(null)
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
      setMessage("Preview generated successfully. Review the summary below before confirming.")
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Failed to generate import preview.")
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
      setLatestBatch(details)
      const nextBatchId = details?.batchId ?? ""
      if (nextBatchId) {
        setInspectedBatchId(nextBatchId)
      }
      setMessage("Employee import started successfully.")
      void loadHistory()
      if (nextBatchId) {
        void inspectBatch(nextBatchId, "Employee import started successfully. Latest batch details have been loaded.")
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Failed to start employee import.")
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
      setMessage("Preview confirmed successfully.")
      void loadHistory()
      if (nextBatchId) {
        void inspectBatch(nextBatchId, "Preview confirmed successfully. Latest batch details have been loaded.")
      }
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Failed to confirm employee import.")
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
      setMessage(`Template downloaded as ${result.filename}.`)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download employee import template.")
    } finally {
      setDownloadingTemplate(false)
    }
  }, [token])

  const selectedMode = IMPORT_MODES.find((mode) => mode.value === importMode)
  const latestBatchId = latestBatch?.batchId || inspectedBatchId

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Employee Import</CardTitle>
          <CardDescription>Upload one file, review the preview, confirm when ready, and inspect the latest batch here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employee-import-file">Excel file</Label>
                <input
                  ref={fileInputRef}
                  id="employee-import-file"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={handleFileSelection}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    Choose File
                  </Button>
                  {selectedFile ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => {
                        setSelectedFile(null)
                        setPreviewDetails(null)
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ""
                        }
                      }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">{selectedFile ? selectedFile.name : "No file selected."}</p>
                <p className="text-xs text-muted-foreground">Use the provided Excel template and upload a `.xlsx` file.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee-import-mode">Import mode</Label>
                <Select value={importMode} onValueChange={(value) => setImportMode(value as EmployeeImportMode)}>
                  <SelectTrigger id="employee-import-mode">
                    <SelectValue placeholder="Select import mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPORT_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{selectedMode?.description}</p>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-3">
                <Checkbox
                  checked={processValidRowsOnly}
                  onCheckedChange={(checked) => setProcessValidRowsOnly(checked === true)}
                  aria-label="Process valid rows only"
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Process valid rows only</p>
                  <p className="text-xs text-muted-foreground">Continue with valid records even if some rows need correction.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handlePreview} disabled={previewing || importing || !token}>
                  {previewing ? <Loader2Icon className="size-4 animate-spin" /> : <UploadIcon className="size-4" />}
                  Preview Import
                </Button>
                <Button type="button" variant="outline" onClick={handleImport} disabled={importing || previewing || !token}>
                  {importing ? <Loader2Icon className="size-4 animate-spin" /> : <UploadIcon className="size-4" />}
                  Start Import Now
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTemplateDownload}
                  disabled={downloadingTemplate || !token}
                >
                  {downloadingTemplate ? <Loader2Icon className="size-4 animate-spin" /> : <DownloadIcon className="size-4" />}
                  Download Template
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Guided Flow</div>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-3">
                  <div className="text-sm font-medium text-foreground">1. Upload and validate</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Select the template-filled file, choose the mode, and generate a preview.
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-foreground">2. Review preview</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        The latest preview token stays attached to this screen, so confirmation is one click.
                      </div>
                    </div>
                    <Badge variant={previewDetails ? "default" : "outline"}>{previewDetails ? "Ready" : "Waiting"}</Badge>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-foreground">3. Track latest batch</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Load result details here or inspect any previous batch from history.
                      </div>
                    </div>
                    <Badge variant={latestBatchId ? "default" : "outline"}>{latestBatchId ? "Active" : "Idle"}</Badge>
                  </div>
                </div>
              </div>
            </div>
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

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Preview Review</CardTitle>
          <CardDescription>Check the summary and invalid rows from your latest preview before confirming.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {previewDetails ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{formatModeLabel(previewDetails.importMode || importMode)}</Badge>
                <Badge variant="outline">
                  {previewDetails.processValidRowsOnly === false ? "Block invalid rows" : "Process valid rows only"}
                </Badge>
                {previewDetails.previewToken ? (
                  <Badge variant="secondary" className="font-mono">
                    {previewDetails.previewToken}
                  </Badge>
                ) : null}
              </div>

              <OverviewGrid overview={previewDetails.overview} />

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleConfirm} disabled={confirming || !token || !previewDetails.previewToken}>
                  {confirming ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
                  Confirm Latest Preview
                </Button>
                <Button type="button" variant="outline" onClick={handleImport} disabled={importing || previewing || !token}>
                  {importing ? <Loader2Icon className="size-4 animate-spin" /> : <UploadIcon className="size-4" />}
                  Skip Confirmation and Start Import
                </Button>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Invalid Row Details</div>
                <IssueTable issues={previewDetails.issues} emptyMessage="No invalid row details were returned in this preview." />
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-sm text-muted-foreground">
              Generate a preview to see row counts, validation errors, and the confirm action here.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Latest Batch</CardTitle>
          <CardDescription>Inspect the newest import batch or reload the currently selected one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void inspectBatch(latestBatchId)}
              disabled={checkingResult || !token || !latestBatchId}
            >
              {checkingResult ? <Loader2Icon className="size-4 animate-spin" /> : <FileSearchIcon className="size-4" />}
              Refresh Latest Batch
            </Button>
            {latestBatchId ? <Badge variant="secondary" className="font-mono">{latestBatchId}</Badge> : null}
          </div>

          {latestBatch ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={latestBatch.status || "Unknown"} />
                <Badge variant="outline">{formatModeLabel(latestBatch.importMode)}</Badge>
                <Badge variant="outline">
                  {latestBatch.processValidRowsOnly === false ? "Block invalid rows" : "Process valid rows only"}
                </Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Created</div>
                  <div className="mt-1 text-sm font-medium text-foreground">{formatDateTime(latestBatch.createdAt)}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Updated</div>
                  <div className="mt-1 text-sm font-medium text-foreground">{formatDateTime(latestBatch.updatedAt)}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Completed</div>
                  <div className="mt-1 text-sm font-medium text-foreground">{formatDateTime(latestBatch.completedAt)}</div>
                </div>
              </div>

              <OverviewGrid overview={latestBatch.overview} />

              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Batch Result Details</div>
                <IssueTable issues={latestBatch.issues} emptyMessage="No row-level issues were returned for this batch." />
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-sm text-muted-foreground">
              Start an import, confirm the latest preview, or inspect a batch from history to load detailed results here.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Import History</CardTitle>
          <CardDescription>Recent employee imports with direct inspect actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => void loadHistory()} disabled={loadingHistory || !token}>
              {loadingHistory ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCcwIcon className="size-4" />}
              Refresh History
            </Button>
            <div className="text-xs text-muted-foreground">
              Page {historyPage}
              {typeof historyTotal === "number" ? ` • Total ${historyTotal}` : ""}
            </div>
          </div>

          {historyRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-sm text-muted-foreground">
              No employee import history found yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRows.map((row, index) => {
                  const summary = extractHistorySummary(row)
                  const isActive = summary.batchId !== "—" && summary.batchId === latestBatchId

                  return (
                    <TableRow key={`${summary.batchId || "batch"}-${index}`} className={isActive ? "bg-muted/30" : undefined}>
                      <TableCell className="font-mono text-xs">{summary.batchId || "—"}</TableCell>
                      <TableCell>{formatModeLabel(summary.mode)}</TableCell>
                      <TableCell>
                        <StatusBadge value={summary.status || "Unknown"} />
                      </TableCell>
                      <TableCell>
                        {summary.totalRows !== null ? `${summary.totalRows} total` : "—"}
                        {summary.validRows !== null ? ` • ${summary.validRows} valid` : ""}
                        {summary.invalidRows !== null ? ` • ${summary.invalidRows} invalid` : ""}
                      </TableCell>
                      <TableCell>{formatDateTime(summary.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={checkingResult || !token || !summary.batchId || summary.batchId === "—"}
                          onClick={() => void inspectBatch(summary.batchId, "Selected batch details loaded successfully.")}
                        >
                          Inspect
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={historyPage <= 1 || loadingHistory}
              onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loadingHistory || (historyTotal !== null && historyPage * historyLimit >= historyTotal)}
              onClick={() => setHistoryPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
