export type LeavePolicyTypeAssignment = {
  leave_type_id: string
  leave_type_name: string
  annual_quota_days: string
  max_per_request_days: string
  requires_approval: string
  encashment_enabled: string
  maximum_encashment_days: string
  encashment_rate_divisor: string
  minimum_balance_after_encashment: string
  encashment_requires_approval: string
  maximum_accumulation_days: string
  /** "" = use the policy's accrual schedule */
  accrual_method: string
  /** "" = use the leave type's basic carry-forward; "true"/"false" = policy rule */
  carry_forward_enabled: string
  /** "" = no cap */
  carry_forward_max_days: string
  /** "none" | "months" | "date" */
  carry_forward_expiry_mode: string
  carry_forward_expiry_months: string
  /** MM-DD */
  carry_forward_expiry_date: string
  carry_forward_auto_expire: string
  carry_forward_consume_first: string
}

export type LeavePolicyFormValue = {
  name: string
  description: string
  status: string
  accrual_method: string
  accrual_rate: string
  priority: string
  applicable_branch_id: string
  applicable_department_id: string
  applicable_position_id: string
  applicable_grade_id: string
  applicable_employment_type: string
  applicable_confirmation_status: string
  max_consecutive_days: string
  min_service_months: string
  allow_during_probation: string
  allow_negative_balance: string
  weekly_off_treatment: string
  holiday_treatment: string
  allow_half_day: string
  allow_short_leave: string
  minimum_short_leave_minutes: string
  maximum_short_leave_minutes: string
  minimum_notice_days: string
  maximum_backdate_days: string
  cancellation_requires_approval: string
  cancellation_cutoff_days: string
  maximum_accumulation_days: string
  attendance_balance_deduction_enabled: string
  absent_day_deduction_days: string
  unpaid_leave_day_deduction_days: string
  half_day_deduction_days: string
  leave_types: LeavePolicyTypeAssignment[]
}

export type LeavePolicyOption = {
  value: string
  label: string
}

export const LEAVE_POLICY_EMPLOYMENT_TYPE_OPTIONS: LeavePolicyOption[] = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
  { value: "consultant", label: "Consultant" },
  { value: "temporary", label: "Temporary" },
]

export const LEAVE_POLICY_CONFIRMATION_OPTIONS: LeavePolicyOption[] = [
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PROBATION", label: "Probation" },
  { value: "CONFIRMATION_DUE", label: "Confirmation due" },
  { value: "PROBATION_EXTENDED", label: "Probation extended" },
  { value: "NOT_CONFIRMED", label: "Not confirmed" },
  { value: "NOT_APPLICABLE", label: "Not applicable" },
]

export const LEAVE_POLICY_DAY_TREATMENT_OPTIONS: LeavePolicyOption[] = [
  { value: "EMPLOYEE_SCHEDULE", label: "Follow schedule" },
  { value: "EXCLUDE", label: "Exclude" },
  { value: "INCLUDE", label: "Include" },
]

type PolicyRecord = Record<string, unknown>

function asRecord(value: unknown): PolicyRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as PolicyRecord)
    : null
}

function readText(row: PolicyRecord, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim() && value.trim() !== "-") {
      return value.trim()
    }
  }
  return fallback
}

function readNumeric(row: PolicyRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
    if (typeof value === "string" && value.trim() && value.trim() !== "-") {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return null
}

function readBool(row: PolicyRecord, keys: string[], fallback: boolean): boolean {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "boolean") {
      return value
    }
    if (typeof value === "number") {
      if (value === 1) return true
      if (value === 0) return false
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (["true", "1", "yes", "y"].includes(normalized)) return true
      if (["false", "0", "no", "n"].includes(normalized)) return false
    }
  }
  return fallback
}

function readNumberString(row: PolicyRecord, keys: string[], fallback: string): string {
  const value = readNumeric(row, keys)
  return value !== null ? String(value) : fallback
}

function readRelatedId(row: PolicyRecord, idKeys: string[], nestedKeys: string[]): string {
  const direct = readNumeric(row, idKeys)
  if (direct !== null && direct > 0) {
    return String(direct)
  }
  for (const key of nestedKeys) {
    const nested = asRecord(row[key])
    if (!nested) continue
    const nestedId = readNumeric(nested, ["id"])
    if (nestedId !== null && nestedId > 0) {
      return String(nestedId)
    }
  }
  return ""
}

