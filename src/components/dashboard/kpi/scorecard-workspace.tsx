"use client"

import { Button, Card, Checkbox, Spinner, Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell, Text } from "@fluentui/react-components";
import { KpiFluentInput, KpiFluentSelect } from "./kpi-fluent-fields";
import * as React from "react"
import { KpiFluentButton } from "./kpi-fluent-button"
import { KpiFeedback, KpiPageHeader, KpiStatusBadge } from "./kpi-page-elements"
import { KpiModeSelector, KpiWizardControls, KpiWizardProgress, type KpiEntryMode } from "./kpi-guided-flow"
import { useRouter } from "next/navigation"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { kpiApi, type KpiAssignment, type KpiPeriod } from "@/lib/kpi-api"
import { readKpiToken, scorecardsEnabled } from "@/lib/kpi-session"
import { scorecardApi, type Scorecard, type ScorecardCreate, type ScorecardDraft, type ScoringPolicy } from "@/lib/scorecard-api"
import { KpiWorkflowGuidancePanel } from "./kpi-workflow-guidance"
import type { KpiWorkflowGuidance } from "@/lib/kpi-workflow-api"

const input = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
const button = "rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
const roles = ["COMPANY_ADMIN", "HR_MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER"]
function errorText(error: unknown) { return error instanceof Error ? error.message : "Request failed" }
function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="block space-y-1 text-sm"><span className="font-medium">{label}</span><KpiFluentInput className={input} type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></label>
}
function weightTotal(rows: Array<{ weight: string }>) { return rows.reduce((sum, row) => sum + (Number.isFinite(Number(row.weight)) ? Math.round(Number(row.weight) * 10000) : 0), 0) / 10000 }

