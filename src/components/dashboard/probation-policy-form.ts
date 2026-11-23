import type { AdminRecord } from "@/lib/admin-api"

export const policyTargets = [
  ["branch_id", "Branch"], ["department_id", "Department"],
  ["position_id", "Position"], ["grade_id", "Grade"],
] as const

export const policyNumbers = [
  ["priority", "Priority", undefined], ["maximum_extensions", "Maximum extensions", 0],
  ["default_extension_days", "Default extension days", 1], ["maximum_extension_days", "Maximum extension days", 1],
] as const

export const policyFlags = [
  ["is_default", "Default policy", false], ["self_assessment_required", "Self-assessment required", false],
  ["objectives_required", "Objectives required", true], ["manager_review_required", "Manager review required", true],
  ["hr_approval_required", "HR approval required", true], ["confirmation_letter_required", "Confirmation letter required", true],
] as const

function value(row: AdminRecord, key: string) {
  return row[key] ?? row[key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())]
}

export function policyFormValues(row: AdminRecord): Record<string, string> {
  const form: Record<string, string> = {}
  for (const [key] of [...policyTargets, ...policyNumbers, ...policyFlags]) {
    const stored = value(row, key)
    if (stored !== undefined && stored !== null) form[key] = String(stored)
  }
  form.effective_to = String(value(row, "effective_to") ?? "").slice(0, 10)
  return form
}

export function policyRulePayload(form: Record<string, string>) {
  const rules: AdminRecord = {}
  for (const [key] of policyTargets) {
    const id = form[key] ? Number(form[key]) : null
    if (id !== null && (!Number.isSafeInteger(id) || id < 1)) throw new Error("Select a valid policy target.")
    rules[key] = id
  }
  for (const [key, label, minimum] of policyNumbers) {
    if (!form[key]?.trim()) continue
    const number = Number(form[key])
    if (!Number.isSafeInteger(number) || (minimum !== undefined && number < minimum)) throw new Error(`Enter a valid value for ${label}.`)
    rules[key] = number
  }
  for (const [key, , fallback] of policyFlags) rules[key] = (form[key] ?? String(fallback)) === "true"
  if (form.effective_to && form.effective_to < form.effective_from) throw new Error("Effective to must be on or after Effective from.")
  if (form.default_extension_days && form.maximum_extension_days && Number(form.default_extension_days) > Number(form.maximum_extension_days)) throw new Error("Default extension days exceed the maximum.")
  rules.effective_to = form.effective_to || null
  return rules
}
