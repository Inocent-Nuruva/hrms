"use client"

import { StandardTable, StandardTableHeader, StandardTableBody, StandardTableRow, StandardTableHead, StandardTableCell } from "@/components/ui/standard-fluent-table"
import * as React from "react"
import { PlusIcon, RefreshCwIcon, TrashIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { Textarea } from "@/components/ui/textarea"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { listLeaveTypes, type AdminRecord } from "@/lib/admin-api"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { showErrorAlert } from "@/lib/error-alert"
import {
  POLICY_STATUS_LABEL,
  STATUTORY_RULE_LABEL,
  activateStatutoryRuleSet,
  calculatePublicHolidayCompensation,
  createStatutoryRuleSet,
  discardStatutoryRuleSet,
  getStatutorySettings,
  listStatutoryRuleSets,
  reviseStatutoryRuleSet,
  statusTone,
  submitStatutoryRuleSet,
  updateStatutoryRuleSet,
  updateStatutorySettings,
  verifyStatutoryRuleSet,
  type LegalReference,
  type StatutoryRule,
  type StatutoryRuleSet,
  type StatutoryRuleType,
  type StatutorySettings,
} from "@/lib/leave-engine-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { showSuccessAlert } from "@/lib/success-alert"
import { cn } from "@/lib/utils"

const token = () => readStoredSessionTokens().accessToken
const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)

type FieldDef = { key: string; label: string; kind: "number" | "boolean"; hint?: string }

/** Settings per rule type; values must come from the verified legal source. */
export const RULE_FIELDS: Record<StatutoryRuleType, FieldDef[]> = {
  annual_leave: [
    { key: "minimum_days_per_cycle", label: "Minimum days per leave cycle", kind: "number" },
    { key: "cycle_months", label: "Cycle length (months)", kind: "number" },
    { key: "eligibility_months", label: "Service needed (months)", kind: "number" },
    { key: "protected_unused_days", label: "Unused days that may never lapse", kind: "number" },
  ],
  sick_leave: [
    { key: "reference_period_months", label: "Reference period (months)", kind: "number" },
    { key: "certificate_required_after_days", label: "Medical certificate after (days)", kind: "number" },
    { key: "eligibility_months", label: "Service needed (months)", kind: "number" },
  ],
  maternity_leave: [
    { key: "standard_days", label: "Standard days", kind: "number" },
    { key: "multiple_birth_days", label: "Days for multiple births", kind: "number" },
    { key: "pay_percent", label: "Pay (%)", kind: "number" },
    { key: "eligibility_months", label: "Service needed (months)", kind: "number" },
    { key: "max_occurrences", label: "Maximum occurrences", kind: "number" },
    { key: "period_months", label: "…within (months)", kind: "number" },
  ],
  paternity_leave: [
    { key: "days", label: "Days", kind: "number" },
    { key: "within_days_of_birth", label: "Must start within (days of birth)", kind: "number" },
    { key: "pay_percent", label: "Pay (%)", kind: "number" },
    { key: "eligibility_months", label: "Service needed (months)", kind: "number" },
  ],
  public_holiday: [
    { key: "premium_rate_percent", label: "Pay for hours worked (% of hourly rate)", kind: "number" },
    { key: "monthly_hours_divisor", label: "Monthly hours (salary ÷ hours = hourly rate)", kind: "number" },
    { key: "standard_hours_per_day", label: "Standard hours per day", kind: "number" },
    { key: "compensatory_leave_allowed", label: "Compensatory leave allowed", kind: "boolean" },
  ],
  termination_settlement: [
    { key: "pay_unused_annual_leave", label: "Pay unused annual leave", kind: "boolean" },
    { key: "include_carried_forward", label: "Include carried-forward days", kind: "boolean" },
    { key: "daily_rate_divisor", label: "Daily rate divisor (monthly basic ÷)", kind: "number" },
  ],
}

const LINKED_TYPES: StatutoryRuleType[] = ["annual_leave", "sick_leave", "maternity_leave", "paternity_leave"]

type Draft = {
  id: number | null
  jurisdiction_code: string
  name: string
  legal_authority: string
  legal_references: LegalReference[]
  is_test_configuration: boolean
  change_reason: string
  rules: StatutoryRule[]
}

const emptyDraft = (): Draft => ({
  id: null,
  jurisdiction_code: "TZ-MAINLAND",
  name: "",
  legal_authority: "",
  legal_references: [],
  is_test_configuration: false,
  change_reason: "",
  rules: [],
})

