import { z } from "zod";

export const LeaveBalanceImportBatchDetailSchema = z
  .object({
    batch_id: z.string(),
    status: z.union([
      z.literal("UPLOADED"),
      z.literal("VALIDATING"),
      z.literal("VALIDATED"),
      z.literal("HAS_ERRORS"),
      z.literal("READY_FOR_IMPORT"),
      z.literal("PROCESSING"),
      z.literal("COMPLETED"),
      z.literal("PARTIALLY_COMPLETED"),
      z.literal("FAILED"),
      z.literal("CANCELLED"),
    ]),
    import_mode: z.union([
      z.null(),
      z.literal("STRICT"),
      z.literal("VALID_ROWS_ONLY"),
    ]),
    fiscal_year: z.string(),
    original_file_name: z.string(),
    file_size: z.number(),
    template_generated_at: z.union([z.null(), z.string()]),
    default_reason: z.union([z.null(), z.string()]),
    total_rows: z.number(),
    valid_rows: z.number(),
    warning_rows: z.number(),
    invalid_rows: z.number(),
    no_change_rows: z.number(),
    changed_rows: z.number(),
    imported_rows: z.number(),
    skipped_rows: z.number(),
    failed_rows: z.number(),
    processed_rows: z.number(),
    total_employees: z.number(),
    employees_affected: z.number(),
    failure_reason: z.union([z.null(), z.string()]),
    uploaded_at: z.string(),
    uploaded_by: z.union([
      z.null(),
      z
        .object({ id: z.number(), name: z.string(), email: z.string() })
        .passthrough(),
    ]),
    confirmed_at: z.union([z.null(), z.string()]),
    confirmed_by: z.union([
      z.null(),
      z
        .object({ id: z.number(), name: z.string(), email: z.string() })
        .passthrough(),
    ]),
    completed_at: z.union([z.null(), z.string()]),
    cancelled_at: z.union([z.null(), z.string()]),
    summary: z
      .object({
        issue_counts: z
          .union([z.undefined(), z.record(z.string(), z.number())])
          .optional(),
        total_increase_days: z.union([z.undefined(), z.string()]).optional(),
        total_decrease_days: z.union([z.undefined(), z.string()]).optional(),
        net_adjustment_days: z.union([z.undefined(), z.string()]).optional(),
        facets: z
          .union([
            z.undefined(),
            z
              .object({
                leave_types: z
                  .union([
                    z.undefined(),
                    z.array(
                      z
                        .object({
                          id: z.number(),
                          name: z.string(),
                          code: z.union([z.undefined(), z.string()]).optional(),
                        })
                        .passthrough(),
                    ),
                  ])
                  .optional(),
                branches: z
                  .union([
                    z.undefined(),
                    z.array(
                      z
                        .object({
                          id: z.number(),
                          name: z.string(),
                          code: z.union([z.undefined(), z.string()]).optional(),
                        })
                        .passthrough(),
                    ),
                  ])
                  .optional(),
                departments: z
                  .union([
                    z.undefined(),
                    z.array(
                      z
                        .object({
                          id: z.number(),
                          name: z.string(),
                          code: z.union([z.undefined(), z.string()]).optional(),
                        })
                        .passthrough(),
                    ),
                  ])
                  .optional(),
              })
              .passthrough(),
          ])
          .optional(),
        result: z
          .union([
            z.undefined(),
            z
              .object({
                imported_rows: z.union([z.undefined(), z.number()]).optional(),
                failed_rows: z.union([z.undefined(), z.number()]).optional(),
                skipped_rows: z.union([z.undefined(), z.number()]).optional(),
                net_adjustment_days: z
                  .union([z.undefined(), z.string()])
                  .optional(),
              })
              .passthrough(),
          ])
          .optional(),
      })
      .passthrough(),
    actions: z
      .object({
        can_confirm_strict: z.boolean(),
        can_confirm_valid_rows_only: z.boolean(),
        can_cancel: z.boolean(),
        requires_warning_acknowledgement: z.boolean(),
      })
      .passthrough(),
  })
  .passthrough();

export const DashboardCardStyleSchema = z
  .object({
    palette: z.union([
      z.literal("ocean"),
      z.literal("forest"),
      z.literal("plum"),
      z.literal("coral"),
      z.literal("midnight"),
      z.literal("berry"),
      z.literal("neutral"),
      z.literal("white"),
    ]),
    artwork: z.union([
      z.literal("none"),
      z.literal("orbit"),
      z.literal("waves"),
      z.literal("confetti"),
      z.literal("arches"),
      z.literal("sprigs"),
    ]),
  })
  .passthrough();

