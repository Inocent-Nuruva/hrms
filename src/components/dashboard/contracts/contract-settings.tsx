"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Loader2, Plus, Search, Trash2 } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { FluentSelect } from "@/components/ui/fluent-select"
import { toast } from "@/components/ui/fluent-toast-store"
import { listEmployeeGrades, listEmployees, listPositions, type AdminRecord } from "@/lib/admin-api"
import {
  CONTRACT_FIELD_LABELS,
  CONTRACT_TOKENS,
  createSignatory,
  errorMessage,
  getContractSettings,
  listContractTemplates,
  listSignatories,
  reactivateSignatory,
  revokeSignatory,
  saveContractTemplate,
  updateCompanyLegal,
  updateContractSigningSettings,
  type CompanyLegal,
  type ContractSection,
  type ContractSettings,
  type ContractTemplate,
  type ContractType,
  type Signatory,
  type SignatoryRule,
} from "@/lib/contracts-api"
import { cn } from "@/lib/utils"

import { useContractDialogs } from "./contract-dialogs"
import { CONTRACT_TYPE_LABELS, formatDate } from "./contract-ui"

const input = "h-9 w-full rounded-md border border-border px-2.5 text-sm"
const primary =
  "inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

// ─────────────────────────── company legal details ───────────────────────────

export function CompanyLegalForm({ token, canEdit }: { token: string; canEdit: boolean }) {
  const [legal, setLegal] = React.useState<CompanyLegal | null>(null)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    getContractSettings(token)
      .then((result) => setLegal(result.legal))
      .catch((cause: unknown) => toast.error(errorMessage(cause, "Could not load company details")))
  }, [token])
  if (!legal) return <p className="text-sm text-muted-foreground">Loading…</p>
  const set = (key: keyof CompanyLegal) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setLegal({ ...legal, [key]: event.target.value })
  const save = async () => {
    setBusy(true)
    try {
      const result = await updateCompanyLegal(token, {
        legal_name: legal.legal_name ?? "",
        address: legal.address ?? "",
        registration_number: legal.registration_number ?? "",
        tin: legal.tin ?? "",
        phone: legal.phone ?? "",
        email: legal.email || undefined,
      })
      setLegal(result.legal)
      toast.success("Company legal details saved")
    } catch (cause) {
      toast.error(errorMessage(cause, "Could not save"))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Section title="Company legal details" description="Printed in the header of every contract.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Registered (legal) name">
          <input className={input} value={legal.legal_name ?? ""} onChange={set("legal_name")} disabled={!canEdit} />
        </Field>
        <Field label="Registration number">
          <input className={input} value={legal.registration_number ?? ""} onChange={set("registration_number")} disabled={!canEdit} />
        </Field>
        <Field label="TIN">
          <input className={input} value={legal.tin ?? ""} onChange={set("tin")} disabled={!canEdit} />
        </Field>
        <Field label="Phone">
          <input className={input} value={legal.phone ?? ""} onChange={set("phone")} disabled={!canEdit} />
        </Field>
        <Field label="Email">
          <input className={input} type="email" value={legal.email ?? ""} onChange={set("email")} disabled={!canEdit} />
        </Field>
        <Field label="Address">
          <textarea className="min-h-16 rounded-md border border-border px-2.5 py-1.5 text-sm" value={legal.address ?? ""} onChange={set("address")} disabled={!canEdit} />
        </Field>
      </div>
      {canEdit ? (
        <div>
          <button type="button" className={primary} disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null} Save details
          </button>
        </div>
      ) : null}
    </Section>
  )
}

// ─────────────────────────── signatories & signing ───────────────────────────

