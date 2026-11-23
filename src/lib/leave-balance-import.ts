import type {
  LeaveBalanceImportBatch,
  LeaveBalanceImportBatchDetail,
  LeaveBalanceImportBatchStatus,
  LeaveBalanceImportMode,
  LeaveBalanceImportRow,
  LeaveBalanceImportRowFilter,
} from "@/lib/admin-api"

export type ImportTone = "success" | "partial" | "danger" | "warn" | "info" | "neutral"

export type LeaveBalanceImportStep =
  | "template"
  | "upload"
  | "validation"
  | "preview"
  | "confirmation"
  | "result"

export const LEAVE_BALANCE_IMPORT_STEPS: Array<{
  id: LeaveBalanceImportStep
  label: string
  description: string
}> = [
  { id: "template", label: "Download template", description: "Current balances" },
  { id: "upload", label: "Upload", description: "Completed .xlsx" },
  { id: "validation", label: "Validation", description: "Checked against HRMS" },
  { id: "preview", label: "Preview", description: "Review every change" },
  { id: "confirmation", label: "Confirmation", description: "Import summary" },
  { id: "result", label: "Result", description: "Imported and skipped" },
]

export const LEAVE_BALANCE_IMPORT_PERMISSIONS = {
  export: "leave_balances:export",
  bulkImport: "leave_balances:import",
  validRowsOnly: "leave_balances:import-partial",
  history: "leave_balances:read-import-history",
} as const