export const IdentityAuditPageSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.number(),
          change_set_id: z.string(),
          company_id: z.number(),
          user_id: z.union([z.null(), z.number()]),
          employee_id: z.union([z.null(), z.number()]),
          affected_employee_ids: z.array(z.number()),
          subject_name: z.union([z.null(), z.string()]),
          field: z.union([
            z.literal("first_name"),
            z.literal("last_name"),
            z.literal("email"),
            z.literal("phone"),
          ]),
          old_value: z.union([z.null(), z.string()]),
          new_value: z.union([z.null(), z.string()]),
          source: z.union([
            z.literal("user_update"),
            z.literal("employee_update"),
            z.literal("rollback"),
          ]),
          rollback_of_change_set_id: z.union([z.null(), z.string()]),
          rolled_back_by_change_set_id: z.union([z.null(), z.string()]),
          can_rollback: z.boolean(),
          actor_user_id: z.union([z.null(), z.number()]),
          actor_name: z.union([z.null(), z.string()]),
          actor_email: z.union([z.null(), z.string()]),
          reason: z.union([z.null(), z.string()]),
          created_at: z.string(),
        })
        .passthrough(),
    ),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  })
  .passthrough();

export const IdentityRollbackSchema = z
  .object({
    changeSetId: z.union([z.null(), z.string()]),
    changedFields: z.array(z.string()),
  })
  .passthrough();

export const LeaveBalanceImportBatchSchema = z
  .object({
    batch_id: z.string(),
    status: z.union([
      z.literal("UPLOADED"),
      z.literal("VALIDATING"),
      z.literal("VALIDATED"),
      z.literal("HAS_ERRORS"),
      z.literal("READY_FOR_IMPORT"),
      z.literal("PROCESSING"),
      z.literal("COMPLETED"),
      z.literal("PARTIALLY_COMPLETED"),
      z.literal("FAILED"),
      z.literal("CANCELLED"),
    ]),
    import_mode: z.union([
      z.null(),
      z.literal("STRICT"),
      z.literal("VALID_ROWS_ONLY"),
    ]),
    fiscal_year: z.string(),
    original_file_name: z.string(),
    file_size: z.number(),
    template_generated_at: z.union([z.null(), z.string()]),
    default_reason: z.union([z.null(), z.string()]),
    total_rows: z.number(),
    valid_rows: z.number(),
    warning_rows: z.number(),
    invalid_rows: z.number(),
    no_change_rows: z.number(),
    changed_rows: z.number(),
    imported_rows: z.number(),
    skipped_rows: z.number(),
    failed_rows: z.number(),
    processed_rows: z.number(),
    total_employees: z.number(),
    employees_affected: z.number(),
    failure_reason: z.union([z.null(), z.string()]),
    uploaded_at: z.string(),
    uploaded_by: z.union([
      z.null(),
      z
        .object({ id: z.number(), name: z.string(), email: z.string() })
        .passthrough(),
    ]),
    confirmed_at: z.union([z.null(), z.string()]),
    confirmed_by: z.union([
      z.null(),
      z
        .object({ id: z.number(), name: z.string(), email: z.string() })
        .passthrough(),
    ]),
    completed_at: z.union([z.null(), z.string()]),
    cancelled_at: z.union([z.null(), z.string()]),
  })
  .passthrough();

export const LeaveBalanceImportRowSchema = z
  .object({
    id: z.number(),
    row_number: z.number(),
    employee_no: z.union([z.null(), z.string()]),
    employee_name: z.union([z.null(), z.string()]),
    branch_name: z.union([z.null(), z.string()]),
    department_name: z.union([z.null(), z.string()]),
    leave_type_code: z.union([z.null(), z.string()]),
    leave_type_name: z.union([z.null(), z.string()]),
    uploaded_current_balance: z.union([z.null(), z.string()]),
    db_current_balance: z.union([z.null(), z.string()]),
    new_balance: z.union([z.null(), z.string()]),
    adjustment_days: z.union([z.null(), z.string()]),
    reason: z.union([z.null(), z.string()]),
    validation_status: z.union([
      z.literal("VALID"),
      z.literal("WARNING"),
      z.literal("INVALID"),
      z.literal("NO_CHANGE"),
    ]),
    result_status: z.union([
      z.null(),
      z.literal("FAILED"),
      z.literal("IMPORTED"),
      z.literal("SKIPPED"),
    ]),
    error_code: z.union([z.null(), z.string()]),
    message: z.union([z.null(), z.string()]),
    issues: z.array(
      z
        .object({
          code: z.string(),
          severity: z.union([
            z.literal("error"),
            z.literal("warning"),
            z.literal("info"),
          ]),
          field: z.union([z.null(), z.string()]),
          message: z.string(),
        })
        .passthrough(),
    ),
    previous_balance_at_import: z.union([z.null(), z.string()]),
    new_balance_at_import: z.union([z.null(), z.string()]),
    processed_at: z.union([z.null(), z.string()]),
  })
  .passthrough();

const ImportPageMetaSchema = z
  .object({
    totalItems: z.number().int().nonnegative().optional(),
    itemCount: z.number().int().nonnegative().optional(),
    itemsPerPage: z.number().int().positive().optional(),
    currentPage: z.number().int().positive().optional(),
    totalPages: z.number().int().nonnegative().optional(),
  })
  .passthrough();
export const LeaveBalanceImportRowsPageSchema = z
  .object({
    data: z.array(LeaveBalanceImportRowSchema),
    meta: ImportPageMetaSchema.optional(),
  })
  .passthrough();
export const LeaveBalanceImportBatchesPageSchema = z
  .object({
    data: z.array(LeaveBalanceImportBatchSchema),
    meta: ImportPageMetaSchema.optional(),
  })
  .passthrough();
