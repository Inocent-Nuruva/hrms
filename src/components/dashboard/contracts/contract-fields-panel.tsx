"use client"

import * as React from "react"

import { CONTRACT_FIELD_LABELS, type ContractField } from "@/lib/contracts-api"
import { cn } from "@/lib/utils"

const GROUPS: Array<{ title: string; keys: string[] }> = [
  {
    title: "Employer",
    keys: ["company_legal_name", "company_address", "company_registration_number", "company_tin", "signatory_name", "signatory_title"],
  },
  {
    title: "Employee",
    keys: [
      "employee_name",
      "employee_number",
      "employee_dob",
      "employee_age",
      "employee_sex",
      "employee_id_number",
      "employee_address",
      "employee_phone",
      "employee_email",
    ],
  },
  {
    title: "Job and place of work",
    keys: ["job_title", "department", "reporting_manager", "job_description", "place_of_recruitment", "work_location"],
  },
  {
    title: "Terms",
    keys: [
      "contract_type",
      "start_date",
      "end_date",
      "probation_months",
      "hours_of_work",
      "salary",
      "currency",
      "pay_frequency",
      "remuneration_method",
      "benefits",
      "annual_leave_days",
      "notice_period",
      "governing_law",
      "reference_no",
      "issue_date",
    ],
  },
]

const LONG = new Set(["company_address", "employee_address", "job_description", "benefits", "notice_period"])

/**
 * Every field the contract can print. Automatic values come from HR records;
 * typing a value overrides it for this contract only. Fields used by the
 * clauses but still empty are highlighted.
 */
export function ContractFieldsPanel({
  fields,
  overrides,
  onChange,
}: {
  fields: ContractField[]
  /** Edited values keyed by field ("" = use the automatic value). */
  overrides: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const [showAll, setShowAll] = React.useState(false)
  const byKey = new Map(fields.map((field) => [field.key, field]))
  const valueOf = (field: ContractField) => overrides[field.key] ?? field.override ?? ""
  const missing = fields.filter((field) => field.used && !valueOf(field).trim() && !field.automatic.trim())

  return (
    <section className="grid gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Contract fields</h3>
          <p className="text-xs text-muted-foreground">
            Grey text is filled in automatically from HR records. Type to use a different value on this contract only;
            clear the box to go back to the automatic value.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
          Show fields not used in the clauses
        </label>
      </div>
      {missing.length ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {missing.length} field{missing.length === 1 ? " is" : "s are"} used in the clauses but empty:{" "}
          {missing.map((field) => CONTRACT_FIELD_LABELS[field.key] ?? field.key).join(", ")}.
        </p>
      ) : null}
      {GROUPS.map((group) => {
        const rows = group.keys
          .map((key) => byKey.get(key))
          .filter((field): field is ContractField => Boolean(field) && !field?.hidden && (showAll || Boolean(field?.used)))
        if (!rows.length) return null
        return (
          <fieldset key={group.title} className="grid gap-2">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.title}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map((field) => {
                const value = valueOf(field)
                const empty = field.used && !value.trim() && !field.automatic.trim()
                const common = {
                  id: `contract-field-${field.key}`,
                  value,
                  placeholder: field.automatic || "Not available — type a value",
                  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(field.key, event.target.value),
                  className: cn(
                    "w-full rounded-md border px-2.5 text-sm placeholder:text-slate-400",
                    empty ? "border-amber-400 bg-amber-50/40" : "border-border",
                  ),
                }
                return (
                  <label key={field.key} htmlFor={common.id} className={cn("grid gap-1 text-sm", LONG.has(field.key) && "sm:col-span-2")}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-700">{CONTRACT_FIELD_LABELS[field.key] ?? field.key}</span>
                      {value.trim() ? <span className="text-[11px] font-medium text-sky-700">Edited for this contract</span> : null}
                    </span>
                    {LONG.has(field.key) ? (
                      <textarea {...common} className={cn(common.className, "min-h-14 py-1.5")} />
                    ) : (
                      <input {...common} className={cn(common.className, "h-9")} />
                    )}
                  </label>
                )
              })}
            </div>
          </fieldset>
        )
      })}
    </section>
  )
}