function flag(value: boolean): "true" | "false" {
  return value ? "true" : "false"
}

function normalizeAccrualMethod(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if (normalized === "yearly" || normalized === "annual" || normalized === "annually") return "yearly"
  if (normalized === "monthly") return "monthly"
  if (normalized === "daily") return "daily"
  if (normalized === "manual") return "manual"
  return value.trim() || "yearly"
}

function normalizeEmploymentType(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_")
}

function normalizeConfirmationStatus(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_")
}

function normalizeDayTreatment(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_")
  if (normalized === "FOLLOW_SCHEDULE" || normalized === "SCHEDULE") return "EMPLOYEE_SCHEDULE"
  return normalized
}

function optionLabel(options: LeavePolicyOption[], value: string, fallback: string): string {
  if (!value) return fallback
  return options.find((option) => option.value === value)?.label ?? fallback
}

export function emptyLeavePolicyTypeAssignment(): LeavePolicyTypeAssignment {
  return {
    leave_type_id: "",
    leave_type_name: "",
    annual_quota_days: "0",
    max_per_request_days: "0",
    requires_approval: "true",
    encashment_enabled: "false",
    maximum_encashment_days: "0",
    encashment_rate_divisor: "",
    minimum_balance_after_encashment: "0",
    encashment_requires_approval: "true",
    maximum_accumulation_days: "0",
    accrual_method: "",
    carry_forward_enabled: "",
    carry_forward_max_days: "",
    carry_forward_expiry_mode: "none",
    carry_forward_expiry_months: "",
    carry_forward_expiry_date: "",
    carry_forward_auto_expire: "true",
    carry_forward_consume_first: "true",
  }
}

function positiveDayString(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0"
  if (typeof value === "string" && (value.trim() === "" || value.trim() === "-")) return "0"
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return "0"
  return String(parsed)
}

export type LeaveTypePolicyDefaults = {
  maxDaysPerYear?: string | number | null
  maxCarryForwardDays?: string | number | null
  carryForwardAllowed?: boolean
  name?: string
}

export function assignmentDefaultsFromLeaveType(
  leaveTypeId: string,
  defaults?: LeaveTypePolicyDefaults,
): LeavePolicyTypeAssignment {
  const yearly = positiveDayString(defaults?.maxDaysPerYear)
  const carry = defaults?.carryForwardAllowed ? positiveDayString(defaults.maxCarryForwardDays) : "0"
  return {
    ...emptyLeavePolicyTypeAssignment(),
    leave_type_id: leaveTypeId,
    leave_type_name: defaults?.name ?? "",
    annual_quota_days: yearly,
    max_per_request_days: yearly,
    maximum_accumulation_days: carry,
  }
}

export function emptyLeavePolicyForm(): LeavePolicyFormValue {
  return {
    name: "",
    description: "",
    status: "active",
    accrual_method: "yearly",
    accrual_rate: "0",
    priority: "0",
    applicable_branch_id: "",
    applicable_department_id: "",
    applicable_position_id: "",
    applicable_grade_id: "",
    applicable_employment_type: "",
    applicable_confirmation_status: "",
    max_consecutive_days: "1",
    min_service_months: "0",
    allow_during_probation: "true",
    allow_negative_balance: "false",
    weekly_off_treatment: "EMPLOYEE_SCHEDULE",
    holiday_treatment: "EXCLUDE",
    allow_half_day: "false",
    allow_short_leave: "false",
    minimum_short_leave_minutes: "30",
    maximum_short_leave_minutes: "240",
    minimum_notice_days: "0",
    maximum_backdate_days: "0",
    cancellation_requires_approval: "false",
    cancellation_cutoff_days: "0",
    maximum_accumulation_days: "0",
    attendance_balance_deduction_enabled: "false",
    absent_day_deduction_days: "1",
    unpaid_leave_day_deduction_days: "1",
    half_day_deduction_days: "0.5",
    leave_types: [emptyLeavePolicyTypeAssignment()],
  }
}

function collectLeaveTypeEntries(row: PolicyRecord): unknown[] {
  const candidates = [
    row.leave_types,
    row.leaveTypes,
    row.policy_leave_types,
    row.policyLeaveTypes,
    row.leave_type_assignments,
    row.leaveTypeAssignments,
    row.types,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate
    }
  }
  return []
}

