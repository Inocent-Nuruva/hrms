import { describe, expect, it } from "vitest"

import type { LeaveBalanceImportBatchDetail } from "./admin-api"
import {
  buildRowFilterOptions,
  defaultImportMode,
  describeRowStatus,
  evaluateConfirmation,
  formatAdjustmentDays,
  formatBalanceDays,
  importProgress,
  resolveImportStep,
} from "./leave-balance-import"

function batch(overrides: Partial<LeaveBalanceImportBatchDetail> = {}): LeaveBalanceImportBatchDetail {
  return {
    batch_id: "LBI-20260926-ABC123",
    status: "READY_FOR_IMPORT",
    import_mode: null,
    fiscal_year: "2026",
    original_file_name: "balances.xlsx",
    file_size: 1024,
    template_generated_at: null,
    default_reason: null,
    total_rows: 520,
    valid_rows: 310,
    warning_rows: 10,
    invalid_rows: 0,
    no_change_rows: 200,
    changed_rows: 320,
    imported_rows: 0,
    skipped_rows: 0,
    failed_rows: 0,
    processed_rows: 0,
    total_employees: 150,
    employees_affected: 120,
    failure_reason: null,
    uploaded_at: "2026-09-26T08:00:00.000Z",
    uploaded_by: null,
    confirmed_at: null,
    confirmed_by: null,
    completed_at: null,
    cancelled_at: null,
    summary: { net_adjustment_days: "42.50" },
    actions: {
      can_confirm_strict: true,
      can_confirm_valid_rows_only: true,
      can_cancel: true,
      requires_warning_acknowledgement: true,
    },
    ...overrides,
  }
}

describe("leave balance import helpers", () => {
  it("formats balances and signed adjustments without trailing zeros", () => {
    expect(formatBalanceDays("21.00")).toBe("21")
    expect(formatBalanceDays("12.50")).toBe("12.5")
    expect(formatBalanceDays(null)).toBe("—")
    expect(formatAdjustmentDays("4.00")).toBe("+4")
    expect(formatAdjustmentDays("-2.00")).toBe("-2")
    expect(formatAdjustmentDays("0.00")).toBe("0")
  })

  it("labels rows with text, preferring the import result once processed", () => {
    expect(describeRowStatus({ validation_status: "INVALID", result_status: null, error_code: "CURRENT_BALANCE_MISMATCH" })).toEqual({
      label: "Balance mismatch",
      tone: "danger",
    })
    expect(describeRowStatus({ validation_status: "WARNING", result_status: "IMPORTED", error_code: "DEPARTMENT_MISMATCH" })).toEqual({
      label: "Imported",
      tone: "success",
    })
    expect(describeRowStatus({ validation_status: "NO_CHANGE", result_status: "SKIPPED", error_code: null }).label).toBe("No change")
    expect(
      describeRowStatus({ validation_status: "VALID", result_status: "FAILED", error_code: "BALANCE_CHANGED_SINCE_VALIDATION" }).label,
    ).toBe("Changed after validation")
  })

  it("walks the wizard steps from the batch state", () => {
    expect(resolveImportStep({ uploading: false, confirming: false, batch: null })).toBe("upload")
    expect(resolveImportStep({ uploading: true, confirming: false, batch: null })).toBe("validation")
    expect(resolveImportStep({ uploading: false, confirming: false, batch: { status: "HAS_ERRORS" } })).toBe("preview")
    expect(resolveImportStep({ uploading: false, confirming: true, batch: { status: "READY_FOR_IMPORT" } })).toBe("confirmation")
    expect(resolveImportStep({ uploading: false, confirming: false, batch: { status: "PARTIALLY_COMPLETED" } })).toBe("result")
  })

  it("requires warnings to be acknowledged before confirming", () => {
    const current = batch()
    expect(evaluateConfirmation(current, { mode: "STRICT", acknowledgeWarnings: false, acknowledgeSkippedRows: false })).toMatchObject({
      allowed: false,
    })
    expect(evaluateConfirmation(current, { mode: "STRICT", acknowledgeWarnings: true, acknowledgeSkippedRows: false })).toMatchObject({
      allowed: true,
      importing: 320,
      skipping: 200,
    })
  })

  it("blocks strict mode with invalid rows and asks to acknowledge skipped rows in valid-only mode", () => {
    const withErrors = batch({
      status: "HAS_ERRORS",
      invalid_rows: 20,
      warning_rows: 0,
      actions: {
        can_confirm_strict: false,
        can_confirm_valid_rows_only: true,
        can_cancel: true,
        requires_warning_acknowledgement: false,
      },
    })
    expect(defaultImportMode(withErrors)).toBe("VALID_ROWS_ONLY")
    expect(
      evaluateConfirmation(withErrors, { mode: "STRICT", acknowledgeWarnings: false, acknowledgeSkippedRows: false }).reason,
    ).toContain("20 invalid")
    expect(
      evaluateConfirmation(withErrors, { mode: "VALID_ROWS_ONLY", acknowledgeWarnings: false, acknowledgeSkippedRows: false }).allowed,
    ).toBe(false)
    expect(
      evaluateConfirmation(withErrors, { mode: "VALID_ROWS_ONLY", acknowledgeWarnings: false, acknowledgeSkippedRows: true }).allowed,
    ).toBe(true)
  })

  it("adds result filters only after the batch finished", () => {
    expect(buildRowFilterOptions(batch()).map((option) => option.value)).not.toContain("IMPORTED")
    expect(buildRowFilterOptions(batch({ status: "COMPLETED", imported_rows: 320 })).map((option) => option.value)).toEqual(
      expect.arrayContaining(["IMPORTED", "FAILED", "SKIPPED"]),
    )
  })

  it("reports background import progress", () => {
    expect(importProgress(batch({ processed_rows: 80 }))).toEqual({ processed: 80, total: 320, percent: 25 })
    expect(importProgress(batch({ changed_rows: 0 }))).toEqual({ processed: 0, total: 0, percent: 0 })
  })
})
