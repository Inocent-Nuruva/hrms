"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Badge, Button, Dialog, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Dropdown, Field, Input, Option, ProgressBar, Table, TableBody, TableCell,
  TableHeader, TableHeaderCell, TableRow,
} from "@fluentui/react-components"
import { Add20Regular, Delete16Regular, Dismiss20Regular } from "@fluentui/react-icons"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { listBranches, listDepartments, listEmployees, type AdminRecord } from "@/lib/admin-api"
import { kpiApi, type KpiDefinition, type KpiPeriod } from "@/lib/kpi-api"
import { readKpiToken, scorecardsEnabled } from "@/lib/kpi-session"
import { scorecardApi, type ScorecardTemplate, type ScoringPolicy } from "@/lib/scorecard-api"
import { KpiFeedback, KpiPageHeader } from "./kpi-page-elements"
import { kpiIdentifierFromName } from "./kpi-identifier"
import { KpiSearchSelect, type KpiChoice } from "./kpi-search-select"

type TemplateItem = ScorecardTemplate["items"][number]
const steps = ["Details", "Select KPIs", "Weights and policy", "Review"] as const
const subjects = ["employee", "department", "branch", "manager_group", "organization"]
const totalWeight = (items: TemplateItem[]) => items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0)
const errorText = (error: unknown) => error instanceof Error ? error.message : "Request failed."