function mapLeaveTypeAssignment(entry: unknown): LeavePolicyTypeAssignment {
  if (typeof entry === "number" && Number.isFinite(entry) && entry > 0) {
    return { ...emptyLeavePolicyTypeAssignment(), leave_type_id: String(entry) }
  }
  if (typeof entry === "string" && entry.trim() && Number.isFinite(Number(entry))) {
    return { ...emptyLeavePolicyTypeAssignment(), leave_type_id: String(Number(entry)) }
  }

  const record = asRecord(entry) ?? {}
  const nestedType =
    asRecord(record.leave_type) ??
    asRecord(record.leaveType) ??
    asRecord(record.type) ??
    asRecord(record.leave_type_details)

  const typeId =
    readNumeric(record, ["leave_type_id", "leaveTypeId", "type_id", "typeId"]) ??
    (nestedType ? readNumeric(nestedType, ["id", "leave_type_id", "leaveTypeId"]) : null)

  const typeName =
    readText(nestedType ?? {}, ["name", "title", "code", "display_name"]) ||
    readText(record, ["leave_type_name", "leaveTypeName", "type_name"])

  return {
    ...emptyLeavePolicyTypeAssignment(),
    leave_type_id: typeId !== null && typeId > 0 ? String(typeId) : "",
    leave_type_name: typeName,
    annual_quota_days: readNumberString(record, ["annual_quota_days", "annualQuotaDays", "quota_days"], "0"),
    max_per_request_days: readNumberString(
      record,
      ["max_per_request_days", "maxPerRequestDays", "maximum_per_request_days"],
      "0",
    ),
    requires_approval: flag(readBool(record, ["requires_approval", "requiresApproval"], true)),
    encashment_enabled: flag(readBool(record, ["encashment_enabled", "encashmentEnabled"], false)),
    maximum_encashment_days: readNumberString(
      record,
      ["maximum_encashment_days", "maximumEncashmentDays", "max_encashment_days"],
      "0",
    ),
    encashment_rate_divisor: readNumberString(record, ["encashment_rate_divisor", "encashmentRateDivisor"], ""),
    minimum_balance_after_encashment: readNumberString(
      record,
      ["minimum_balance_after_encashment", "minimumBalanceAfterEncashment"],
      "0",
    ),
    encashment_requires_approval: flag(
      readBool(record, ["encashment_requires_approval", "encashmentRequiresApproval"], true),
    ),
    maximum_accumulation_days: readNumberString(
      record,
      ["maximum_accumulation_days", "maximumAccumulationDays"],
      "0",
    ),
    ...readCarryForwardFields(record),
  }
}

function readCarryForwardFields(record: PolicyRecord) {
  const text = (key: string) => {
    const value = record[key]
    return value === null || value === undefined ? "" : String(value)
  }
  const enabled = record.carry_forward_enabled
  const months = text("carry_forward_expiry_months")
  const date = text("carry_forward_expiry_date")
  const maxDays = text("carry_forward_max_days")
  return {
    accrual_method: text("accrual_method"),
    carry_forward_enabled: enabled === true ? "true" : enabled === false ? "false" : "",
    carry_forward_max_days: maxDays === "" ? "" : String(Number(maxDays)),
    carry_forward_expiry_mode: date ? "date" : months ? "months" : "none",
    carry_forward_expiry_months: months,
    carry_forward_expiry_date: date,
    carry_forward_auto_expire: record.carry_forward_auto_expire === false ? "false" : "true",
    carry_forward_consume_first: record.carry_forward_consume_first === false ? "false" : "true",
  }
}

/** API payload for the per-type accrual and carry-forward overrides. */
export function leavePolicyTypeCarryForwardPayload(row: LeavePolicyTypeAssignment) {
  const inherit = row.carry_forward_enabled === ""
  return {
    accrual_method: row.accrual_method || null,
    carry_forward_enabled: inherit ? null : row.carry_forward_enabled === "true",
    carry_forward_max_days:
      inherit || row.carry_forward_max_days.trim() === "" ? null : Number(row.carry_forward_max_days),
    carry_forward_expiry_months:
      !inherit && row.carry_forward_expiry_mode === "months" && row.carry_forward_expiry_months
        ? Number(row.carry_forward_expiry_months)
        : null,
    carry_forward_expiry_date:
      !inherit && row.carry_forward_expiry_mode === "date" && row.carry_forward_expiry_date
        ? row.carry_forward_expiry_date
        : null,
    carry_forward_auto_expire: row.carry_forward_auto_expire !== "false",
    carry_forward_consume_first: row.carry_forward_consume_first !== "false",
  }
}

