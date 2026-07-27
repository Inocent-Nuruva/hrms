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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

function readStoredToken(): string {
  return readStoredSessionTokens().accessToken.trim()
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null ? (value as AdminRecord) : null
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

function findFirstRecord(record: AdminRecord | null, keys: string[]) {
  if (!record) return null
  for (const key of keys) {
    const nested = asRecord(record[key])
    if (nested) return nested
  }
  return null
}

function extractPreviewToken(payload: AdminRecord | null) {
  const nested = findFirstRecord(payload, ["data", "result", "preview"])
  return (
    readString(payload, ["preview_token", "previewToken"], "") ||
    readString(nested, ["preview_token", "previewToken"], "")
  )
}

function extractBatchId(payload: AdminRecord | null) {
  const nested = findFirstRecord(payload, ["data", "result", "batch", "import_batch"])
  return (
    readString(payload, ["batch_id", "batchId", "id"], "") ||
    readString(nested, ["batch_id", "batchId", "id"], "")
  )
}

function extractHistorySummary(row: AdminRecord) {
  const nested = findFirstRecord(row, ["data", "result", "summary"])
  return {
    batchId:
      readString(row, ["batch_id", "batchId", "id"], "") ||
      readString(nested, ["batch_id", "batchId", "id"], "—"),
    mode:
      readString(row, ["import_mode", "importMode", "mode"], "") ||
      readString(nested, ["import_mode", "importMode", "mode"], "—"),
    status:
      readString(row, ["status", "state"], "") ||
      readString(nested, ["status", "state"], "—"),
    createdAt:
      readString(row, ["created_at", "createdAt", "generated_at", "generatedAt"], "") ||
      readString(nested, ["created_at", "createdAt", "generated_at", "generatedAt"], "—"),
    totalRows:
      readNumber(row, ["total_rows", "totalRows", "row_count", "rowCount"]) ??
      readNumber(nested, ["total_rows", "totalRows", "row_count", "rowCount"]),
    validRows:
      readNumber(row, ["valid_rows", "validRows"]) ??
      readNumber(nested, ["valid_rows", "validRows"]),
    invalidRows:
      readNumber(row, ["invalid_rows", "invalidRows"]) ??
      readNumber(nested, ["invalid_rows", "invalidRows"]),
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

export function EmployeeImportView() {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [token, setToken] = React.useState("")
  const [importMode, setImportMode] = React.useState<EmployeeImportMode>("CREATE_ONLY")
  const [processValidRowsOnly, setProcessValidRowsOnly] = React.useState(true)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [previewToken, setPreviewToken] = React.useState("")
  const [batchId, setBatchId] = React.useState("")
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

  const handleFileSelection = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0] ?? null
      if (!isSupportedEmployeeImportFile(nextFile)) {
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
        setError(nextFile ? "Only .xlsx employee import files are supported." : null)
        setMessage(null)
        return
      }

      setSelectedFile(nextFile)
      setError((currentError) =>
        currentError === "Excel file is required." ||
        currentError === "Only .xlsx employee import files are supported."
          ? null
          : currentError
      )
      setMessage(null)
    },
    []
  )

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
      const response = await previewEmployeeImport(token, {
        import_mode: importMode,
        process_valid_rows_only: processValidRowsOnly,
      }, selectedFile, selectedFile.name)
      const nextPreviewToken = extractPreviewToken(response)
      if (nextPreviewToken) {
        setPreviewToken(nextPreviewToken)
      }
      setMessage("Preview generated successfully.")
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
      const response = await startEmployeeImport(token, {
        import_mode: importMode,
        process_valid_rows_only: processValidRowsOnly,
      }, selectedFile, selectedFile.name)
      const nextBatchId = extractBatchId(response)
      if (nextBatchId) {
        setBatchId(nextBatchId)
      }
      setMessage("Employee import started successfully.")
      void loadHistory()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Failed to start employee import.")
    } finally {
      setImporting(false)
    }
  }, [importMode, loadHistory, processValidRowsOnly, selectedFile, token])

  const handleConfirm = React.useCallback(async () => {
    if (!token) return
    if (!previewToken.trim()) {
      setError("Enter a preview token before confirming the import.")
      return
    }
    setConfirming(true)
    setError(null)
    setMessage(null)
    try {
      const response = await confirmEmployeeImport(token, {
        preview_token: previewToken.trim(),
        process_valid_rows_only: processValidRowsOnly,
      })
      const nextBatchId = extractBatchId(response)
      if (nextBatchId) {
        setBatchId(nextBatchId)
      }
      setMessage("Preview confirmed successfully.")
      void loadHistory()
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Failed to confirm employee import.")
    } finally {
      setConfirming(false)
    }
  }, [loadHistory, previewToken, processValidRowsOnly, token])

  const handleCheckResult = React.useCallback(async () => {
    if (!token) return
    if (!batchId.trim()) {
      setError("Enter a batch ID before checking the import result.")
      return
    }
    setCheckingResult(true)
    setError(null)
    setMessage(null)
    try {
      await getEmployeeImportResult(token, batchId.trim())
      setMessage("Import result loaded successfully.")
    } catch (resultError) {
      setError(resultError instanceof Error ? resultError.message : "Failed to fetch employee import result.")
    } finally {
      setCheckingResult(false)
    }
  }, [batchId, token])

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

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Employee Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ""
                      }
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedFile ? selectedFile.name : "No file selected."}
              </p>
              <p className="text-xs text-muted-foreground">
                Use the provided Excel template and upload a `.xlsx` file.
              </p>
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
                <p className="text-xs text-muted-foreground">
                  Continue with valid records even if some rows need correction.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handlePreview} disabled={previewing || importing || !token}>
                {previewing ? <Loader2Icon className="size-4 animate-spin" /> : <UploadIcon className="size-4" />}
                Preview Import
              </Button>
              <Button type="button" variant="outline" onClick={handleImport} disabled={importing || previewing || !token}>
                {importing ? <Loader2Icon className="size-4 animate-spin" /> : <UploadIcon className="size-4" />}
                Start Import
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTemplateDownload}
                disabled={downloadingTemplate || !token}
              >
                {downloadingTemplate ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <DownloadIcon className="size-4" />
                )}
                Download Template
              </Button>
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

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Confirm Preview</CardTitle>
            <CardDescription>Enter the preview token to continue with this import.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="employee-import-preview-token">Preview token</Label>
              <Input
                id="employee-import-preview-token"
                value={previewToken}
                onChange={(event) => setPreviewToken(event.target.value)}
                placeholder="Paste preview token"
              />
            </div>
            <Button type="button" onClick={handleConfirm} disabled={confirming || !token}>
              {confirming ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
              Confirm Import
            </Button>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Check Import Result</CardTitle>
            <CardDescription>Enter the batch ID to view the latest status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="employee-import-batch-id">Batch ID</Label>
              <Input
                id="employee-import-batch-id"
                value={batchId}
                onChange={(event) => setBatchId(event.target.value)}
                placeholder="Paste batch ID"
              />
            </div>
            <Button type="button" variant="outline" onClick={handleCheckResult} disabled={checkingResult || !token}>
              {checkingResult ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <FileSearchIcon className="size-4" />
              )}
              Get Result
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Import History</CardTitle>
          <CardDescription>Recent employee imports.</CardDescription>
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
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="min-w-full divide-y divide-border/70 text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Batch</th>
                    <th className="px-3 py-2 font-medium">Mode</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Rows</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {historyRows.map((row, index) => {
                    const summary = extractHistorySummary(row)
                    return (
                      <tr key={`${summary.batchId || "batch"}-${index}`} className="bg-background/80">
                        <td className="px-3 py-2 font-mono text-xs">{summary.batchId || "—"}</td>
                        <td className="px-3 py-2">{summary.mode || "—"}</td>
                        <td className="px-3 py-2">{summary.status || "—"}</td>
                        <td className="px-3 py-2">
                          {summary.totalRows !== null
                            ? `${summary.totalRows} total`
                            : "—"}
                          {summary.validRows !== null ? ` • ${summary.validRows} valid` : ""}
                          {summary.invalidRows !== null ? ` • ${summary.invalidRows} invalid` : ""}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{summary.createdAt || "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