export function ScorecardList() {
  const actor = useDashboardActor()
  const [workflowGuidance, setWorkflowGuidance] = React.useState<KpiWorkflowGuidance | null>(null)
  const [rows, setRows] = React.useState<Scorecard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  React.useEffect(() => {
    if (!scorecardsEnabled || !actor.ready) return
    const token = readKpiToken()
    if (!token) { setError("Sign in to view scorecards"); setLoading(false); return }
    void scorecardApi.list(token).then(setRows).catch((e: unknown) => setError(errorText(e))).finally(() => setLoading(false))
  }, [actor.ready])
  if (!scorecardsEnabled) return <p className="p-6">Scorecards are disabled in this environment.</p>
  const canCreate = actor.roleNames.some((r) => roles.includes(r))
  const blockedCreate = workflowGuidance?.actions.find((action) => action.id === "create-scorecard" && action.blocked)
  return <div className="space-y-4 pt-3">
    <Card appearance="outline" className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2 shadow-sm">
      <div className="min-w-0 space-y-0.5">
        <Text as="h1" size={400} weight="semibold">Scorecards</Text>
        <Text as="p" size={200} className="max-w-3xl text-muted-foreground">Configure weighted KPIs and review approved results. Incomplete scorecards remain awaiting data.</Text>
      </div>
      <div className="flex flex-wrap gap-2">
        {canCreate && (blockedCreate ? <Button appearance="primary" disabled title={blockedCreate.reason}>New scorecard</Button> : <Button as="a" href="/dashboard/kpi/scorecards/new" appearance="primary">New scorecard</Button>)}
        {actor.roleNames.some((r) => ["COMPANY_ADMIN", "HR_MANAGER"].includes(r)) && <>
          <Button as="a" href="/dashboard/kpi/scoring-policies" appearance="secondary">Scoring policies</Button>
          <Button as="a" href="/dashboard/kpi/scorecard-templates" appearance="secondary">Templates</Button>
        </>}
      </div>
    </Card>
    <KpiWorkflowGuidancePanel compact onGuidance={setWorkflowGuidance} />
    {loading && <div className="py-4"><Spinner size="small" label="Loading scorecards" /></div>}
    {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
    {!loading && !error && rows.length === 0 && <Card appearance="outline" className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl p-8 text-center">
      <Text as="h2" size={400} weight="semibold">No scorecards yet</Text>
      <Text as="p" size={300} className="max-w-lg text-muted-foreground">Create a scorecard from existing KPI assignments to combine measures and review approved results.</Text>
      {canCreate && !blockedCreate && <Button as="a" href="/dashboard/kpi/scorecards/new" appearance="primary" className="mt-2">Create scorecard</Button>}
    </Card>}
    {!loading && !error && rows.length > 0 && <Card appearance="outline" className="overflow-hidden rounded-xl p-0 shadow-sm">
      <div className="overflow-x-auto"><Table aria-label="KPI scorecards" size="small" className="w-full text-left text-sm">
        <TableHeader><TableRow><TableHeaderCell className="p-3">Scorecard</TableHeaderCell><TableHeaderCell className="p-3">Type / owner</TableHeaderCell><TableHeaderCell className="p-3">Period</TableHeaderCell><TableHeaderCell className="p-3">KPIs</TableHeaderCell><TableHeaderCell className="p-3">Status</TableHeaderCell><TableHeaderCell className="p-3">Action</TableHeaderCell></TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell className="p-3"><Text weight="semibold">{row.currentVersion.name}</Text><Text as="span" size={200} className="block text-muted-foreground">{row.code}</Text></TableCell><TableCell className="p-3 capitalize">{row.subjectType.replaceAll("_", " ")} #{row.subjectId}</TableCell><TableCell className="p-3">{row.period.label}</TableCell><TableCell className="p-3">{row.entries.length}</TableCell><TableCell className="p-3"><KpiStatusBadge status={row.status} /></TableCell><TableCell className="p-3"><Button as="a" href={`/dashboard/kpi/scorecards/${row.id}`} appearance="subtle">View details</Button></TableCell></TableRow>)}</TableBody>
      </Table></div>
    </Card>}
  </div>
}

export function ScorecardBuilder({ scorecardId }: { scorecardId?: number }) {
  const router = useRouter(), actor = useDashboardActor(), token = readKpiToken()
  const [assignments, setAssignments] = React.useState<KpiAssignment[]>([])
  const [periods, setPeriods] = React.useState<KpiPeriod[]>([])
  const [policies, setPolicies] = React.useState<ScoringPolicy[]>([])
  const [existing, setExisting] = React.useState<Scorecard | null>(null)
  const [code, setCode] = React.useState(""), [name, setName] = React.useState(""), [description, setDescription] = React.useState("")
  const [subjectType, setSubjectType] = React.useState("employee"), [subjectId, setSubjectId] = React.useState(""), [periodId, setPeriodId] = React.useState("")
  const [managerId, setManagerId] = React.useState(""), [mode, setMode] = React.useState<"weighted" | "strategic">("weighted")
  const [policyId, setPolicyId] = React.useState(""), [items, setItems] = React.useState<Array<{ assignmentId: number; weight: string; required: boolean }>>([])
  const [selected, setSelected] = React.useState(""), [error, setError] = React.useState(""), [notice, setNotice] = React.useState("")
  const [loading, setLoading] = React.useState(true), [busy, setBusy] = React.useState(false)
  const [entryMode, setEntryMode] = React.useState<KpiEntryMode>(scorecardId ? "manual" : "choose")
  const [wizardStep, setWizardStep] = React.useState(0)
  const [publishAfterSave, setPublishAfterSave] = React.useState(false)
  const formRef = React.useRef<HTMLFormElement>(null)
  const savingRef = React.useRef(false)
  const wizardSteps = [
    { title: "Scorecard details", description: "Choose an existing subject and reporting period." },
    { title: "Select assigned KPIs", description: "Only matching, active KPI assignments can be added." },
    { title: "Configure weights", description: "Weighted scorecards need exactly 100% when published." },
    { title: "Scoring policy", description: "Use an existing published policy; unapproved actuals never contribute." },
    { title: "Review and save", description: "Save a draft, then publish from scorecard details after validation." },
  ]
  React.useEffect(() => {
    if (!actor.ready || !scorecardsEnabled || !token) return
    void Promise.all([kpiApi.assignments(token), kpiApi.periods(token), scorecardApi.policies(token), scorecardId ? scorecardApi.get(token, scorecardId) : Promise.resolve(null)])
      .then(([a, p, s, card]) => { setAssignments(a); setPeriods(p); setPolicies(s); if (card) { setExisting(card); setCode(card.code); setName(card.currentVersion.name); setDescription(card.currentVersion.description ?? ""); setSubjectType(card.subjectType); setSubjectId(String(card.subjectId)); setPeriodId(String(card.periodId)); setManagerId(card.managerEmployeeId ? String(card.managerEmployeeId) : ""); setMode(card.currentVersion.mode); setPolicyId(card.currentVersion.policyVersionId ? String(card.currentVersion.policyVersionId) : ""); setItems(card.currentVersion.entries.map((e) => ({ assignmentId: e.assignmentId, weight: e.weight, required: e.required }))) } })
      .catch((e: unknown) => setError(errorText(e))).finally(() => setLoading(false))
  }, [actor.ready, token, scorecardId])
  const canEdit = actor.roleNames.some((r) => roles.includes(r))
  const available = assignments.filter((a) => a.status === "active" && a.period?.id === Number(periodId) &&
    (subjectType === "organization" || (a.subjectType === subjectType && a.subjectId === Number(subjectId))) && !items.some((i) => i.assignmentId === a.id))
  const total = weightTotal(items)
  function advanceWizard() {
    if (wizardStep === 0 && (!code.trim() || !name.trim() || !Number(subjectId) || !Number(periodId))) { setError("Enter a code, name, subject and reporting period."); return }
    if (wizardStep === 1 && !items.length) { setError("Add at least one matching KPI assignment."); return }
    if (wizardStep === 2 && (items.some((item) => !Number.isFinite(Number(item.weight)) || Number(item.weight) < 0) || (mode === "weighted" && total !== 100))) { setError("Enter valid weights totaling 100% for a weighted scorecard."); return }
    setError(""); setWizardStep((current) => Math.min(current + 1, wizardSteps.length - 1))
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (savingRef.current) return
    if (!items.length) { setError("Add at least one eligible KPI assignment. An authorized manager can create one in KPI Assignments."); return }
    if (items.some((item) => !Number.isFinite(Number(item.weight)) || Number(item.weight) < 0)) { setError("Weights must be non-negative numbers"); return }
    savingRef.current = true; setBusy(true); setError(""); setNotice("")
    let draftSaved = false
    try {
      const draft: ScorecardDraft = { name, description, mode, policyVersionId: policyId ? Number(policyId) : undefined, entries: items }
      const card = existing ? await scorecardApi.update(token, existing.id, draft) : await scorecardApi.create(token, { ...draft, code, subjectType, subjectId: Number(subjectId), periodId: Number(periodId), managerEmployeeId: managerId ? Number(managerId) : undefined } as ScorecardCreate)
      setExisting(card)
      draftSaved = true
      if (entryMode === "guided" && publishAfterSave) await scorecardApi.publish(token, card.id)
      setNotice(entryMode === "guided" && publishAfterSave ? "Scorecard configuration published" : "Draft scorecard saved"); router.push(`/dashboard/kpi/scorecards/${card.id}`)
    } catch (e) { setError(draftSaved ? `Draft saved, but publication failed: ${errorText(e)}` : errorText(e)) } finally { savingRef.current = false; setBusy(false) }
  }
  if (!scorecardsEnabled) return <p className="p-6">Scorecards are disabled in this environment.</p>
  if (!actor.ready || loading) return <p className="p-6">Loading scorecard builder…</p>
  if (!canEdit) return <p role="alert" className="p-6">Scorecard editing is not available to your role.</p>
  if (existing?.currentVersion.publishedAt) return <p className="p-6">This configuration is published. Create a draft revision from its details page.</p>
  return <div className="space-y-4 pt-3"><KpiPageHeader title={existing ? "Edit Draft Scorecard" : "Create Scorecard"} description="Configure eligible KPI assignments, weights and an approved scoring policy." actions={<Button as="a" href="/dashboard/kpi/scorecards" appearance="secondary">Back to Scorecards</Button>} />{!existing && entryMode === "choose" && <KpiModeSelector title="Scorecard" description="Follow the existing scorecard configuration in five guided stages." onSelect={setEntryMode} blockedReason={!periods.length ? "Create a reporting period before configuring a scorecard." : !assignments.some((row) => row.status === "active" && !!row.currentTarget) ? "Create an active KPI assignment with a target before configuring a scorecard." : undefined} resolveHref={!periods.length ? "/dashboard/kpi/periods" : "/dashboard/kpi/assignments"} owner="HR or authorized manager" />}{entryMode === "guided" && <KpiWizardProgress steps={wizardSteps} step={wizardStep} />}{error && <KpiFeedback intent="error">{error}</KpiFeedback>}{notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}{entryMode !== "choose" && <form ref={formRef} onSubmit={(event) => void save(event)} className="space-y-6"><div hidden={entryMode === "guided" && wizardStep !== 0 && wizardStep !== 3} className="grid gap-4 rounded-lg border p-5 md:grid-cols-2"><Field label="Scorecard identifier" value={code} onChange={setCode} required /><Field label="Scorecard name" value={name} onChange={setName} required /><Field label="Description" value={description} onChange={setDescription} /><label className="space-y-1 text-sm"><span>Scorecard type</span><KpiFluentSelect className={input} value={subjectType} disabled={!!existing} onChange={(e) => { setSubjectType(e.target.value); setItems([]) }}>{["employee", "department", "branch", "manager_group", "organization"].map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</KpiFluentSelect></label><Field label="Owner or subject ID" type="number" value={subjectId} onChange={(v) => { setSubjectId(v); setItems([]) }} required /><label className="space-y-1 text-sm"><span>Reporting period</span><KpiFluentSelect aria-label="Reporting period" className={input} value={periodId} disabled={!!existing} onChange={(e) => { setPeriodId(e.target.value); setItems([]) }} required><option value="">Select period</option>{periods.map((p) => <option key={p.id} value={p.id}>{p.label} · {p.frequency}</option>)}</KpiFluentSelect></label><Field label="Responsible manager employee ID" type="number" value={managerId} onChange={setManagerId} /><label className="space-y-1 text-sm"><span>Scorecard mode</span><KpiFluentSelect aria-label="Scorecard mode" className={input} value={mode} onChange={(e) => { setMode(e.target.value as "weighted" | "strategic"); setItems((rows) => rows.map((row) => ({ ...row, weight: e.target.value === "strategic" ? "0" : row.weight }))) }}><option value="weighted">Weighted evaluation</option><option value="strategic">Strategic status only</option></KpiFluentSelect></label><label className="space-y-1 text-sm"><span>Scoring policy</span><KpiFluentSelect aria-label="Scoring policy" className={input} value={policyId} onChange={(e) => setPolicyId(e.target.value)}><option value="">Select a published policy</option>{policies.flatMap((policy) => policy.versions.filter((v) => v.publishedAt).map((v) => <option key={v.id} value={v.id}>{policy.code} · v{v.version} · {v.name}</option>))}</KpiFluentSelect></label></div><section hidden={entryMode === "guided" && wizardStep !== 1 && wizardStep !== 2} className="space-y-3 rounded-lg border p-5"><h2 className="text-lg font-semibold">KPI assignments</h2><p className="text-sm text-muted-foreground">Choose existing active assignments for the selected subject and period.</p><div className="flex flex-wrap gap-2"><KpiFluentSelect aria-label="Available KPI assignment" className={`${input} max-w-xl`} value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Select an assignment</option>{available.map((a) => <option key={a.id} value={a.id}>{a.definitionVersion?.name} · #{a.id} · {a.period?.label}</option>)}</KpiFluentSelect><KpiFluentButton type="button" className={button} disabled={!selected} onClick={() => { const id = Number(selected); if (items.some((i) => i.assignmentId === id)) return; setItems((rows) => [...rows, { assignmentId: id, weight: mode === "strategic" ? "0" : "", required: true }]); setSelected("") }}>Add KPI</KpiFluentButton></div>{available.length === 0 && <p className="text-sm text-muted-foreground">No matching assignments available. Create assignments in KPI Management first.</p>}<div className="space-y-2">{items.map((item) => { const a = assignments.find((row) => row.id === item.assignmentId); return <div key={item.assignmentId} className="grid items-end gap-2 rounded border p-3 sm:grid-cols-[1fr_8rem_7rem_auto]"><div><b>{a?.definitionVersion?.name ?? `Assignment #${item.assignmentId}`}</b><p className="text-xs text-muted-foreground">Target revision {a?.currentTarget?.revision ?? "—"}</p></div><Field label={`Weight for ${a?.definitionVersion?.name ?? item.assignmentId} (%)`} type="number" value={item.weight} onChange={(value) => setItems((rows) => rows.map((r) => r.assignmentId === item.assignmentId ? { ...r, weight: value } : r))} /><Checkbox label="Required" checked={item.required} onChange={(_, data) => setItems((rows) => rows.map((r) => r.assignmentId === item.assignmentId ? { ...r, required: data.checked === true } : r))} /><KpiFluentButton type="button" className="text-sm text-red-700 underline" onClick={() => setItems((rows) => rows.filter((r) => r.assignmentId !== item.assignmentId))}>Remove</KpiFluentButton></div> })}</div><p className={`text-sm font-medium ${mode === "weighted" && total !== 100 ? "text-amber-700" : "text-green-700"}`}>Draft weight total: {total.toFixed(4)}% {mode === "weighted" && total !== 100 ? "· Must equal 100% to publish" : ""}</p></section><section hidden={entryMode === "guided" && wizardStep !== 4} className="rounded-lg border p-5"><h2 className="font-semibold">Structure preview</h2><p className="mt-1 text-sm">{name || "Untitled scorecard"} · {subjectType} #{subjectId || "—"} · {periods.find((p) => p.id === Number(periodId))?.label ?? "No period"}</p><p className="mt-1 text-sm text-muted-foreground">Actuals and results: Awaiting Data</p>{entryMode === "guided" && <label className="mt-4 block max-w-sm text-sm">Save action<KpiFluentSelect aria-label="Save action" value={publishAfterSave ? "publish" : "draft"} onChange={(event) => setPublishAfterSave(event.target.value === "publish")}><option value="draft">Save draft</option><option value="publish">Save and publish</option></KpiFluentSelect></label>}</section>{entryMode === "manual" && <KpiFluentButton className={button} disabled={busy}>{busy ? "Saving…" : "Save draft scorecard"}</KpiFluentButton>}</form>}{entryMode === "guided" && <KpiWizardControls step={wizardStep} steps={wizardSteps} busy={busy} onBack={() => { setError(""); setWizardStep((current) => current - 1) }} onNext={advanceWizard} onCancel={() => setEntryMode("choose")} onFinish={() => formRef.current?.requestSubmit()} finishLabel={publishAfterSave ? "Save and publish" : "Save draft scorecard"} confirmFinish={publishAfterSave} error={error} />}</div>
}
