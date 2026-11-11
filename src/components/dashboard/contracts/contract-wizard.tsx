"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Check, ExternalLink, Loader2, RefreshCw, Search, Send } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { FluentSelect } from "@/components/ui/fluent-select"
import { toast } from "@/components/ui/fluent-toast-store"
import {
  getEmployeeById,
  listBranches,
  listDepartments,
  listEmployeeGrades,
  listEmployees,
  listPositions,
  readStatusFieldErrors,
  type AdminRecord,
} from "@/lib/admin-api"
import {
  CONTRACT_STEPS,
  RECORD_FIELDS,
  fieldLabel,
  missingContractFields,
  stepOfField,
  type ContractStepId,
} from "@/lib/contract-required-fields"
import {
  base64ToBlob,
  CONTRACT_REF_KEYS,
  CONTRACT_REF_TOKEN,
  createContractDraft,
  errorMessage,
  getContract,
  getContractFields,
  listContracts,
  listContractTemplates,
  listSignatories,
  previewContractDraft,
  sendContract,
  updateContractDraft,
  type ContractDetail,
  type ContractField,
  type ContractRefKey,
  type ContractRow,
  type ContractSection,
  type ContractType,
  type Signatory,
} from "@/lib/contracts-api"
import { cn } from "@/lib/utils"

import { useContractDialogs } from "./contract-dialogs"
import { ClausesEditor } from "./contract-settings"
import { CONTRACT_TYPE_LABELS, ContractStatusBadge, formatDate } from "./contract-ui"

const input = "h-9 w-full rounded-md border border-border px-2.5 text-sm"
const btn = "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
const AUTOSAVE_MS = 2000
const PREVIEW_MS = 1000

function addMonths(date: string, months: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCMonth(value.getUTCMonth() + months)
  value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10)
}

function dayAfter(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
}

function nameOf(row: AdminRecord | null | undefined) {
  if (!row) return ""
  const full = [row.first_name, row.last_name].filter((part) => typeof part === "string" && part).join(" ")
  return full || String(row.name ?? row.title ?? row.code ?? row.id ?? "")
}

function Field({ label, hint, error, children }: { label: string; hint?: React.ReactNode; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </div>
  )
}