export function leavePolicyRecordToForm(row: PolicyRecord | null | undefined): LeavePolicyFormValue {
  const empty = emptyLeavePolicyForm()
  if (!row) return empty

  const assignments = collectLeaveTypeEntries(row)
    .map(mapLeaveTypeAssignment)
    .filter((assignment) => assignment.leave_type_id || assignment.leave_type_name)

  const status = readText(row, ["status"]).toLowerCase() === "inactive" ? "inactive" : "active"
  const accrualMethod = normalizeAccrualMethod(readText(row, ["accrual_method", "accrualMethod"], empty.accrual_method))
  const employmentType = normalizeEmploymentType(
    readText(row, ["applicable_employment_type", "applicableEmploymentType"], ""),
  )
  const confirmationStatus = normalizeConfirmationStatus(
    readText(row, ["applicable_confirmation_status", "applicableConfirmationStatus"], ""),
  )

  return {
    ...empty,
    name: readText(row, ["name", "title"]),
    description: readText(row, ["description", "notes"]),
    status,
    accrual_method: accrualMethod || empty.accrual_method,
    accrual_rate: readNumberString(row, ["accrual_rate", "accrualRate"], empty.accrual_rate),
    priority: readNumberString(row, ["priority"], empty.priority),
    applicable_branch_id: readRelatedId(
      row,
      ["applicable_branch_id", "applicableBranchId"],
      ["applicable_branch", "applicableBranch", "branch"],
    ),
    applicable_department_id: readRelatedId(
      row,
      ["applicable_department_id", "applicableDepartmentId"],
      ["applicable_department", "applicableDepartment", "department"],
    ),
    applicable_position_id: readRelatedId(
      row,
      ["applicable_position_id", "applicablePositionId"],
      ["applicable_position", "applicablePosition", "position"],
    ),
    applicable_grade_id: readRelatedId(
      row,
      ["applicable_grade_id", "applicableGradeId"],
      ["applicable_grade", "applicableGrade", "grade"],
    ),
    applicable_employment_type: employmentType,
    applicable_confirmation_status: confirmationStatus,
    max_consecutive_days: readNumberString(
      row,
      ["max_consecutive_days", "maxConsecutiveDays"],
      empty.max_consecutive_days,
    ),
    min_service_months: readNumberString(
      row,
      ["min_service_months", "minServiceMonths"],
      empty.min_service_months,
    ),
    allow_during_probation: flag(
      readBool(row, ["allow_during_probation", "allowDuringProbation"], true),
    ),
    allow_negative_balance: flag(
      readBool(row, ["allow_negative_balance", "allowNegativeBalance"], false),
    ),
    weekly_off_treatment:
      normalizeDayTreatment(readText(row, ["weekly_off_treatment", "weeklyOffTreatment"])) ||
      empty.weekly_off_treatment,
    holiday_treatment:
      normalizeDayTreatment(readText(row, ["holiday_treatment", "holidayTreatment"])) ||
      empty.holiday_treatment,
    allow_half_day: flag(readBool(row, ["allow_half_day", "allowHalfDay"], false)),
    allow_short_leave: flag(readBool(row, ["allow_short_leave", "allowShortLeave"], false)),
    minimum_short_leave_minutes: readNumberString(
      row,
      ["minimum_short_leave_minutes", "minimumShortLeaveMinutes"],
      empty.minimum_short_leave_minutes,
    ),
    maximum_short_leave_minutes: readNumberString(
      row,
      ["maximum_short_leave_minutes", "maximumShortLeaveMinutes"],
      empty.maximum_short_leave_minutes,
    ),
    minimum_notice_days: readNumberString(
      row,
      ["minimum_notice_days", "minimumNoticeDays"],
      empty.minimum_notice_days,
    ),
    maximum_backdate_days: readNumberString(
      row,
      ["maximum_backdate_days", "maximumBackdateDays"],
      empty.maximum_backdate_days,
    ),
    cancellation_requires_approval: flag(
      readBool(row, ["cancellation_requires_approval", "cancellationRequiresApproval"], false),
    ),
    cancellation_cutoff_days: readNumberString(
      row,
      ["cancellation_cutoff_days", "cancellationCutoffDays"],
      empty.cancellation_cutoff_days,
    ),
    maximum_accumulation_days: readNumberString(
      row,
      ["maximum_accumulation_days", "maximumAccumulationDays"],
      empty.maximum_accumulation_days,
    ),
    attendance_balance_deduction_enabled: flag(
      readBool(row, ["attendance_balance_deduction_enabled", "attendanceBalanceDeductionEnabled"], false),
    ),
    absent_day_deduction_days: readNumberString(
      row,
      ["absent_day_deduction_days", "absentDayDeductionDays"],
      empty.absent_day_deduction_days,
    ),
    unpaid_leave_day_deduction_days: readNumberString(
      row,
      ["unpaid_leave_day_deduction_days", "unpaidLeaveDayDeductionDays"],
      empty.unpaid_leave_day_deduction_days,
    ),
    half_day_deduction_days: readNumberString(
      row,
      ["half_day_deduction_days", "halfDayDeductionDays"],
      empty.half_day_deduction_days,
    ),
    leave_types: assignments.length ? assignments : [emptyLeavePolicyTypeAssignment()],
  }
}

