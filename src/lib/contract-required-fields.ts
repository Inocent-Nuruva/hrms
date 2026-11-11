/**
 * Which wizard step owns each contract field, and which fields a contract
 * needs. Kept separate from the UI so the onboarding "required fields"
 * summary can reuse the contract group.
 */
import { CONTRACT_FIELD_LABELS, type ContractField } from "@/lib/contracts-api"

export type ContractStepId = "employee" | "job" | "pay" | "clauses" | "review"

export const CONTRACT_STEPS: Array<{ id: ContractStepId; title: string }> = [
  { id: "employee", title: "Employee & type" },
  { id: "job", title: "Job & place" },
  { id: "pay", title: "Pay & benefits" },
  { id: "clauses", title: "Clauses" },
  { id: "review", title: "Review & send" },
]

/** Fields HR fixes in the employee or company records, not in the contract. */
export const RECORD_FIELDS = new Set([
  "employee_name",
  "employee_number",
  "employee_dob",
  "employee_age",
  "employee_sex",
  "employee_id_number",
  "employee_address",
  "employee_phone",
  "employee_email",
  "company_legal_name",
  "company_address",
  "company_registration_number",
  "company_tin",
])

const STEP_OF: Record<string, ContractStepId> = {
  contract_type: "employee",
  start_date: "employee",
  end_date: "employee",
  employment_basis: "employee",
  job_title: "job",
  department: "job",
  grade: "job",
  reporting_manager: "job",
  work_location: "job",
  place_of_recruitment: "job",
  job_description: "job",
  salary: "pay",
  currency: "pay",
  pay_frequency: "pay",
  remuneration_method: "pay",
  benefits: "pay",
  hours_of_work: "pay",
  probation_months: "pay",
  annual_leave_days: "pay",
  notice_period: "pay",
  governing_law: "pay",
  signatory_name: "review",
  signatory_title: "review",
}

/** Step a field is completed in; record fields count against the employee step. */
export function stepOfField(key: string): ContractStepId {
  return STEP_OF[key] ?? (RECORD_FIELDS.has(key) ? "employee" : "review")
}

export function fieldLabel(key: string) {
  return CONTRACT_FIELD_LABELS[key] ?? key.replace(/_/g, " ")
}

export type MissingItem = { key: string; label: string; step: ContractStepId; inRecords: boolean }

/**
 * A field is missing when the clauses use it and it has no value.
 * (The server repeats this check on Send and returns `missing_fields`.)
 */
export function missingContractFields(fields: ContractField[]): MissingItem[] {
  return fields
    .filter((field) => field.used && !field.value.trim() && !(field.hidden && field.has_value))
    .map((field) => ({
      key: field.key,
      label: field.hidden ? `${fieldLabel(field.key)} (needs a user with payroll access)` : fieldLabel(field.key),
      step: stepOfField(field.key),
      inRecords: RECORD_FIELDS.has(field.key),
    }))
}