function EmployeePicker({
  token,
  value,
  onPick,
  placeholder = "Search name or employee number",
  activeOnly,
}: {
  token: string
  value: string
  onPick: (row: AdminRecord) => void
  placeholder?: string
  activeOnly?: boolean
}) {
  const [search, setSearch] = React.useState("")
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  React.useEffect(() => {
    if (search.trim().length < 2) {
      setRows([])
      return
    }
    const timer = window.setTimeout(() => {
      listEmployees(token, { search: search.trim(), limit: 8, ...(activeOnly ? { employment_status: "active" } : {}) } as never)
        .then((result) => setRows(result.rows))
        .catch(() => undefined)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search, token, activeOnly])
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" />
      <input className={cn(input, "pl-8")} placeholder={value || placeholder} value={search} onChange={(event) => setSearch(event.target.value)} aria-label={placeholder} />
      {rows.length ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-white shadow-md">
          {rows.map((row) => (
            <li key={String(row.id)}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  onPick(row)
                  setSearch("")
                  setRows([])
                }}
              >
                {nameOf(row)} <span className="text-xs text-muted-foreground">{String(row.employee_no ?? "")}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

// ─────────────────────────── step 1: create ───────────────────────────

/** Step 1 before a draft exists: employee, type, dates, duplicate. Leaving it creates the draft. */
function CreateStep({ token, presetEmployeeId, fromContractId }: { token: string; presetEmployeeId: number | null; fromContractId: number | null }) {
  const router = useRouter()
  const [employee, setEmployee] = React.useState<AdminRecord | null>(null)
  const [previous, setPrevious] = React.useState<ContractRow[]>([])
  const [duplicateId, setDuplicateId] = React.useState<string>(fromContractId ? String(fromContractId) : "")
  const [contractType, setContractType] = React.useState<ContractType>("UNSPECIFIED")
  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")
  const [partTime, setPartTime] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const pickEmployee = React.useCallback(
    async (id: number) => {
      try {
        const record = await getEmployeeById(id, token)
        setEmployee(record)
        const contracts = await listContracts(token, { employee_id: id, limit: 50 })
        const rows = contracts.data.filter((row) => row.status !== "CANCELLED").sort((a, b) => b.version - a.version)
        setPrevious(rows)
        // Default start: day after the latest contract ends (renewal), else the hire date.
        const latestEnd = rows.find((row) => row.endDate && ["SIGNED", "SUPERSEDED"].includes(row.status))?.endDate
        setStartDate(latestEnd ? dayAfter(latestEnd) : String(record?.hire_date ?? "").slice(0, 10))
      } catch (cause) {
        toast.error(errorMessage(cause, "Could not load the employee"))
      }
    },
    [token],
  )

  React.useEffect(() => {
    if (presetEmployeeId) void pickEmployee(presetEmployeeId)
  }, [presetEmployeeId, pickEmployee])

  React.useEffect(() => {
    const source = previous.find((row) => String(row.id) === duplicateId)
    if (source) setContractType(source.contractType)
  }, [duplicateId, previous])

  const needsEnd = contractType !== "UNSPECIFIED"

  const create = async () => {
    const problems: Record<string, string> = {}
    if (!employee) problems.employee_id = "Choose the employee."
    if (!startDate) problems.start_date = "Choose the start date."
    if (needsEnd && !endDate) problems.end_date = "This contract type needs an end date."
    if (endDate && startDate && endDate < startDate) problems.end_date = "The end date is before the start date."
    setErrors(problems)
    if (Object.keys(problems).length || !employee) return
    setBusy(true)
    try {
      const draft = await createContractDraft(token, {
        employee_id: Number(employee.id),
        contract_type: contractType,
        start_date: startDate,
        ...(needsEnd && endDate ? { end_date: endDate } : {}),
        mode: "live",
        part_time: partTime,
        ...(duplicateId ? { from_contract_id: Number(duplicateId) } : {}),
      })
      router.replace(`/dashboard/employees/contracts/${draft.id}/edit?step=job`)
    } catch (cause) {
      setErrors(readStatusFieldErrors(cause))
      toast.error(errorMessage(cause, "The draft could not be created"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="grid max-w-2xl gap-4 rounded-lg border border-border p-4">
      <h3 className="text-base font-semibold">1. Employee and contract type</h3>
      <Field label="Employee" error={errors.employee_id}>
        {employee ? (
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <span>
              {nameOf(employee)} <span className="text-xs text-muted-foreground">{String(employee.employee_no ?? "")}</span>
            </span>
            {!presetEmployeeId ? (
              <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setEmployee(null)}>
                Change
              </button>
            ) : null}
          </div>
        ) : (
          <EmployeePicker token={token} value="" onPick={(row) => void pickEmployee(Number(row.id))} />
        )}
      </Field>
      {previous.length ? (
        <Field label="Start from" hint="Duplicating copies the terms and clauses of an earlier contract; values still follow the current HR records.">
          <FluentSelect
            ariaLabel="Start from"
            value={duplicateId}
            onChange={setDuplicateId}
            options={[
              { value: "", label: "The company template" },
              ...previous.map((row) => ({ value: String(row.id), label: `Duplicate v${row.version} · ${row.referenceNo} (${row.status.toLowerCase().replace(/_/g, " ")})` })),
            ]}
          />
        </Field>
      ) : null}
      <Field label="Contract type">
        <FluentSelect
          ariaLabel="Contract type"
          value={contractType}
          onChange={(value) => setContractType(value as ContractType)}
          options={(Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).map((value) => ({ value, label: CONTRACT_TYPE_LABELS[value] }))}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start date" error={errors.start_date} hint="Defaults to the hire date, or the day after the previous contract ends.">
          <input type="date" className={input} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </Field>
        {needsEnd ? (
          <Field label={contractType === "SPECIFIC_TASK" ? "Expected end date" : "End date"} error={errors.end_date}>
            <input type="date" className={input} value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} />
            {startDate ? (
              <span className="flex gap-1">
                {[6, 12, 24].map((months) => (
                  <button key={months} type="button" className="rounded border border-border px-2 py-0.5 text-xs hover:bg-slate-50" onClick={() => setEndDate(addMonths(startDate, months))}>
                    +{months} months
                  </button>
                ))}
              </span>
            ) : null}
          </Field>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={partTime} onCheckedChange={(value) => setPartTime(Boolean(value))} />
        Part-time (works with any contract type)
      </label>
      <div>
        <button type="button" className={cn(btn, "bg-primary text-primary-foreground")} disabled={busy} onClick={() => void create()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} Create draft and continue
        </button>
      </div>
    </section>
  )
}

// ─────────────────────────── shared field UI ───────────────────────────

/**
 * A value that comes from HR records or policy. "Override for this contract"
 * opens a value box and a required reason; an override shows the HR value.
 */
function SourcedField({
  field,
  override,
  reason,
  onOverride,
  onReason,
  error,
  inputType = "text",
}: {
  field: ContractField | undefined
  override: string | undefined
  reason: string
  onOverride: (value: string | null) => void
  onReason: (value: string) => void
  error?: string
  inputType?: "text" | "number"
}) {
  if (!field) return null
  if (field.hidden)
    return (
      <div className="grid gap-1 rounded-md border border-border p-3 text-sm">
        <span className="font-medium text-slate-700">{fieldLabel(field.key)}</span>
        <span className={field.has_value ? "text-slate-700" : "text-amber-700"}>
          {field.has_value ? "Set by payroll (hidden)" : "Not set yet — a user with payroll access must add it"}
        </span>
        <span className="text-xs text-muted-foreground">Salary is visible only to users with payroll access. The draft can still be saved.</span>
      </div>
    )
  const overridden = override !== undefined
  return (
    <div className="grid gap-1 rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-slate-700">{fieldLabel(field.key)}</span>
        {overridden ? (
          <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => onOverride(null)}>
            Use HR value
          </button>
        ) : (
          <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => onOverride(field.automatic)}>
            Override for this contract
          </button>
        )}
      </div>
      {overridden ? (
        <>
          <input className={input} type={inputType} value={override} onChange={(event) => onOverride(event.target.value)} aria-label={fieldLabel(field.key)} />
          <span className="w-fit rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
            Differs from HR record: {field.automatic || "empty"}
          </span>
          <input className={input} placeholder="Reason for this contract (required)" value={reason} onChange={(event) => onReason(event.target.value)} aria-label="Reason" />
        </>
      ) : (
        <span className={cn("text-sm", field.automatic ? "text-slate-900" : "text-amber-700")}>{field.automatic || "Not available in HR records"}</span>
      )}
      {field.source ? <span className="text-xs text-muted-foreground">{field.source}</span> : null}
      {field.warning ? (
        <span className="flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle className="size-3.5" /> {field.warning}
        </span>
      ) : null}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </div>
  )
}

/** Assignment select (department, position, grade, branch): defaults to the current one. */
function RefSelect({
  label,
  options,
  current,
  value,
  onChange,
  reason,
  onReason,
  error,
  hint,
}: {
  label: string
  options: AdminRecord[]
  current: number | null
  value: number | null
  onChange: (id: number | null) => void
  reason: string
  onReason: (value: string) => void
  error?: string
  hint?: string
}) {
  const chosen = value ?? current
  const differs = value !== null && value !== current
  const currentName = nameOf(options.find((row) => Number(row.id) === current))
  return (
    <div className="grid gap-1 rounded-md border border-border p-3 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <FluentSelect
        ariaLabel={label}
        value={chosen ? String(chosen) : ""}
        onChange={(id) => onChange(id && Number(id) !== current ? Number(id) : null)}
        options={[{ value: "", label: "Not set" }, ...options.map((row) => ({ value: String(row.id), label: `${nameOf(row)}${Number(row.id) === current ? " (current)" : ""}` }))]}
      />
      {differs ? (
        <>
          <span className="w-fit rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
            Differs from HR record: {currentName || "not set"}
          </span>
          <input className={input} placeholder="Reason for this contract (required)" value={reason} onChange={(event) => onReason(event.target.value)} aria-label={`${label} reason`} />
        </>
      ) : (
        <span className="text-xs text-muted-foreground">{hint ?? "Follows the employee's current assignment until the contract is sent."}</span>
      )}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </div>
  )
}

// ─────────────────────────── edit wizard ───────────────────────────

type DraftForm = {
  contract_type: ContractType
  start_date: string
  end_date: string
  title: string
  place_of_recruitment: string
  job_description: string
  benefits: string
  part_time: boolean
  assigned_signatory_id: string
}

function readMap(value: unknown): Record<string, string> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    : {}
}

function readRefs(value: unknown): Partial<Record<ContractRefKey, number>> {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return Object.fromEntries(
    CONTRACT_REF_KEYS.filter((key) => Number.isInteger(Number(raw[key])) && Number(raw[key]) > 0).map((key) => [key, Number(raw[key])]),
  )
}

const PAY_TOKENS = ["salary", "currency", "pay_frequency", "remuneration_method", "hours_of_work", "probation_months", "annual_leave_days"]

function EditWizard({ token, contractId, initialStep }: { token: string; contractId: number; initialStep: ContractStepId }) {
  const router = useRouter()
  const { confirm, dialog } = useContractDialogs()
  const [contract, setContract] = React.useState<ContractDetail | null>(null)
  const [fields, setFields] = React.useState<ContractField[]>([])
  const [employee, setEmployee] = React.useState<AdminRecord | null>(null)
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [positions, setPositions] = React.useState<AdminRecord[]>([])
  const [grades, setGrades] = React.useState<AdminRecord[]>([])
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [signatories, setSignatories] = React.useState<Signatory[]>([])
  const [templateSections, setTemplateSections] = React.useState<ContractSection[] | undefined>(undefined)
  const [step, setStep] = React.useState<ContractStepId>(initialStep)
  const [form, setForm] = React.useState<DraftForm | null>(null)
  const [refs, setRefs] = React.useState<Partial<Record<ContractRefKey, number>>>({})
  const [reportsToName, setReportsToName] = React.useState("")
  const [overrides, setOverrides] = React.useState<Record<string, string>>({})
  const [savedOverrideKeys, setSavedOverrideKeys] = React.useState<string[]>([])
  const [reasons, setReasons] = React.useState<Record<string, string>>({})
  const [sections, setSections] = React.useState<ContractSection[]>([])
  const [dirty, setDirty] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [savedAt, setSavedAt] = React.useState<Date | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [previewing, setPreviewing] = React.useState(false)
  const [mobileTab, setMobileTab] = React.useState<"form" | "preview">("form")
  const [sending, setSending] = React.useState(false)
  const updatedAtRef = React.useRef<string>("")
  // Bumped on every edit; a save only clears "dirty" if nothing changed meanwhile.
  const editsRef = React.useRef(0)
  const markDirty = React.useCallback(() => {
    editsRef.current += 1
    setDirty(true)
  }, [])

  // Load the draft and turn it into editor state.
  const adopt = React.useCallback((row: ContractDetail) => {
    const particulars = row.particulars ?? {}
    setContract(row)
    updatedAtRef.current = row.updatedAt
    setForm({
      contract_type: row.contractType,
      start_date: row.startDate,
      end_date: row.endDate ?? "",
      title: row.title,
      place_of_recruitment: typeof particulars.place_of_recruitment === "string" ? particulars.place_of_recruitment : "",
      job_description: typeof particulars.job_description === "string" ? particulars.job_description : "",
      benefits: row.benefits ?? "",
      part_time: particulars.part_time === true,
      assigned_signatory_id: row.assignedSignatoryId ? String(row.assignedSignatoryId) : "",
    })
    setRefs(readRefs(particulars.refs))
    const savedOverrides = readMap(particulars.field_overrides)
    setOverrides(savedOverrides)
    setSavedOverrideKeys(Object.keys(savedOverrides))
    setReasons(readMap(particulars.override_reasons))
    setSections(row.sections)
    setDirty(false)
  }, [])

  const reloadFields = React.useCallback(async () => {
    setFields(await getContractFields(token, contractId))
  }, [token, contractId])

  React.useEffect(() => {
    void (async () => {
      try {
        const row = await getContract(token, contractId)
        adopt(row)
        void reloadFields()
        const [record, deptResult, branchResult, gradeRows, signatoryRows] = await Promise.all([
          getEmployeeById(row.employeeId, token),
          listDepartments(token, { limit: 200 } as never),
          listBranches(token, { limit: 200 } as never),
          listEmployeeGrades(token),
          listSignatories(token),
        ])
        setEmployee(record)
        setDepartments(deptResult.rows)
        setBranches(branchResult.rows)
        setGrades(gradeRows)
        setSignatories(signatoryRows)
        if (row.templateId) {
          const templates = await listContractTemplates(token)
          setTemplateSections(templates.find((template) => template.id === row.templateId)?.sections)
        }
      } catch (cause) {
        toast.error(errorMessage(cause, "Could not load the draft"))
      }
    })()
  }, [token, contractId, adopt, reloadFields])

  const current: Record<ContractRefKey, number | null> = {
    department_id: employee ? (Number(employee.primary_department_id) || null) : null,
    position_id: employee ? (Number(employee.primary_position_id) || null) : null,
    grade_id: employee ? (Number(employee.grade_id) || null) : null,
    branch_id: employee ? (Number(employee.primary_branch_id) || null) : null,
    reports_to_id: employee ? (Number(employee.reports_to) || null) : null,
  }
  const departmentId = refs.department_id ?? current.department_id

  // Job titles follow the chosen department.
  React.useEffect(() => {
    if (!token) return
    listPositions(token, { limit: 200, ...(departmentId ? { department_id: departmentId } : {}) } as never)
      .then((result) => setPositions(result.rows))
      .catch(() => setPositions([]))
  }, [token, departmentId])

  const body = React.useCallback((): Record<string, unknown> | null => {
    if (!form) return null
    const fieldOverrides: Record<string, string> = {}
    for (const key of new Set([...savedOverrideKeys, ...Object.keys(overrides)])) fieldOverrides[key] = overrides[key] ?? ""
    return {
      contract_type: form.contract_type,
      start_date: form.start_date,
      end_date: form.contract_type === "UNSPECIFIED" ? null : form.end_date || null,
      title: form.title,
      place_of_recruitment: form.place_of_recruitment,
      job_description: form.job_description,
      benefits: form.benefits,
      part_time: form.part_time,
      ...(form.assigned_signatory_id ? { assigned_signatory_id: Number(form.assigned_signatory_id) } : {}),
      refs: Object.fromEntries(CONTRACT_REF_KEYS.map((key) => [key, refs[key] ?? null])),
      field_overrides: fieldOverrides,
      override_reasons: reasons,
      sections,
    }
  }, [form, refs, overrides, savedOverrideKeys, reasons, sections])

  const save = React.useCallback(async () => {
    const payload = body()
    if (!payload || !contract) return false
    const editsAtStart = editsRef.current
    setSaving(true)
    try {
      const saved = await updateContractDraft(token, contract.id, { ...payload, expected_updated_at: updatedAtRef.current })
      updatedAtRef.current = saved.updatedAt
      // What the server now holds is what was sent, not the latest local state.
      setSavedOverrideKeys(
        Object.entries(payload.field_overrides as Record<string, string>)
          .filter(([, value]) => value !== "")
          .map(([key]) => key),
      )
      if (editsRef.current === editsAtStart) setDirty(false)
      setErrors({})
      setSavedAt(new Date())
      void reloadFields()
      return true
    } catch (cause) {
      const fieldErrors = readStatusFieldErrors(cause)
      setErrors(fieldErrors)
      const status = (cause as { status?: number }).status
      if (status === 409) {
        toast.error("Someone else changed this draft. Reloading the latest version.")
        adopt(await getContract(token, contract.id))
      } else if (!Object.keys(fieldErrors).length) {
        toast.error(errorMessage(cause, "Could not save the draft"))
      }
      return false
    } finally {
      setSaving(false)
    }
  }, [body, contract, token, reloadFields, adopt])

  // Autosave after 2 s without changes.
  React.useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => void save(), AUTOSAVE_MS)
    return () => window.clearTimeout(timer)
  }, [dirty, save])

  // Live preview of the unsaved state, 1 s after the last change.
  React.useEffect(() => {
    const payload = body()
    if (!payload || !contract) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setPreviewing(true)
      previewContractDraft(token, contract.id, payload)
        .then((result) => {
          if (cancelled) return
          const url = URL.createObjectURL(base64ToBlob(result.content_base64))
          setPreviewUrl((old) => {
            if (old) URL.revokeObjectURL(old)
            return url
          })
        })
        .catch(() => undefined)
        .finally(() => !cancelled && setPreviewing(false))
    }, PREVIEW_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [body, contract, token])

  React.useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  if (!contract || !form)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading draft…
      </p>
    )

  if (contract.status !== "DRAFT")
    return (
      <p className="text-sm">
        This contract is no longer a draft. <Link className="text-primary underline" href={`/dashboard/employees/contracts/${contract.id}`}>Open the contract</Link>
      </p>
    )

  const change = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => {
    setForm({ ...form, [key]: value })
    markDirty()
  }
  const setRef = (key: ContractRefKey, id: number | null) => {
    const next = { ...refs }
    if (id === null) delete next[key]
    else next[key] = id
    setRefs(next)
    markDirty()
  }
  const setOverride = (key: string, value: string | null) => {
    const next = { ...overrides }
    if (value === null) delete next[key]
    else next[key] = value
    setOverrides(next)
    markDirty()
  }
  const setReason = (key: string, value: string) => {
    setReasons({ ...reasons, [key]: value })
    markDirty()
  }
  const field = (key: string) => fields.find((row) => row.key === key)

  // Completeness: empty fields the clauses use, missing reasons, dates, signatory.
  const missing = missingContractFields(fields).filter((item) => !(item.key in overrides && overrides[item.key].trim()))
  const reasonGaps = [
    ...Object.keys(overrides),
    ...CONTRACT_REF_KEYS.filter((key) => refs[key] !== undefined).map((key) => CONTRACT_REF_TOKEN[key]),
  ].filter((key) => (reasons[key] ?? "").trim().length < 3)
  const problems: Array<{ key: string; label: string; step: ContractStepId }> = [
    ...missing.map((item) => ({ key: item.key, label: item.inRecords ? `${item.label} (fix in HR records)` : item.label, step: item.step })),
    ...reasonGaps.map((key) => ({ key: `reason.${key}`, label: `Reason for ${fieldLabel(key)}`, step: stepOfField(key) })),
    ...(form.contract_type !== "UNSPECIFIED" && !form.end_date ? [{ key: "end_date", label: "End date", step: "employee" as const }] : []),
    ...(!form.assigned_signatory_id && !contract.assignedSignatoryId ? [{ key: "signatory", label: "Company signatory", step: "review" as const }] : []),
    ...Object.entries(errors).map(([key, message]) => ({ key: `error.${key}`, label: message, step: stepOfField(key.replace(/^sections\..*/, "clauses")) })),
  ]
  const readySteps = CONTRACT_STEPS.filter((item) => !problems.some((problem) => problem.step === item.id)).length

  const goto = async (next: ContractStepId) => {
    if (dirty) await save()
    setStep(next)
    router.replace(`/dashboard/employees/contracts/${contract.id}/edit?step=${next}`, { scroll: false })
  }
  const index = CONTRACT_STEPS.findIndex((item) => item.id === step)

  const send = async () => {
    if (dirty && !(await save())) return
    const ok = await confirm({
      title: "Send for signature?",
      message: "Every value is frozen as shown in the preview. The company signatory signs first, then the employee.",
      confirmLabel: "Send for signature",
    })
    if (!ok) return
    setSending(true)
    try {
      await sendContract(token, contract.id, form.assigned_signatory_id ? Number(form.assigned_signatory_id) : null)
      toast.success("Sent to the company signatory")
      router.push(`/dashboard/employees/contracts/${contract.id}`)
    } catch (cause) {
      setErrors(readStatusFieldErrors(cause))
      toast.error(errorMessage(cause, "Could not send"))
    } finally {
      setSending(false)
    }
  }

  const sourced = (key: string, inputType: "text" | "number" = "text") => (
    <SourcedField
      key={key}
      field={field(key)}
      override={overrides[key]}
      reason={reasons[key] ?? ""}
      onOverride={(value) => setOverride(key, value)}
      onReason={(value) => setReason(key, value)}
      error={errors[key]}
      inputType={inputType}
    />
  )
  const refSelect = (key: ContractRefKey, label: string, options: AdminRecord[]) => (
    <RefSelect
      label={label}
      options={options}
      current={current[key]}
      value={refs[key] ?? null}
      onChange={(id) => setRef(key, id)}
      reason={reasons[CONTRACT_REF_TOKEN[key]] ?? ""}
      onReason={(value) => setReason(CONTRACT_REF_TOKEN[key], value)}
      error={errors[CONTRACT_REF_TOKEN[key]]}
    />
  )

  const profileHref = employee?.employee_no ? `/dashboard/employees/profile/${encodeURIComponent(String(employee.employee_no))}` : null

  const formPanel = (
    <div className="grid content-start gap-4">
      {step === "employee" ? (
        <section className="grid gap-3">
          <h3 className="text-base font-semibold">1. Employee and contract type</h3>
          <div className="grid gap-1 rounded-md border border-border p-3 text-sm">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {contract.employeeName} <span className="text-xs text-muted-foreground">{contract.employeeNo}</span>
              </span>
              {profileHref ? (
                <Link href={profileHref} target="_blank" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Edit employee details <ExternalLink className="size-3" />
                </Link>
              ) : null}
            </span>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
              {fields
                .filter((row) => RECORD_FIELDS.has(row.key) && row.key.startsWith("employee_"))
                .map((row) => (
                  <React.Fragment key={row.key}>
                    <dt className="text-muted-foreground">{fieldLabel(row.key)}</dt>
                    <dd className={cn(!row.value && row.used && "text-amber-700")}>{row.value || (row.used ? "Missing — fix in the employee record" : "—")}</dd>
                  </React.Fragment>
                ))}
            </dl>
          </div>
          <Field label="Contract type">
            <FluentSelect
              ariaLabel="Contract type"
              value={form.contract_type}
              onChange={(value) => change("contract_type", value as ContractType)}
              options={(Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).map((value) => ({ value, label: CONTRACT_TYPE_LABELS[value] }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start date" error={errors.start_date}>
              <input type="date" className={input} value={form.start_date} onChange={(event) => change("start_date", event.target.value)} />
            </Field>
            {form.contract_type !== "UNSPECIFIED" ? (
              <Field label="End date" error={errors.end_date}>
                <input type="date" className={input} value={form.end_date} min={form.start_date} onChange={(event) => change("end_date", event.target.value)} />
                <span className="flex gap-1">
                  {[6, 12, 24].map((months) => (
                    <button key={months} type="button" className="rounded border border-border px-2 py-0.5 text-xs hover:bg-slate-50" onClick={() => change("end_date", addMonths(form.start_date, months))}>
                      +{months} months
                    </button>
                  ))}
                </span>
              </Field>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.part_time} onCheckedChange={(value) => change("part_time", Boolean(value))} />
            Part-time
          </label>
        </section>
      ) : null}

      {step === "job" ? (
        <section className="grid gap-3">
          <h3 className="text-base font-semibold">2. Job and place of work</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {refSelect("department_id", "Department", departments)}
            {refSelect("position_id", "Job title", positions)}
            {refSelect("grade_id", "Grade", grades)}
            {refSelect("branch_id", "Place of work", branches)}
          </div>
          <div className="grid gap-1 rounded-md border border-border p-3 text-sm">
            <span className="font-medium text-slate-700">Reports to</span>
            <EmployeePicker
              token={token}
              activeOnly
              value={refs.reports_to_id ? reportsToName || "Changed" : (field("reporting_manager")?.automatic ?? "")}
              placeholder="Search a manager"
              onPick={(row) => {
                setReportsToName(nameOf(row))
                setRef("reports_to_id", Number(row.id) === current.reports_to_id ? null : Number(row.id))
              }}
            />
            {refs.reports_to_id ? (
              <>
                <span className="w-fit rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                  Differs from HR record: {field("reporting_manager")?.automatic || "not set"} ·{" "}
                  <button type="button" className="underline" onClick={() => setRef("reports_to_id", null)}>
                    use HR value
                  </button>
                </span>
                <input className={input} placeholder="Reason for this contract (required)" value={reasons.reporting_manager ?? ""} onChange={(event) => setReason("reporting_manager", event.target.value)} aria-label="Reports to reason" />
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Current: {field("reporting_manager")?.automatic || "not set"}</span>
            )}
          </div>
          <Field label="Place of recruitment" hint="Where the employee was recruited.">
            <input className={input} value={form.place_of_recruitment} onChange={(event) => change("place_of_recruitment", event.target.value)} />
          </Field>
          <Field label="Job description" hint="Positions have no description in HRMS, so it is typed here.">
            <textarea className="min-h-20 rounded-md border border-border px-2.5 py-1.5 text-sm" value={form.job_description} onChange={(event) => change("job_description", event.target.value)} />
          </Field>
        </section>
      ) : null}

      {step === "pay" ? (
        <section className="grid gap-3">
          <h3 className="text-base font-semibold">3. Pay and benefits</h3>
          <p className="text-xs text-muted-foreground">Values come from the salary record, payroll profile, shift or timetable, probation and leave policies. Override only when this contract must differ.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {PAY_TOKENS.map((key) => sourced(key, key === "salary" || key === "probation_months" || key === "annual_leave_days" ? "number" : "text"))}
          </div>
          <Field label="Allowances and other benefits">
            <textarea className="min-h-16 rounded-md border border-border px-2.5 py-1.5 text-sm" value={form.benefits} onChange={(event) => change("benefits", event.target.value)} />
          </Field>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            <dt className="text-muted-foreground">Notice period</dt>
            <dd>{field("notice_period")?.value ?? "—"}</dd>
            <dt className="text-muted-foreground">Governing law</dt>
            <dd>{field("governing_law")?.value ?? "—"}</dd>
          </dl>
          <p className="text-xs text-muted-foreground">Notice period and governing law are company settings (Contracts → Signatories & signing).</p>
        </section>
      ) : null}

      {step === "clauses" ? (
        <section className="grid gap-3">
          <h3 className="text-base font-semibold">4. Terms and clauses</h3>
          <ClausesEditor
            sections={sections}
            templateSections={templateSections}
            onChange={(next) => {
              setSections(next)
              markDirty()
            }}
          />
        </section>
      ) : null}

      {step === "review" ? (
        <section className="grid gap-4">
          <h3 className="text-base font-semibold">5. Review and send</h3>
          <div className={cn("rounded-md border px-3 py-2 text-sm", problems.length ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50")}>
            {problems.length ? (
              <>
                <p className="font-medium">Complete these before sending:</p>
                <ul className="mt-1 grid gap-0.5">
                  {problems.map((problem) => (
                    <li key={problem.key}>
                      <button type="button" className="text-left text-primary underline" onClick={() => void goto(problem.step)}>
                        {problem.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="flex items-center gap-2 font-medium text-emerald-800">
                <Check className="size-4" /> Everything required is filled in.
              </p>
            )}
          </div>
          <div className="grid gap-1 text-sm">
            <span className="font-medium">Values that differ from HR records</span>
            {[...Object.keys(overrides), ...CONTRACT_REF_KEYS.filter((key) => refs[key] !== undefined).map((key) => CONTRACT_REF_TOKEN[key])].length ? (
              <ul className="grid gap-1">
                {Object.keys(overrides).map((key) => (
                  <li key={key} className="rounded-md border border-border px-3 py-2">
                    <span className="font-medium">{fieldLabel(key)}:</span> {overrides[key] || "—"}{" "}
                    <span className="text-xs text-muted-foreground">(HR record: {field(key)?.automatic || "empty"})</span>
                    <span className="block text-xs">Reason: {reasons[key] || <span className="text-rose-600">missing</span>}</span>
                  </li>
                ))}
                {CONTRACT_REF_KEYS.filter((key) => refs[key] !== undefined).map((key) => (
                  <li key={key} className="rounded-md border border-border px-3 py-2">
                    <span className="font-medium">{fieldLabel(CONTRACT_REF_TOKEN[key])}:</span> {field(CONTRACT_REF_TOKEN[key])?.value || "changed"}
                    <span className="block text-xs">Reason: {reasons[CONTRACT_REF_TOKEN[key]] || <span className="text-rose-600">missing</span>}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">None — every value follows HR records.</p>
            )}
          </div>
          <Field label="Company signatory" hint="Default comes from the signatory rules." error={errors.assigned_signatory_id}>
            <FluentSelect
              ariaLabel="Company signatory"
              value={form.assigned_signatory_id}
              onChange={(value) => change("assigned_signatory_id", value)}
              options={[
                { value: "", label: "Automatic (company rules)" },
                ...signatories.filter((row) => row.isActive && row.employeeId !== contract.employeeId).map((row) => ({ value: String(row.id), label: `${row.displayName} — ${row.jobTitle}` })),
              ]}
            />
          </Field>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Advanced</summary>
            <div className="mt-2">
              <Field label="Document title">
                <input className={input} value={form.title} onChange={(event) => change("title", event.target.value)} />
              </Field>
            </div>
          </details>
          <div>
            <button type="button" className={cn(btn, "bg-primary text-primary-foreground")} disabled={sending || problems.length > 0} onClick={() => void send()}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send for signature
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )

  const previewPanel = (
    <div className="grid content-start gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          {previewing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />} Live preview (draft)
        </span>
        {previewUrl ? (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary">
            Open full size
          </a>
        ) : null}
      </div>
      {previewUrl ? (
        <iframe title="Contract preview" src={previewUrl} className="h-[75vh] w-full rounded-md border border-border bg-white" />
      ) : (
        <p className="rounded-md border border-dashed border-border px-3 py-10 text-center text-sm text-muted-foreground">Preparing preview…</p>
      )}
    </div>
  )

  return (
    <div className="grid min-w-0 gap-4 pb-20 lg:pb-0">
      {dialog}
      <header className="grid gap-2">
        <Link href="/dashboard/employees/contracts" className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" /> Contracts
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">
            {contract.referenceNo} · {contract.employeeName}
          </h2>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <ContractStatusBadge status={contract.status} />
            {saving ? "Saving…" : dirty ? "Unsaved changes" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : `Last saved ${formatDate(contract.updatedAt)}`}
          </span>
        </div>
        {/* Steps: a row on large screens, a dropdown on phones. */}
        <ol className="hidden flex-wrap gap-1 lg:flex">
          {CONTRACT_STEPS.map((item, position) => {
            const ready = !problems.some((problem) => problem.step === item.id)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={item.id === step ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                    item.id === step ? "border-primary bg-primary/10 font-medium" : "border-border",
                  )}
                  onClick={() => void goto(item.id)}
                >
                  <span className={cn("flex size-5 items-center justify-center rounded-full text-xs", ready ? "bg-emerald-600 text-white" : "bg-slate-200")}>
                    {ready ? <Check className="size-3" /> : position + 1}
                  </span>
                  {item.title}
                </button>
              </li>
            )
          })}
        </ol>
        <div className="lg:hidden">
          <FluentSelect
            ariaLabel="Step"
            value={step}
            onChange={(value) => void goto(value as ContractStepId)}
            options={CONTRACT_STEPS.map((item, position) => ({ value: item.id, label: `${position + 1}. ${item.title}` }))}
          />
        </div>
        <p className={cn("text-sm", problems.length ? "text-amber-800" : "text-emerald-700")}>
          Ready {readySteps}/{CONTRACT_STEPS.length}
          {problems.length ? ` · ${problems.length} to complete: ${problems.slice(0, 3).map((problem) => problem.label).join(", ")}${problems.length > 3 ? "…" : ""}` : " · nothing missing"}
        </p>
      </header>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={cn("min-w-0", mobileTab === "preview" && "hidden lg:block")}>{formPanel}</div>
        <div className={cn("min-w-0 lg:sticky lg:top-4 lg:self-start", mobileTab === "form" && "hidden lg:block")}>{previewPanel}</div>
      </div>

      {/* Navigation: inline on large screens, sticky bar on phones. */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 border-t border-border bg-white px-4 py-2 lg:static lg:border-0 lg:bg-transparent lg:px-0">
        <button type="button" className={cn(btn, "border border-border")} disabled={index === 0} onClick={() => void goto(CONTRACT_STEPS[index - 1].id)}>
          Back
        </button>
        <span className="flex rounded-md border border-border p-0.5 text-xs lg:hidden">
          {(["form", "preview"] as const).map((tab) => (
            <button key={tab} type="button" className={cn("rounded px-3 py-1", mobileTab === tab && "bg-primary text-primary-foreground")} onClick={() => setMobileTab(tab)}>
              {tab === "form" ? "Form" : "Preview"}
            </button>
          ))}
        </span>
        <span className="flex gap-2">
          <button type="button" className={cn(btn, "hidden border border-border sm:inline-flex")} disabled={saving || !dirty} onClick={() => void save()}>
            Save draft
          </button>
          {index < CONTRACT_STEPS.length - 1 ? (
            <button type="button" className={cn(btn, "bg-primary text-primary-foreground")} onClick={() => void goto(CONTRACT_STEPS[index + 1].id)}>
              Next: {CONTRACT_STEPS[index + 1].title}
            </button>
          ) : null}
        </span>
      </div>
    </div>
  )
}

/** Full-page contract creation and editing (redesigned drafts). */
export function ContractWizard({
  token,
  contractId,
  presetEmployeeId,
  fromContractId,
  initialStep,
}: {
  token: string
  contractId: number | null
  presetEmployeeId?: number | null
  fromContractId?: number | null
  initialStep?: string | null
}) {
  const step = CONTRACT_STEPS.some((item) => item.id === initialStep) ? (initialStep as ContractStepId) : "employee"
  if (!contractId)
    return (
      <div className="grid gap-4">
        <Link href="/dashboard/employees/contracts" className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" /> Contracts
        </Link>
        <h2 className="text-xl font-semibold">New contract</h2>
        <CreateStep token={token} presetEmployeeId={presetEmployeeId ?? null} fromContractId={fromContractId ?? null} />
      </div>
    )
  return <EditWizard token={token} contractId={contractId} initialStep={step} />
}