const BATCH_STATUS: Record<LeaveBalanceImportBatchStatus, { label: string; tone: ImportTone }> = {
  UPLOADED: { label: "Uploaded", tone: "info" },
  VALIDATING: { label: "Validating", tone: "info" },
  VALIDATED: { label: "Validated · no changes", tone: "neutral" },
  HAS_ERRORS: { label: "Has errors", tone: "danger" },
  READY_FOR_IMPORT: { label: "Ready for import", tone: "success" },
  PROCESSING: { label: "Processing", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  PARTIALLY_COMPLETED: { label: "Partially completed", tone: "partial" },
  FAILED: { label: "Failed", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
}

export function describeBatchStatus(status: LeaveBalanceImportBatchStatus | string) {
  return (
    BATCH_STATUS[status as LeaveBalanceImportBatchStatus] ?? {
      label: status.replace(/_/g, " ").toLowerCase(),
      tone: "neutral" as ImportTone,
    }
  )
}

const ISSUE_LABELS: Record<string, string> = {
  CURRENT_BALANCE_MISMATCH: "Balance mismatch",
  BALANCE_CHANGED_SINCE_VALIDATION: "Changed after validation",
  EMPLOYEE_NOT_FOUND: "Employee not found",
  EMPLOYEE_INACTIVE: "Employee inactive",
  EMPLOYEE_ACCESS_DENIED: "Not in your scope",
  EMPLOYEE_DATA_MISMATCH: "Employee mismatch",
  LEAVE_TYPE_NOT_FOUND: "Leave type not found",
  LEAVE_TYPE_INACTIVE: "Leave type inactive",
  LEAVE_TYPE_MISMATCH: "Leave type mismatch",
  LEAVE_TYPE_NOT_ELIGIBLE: "Not eligible",
  LEAVE_YEAR_MISMATCH: "Wrong leave year",
  BALANCE_NOT_FOUND: "No balance",
  INVALID_CURRENT_BALANCE: "Invalid current balance",
  INVALID_NEW_BALANCE: "Invalid new balance",
  NEGATIVE_BALANCE_NOT_ALLOWED: "Negative not allowed",
  DUPLICATE_EMPLOYEE_LEAVE_TYPE: "Duplicate row",
  REQUIRED_FIELD_MISSING: "Missing value",
  INVALID_REASON: "Invalid reason",
  NOT_IMPORTED_BATCH_ROLLED_BACK: "Rolled back",
  IMPORT_FAILED: "Import failed",
}

/**
 * One label per row that never depends on colour alone: the import result
 * wins once a batch has been processed, otherwise the validation outcome.
 */
export function describeRowStatus(row: Pick<
  LeaveBalanceImportRow,
  "validation_status" | "result_status" | "error_code"
>): { label: string; tone: ImportTone } {
  if (row.result_status === "IMPORTED") return { label: "Imported", tone: "success" }
  if (row.result_status === "FAILED") {
    return { label: ISSUE_LABELS[row.error_code ?? ""] ?? "Failed", tone: "danger" }
  }
  if (row.result_status === "SKIPPED" && row.validation_status !== "NO_CHANGE") {
    return { label: "Skipped", tone: "neutral" }
  }
  switch (row.validation_status) {
    case "VALID":
      return { label: "Valid", tone: "success" }
    case "WARNING":
      return { label: "Warning", tone: "warn" }
    case "INVALID":
      return { label: ISSUE_LABELS[row.error_code ?? ""] ?? "Invalid", tone: "danger" }
    default:
      return { label: "No change", tone: "neutral" }
  }
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** "21.00" → "21", "12.50" → "12.5"; blank stays "—". */
export function formatBalanceDays(value: string | number | null | undefined): string {
  const parsed = toNumber(value)
  return parsed === null ? "—" : String(Number(parsed.toFixed(2)))
}

/** Signed adjustment, e.g. "+4", "-2", "0". */
export function formatAdjustmentDays(value: string | number | null | undefined): string {
  const parsed = toNumber(value)
  if (parsed === null) return "—"
  const text = String(Number(parsed.toFixed(2)))
  return parsed > 0 ? `+${text}` : text
}

export function resolveImportStep(state: {
  uploading: boolean
  confirming: boolean
  batch: Pick<LeaveBalanceImportBatch, "status"> | null
}): LeaveBalanceImportStep {
  if (state.uploading) return "validation"
  if (!state.batch) return "upload"
  if (state.confirming || state.batch.status === "PROCESSING") return "confirmation"
  if (["COMPLETED", "PARTIALLY_COMPLETED", "FAILED", "CANCELLED"].includes(state.batch.status)) {
    return "result"
  }
  return "preview"
}

export function isBatchFinished(status: LeaveBalanceImportBatchStatus): boolean {
  return ["COMPLETED", "PARTIALLY_COMPLETED", "FAILED", "CANCELLED"].includes(status)
}

export type RowFilterOption = {
  value: LeaveBalanceImportRowFilter
  label: string
  count: number | null
}

export function buildRowFilterOptions(batch: LeaveBalanceImportBatch): RowFilterOption[] {
  const base: RowFilterOption[] = [
    { value: "ALL", label: "All", count: batch.total_rows },
    { value: "VALID", label: "Valid", count: batch.valid_rows },
    { value: "WARNING", label: "Warning", count: batch.warning_rows },
    { value: "INVALID", label: "Invalid", count: batch.invalid_rows },
    { value: "CHANGED", label: "Changed", count: batch.changed_rows },
    { value: "UNCHANGED", label: "Unchanged", count: batch.no_change_rows },
    { value: "CONFLICT", label: "Balance conflicts", count: null },
  ]
  if (!isBatchFinished(batch.status) || batch.status === "CANCELLED") return base
  return [
    ...base,
    { value: "IMPORTED", label: "Imported", count: batch.imported_rows },
    { value: "FAILED", label: "Failed", count: batch.failed_rows },
    { value: "SKIPPED", label: "Skipped", count: batch.skipped_rows },
  ]
}

export function buildImportSummary(batch: LeaveBalanceImportBatchDetail): Array<{
  label: string
  value: string
}> {
  return [
    { label: "Total employees", value: String(batch.total_employees) },
    { label: "Employee + Leave Type records", value: String(batch.total_rows) },
    { label: "Balances changed", value: String(batch.changed_rows) },
    { label: "No change", value: String(batch.no_change_rows) },
    { label: "Warnings", value: String(batch.warning_rows) },
    { label: "Invalid", value: String(batch.invalid_rows) },
    { label: "Employees affected", value: String(batch.employees_affected) },
    {
      label: "Net adjustment (days)",
      value: formatAdjustmentDays(batch.summary?.net_adjustment_days ?? null),
    },
  ]
}

export type ConfirmationState = {
  mode: LeaveBalanceImportMode
  acknowledgeWarnings: boolean
  acknowledgeSkippedRows: boolean
}

/** Mirrors the server's confirmation rules so the button explains itself. */
export function evaluateConfirmation(
  batch: LeaveBalanceImportBatchDetail,
  state: ConfirmationState,
): { allowed: boolean; reason: string | null; importing: number; skipping: number } {
  const importing = batch.changed_rows
  const skipping = batch.total_rows - batch.changed_rows
  if (state.mode === "STRICT" && !batch.actions.can_confirm_strict) {
    return {
      allowed: false,
      reason:
        batch.invalid_rows > 0
          ? `Strict mode needs every row to be valid. Fix the ${batch.invalid_rows} invalid row(s) and upload again.`
          : "There are no balance changes to import.",
      importing,
      skipping,
    }
  }
  if (state.mode === "VALID_ROWS_ONLY" && !batch.actions.can_confirm_valid_rows_only) {
    return {
      allowed: false,
      reason: "You are not allowed to import valid rows only.",
      importing,
      skipping,
    }
  }
  if (batch.warning_rows > 0 && !state.acknowledgeWarnings) {
    return {
      allowed: false,
      reason: `Confirm that you reviewed the ${batch.warning_rows} row(s) with warnings.`,
      importing,
      skipping,
    }
  }
  if (state.mode === "VALID_ROWS_ONLY" && batch.invalid_rows > 0 && !state.acknowledgeSkippedRows) {
    return {
      allowed: false,
      reason: `Confirm that the ${batch.invalid_rows} invalid row(s) will be skipped.`,
      importing,
      skipping,
    }
  }
  return { allowed: true, reason: null, importing, skipping }
}

export function defaultImportMode(batch: LeaveBalanceImportBatchDetail): LeaveBalanceImportMode {
  return batch.actions.can_confirm_strict || !batch.actions.can_confirm_valid_rows_only
    ? "STRICT"
    : "VALID_ROWS_ONLY"
}

/** Background import progress, e.g. "320 / 500 records processed". */
export function importProgress(
  batch: Pick<LeaveBalanceImportBatch, "processed_rows" | "changed_rows">,
): { processed: number; total: number; percent: number } {
  const total = Math.max(0, batch.changed_rows)
  const processed = Math.min(total, Math.max(0, batch.processed_rows ?? 0))
  return { processed, total, percent: total ? Math.round((processed / total) * 100) : 0 }
}

export function templateYearOptions(now: Date = new Date()): string[] {
  const year = now.getFullYear()
  return [String(year), String(year - 1), String(year + 1)]
}