export function ScorecardTemplates() {
  const router = useRouter()
  const actor = useDashboardActor()
  const token = readKpiToken()
  const [rows, setRows] = React.useState<ScorecardTemplate[]>([])
  const [definitions, setDefinitions] = React.useState<KpiDefinition[]>([])
  const [periods, setPeriods] = React.useState<KpiPeriod[]>([])
  const [policies, setPolicies] = React.useState<ScoringPolicy[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<number | null>(null)
  const [step, setStep] = React.useState(0)
  const [name, setName] = React.useState("")
  const [code, setCode] = React.useState("")
  const [mode, setMode] = React.useState<"weighted" | "strategic">("weighted")
  const [policyId, setPolicyId] = React.useState("")
  const [items, setItems] = React.useState<TemplateItem[]>([])
  const [selectedKpi, setSelectedKpi] = React.useState("")
  const [useId, setUseId] = React.useState<number | null>(null)
  const [newCode, setNewCode] = React.useState("")
  const [subjectType, setSubjectType] = React.useState("employee")
  const [subjectId, setSubjectId] = React.useState("")
  const [periodId, setPeriodId] = React.useState("")
  const loadSequence = React.useRef(0)
  const saving = React.useRef(false)
  const canEdit = actor.roleNames.some((role) => ["COMPANY_ADMIN", "HR_MANAGER"].includes(role))
  const publishedPolicies = policies.flatMap((policy) => policy.versions.filter((version) => version.publishedAt).map((version) => ({ id: version.id, label: version.name + " · v" + version.version })))
  const kpiName = (id: number) => definitions.find((row) => row.id === id)?.currentVersion?.name ?? "KPI #" + id
  const loadSubjects = React.useCallback(async (search: string): Promise<KpiChoice[]> => {
    const result = subjectType === "employee" ? await listEmployees(token, { limit: 100, search }) : subjectType === "department" ? await listDepartments(token, { limit: 100, search }) : await listBranches(token, { limit: 100, search })
    return result.rows.map((row: AdminRecord) => {
      const id = Number(row.id)
      const fullName = [row.first_name ?? row.firstName, row.last_name ?? row.lastName].filter(Boolean).join(" ")
      return { id, label: String(row.full_name ?? row.fullName ?? (fullName || row.name || row.email || subjectType + " #" + id)) }
    }).filter((choice) => Number.isInteger(choice.id) && choice.id > 0)
  }, [subjectType, token])

  const load = React.useCallback(async () => {
    if (!token || !scorecardsEnabled) return
    const sequence = ++loadSequence.current
    setLoading(true)
    try {
      const [templates, nextDefinitions, nextPeriods, nextPolicies] = await Promise.all([
        scorecardApi.templates(token), kpiApi.definitions(token, "", "assignment"),
        kpiApi.periods(token), scorecardApi.policies(token),
      ])
      if (sequence === loadSequence.current) {
        setRows(templates); setDefinitions(nextDefinitions); setPeriods(nextPeriods); setPolicies(nextPolicies); setError("")
      }
    } catch (cause) {
      if (sequence === loadSequence.current) setError(errorText(cause))
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }, [token])
  React.useEffect(() => { if (actor.ready) void load() }, [actor.ready, load])

  function reset() {
    setEditing(null); setStep(0); setName(""); setCode(""); setMode("weighted")
    setPolicyId(""); setItems([]); setSelectedKpi(""); setError("")
  }
  function close() { if (!busy) { setOpen(false); reset() } }
  function edit(row: ScorecardTemplate) {
    reset(); setEditing(row.id); setName(row.name); setCode(row.code); setMode(row.mode)
    setPolicyId(row.policyVersionId ? String(row.policyVersionId) : "")
    setItems(row.items.map((item) => ({ ...item }))); setNotice(""); setOpen(true)
  }
  function validate(index: number, publish = false) {
    if (index === 0 && (!name.trim() || !code.trim())) return "Enter a template name and identifier."
    if (index === 1 && !items.length) return "Add at least one published KPI."
    if (index === 2 && mode === "weighted") {
      if (items.some((item) => !item.weight.trim() || !Number.isFinite(Number(item.weight)) || Number(item.weight) < 0)) return "Enter a valid weight for every KPI."
      if (Math.abs(totalWeight(items) - 100) > 0.0001) return "KPI weights must total 100%."
      if (publish && !policyId) return "Choose a published scoring policy before publishing."
    }
    return ""
  }
  function next() {
    const problem = validate(step)
    if (problem) { setError(problem); return }
    setError(""); setStep((current) => Math.min(current + 1, steps.length - 1))
  }
  async function save(publish: boolean) {
    if (saving.current || busy) return
    for (let index = 0; index < steps.length - 1; index += 1) {
      const problem = validate(index, publish)
      if (problem) { setStep(index); setError(problem); return }
    }
    saving.current = true; setBusy(true); setError(""); setNotice("")
    let saved: ScorecardTemplate | null = null
    try {
      const body = { code: code.trim(), name: name.trim(), mode, policyVersionId: policyId ? Number(policyId) : null, items }
      const draft = editing ? await scorecardApi.updateTemplate(token, editing, body) : await scorecardApi.createTemplate(token, body)
      saved = draft; setEditing(draft.id); ++loadSequence.current
      setRows((current) => [draft, ...current.filter((row) => row.id !== draft.id)])
      if (publish) {
        const published = await scorecardApi.publishTemplate(token, draft.id)
        setRows((current) => [published, ...current.filter((row) => row.id !== published.id)])
      }
      setOpen(false); reset(); setNotice(publish ? "Scorecard template published." : "Template draft saved.")
    } catch (cause) {
      setError(saved && publish ? "Draft saved, but publication failed: " + errorText(cause) : errorText(cause))
    } finally {
      saving.current = false; setBusy(false)
    }
  }
  async function publishRow(row: ScorecardTemplate) {
    if (busy) return
    setBusy(true); setError(""); setNotice("")
    try {
      const published = await scorecardApi.publishTemplate(token, row.id)
      ++loadSequence.current
      setRows((current) => [published, ...current.filter((item) => item.id !== published.id)])
      setNotice("Scorecard template published.")
    } catch (cause) { setError(errorText(cause)) } finally { setBusy(false) }
  }
  function openUse(row: ScorecardTemplate) {
    setUseId(row.id); setNewCode(kpiIdentifierFromName(row.name))
    setSubjectType("employee"); setSubjectId(""); setPeriodId(""); setError("")
  }
  async function createFromTemplate(event: React.FormEvent) {
    event.preventDefault()
    if (busy || useId === null) return
    if (!newCode.trim() || !Number.isInteger(Number(subjectId)) || Number(subjectId) < 1 || !periodId) {
      setError("Enter an identifier, subject ID, and reporting period."); return
    }
    setBusy(true); setError("")
    try {
      const card = await scorecardApi.useTemplate(token, useId, { code: newCode.trim(), subjectType, subjectId: Number(subjectId), periodId: Number(periodId) })
      setUseId(null); router.push("/dashboard/kpi/scorecards/" + card.id)
    } catch (cause) { setError(errorText(cause)) } finally { setBusy(false) }
  }

  if (!scorecardsEnabled) return <p className="p-6">Scorecards are disabled in this environment.</p>
  return <div className="space-y-4">
    <KpiPageHeader title="Scorecard Templates" description="Save a reusable set of KPIs and scoring rules. Choose the person and reporting period when you use it." actions={<Link className="inline-flex h-8 items-center border border-border px-3 text-xs font-medium hover:bg-muted" href="/dashboard/kpi/scorecards">Back to scorecards</Link>} />
    {error && !open && useId === null && <KpiFeedback intent="error">{error}</KpiFeedback>}
    {notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}
    {canEdit && <Button appearance="primary" icon={<Add20Regular />} onClick={() => { reset(); setNotice(""); setOpen(true) }}>Create template</Button>}
    <section className="space-y-3" aria-label="Scorecard template library">
      <h2 className="text-xl font-semibold">Template library</h2>
      {loading ? <p className="text-sm text-muted-foreground">Loading templates…</p> : rows.length === 0 ? <p className="border-t border-border py-8 text-center text-sm text-muted-foreground">No templates yet. Create one to reuse a KPI structure.</p> :
        <div className="overflow-x-auto border-y border-border"><Table aria-label="Scorecard templates" size="small" className="min-w-[42rem] w-full">
          <TableHeader><TableRow><TableHeaderCell>Template</TableHeaderCell><TableHeaderCell>Mode</TableHeaderCell><TableHeaderCell>KPIs</TableHeaderCell><TableHeaderCell>Weight total</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell>Actions</TableHeaderCell></TableRow></TableHeader>
          <TableBody>{rows.map((row) => <TableRow key={row.id}>
            <TableCell><span className="block font-semibold">{row.name}</span><span className="text-xs text-muted-foreground">{row.code}</span></TableCell>
            <TableCell>{row.mode === "weighted" ? "Weighted score" : "Strategic status"}</TableCell>
            <TableCell>{row.items.length}</TableCell>
            <TableCell>{row.mode === "weighted" ? totalWeight(row.items).toFixed(2) + "%" : "Not used"}</TableCell>
            <TableCell><Badge appearance="outline" color={row.status === "published" ? "success" : "warning"}>{row.status === "published" ? "Published" : "Draft"}</Badge></TableCell>
            <TableCell><div className="flex flex-wrap gap-2">{canEdit && row.status === "draft" && <><Button appearance="subtle" size="small" onClick={() => edit(row)}>Edit</Button><Button appearance="subtle" size="small" disabled={busy} onClick={() => void publishRow(row)}>Publish</Button></>}{row.status === "published" && <Button appearance="subtle" size="small" onClick={() => openUse(row)}>Use template</Button>}</div></TableCell>
          </TableRow>)}</TableBody>
        </Table></div>}
    </section>

    <Dialog open={canEdit && open} onOpenChange={(_, data) => { if (!data.open) close() }}>
      <DialogSurface style={{ width: "min(92vw, 760px)", maxWidth: "none" }} className="!h-[min(90dvh,44rem)] !rounded-none !p-0">
        <DialogBody className="!flex h-full min-h-0 flex-col gap-0">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-5 sm:px-8"><DialogTitle className="text-xl font-semibold sm:text-2xl">{editing ? "Edit scorecard template" : "Create scorecard template"}</DialogTitle><Button appearance="subtle" icon={<Dismiss20Regular />} aria-label="Close template" onClick={close} /></div>
          <div className="shrink-0 border-b border-border px-6 py-4 sm:px-8"><div className="flex items-center justify-between text-sm"><strong>{steps[step]}</strong><span className="text-muted-foreground">Step {step + 1} of {steps.length}</span></div><ProgressBar className="mt-2" value={(step + 1) / steps.length} aria-label={"Step " + (step + 1) + " of " + steps.length} /><ol className="mt-3 grid grid-cols-4 gap-2">{steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={"flex min-w-0 items-center gap-2 text-xs " + (step === index ? "font-semibold text-primary" : "text-muted-foreground")}><span className={"flex size-6 shrink-0 items-center justify-center rounded-full border " + (index <= step ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{index + 1}</span><span className="hidden truncate sm:inline">{label}</span></li>)}</ol></div>
          <DialogContent style={{ padding: "clamp(24px, 3vw, 36px) clamp(24px, 4vw, 40px)" }} className="!m-0 min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-7">
              {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
              {step === 0 && <section className="space-y-6"><div><h3 className="text-lg font-semibold">Template details</h3><p className="mt-1 text-sm text-muted-foreground">Name the reusable KPI set and choose how it will be scored.</p></div>
                <Field label="Template name" required><Input className="w-full" value={name} maxLength={160} onChange={(_, data) => { if (!editing && (!code || code === kpiIdentifierFromName(name))) setCode(kpiIdentifierFromName(data.value)); setName(data.value) }} /></Field>
                <Field label="Identifier" hint="Generated from the name; you can change it before saving." required><Input className="w-full" value={code} maxLength={80} onChange={(_, data) => setCode(data.value.toUpperCase())} /></Field>
                <Field label="Scorecard mode" hint={mode === "weighted" ? "Each KPI contributes to one combined score using its weight." : "Shows KPI progress without one combined score."}><Dropdown className="w-full" value={mode === "weighted" ? "Weighted score" : "Strategic status only"} selectedOptions={[mode]} onOptionSelect={(_, data) => { const next = data.optionValue as "weighted" | "strategic"; setMode(next); if (next === "strategic") setItems((current) => current.map((item) => ({ ...item, weight: "0" }))) }}><Option value="weighted">Weighted score</Option><Option value="strategic">Strategic status only</Option></Dropdown></Field>
              </section>}
              {step === 1 && <section className="space-y-6"><div><h3 className="text-lg font-semibold">Select KPIs</h3><p className="mt-1 text-sm text-muted-foreground">Add published KPIs to this reusable template.</p></div>
                <div className="flex flex-wrap items-end gap-2"><Field label="Published KPI" className="min-w-[14rem] flex-1"><Dropdown className="w-full" value={definitions.find((row) => String(row.id) === selectedKpi)?.currentVersion?.name ?? "Select a KPI"} selectedOptions={selectedKpi ? [selectedKpi] : []} onOptionSelect={(_, data) => setSelectedKpi(data.optionValue ?? "")}><Option value="">Select a KPI</Option>{definitions.filter((row) => row.status === "published" && !items.some((item) => item.definitionId === row.id)).map((row) => <Option key={row.id} value={String(row.id)}>{row.currentVersion?.name ?? row.code}</Option>)}</Dropdown></Field><Button appearance="secondary" disabled={!selectedKpi} onClick={() => { setItems((current) => [...current, { definitionId: Number(selectedKpi), weight: mode === "strategic" ? "0" : "" }]); setSelectedKpi("") }}>Add KPI</Button></div>
                {items.length === 0 ? <p className="border-t border-border py-5 text-sm text-muted-foreground">No KPIs added yet.</p> : <ul className="divide-y divide-border border-y border-border">{items.map((item) => <li key={item.definitionId} className="flex items-center justify-between gap-3 py-3"><span>{kpiName(item.definitionId)}</span><Button appearance="subtle" icon={<Delete16Regular />} aria-label={"Remove " + kpiName(item.definitionId)} onClick={() => setItems((current) => current.filter((entry) => entry.definitionId !== item.definitionId))} /></li>)}</ul>}
              </section>}
              {step === 2 && <section className="space-y-6"><div><h3 className="text-lg font-semibold">Weights and policy</h3><p className="mt-1 text-sm text-muted-foreground">{mode === "weighted" ? "Give each KPI a share of the total. Weights must add up to 100%." : "Strategic scorecards track status, so weights are not used."}</p></div>
                {mode === "weighted" && <Field label="Published scoring policy" hint="Turns approved KPI results into a score. Required to publish a weighted template."><Dropdown className="w-full" value={publishedPolicies.find((row) => String(row.id) === policyId)?.label ?? "Select a policy"} selectedOptions={policyId ? [policyId] : []} onOptionSelect={(_, data) => setPolicyId(data.optionValue ?? "")}><Option value="">Select a policy</Option>{publishedPolicies.map((row) => <Option key={row.id} value={String(row.id)}>{row.label}</Option>)}</Dropdown></Field>}
                <div className="divide-y divide-border border-y border-border">{items.map((item) => <div key={item.definitionId} className="grid items-center gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:gap-5"><label htmlFor={"template-weight-" + item.definitionId} className="text-sm font-medium">{kpiName(item.definitionId)}</label>{mode === "weighted" ? <Input id={"template-weight-" + item.definitionId} aria-label={"Weight for " + kpiName(item.definitionId)} className="w-full" type="number" min={0} max={100} step="any" value={item.weight} contentAfter="%" onChange={(_, data) => setItems((current) => current.map((entry) => entry.definitionId === item.definitionId ? { ...entry, weight: data.value } : entry))} /> : <span className="text-sm text-muted-foreground">No weight</span>}</div>)}</div>
                {mode === "weighted" && <p className="text-sm font-semibold tabular-nums">Total weight: {totalWeight(items).toFixed(2)}% of 100%</p>}
              </section>}
              {step === 3 && <section className="space-y-6"><div><h3 className="text-lg font-semibold">Review template</h3><p className="mt-1 text-sm text-muted-foreground">Check the structure, then save a draft or publish it now.</p></div>
                <dl className="grid gap-5 border-y border-border py-5 text-sm sm:grid-cols-2">{[["Template", name], ["Identifier", code], ["Mode", mode === "weighted" ? "Weighted score" : "Strategic status"], ["KPIs", String(items.length)], ["Weight total", mode === "weighted" ? totalWeight(items).toFixed(2) + "%" : "Not used"], ["Scoring policy", publishedPolicies.find((row) => String(row.id) === policyId)?.label ?? "None selected"]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl>
                <ul className="divide-y divide-border">{items.map((item) => <li className="flex justify-between gap-3 py-2 text-sm" key={item.definitionId}><span>{kpiName(item.definitionId)}</span><span className="tabular-nums">{mode === "weighted" ? item.weight + "%" : "Status only"}</span></li>)}</ul>
              </section>}
            </div>
          </DialogContent>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 sm:px-8"><Button appearance="subtle" disabled={busy} onClick={close}>Cancel</Button><div className="flex flex-wrap gap-2">{step > 0 && <Button appearance="secondary" disabled={busy} onClick={() => { setError(""); setStep((current) => current - 1) }}>Back</Button>}{step < steps.length - 1 ? <Button appearance="primary" disabled={busy} onClick={next}>Continue</Button> : <><Button appearance="secondary" disabled={busy} onClick={() => void save(false)}>Save draft</Button><Button appearance="primary" disabled={busy} onClick={() => void save(true)}>{busy ? "Saving…" : "Save & publish"}</Button></>}</div></div>
        </DialogBody>
      </DialogSurface>
    </Dialog>

    <Dialog open={useId !== null} onOpenChange={(_, data) => { if (!data.open && !busy) { setUseId(null); setError("") } }}>
      <DialogSurface style={{ width: "min(92vw, 640px)", maxWidth: "none" }} className="!rounded-none !p-0">
        <DialogBody className="!flex flex-col gap-0">
          <div className="flex items-center justify-between border-b border-border px-6 py-4"><DialogTitle className="text-xl font-semibold">Use template</DialogTitle><Button appearance="subtle" icon={<Dismiss20Regular />} aria-label="Close" onClick={() => setUseId(null)} /></div>
          <DialogContent className="!m-0 space-y-5 !px-6 !py-6"><p className="text-sm text-muted-foreground">Choose who the scorecard is for and its reporting period.</p>{error && <KpiFeedback intent="error">{error}</KpiFeedback>}
            <form id="use-scorecard-template" className="space-y-5" onSubmit={(event) => void createFromTemplate(event)}>
              <Field label="New scorecard identifier" required><Input className="w-full" value={newCode} onChange={(_, data) => setNewCode(data.value.toUpperCase())} /></Field>
              <Field label="Subject type"><Dropdown className="w-full" value={subjectType.replaceAll("_", " ")} selectedOptions={[subjectType]} onOptionSelect={(_, data) => { setSubjectType(data.optionValue ?? "employee"); setSubjectId("") }}>{subjects.map((type) => <Option key={type} value={type}>{type.replaceAll("_", " ")}</Option>)}</Dropdown></Field>
              {["employee", "department", "branch"].includes(subjectType) ? <KpiSearchSelect label={subjectType === "employee" ? "Employee" : subjectType === "department" ? "Department" : "Branch"} value={subjectId} onChange={setSubjectId} load={loadSubjects} required fluentDropdown /> : <Field label="Subject ID" hint="ID of the selected group or organization." required><Input className="w-full" type="number" min={1} value={subjectId} onChange={(_, data) => setSubjectId(data.value)} /></Field>}
              <Field label="Reporting period" required><Dropdown className="w-full" value={periods.find((row) => String(row.id) === periodId)?.label ?? "Select period"} selectedOptions={periodId ? [periodId] : []} onOptionSelect={(_, data) => setPeriodId(data.optionValue ?? "")}><Option value="">Select period</Option>{periods.map((row) => <Option key={row.id} value={String(row.id)}>{row.label}</Option>)}</Dropdown></Field>
            </form>
          </DialogContent>
          <div className="flex justify-end gap-2 border-t border-border px-6 py-4"><Button appearance="secondary" disabled={busy} onClick={() => setUseId(null)}>Cancel</Button><Button type="submit" form="use-scorecard-template" appearance="primary" disabled={busy}>{busy ? "Creating…" : "Create scorecard draft"}</Button></div>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  </div>
}