function Chip({ status, label }: { status: string; label: string }) {
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", statusTone(status))}>{label}</span>
}

/** Statutory leave rules per jurisdiction: setup, verification, activation. */
export function LeaveStatutoryView() {
  const actor = useDashboardActor()
  const canManage = canPerformPermission(actor.permissionLabels, "leave_statutory:manage")
  const canApprove = canPerformPermission(actor.permissionLabels, "leave_statutory:approve")
  const [sets, setSets] = React.useState<StatutoryRuleSet[]>([])
  const [settings, setSettings] = React.useState<StatutorySettings | null>(null)
  const [leaveTypes, setLeaveTypes] = React.useState<AdminRecord[]>([])
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const [holiday, setHoliday] = React.useState({ from_date: "", to_date: "", payroll_period_code: "" })
  const [holidayResult, setHolidayResult] = React.useState<{ total_amount: number; posted_inputs: number; data: AdminRecord[] } | null>(null)

  const load = React.useCallback(async () => {
    try {
      const [ruleSets, companySettings, types] = await Promise.all([
        listStatutoryRuleSets(token()),
        getStatutorySettings(token()),
        listLeaveTypes(token(), { limit: 100 }),
      ])
      setSets(ruleSets)
      setSettings(companySettings)
      setLeaveTypes(types.rows)
    } catch (error) {
      showErrorAlert(errorText(error, "Could not load statutory rules."))
    } finally {
      setLoaded(true)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
      await load()
      showSuccessAlert(label)
      return true
    } catch (error) {
      showErrorAlert(errorText(error, "The action failed."))
      return false
    } finally {
      setBusy(false)
    }
  }

  function editSet(set: StatutoryRuleSet) {
    setDraft({
      id: set.id,
      jurisdiction_code: set.jurisdiction_code,
      name: set.name,
      legal_authority: set.legal_authority ?? "",
      legal_references: set.legal_references ?? [],
      is_test_configuration: set.is_test_configuration,
      change_reason: set.change_reason ?? "",
      rules: set.rules.map((rule) => ({ ...rule, settings: { ...rule.settings } })),
    })
  }

  async function saveDraft() {
    if (!draft) return
    const body = {
      name: draft.name,
      legal_authority: draft.legal_authority || undefined,
      legal_references: draft.legal_references.filter((item) => item.title.trim()),
      is_test_configuration: draft.is_test_configuration,
      change_reason: draft.change_reason || undefined,
      rules: draft.rules.map((rule) => ({
        rule_type: rule.rule_type,
        leave_type_id: rule.leave_type_id,
        settings: rule.settings,
        legal_reference: rule.legal_reference || undefined,
      })),
    }
    const ok = await run(
      "Statutory rule set saved as draft",
      () =>
        draft.id
          ? updateStatutoryRuleSet(token(), draft.id, body)
          : createStatutoryRuleSet(token(), { ...body, jurisdiction_code: draft.jurisdiction_code }),
    )
    if (ok) setDraft(null)
  }

  function updateRule(index: number, patch: Partial<StatutoryRule>) {
    setDraft((current) =>
      current ? { ...current, rules: current.rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)) } : current,
    )
  }

  const missingTypes = (Object.keys(RULE_FIELDS) as StatutoryRuleType[]).filter(
    (type) => !draft?.rules.some((rule) => rule.rule_type === type),
  )

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        title="Statutory leave rules"
        description="Jurisdiction rules (e.g. Tanzania Mainland, Zanzibar) that company policies may add to but never go below. A rule set applies only after HR/legal record the legal sources they verified and activate it."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCwIcon className="mr-1 size-4" /> Refresh
            </Button>
            {canManage ? (
              <Button size="sm" onClick={() => setDraft(emptyDraft())}>
                <PlusIcon className="mr-1 size-4" /> New rule set
              </Button>
            ) : null}
          </div>
        }
      />

      {settings ? (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">Which rules apply to whom</h2>
          <p className="text-xs text-muted-foreground">
            An employee follows their branch&apos;s jurisdiction, or the company default when the branch has none.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Company default</span>
              <Input
                value={settings.default_jurisdiction_code ?? ""}
                placeholder="e.g. TZ-MAINLAND"
                disabled={!canManage}
                onChange={(event) => setSettings({ ...settings, default_jurisdiction_code: event.target.value.toUpperCase() })}
              />
            </label>
            {settings.branches.map((branch) => (
              <label key={branch.id} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{branch.name}</span>
                <Input
                  value={branch.statutory_jurisdiction_code ?? ""}
                  placeholder="Company default"
                  disabled={!canManage}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      branches: settings.branches.map((item) =>
                        item.id === branch.id ? { ...item, statutory_jurisdiction_code: event.target.value.toUpperCase() } : item,
                      ),
                    })
                  }
                />
              </label>
            ))}
          </div>
          {canManage ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void run("Jurisdictions saved", () =>
                  updateStatutorySettings(token(), {
                    default_jurisdiction_code: settings.default_jurisdiction_code || null,
                    branches: settings.branches.map((branch) => ({
                      branch_id: branch.id,
                      jurisdiction_code: branch.statutory_jurisdiction_code || null,
                    })),
                  }),
                )
              }
            >
              Save jurisdictions
            </Button>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Rule sets</h2>
        {sets.length === 0 ? <p className="text-sm text-muted-foreground">{loaded ? "No statutory rule sets yet." : "Loading rule sets…"}</p> : null}
        <div className="grid gap-3 lg:grid-cols-2">
          {sets.map((set) => (
            <article key={set.id} className="space-y-2 rounded-lg border border-border p-4" data-testid="statutory-rule-set">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{set.name}</h3>
                <Chip status={set.status} label={POLICY_STATUS_LABEL[set.status]} />
                <Chip status={set.verification_status} label={set.verification_status === "verified" ? "Legally verified" : set.verification_status === "rejected" ? "Verification rejected" : "Not verified"} />
                {set.is_test_configuration ? <Chip status="draft" label="TEST configuration" /> : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {set.jurisdiction_code} · version {set.version_no}
                {set.effective_from ? ` · effective ${set.effective_from}${set.effective_to ? ` to ${set.effective_to}` : ""}` : ""}
              </p>
              {set.legal_authority ? <p className="text-xs">{set.legal_authority}</p> : null}
              <ul className="space-y-1 text-xs">
                {set.rules.map((rule) => (
                  <li key={rule.rule_type}>
                    <span className="font-medium">{STATUTORY_RULE_LABEL[rule.rule_type]}:</span>{" "}
                    {Object.entries(rule.settings)
                      .map(([key, value]) => `${key.replace(/_/g, " ")} ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
                      .join(" · ")}
                  </li>
                ))}
              </ul>
              {set.verification_notes ? <p className="text-xs text-muted-foreground">Verification: {set.verification_notes}</p> : null}
              <div className="flex flex-wrap gap-2 pt-1">
                {canManage && ["draft", "pending_approval"].includes(set.status) ? (
                  <Button size="sm" variant="outline" onClick={() => editSet(set)}>Edit</Button>
                ) : null}
                {canManage && set.status === "draft" ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void run("Submitted for approval", () => submitStatutoryRuleSet(token(), set.id))}>Submit</Button>
                ) : null}
                {canApprove && ["draft", "pending_approval"].includes(set.status) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      const notes = window.prompt("Verification notes: which current legislation and amendments did you check?")
                      if (!notes) return
                      const verified = window.confirm("Mark these values as legally verified? Cancel records the check as rejected.")
                      void run(verified ? "Recorded as verified" : "Recorded as rejected", () => verifyStatutoryRuleSet(token(), set.id, { verified, notes }))
                    }}
                  >
                    Record verification
                  </Button>
                ) : null}
                {canApprove && ["draft", "pending_approval"].includes(set.status) ? (
                  <Button
                    size="sm"
                    disabled={busy || (!set.is_test_configuration && set.verification_status !== "verified")}
                    title={!set.is_test_configuration && set.verification_status !== "verified" ? "Record a legal verification first" : undefined}
                    onClick={() => {
                      const from = window.prompt("Effective from (YYYY-MM-DD)", new Date().toISOString().slice(0, 10))
                      if (!from) return
                      void run("Rule set activated", () => activateStatutoryRuleSet(token(), set.id, { effective_from: from }))
                    }}
                  >
                    Activate
                  </Button>
                ) : null}
                {canManage && ["active", "superseded"].includes(set.status) ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void run("New draft version created", () => reviseStatutoryRuleSet(token(), set.id))}>New version</Button>
                ) : null}
                {canManage && ["draft", "pending_approval"].includes(set.status) ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void run("Draft discarded", () => discardStatutoryRuleSet(token(), set.id))}>Discard</Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {draft ? (
        <section className="space-y-4 rounded-lg border-2 border-primary/40 p-4" aria-label="Statutory rule set editor">
          <h2 className="text-base font-semibold">{draft.id ? "Edit draft rule set" : "New statutory rule set"}</h2>
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            Enter only values confirmed against the current legislation, and cite the source. Saving resets any earlier verification.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Jurisdiction code</span>
              <Input value={draft.jurisdiction_code} disabled={Boolean(draft.id)} onChange={(event) => setDraft({ ...draft, jurisdiction_code: event.target.value.toUpperCase() })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Name</span>
              <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium">Legal authority</span>
              <Input value={draft.legal_authority} onChange={(event) => setDraft({ ...draft, legal_authority: event.target.value })} placeholder="Act, chapter and revision" />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={draft.is_test_configuration} onChange={(event) => setDraft({ ...draft, is_test_configuration: event.target.checked })} />
              Test configuration (development/test only; can never be activated in production)
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Legal references</h3>
              <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, legal_references: [...draft.legal_references, { title: "", citation: "", url: "" }] })}>
                <PlusIcon className="mr-1 size-4" /> Add reference
              </Button>
            </div>
            {draft.legal_references.map((reference, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[2fr_2fr_2fr_auto]">
                {(["title", "citation", "url"] as const).map((key) => (
                  <Input
                    key={key}
                    placeholder={key === "title" ? "Title" : key === "citation" ? "Section / citation" : "Link (optional)"}
                    value={reference[key] ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        legal_references: draft.legal_references.map((item, i) => (i === index ? { ...item, [key]: event.target.value } : item)),
                      })
                    }
                  />
                ))}
                <Button size="sm" variant="outline" aria-label="Remove reference" onClick={() => setDraft({ ...draft, legal_references: draft.legal_references.filter((_, i) => i !== index) })}>
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Rules</h3>
            {draft.rules.map((rule, index) => (
              <div key={rule.rule_type} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{STATUTORY_RULE_LABEL[rule.rule_type]}</span>
                  <Button size="sm" variant="outline" aria-label={`Remove ${STATUTORY_RULE_LABEL[rule.rule_type]}`} onClick={() => setDraft({ ...draft, rules: draft.rules.filter((_, i) => i !== index) })}>
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {LINKED_TYPES.includes(rule.rule_type) ? (
                    <label className="flex flex-col gap-1 text-xs">
                      <span>Company leave type</span>
                      <select
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={rule.leave_type_id ?? ""}
                        onChange={(event) => updateRule(index, { leave_type_id: event.target.value ? Number(event.target.value) : null })}
                      >
                        <option value="">Choose…</option>
                        {leaveTypes.map((type) => (
                          <option key={String(type.id)} value={String(type.id)}>{String(type.name)}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {RULE_FIELDS[rule.rule_type].map((field) => (
                    <label key={field.key} className={cn("flex gap-1 text-xs", field.kind === "boolean" ? "items-center" : "flex-col")}>
                      {field.kind === "boolean" ? (
                        <input
                          type="checkbox"
                          checked={rule.settings[field.key] === true}
                          onChange={(event) => updateRule(index, { settings: { ...rule.settings, [field.key]: event.target.checked } })}
                        />
                      ) : null}
                      <span>{field.label}</span>
                      {field.kind === "number" ? (
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={rule.settings[field.key] === undefined || rule.settings[field.key] === null ? "" : String(rule.settings[field.key])}
                          onChange={(event) =>
                            updateRule(index, {
                              settings: { ...rule.settings, [field.key]: event.target.value === "" ? undefined : Number(event.target.value) },
                            })
                          }
                        />
                      ) : null}
                    </label>
                  ))}
                </div>
                {rule.rule_type === "sick_leave" ? (
                  <div className="space-y-1">
                    <span className="text-xs font-medium">Pay stages (in order)</span>
                    {((rule.settings.stages as Array<{ days: number; pay_percent: number }> | undefined) ?? []).map((stage, stageIndex) => (
                      <div key={stageIndex} className="flex flex-wrap items-center gap-2 text-xs">
                        <Input
                          type="number"
                          className="w-24"
                          aria-label="Days"
                          value={String(stage.days ?? "")}
                          onChange={(event) => {
                            const stages = [...((rule.settings.stages as Array<{ days: number; pay_percent: number }>) ?? [])]
                            stages[stageIndex] = { ...stages[stageIndex], days: Number(event.target.value) }
                            updateRule(index, { settings: { ...rule.settings, stages } })
                          }}
                        />
                        days at
                        <Input
                          type="number"
                          className="w-24"
                          aria-label="Pay percent"
                          value={String(stage.pay_percent ?? "")}
                          onChange={(event) => {
                            const stages = [...((rule.settings.stages as Array<{ days: number; pay_percent: number }>) ?? [])]
                            stages[stageIndex] = { ...stages[stageIndex], pay_percent: Number(event.target.value) }
                            updateRule(index, { settings: { ...rule.settings, stages } })
                          }}
                        />
                        % pay
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateRule(index, {
                          settings: {
                            ...rule.settings,
                            stages: [...((rule.settings.stages as unknown[]) ?? []), { days: 0, pay_percent: 100 }],
                          },
                        })
                      }
                    >
                      Add stage
                    </Button>
                  </div>
                ) : null}
                <Input
                  placeholder="Legal reference for this rule (section)"
                  value={rule.legal_reference ?? ""}
                  onChange={(event) => updateRule(index, { legal_reference: event.target.value })}
                />
              </div>
            ))}
            {missingTypes.length ? (
              <div className="flex flex-wrap gap-2">
                {missingTypes.map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant="outline"
                    onClick={() => setDraft({ ...draft, rules: [...draft.rules, { rule_type: type, leave_type_id: null, settings: {}, legal_reference: "" }] })}
                  >
                    <PlusIcon className="mr-1 size-4" /> {STATUTORY_RULE_LABEL[type]}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Change reason</span>
            <Textarea value={draft.change_reason} onChange={(event) => setDraft({ ...draft, change_reason: event.target.value })} />
          </label>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || !draft.name.trim()} onClick={() => void saveDraft()}>Save draft</Button>
            <Button size="sm" variant="outline" onClick={() => setDraft(null)}>Close</Button>
          </div>
        </section>
      ) : null}

      {canManage ? (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">Public holiday work pay</h2>
          <p className="text-xs text-muted-foreground">
            Calculated from attendance (hours worked on public holidays) and the active public-holiday rule. Posting creates draft payroll inputs for payroll to approve, once Finance has confirmed the PUBLIC_HOLIDAY_WORK component.
          </p>
          <div className="grid gap-2 sm:grid-cols-4">
            <Input type="date" aria-label="From" value={holiday.from_date} onChange={(event) => setHoliday({ ...holiday, from_date: event.target.value })} />
            <Input type="date" aria-label="To" value={holiday.to_date} onChange={(event) => setHoliday({ ...holiday, to_date: event.target.value })} />
            <Input placeholder="Payroll period code (to post)" value={holiday.payroll_period_code} onChange={(event) => setHoliday({ ...holiday, payroll_period_code: event.target.value })} />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy || !holiday.from_date || !holiday.to_date}
                onClick={() =>
                  void run("Calculated", async () =>
                    setHolidayResult(await calculatePublicHolidayCompensation(token(), { from_date: holiday.from_date, to_date: holiday.to_date })),
                  )
                }
              >
                Calculate
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !holiday.from_date || !holiday.to_date || !holiday.payroll_period_code}
                onClick={() =>
                  void run("Draft payroll inputs created", async () =>
                    setHolidayResult(await calculatePublicHolidayCompensation(token(), { ...holiday, post: true })),
                  )
                }
              >
                Post to payroll
              </Button>
            </div>
          </div>
          {holidayResult ? (
            <div className="overflow-x-auto">
              <p className="text-sm">
                Total {holidayResult.total_amount.toLocaleString()} · {holidayResult.posted_inputs} input(s) posted
              </p>
              <StandardTable className="mt-2 w-full min-w-[560px] text-xs">
                <StandardTableHeader className="text-left text-muted-foreground">
                  <StandardTableRow><StandardTableHead className="py-1">Employee</StandardTableHead><StandardTableHead>Date</StandardTableHead><StandardTableHead className="text-right">Hours</StandardTableHead><StandardTableHead className="text-right">Amount</StandardTableHead><StandardTableHead>Status</StandardTableHead></StandardTableRow>
                </StandardTableHeader>
                <StandardTableBody>
                  {holidayResult.data.map((line, index) => (
                    <StandardTableRow key={index} className="border-t border-border">
                      <StandardTableCell className="py-1">{String(line.employee_no ?? line.employee_id)}</StandardTableCell>
                      <StandardTableCell>{String(line.date)}</StandardTableCell>
                      <StandardTableCell className="text-right">{String(line.hours)}</StandardTableCell>
                      <StandardTableCell className="text-right">{line.amount !== undefined ? `${String(line.amount)} ${String(line.currency ?? "")}` : "-"}</StandardTableCell>
                      <StandardTableCell>{String(line.message ?? line.status)}</StandardTableCell>
                    </StandardTableRow>
                  ))}
                </StandardTableBody>
              </StandardTable>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
