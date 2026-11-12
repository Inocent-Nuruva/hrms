import type { ContractSection, ContractType } from "@/lib/contracts-api";

import type { ContractDetail } from "@/lib/contracts-api";

/** Exact DTO mappings for values read by the legacy renderer. */
export const LEGACY_FIELDS: Record<string, string> = {
  contract_type: "contract_type",
  start_date: "start_date",
  end_date: "end_date",
  place_of_recruitment: "place_of_recruitment",
  job_description: "job_description",
  job_title: "job_title",
  work_location: "work_location",
  hours_of_work: "hours_of_work",
  probation_months: "probation_months",
  salary: "salary_amount",
  currency: "salary_currency",
  pay_frequency: "pay_frequency",
  remuneration_method: "remuneration_method",
  benefits: "benefits",
  employee_address: "permanent_address",
  task_description: "task_description",
  title: "title",
};

/** Partial legacy patches preserve unedited fields and override precedence. */
export function serializeLegacyChanges(
  state: {
    legacyValues: Record<string, string>;
    overrides: Record<string, string>;
    revisions: Record<string, number>;
    sections: ContractSection[];
    signatoryId: number | null;
  },
  contract: ContractDetail,
) {
  const body: Record<string, unknown> = {};
  const overrides: Record<string, string> = {};
  const included: string[] = [];
  for (const revision of Object.keys(state.revisions)) {
    if (revision === "sections") {
      body.sections = state.sections;
      included.push(revision);
      continue;
    }
    if (revision === "signatory") {
      body.assigned_signatory_id = state.signatoryId;
      included.push(revision);
      continue;
    }
    if (revision.startsWith("override:")) {
      const key = revision.slice(9);
      overrides[key] = state.overrides[key] ?? "";
      included.push(revision);
      continue;
    }
    if (!revision.startsWith("legacy:")) continue;
    const key = revision.slice(7);
    const value = state.legacyValues[key] ?? "";
    if (key === "salary" && contract.salaryHidden) continue;
    if (state.overrides[key]) overrides[key] = value;
    else if (LEGACY_FIELDS[key]) {
      const dto = LEGACY_FIELDS[key];
      body[dto] =
        key === "probation_months"
          ? value === ""
            ? null
            : Number(value)
          : key === "end_date" ||
              key === "salary" ||
              key === "currency" ||
              key === "pay_frequency"
            ? value || null
            : value;
    } else overrides[key] = value;
    included.push(revision);
  }
  let issue: string | null = null;
  const probation = state.legacyValues.probation_months;
  if (
    state.revisions["legacy:probation_months"] !== undefined &&
    probation &&
    (!/^\d+$/.test(probation) || Number(probation) > 24)
  )
    issue = "probation_range";
  const salary = state.legacyValues.salary;
  if (
    !contract.salaryHidden &&
    state.revisions["legacy:salary"] !== undefined &&
    salary &&
    !/^\d{1,12}(\.\d{1,2})?$/.test(salary)
  )
    issue = "salary_format";
  const currency = state.legacyValues.currency;
  if (
    state.revisions["legacy:currency"] !== undefined &&
    currency &&
    !/^[A-Z]{3}$/.test(currency)
  )
    issue = "currency_format";
  if (
    state.legacyValues.contract_type === "FIXED_TERM" &&
    !state.legacyValues.end_date
  )
    issue = "end_date_required";
  if (
    state.legacyValues.end_date &&
    state.legacyValues.start_date &&
    state.legacyValues.end_date < state.legacyValues.start_date
  )
    issue = "end_before_start";
  if (Object.keys(overrides).length) body.field_overrides = overrides;
  return { body: issue ? {} : body, included: issue ? [] : included, issue };
}

export type ContractWorkspaceModel = {
  mode: "live" | "legacy";
  contractType: ContractType;
  startDate: string;
  endDate: string;
  title: string;
  fields: Record<string, string>;
  refs: Record<string, number | null>;
  overrides: Record<string, string>;
  savedOverrides: Record<string, string>;
  reasons: Record<string, string>;
  savedReasons: Record<string, string>;
  partTime: boolean;
  assignedSignatoryId: number | null;
  sections: ContractSection[];
  salaryHidden: boolean;
};

const referenceTokens: Record<string, string> = {
  department_id: "department",
  position_id: "job_title",
  grade_id: "grade",
  branch_id: "work_location",
  reports_to_id: "reporting_manager",
};

/** Excludes incomplete overrides rather than sending them without a reason. */
export function serializeContractWorkspace(
  model: ContractWorkspaceModel,
  updatedAt: string,
): { payload: Record<string, unknown>; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const fieldOverrides: Record<string, string> = {};
  const reasons: Record<string, string> = {};
  for (const key of new Set([
    ...Object.keys(model.savedOverrides),
    ...Object.keys(model.overrides),
  ])) {
    const next = model.overrides[key] ?? "";
    if (
      model.mode === "live" &&
      next.trim() &&
      (model.reasons[key] ?? "").trim().length < 3
    ) {
      errors[key] = "reason_required";
      continue;
    }
    fieldOverrides[key] = next;
    if (next.trim() && model.reasons[key]?.trim())
      reasons[key] = model.reasons[key].trim();
  }
  const refs: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(
    model.mode === "live" ? model.refs : {},
  )) {
    const token = referenceTokens[key];
    if (value !== null && (model.reasons[token] ?? "").trim().length < 3) {
      errors[token] = "reason_required";
      continue;
    }
    refs[key] = value;
    if (value !== null) reasons[token] = model.reasons[token].trim();
  }
  const common: Record<string, unknown> = {
    expected_updated_at: updatedAt,
    contract_type: model.contractType,
    start_date: model.startDate,
    end_date:
      model.mode === "live" && model.contractType === "UNSPECIFIED"
        ? null
        : model.endDate || null,
    title: model.title,
    place_of_recruitment: model.fields.place_of_recruitment ?? "",
    job_description: model.fields.job_description ?? "",
    ...(model.contractType === "SPECIFIC_TASK" ||
    "task_description" in model.fields
      ? { task_description: model.fields.task_description ?? "" }
      : {}),
    benefits: model.fields.benefits ?? "",
    sections: model.sections,
    field_overrides: fieldOverrides,
    override_reasons: reasons,
    ...(model.assignedSignatoryId
      ? { assigned_signatory_id: model.assignedSignatoryId }
      : {}),
  };
  if (model.mode === "live")
    return { payload: { ...common, refs, part_time: model.partTime }, errors };
  return {
    payload: {
      ...common,
      job_title: model.fields.job_title ?? "",
      work_location: model.fields.work_location ?? "",
      hours_of_work: model.fields.hours_of_work ?? "",
      probation_months: model.fields.probation_months
        ? Number(model.fields.probation_months)
        : null,
      ...(!model.salaryHidden
        ? { salary_amount: model.fields.salary || null }
        : {}),
      salary_currency: model.fields.currency || null,
      pay_frequency: model.fields.pay_frequency || null,
      remuneration_method: model.fields.remuneration_method ?? "",
    },
    errors,
  };
}