export function hasPolicyCoverageLimits(value: LeavePolicyFormValue): boolean {
  return Boolean(
    value.applicable_branch_id ||
      value.applicable_department_id ||
      value.applicable_position_id ||
      value.applicable_grade_id ||
      value.applicable_employment_type ||
      value.applicable_confirmation_status,
  )
}

export function hasPolicyAdvancedRules(value: LeavePolicyFormValue): boolean {
  return (
    value.min_service_months !== "0" ||
    value.minimum_notice_days !== "0" ||
    value.maximum_backdate_days !== "0" ||
    value.allow_negative_balance === "true" ||
    value.cancellation_requires_approval === "true" ||
    value.cancellation_cutoff_days !== "0" ||
    value.maximum_accumulation_days !== "0" ||
    value.priority !== "0" ||
    value.attendance_balance_deduction_enabled === "true"
  )
}

export function attachedLeavePolicyTypes(value: LeavePolicyFormValue): LeavePolicyTypeAssignment[] {
  return value.leave_types.filter((row) => row.leave_type_id || row.leave_type_name)
}

export function leavePolicyTypeLabel(
  assignment: LeavePolicyTypeAssignment,
  options: LeavePolicyOption[],
): string {
  return (
    options.find((option) => option.value === assignment.leave_type_id)?.label ||
    assignment.leave_type_name ||
    (assignment.leave_type_id ? `Leave type ${assignment.leave_type_id}` : "Leave type")
  )
}

export function leavePolicyCoverageParts(
  value: LeavePolicyFormValue,
  lookups: {
    branches: LeavePolicyOption[]
    departments: LeavePolicyOption[]
    positions: LeavePolicyOption[]
    grades: LeavePolicyOption[]
  },
): string[] {
  return [
    optionLabel(lookups.branches, value.applicable_branch_id, ""),
    optionLabel(lookups.departments, value.applicable_department_id, ""),
    optionLabel(lookups.positions, value.applicable_position_id, ""),
    optionLabel(lookups.grades, value.applicable_grade_id, ""),
    optionLabel(LEAVE_POLICY_EMPLOYMENT_TYPE_OPTIONS, value.applicable_employment_type, ""),
    optionLabel(LEAVE_POLICY_CONFIRMATION_OPTIONS, value.applicable_confirmation_status, ""),
  ].filter(Boolean)
}

export function leavePolicyAccrualLabel(method: string): string {
  if (method === "yearly") return "Yearly"
  if (method === "monthly") return "Monthly"
  if (method === "daily") return "Daily pro-rata"
  if (method === "manual") return "Manual"
  return method || "Yearly"
}

export function leavePolicyTreatmentLabel(value: string): string {
  return optionLabel(LEAVE_POLICY_DAY_TREATMENT_OPTIONS, value, value || "—")
}

export function leavePolicyYesNo(value: string): string {
  return value === "true" ? "Yes" : "No"
}

export function formatPolicyDays(value: string, suffix = "days"): string {
  if (!value.trim()) return "—"
  return `${value} ${suffix}`
}