export function EmployeePicker({ token, onPick }: { token: string; onPick: (row: AdminRecord) => void }) {
  const [search, setSearch] = React.useState("")
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  React.useEffect(() => {
    if (search.trim().length < 2) {
      setRows([])
      return
    }
    const timer = window.setTimeout(() => {
      listEmployees(token, { search: search.trim(), limit: 8, employment_status: "active" } as never)
        .then((result) => setRows(result.rows))
        .catch(() => undefined)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search, token])
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" />
      <input className={cn(input, "pl-8")} placeholder="Add signatory: search an active employee" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search employees" />
      {rows.length ? (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md">
          {rows.map((row) => (
            <li key={String(row.id)}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent"
                onClick={() => {
                  onPick(row)
                  setSearch("")
                }}
              >
                {String(row.fullName ?? row.full_name ?? [row.first_name ?? row.firstName, row.middle_name ?? row.middleName, row.last_name ?? row.lastName].filter(Boolean).join(" "))}{" "}
                <span className="text-xs text-muted-foreground">{String(row.employee_no ?? row.employeeNo ?? "")}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function SigningSettingsForm({ token, canEdit }: { token: string; canEdit: boolean }) {
  const { askReason, dialog } = useContractDialogs()
  const [settings, setSettings] = React.useState<ContractSettings | null>(null)
  const [signatories, setSignatories] = React.useState<Signatory[]>([])
  const [grades, setGrades] = React.useState<AdminRecord[]>([])
  const [positions, setPositions] = React.useState<AdminRecord[]>([])
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const [settingsResult, signatoryRows] = await Promise.all([getContractSettings(token), listSignatories(token)])
      setSettings(settingsResult.contract_settings)
      setSignatories(signatoryRows)
    } catch (cause) {
      toast.error(errorMessage(cause, "Could not load signing settings"))
    }
  }, [token])

  React.useEffect(() => {
    void load()
    listEmployeeGrades(token).then(setGrades).catch(() => undefined)
    listPositions(token, { limit: 200 } as never).then((result) => setPositions(result.rows)).catch(() => undefined)
  }, [load, token])

  if (!settings) return <p className="text-sm text-muted-foreground">Loading…</p>
  const active = signatories.filter((row) => row.isActive)
  const signatoryOptions = [
    { value: "", label: "Not set" },
    ...active.map((row) => ({ value: String(row.id), label: `${row.displayName} — ${row.jobTitle}` })),
  ]
  const setRule = (index: number, rule: Partial<SignatoryRule>) =>
    setSettings({
      ...settings,
      signatory_rules: settings.signatory_rules.map((row, i) => (i === index ? { ...row, ...rule } : row)),
    })

  const save = async () => {
    setBusy(true)
    try {
      const result = await updateContractSigningSettings(token, settings)
      setSettings(result.contract_settings)
      toast.success("Signing settings saved")
    } catch (cause) {
      toast.error(errorMessage(cause, "Could not save"))
    } finally {
      setBusy(false)
    }
  }

  const addSignatory = async (row: AdminRecord) => {
    try {
      await createSignatory(token, { employee_id: Number(row.id) })
      toast.success("Signatory added")
      await load()
    } catch (cause) {
      toast.error(errorMessage(cause, "Could not add signatory"))
    }
  }

  const toggle = async (row: Signatory) => {
    try {
      if (row.isActive) {
        const reason = await askReason({
          title: `Revoke ${row.displayName}?`,
          message: "They can no longer sign contracts for the company. Contracts already assigned to them must be reassigned.",
          confirmLabel: "Revoke",
          tone: "danger",
          placeholder: "Why is this person no longer a signatory?",
        })
        if (!reason) return
        await revokeSignatory(token, row.id, reason)
      } else await reactivateSignatory(token, row.id)
      await load()
    } catch (cause) {
      toast.error(errorMessage(cause, "Could not update signatory"))
    }
  }

  const multi = (options: AdminRecord[], selected: number[], onChange: (ids: number[]) => void, label: string) => (
    <details className="rounded-md border border-border px-2 py-1.5 text-sm">
      <summary className="cursor-pointer text-slate-700">
        {label}: {selected.length ? `${selected.length} selected` : "none"}
      </summary>
      <div className="mt-1 grid max-h-40 gap-1 overflow-y-auto">
        {options.map((option) => {
          const id = Number(option.id)
          return (
            <label key={id} className="flex items-center gap-2">
              <Checkbox
                checked={selected.includes(id)}
                disabled={!canEdit}
                onCheckedChange={(value) => onChange(value ? [...selected, id] : selected.filter((item) => item !== id))}
              />
              {String(option.name ?? option.title ?? option.code ?? id)}
            </label>
          )
        })}
      </div>
    </details>
  )

  return (
    <div className="grid gap-4">
      {dialog}
      <Section
        title="Authorized company signatories"
        description="Only people on this list can sign contracts for the company. The company always signs first."
      >
        {canEdit ? <EmployeePicker token={token} onPick={(row) => void addSignatory(row)} /> : null}
        <ul className="divide-y divide-border rounded-md border border-border">
          {signatories.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                <span className={cn("font-medium", !row.isActive && "text-slate-400 line-through")}>{row.displayName}</span> · {row.jobTitle}
                <span className="block text-xs text-muted-foreground">
                  Since {formatDate(row.designatedAt)}
                  {row.pendingCount ? ` · ${row.pendingCount} awaiting signature` : ""}
                  {!row.isActive && row.revokeReason ? ` · Revoked: ${row.revokeReason}` : ""}
                </span>
              </span>
              {canEdit ? (
                <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => void toggle(row)}>
                  {row.isActive ? "Revoke" : "Reactivate"}
                </button>
              ) : null}
            </li>
          ))}
          {!signatories.length ? <li className="px-3 py-4 text-sm text-muted-foreground">No signatories yet.</li> : null}
        </ul>
      </Section>

      <Section
        title="Who signs which contract"
        description="Rules are checked in order (by grade or position, e.g. Managing Director for senior grades). Otherwise the default signs; if none is set, an active signatory with the HR Manager role. The backup may sign when the assigned signatory cannot."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Default signatory">
            <FluentSelect ariaLabel="Default signatory" value={settings.default_signatory_id ? String(settings.default_signatory_id) : ""} onChange={(value) => setSettings({ ...settings, default_signatory_id: value ? Number(value) : null })} options={signatoryOptions} disabled={!canEdit} />
          </Field>
          <Field label="Backup signatory">
            <FluentSelect ariaLabel="Backup signatory" value={settings.backup_signatory_id ? String(settings.backup_signatory_id) : ""} onChange={(value) => setSettings({ ...settings, backup_signatory_id: value ? Number(value) : null })} options={signatoryOptions} disabled={!canEdit} />
          </Field>
        </div>
        <div className="grid gap-2">
          {settings.signatory_rules.map((rule, index) => (
            <div key={index} className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <FluentSelect ariaLabel="Rule signatory" value={String(rule.signatory_id)} onChange={(value) => setRule(index, { signatory_id: Number(value) })} options={signatoryOptions.slice(1)} disabled={!canEdit} />
              {multi(grades, rule.grade_ids, (ids) => setRule(index, { grade_ids: ids }), "Grades")}
              {multi(positions, rule.position_ids, (ids) => setRule(index, { position_ids: ids }), "Positions")}
              {canEdit ? (
                <button type="button" aria-label="Remove rule" className="rounded-md p-2 hover:bg-slate-100" onClick={() => setSettings({ ...settings, signatory_rules: settings.signatory_rules.filter((_, i) => i !== index) })}>
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
          {canEdit && active.length ? (
            <button type="button" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary" onClick={() => setSettings({ ...settings, signatory_rules: [...settings.signatory_rules, { signatory_id: active[0].id, grade_ids: [], position_ids: [], label: null }] })}>
              <Plus className="size-4" /> Add rule
            </button>
          ) : null}
        </div>
      </Section>

      <Section
        title="Signing methods and contract defaults"
        description="Legal review of electronic signatures is pending: keep paper signing on so you can switch if required."
      >
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={settings.digital_signing_enabled} disabled={!canEdit} onCheckedChange={(value) => setSettings({ ...settings, digital_signing_enabled: Boolean(value) })} />
          Digital signing (typed or drawn signature with a one-time code)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={settings.paper_signing_enabled} disabled={!canEdit} onCheckedChange={(value) => setSettings({ ...settings, paper_signing_enabled: Boolean(value) })} />
          Paper signing (print, sign, upload scan; HR verifies)
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Annual leave days">
            <input className={input} type="number" min={1} max={365} value={settings.annual_leave_days} disabled={!canEdit} onChange={(event) => setSettings({ ...settings, annual_leave_days: Number(event.target.value) })} />
          </Field>
          <Field label="Notice period wording">
            <input className={input} value={settings.notice_period} disabled={!canEdit} onChange={(event) => setSettings({ ...settings, notice_period: event.target.value })} />
          </Field>
          <Field label="Governing law">
            <input className={input} value={settings.governing_law} disabled={!canEdit} onChange={(event) => setSettings({ ...settings, governing_law: event.target.value })} />
          </Field>
        </div>
        {canEdit ? (
          <div>
            <button type="button" className={primary} disabled={busy} onClick={() => void save()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Save signing settings
            </button>
          </div>
        ) : null}
      </Section>
    </div>
  )
}

// ─────────────────────────── clauses editor (templates and drafts) ───────────────────────────

type ClauseRule = "required" | "optional_on" | "optional_off"

function ruleOf(section: ContractSection): ClauseRule {
  if (section.optional !== true) return "required"
  return section.enabled === false ? "optional_off" : "optional_on"
}

/**
 * Clause list.
 * - `mode="template"`: HR sets each clause's rule (required / optional on or
 *   off by default) and whether its wording may change per contract.
 * - `mode="contract"`: the template's rules apply. Optional clauses have a
 *   switch, locked clauses are read-only, required ones cannot be removed,
 *   and changed wording shows a badge with "Reset to template".
 * Clauses without any rule (older contracts) stay fully editable.
 */
export function ClausesEditor({
  sections,
  onChange,
  disabled,
  mode = "contract",
  templateSections,
}: {
  sections: ContractSection[]
  onChange: (sections: ContractSection[]) => void
  disabled?: boolean
  mode?: "template" | "contract"
  templateSections?: ContractSection[]
}) {
  const [focused, setFocused] = React.useState<number | null>(null)
  const refs = React.useRef<Array<HTMLTextAreaElement | null>>([])
  const isTemplate = mode === "template"
  const original = new Map((templateSections ?? []).map((section) => [section.id, section]))
  const update = (index: number, patch: Partial<ContractSection>) =>
    onChange(sections.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  const move = (index: number, delta: number) => {
    const next = [...sections]
    const [row] = next.splice(index, 1)
    next.splice(index + delta, 0, row)
    onChange(next)
  }
  const insertToken = (token: string) => {
    if (focused === null) return
    const area = refs.current[focused]
    const value = sections[focused].body
    const at = area?.selectionStart ?? value.length
    update(focused, { body: `${value.slice(0, at)}{{${token}}}${value.slice(at)}` })
  }
  const setRule = (index: number, rule: ClauseRule) =>
    update(index, rule === "required" ? { optional: false, enabled: undefined } : { optional: true, enabled: rule === "optional_on" ? undefined : false })

  return (
    <div className="grid gap-3">
      {!disabled ? (
        <details className="rounded-md border border-border px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium">Insert a field into the selected clause</summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {CONTRACT_TOKENS.map((token) => (
              <button
                key={token}
                type="button"
                title={`{{${token}}}`}
                className="rounded border border-border px-1.5 py-0.5 hover:bg-slate-50"
                disabled={focused === null}
                onClick={() => insertToken(token)}
              >
                {CONTRACT_FIELD_LABELS[token] ?? token}
              </button>
            ))}
          </div>
        </details>
      ) : null}
      <ol className="grid gap-3">
        {sections.map((section, index) => {
          const flagged = section.optional !== undefined || section.editable !== undefined
          const locked = !isTemplate && section.editable === false
          const switchedOff = !isTemplate && section.optional === true && section.enabled === false
          const removable = isTemplate || !flagged
          const source = original.get(section.id)
          const changed = !isTemplate && source && (source.heading !== section.heading || source.body !== section.body)
          const textDisabled = disabled || locked || switchedOff
          return (
            <li key={section.id} className={cn("grid gap-2 rounded-md border border-border p-3", switchedOff && "bg-slate-50 opacity-70")}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-500">{index + 1}.</span>
                <input
                  className={input}
                  aria-label={`Clause ${index + 1} heading`}
                  value={section.heading}
                  disabled={textDisabled}
                  onChange={(event) => update(index, { heading: event.target.value })}
                />
                {!disabled ? (
                  <span className="flex shrink-0">
                    <button type="button" aria-label="Move up" className="rounded p-1.5 hover:bg-slate-100 disabled:opacity-30" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp className="size-4" />
                    </button>
                    <button type="button" aria-label="Move down" className="rounded p-1.5 hover:bg-slate-100 disabled:opacity-30" disabled={index === sections.length - 1} onClick={() => move(index, 1)}>
                      <ArrowDown className="size-4" />
                    </button>
                    {removable ? (
                      <button type="button" aria-label="Remove clause" className="rounded p-1.5 hover:bg-slate-100" onClick={() => onChange(sections.filter((_, i) => i !== index))}>
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </span>
                ) : null}
              </div>

              {isTemplate ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <FluentSelect
                    ariaLabel={`Clause ${index + 1} rule`}
                    className="w-full sm:w-64"
                    value={ruleOf(section)}
                    disabled={disabled}
                    onChange={(value) => setRule(index, value as ClauseRule)}
                    options={[
                      { value: "required", label: "Required in every contract" },
                      { value: "optional_on", label: "Optional — included by default" },
                      { value: "optional_off", label: "Optional — left out by default" },
                    ]}
                  />
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={section.editable !== false}
                      disabled={disabled}
                      onCheckedChange={(value) => update(index, { editable: value ? undefined : false })}
                    />
                    Wording can be changed on each contract
                  </label>
                </div>
              ) : flagged || changed ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {section.optional === true ? (
                    <label className="flex items-center gap-2 font-medium">
                      <Checkbox
                        checked={section.enabled !== false}
                        disabled={disabled}
                        onCheckedChange={(value) => update(index, { enabled: value ? undefined : false })}
                      />
                      Include this optional clause
                    </label>
                  ) : flagged ? (
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-slate-600">Required</span>
                  ) : null}
                  {locked ? (
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-slate-600">Wording fixed by the template</span>
                  ) : null}
                  {changed ? (
                    <>
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-800">Changed from template</span>
                      {!disabled ? (
                        <button
                          type="button"
                          className="font-medium text-primary hover:underline"
                          onClick={() => update(index, { heading: source.heading, body: source.body })}
                        >
                          Reset to template
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}

              <textarea
                ref={(element) => {
                  refs.current[index] = element
                }}
                aria-label={`Clause ${index + 1} text`}
                className="min-h-24 rounded-md border border-border px-2.5 py-1.5 text-sm"
                value={section.body}
                disabled={textDisabled}
                onFocus={() => setFocused(index)}
                onChange={(event) => update(index, { body: event.target.value })}
              />
            </li>
          )
        })}
      </ol>
      {!disabled ? (
        <button
          type="button"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary"
          onClick={() =>
            onChange([
              ...sections,
              { id: `c${Date.now().toString(36)}`, heading: "New clause", body: "", ...(isTemplate ? { optional: false } : {}) },
            ])
          }
        >
          <Plus className="size-4" /> Add clause
        </button>
      ) : null}
    </div>
  )
}

export function ContractTemplatesEditor({ token, canEdit }: { token: string; canEdit: boolean }) {
  const [templates, setTemplates] = React.useState<ContractTemplate[]>([])
  const [type, setType] = React.useState<ContractType>("UNSPECIFIED")
  const [draft, setDraft] = React.useState<ContractTemplate | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    listContractTemplates(token)
      .then(setTemplates)
      .catch((cause: unknown) => toast.error(errorMessage(cause, "Could not load templates")))
  }, [token])
  React.useEffect(() => {
    setDraft(templates.find((row) => row.contract_type === type) ?? null)
  }, [templates, type])

  const save = async () => {
    if (!draft) return
    setBusy(true)
    try {
      await saveContractTemplate(token, { contract_type: draft.contract_type, title: draft.title, sections: draft.sections })
      setTemplates(await listContractTemplates(token))
      toast.success("Template saved")
    } catch (cause) {
      toast.error(errorMessage(cause, "Could not save template"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      title="Contract templates"
      description="One template per contract type. Fields in {{double braces}} fill in automatically. Wording must be reviewed by HR/legal against the Employment and Labour Relations Act."
    >
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Contract type">
        {(Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).map((value) => (
          <button key={value} type="button" role="tab" aria-selected={type === value} className={cn("rounded-md border px-3 py-1.5 text-sm", type === value ? "border-primary bg-primary/10 font-medium" : "border-border")} onClick={() => setType(value)}>
            {CONTRACT_TYPE_LABELS[value]}
          </button>
        ))}
      </div>
      {draft ? (
        <>
          <p className="text-xs text-muted-foreground">
            {draft.is_default ? "Built-in starting template (not saved yet)." : `Version ${draft.version}, saved ${formatDate(draft.updated_at)}.`}
          </p>
          <Field label="Title">
            <input className={input} value={draft.title} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </Field>
          <ClausesEditor mode="template" sections={draft.sections} disabled={!canEdit} onChange={(sections) => setDraft({ ...draft, sections })} />
          {canEdit ? (
            <div>
              <button type="button" className={primary} disabled={busy} onClick={() => void save()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} Save template
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
    </Section>
  )
}
