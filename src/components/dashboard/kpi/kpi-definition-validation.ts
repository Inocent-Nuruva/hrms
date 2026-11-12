import type { KpiDefinitionForm } from "@/lib/kpi-api"

export type KpiDefinitionStep = "basic" | "measurement" | "planning"

/** Client feedback mirrors the existing backend rules; the API remains authoritative. */
export function validateKpiDefinitionStep(form: KpiDefinitionForm, step: KpiDefinitionStep): string | null {
  if (step === "basic") {
    if (!form.name.trim()) return "Enter a KPI name."
    if (form.name.trim().length > 160) return "KPI name must be 160 characters or fewer."
    if (!/^[A-Z][A-Z0-9_-]{1,79}$/.test(form.code.trim().toUpperCase())) return "Use 2–80 letters, numbers, underscores or hyphens for the KPI code; start with a letter."
    if (!form.category.trim()) return "Enter a KPI category."
    if (form.category.trim().length > 100) return "KPI category must be 100 characters or fewer."
  }
  if (step === "measurement") {
    const nonNumeric = ["binary", "milestone", "qualitative"].includes(form.measurementType)
    if (nonNumeric && form.direction !== "not_applicable") return "Binary, milestone and qualitative KPIs do not use a numeric performance direction."
    if (!nonNumeric && form.direction === "not_applicable") return "Choose a performance direction for numeric KPIs."
    if (form.measurementType === "percentage" && form.measurementUnit && form.measurementUnit !== "%") return "Percentage KPIs use % as the unit."
    if (form.measurementType === "currency" && !/^[A-Z]{3}$/.test(form.measurementUnit ?? "")) return "Enter a three-letter ISO currency code, such as TZS."
    if (form.measurementType === "duration" && !["seconds", "minutes", "hours", "days"].includes(form.measurementUnit ?? "")) return "Choose seconds, minutes, hours or days for a duration KPI."
    if (form.measurementType === "binary" && form.measurementUnit) return "Binary KPIs do not have a measurement unit."
  }
  if (step === "planning" && !["monthly", "quarterly", "semiannual", "annual"].includes(form.frequency)) return "Choose a reporting frequency."
  return null
}

export function validateKpiDefinition(form: KpiDefinitionForm): string | null {
  return validateKpiDefinitionStep(form, "basic") ?? validateKpiDefinitionStep(form, "measurement") ?? validateKpiDefinitionStep(form, "planning")
}
