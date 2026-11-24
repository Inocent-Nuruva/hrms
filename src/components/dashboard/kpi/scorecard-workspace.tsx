"use client"
import { kpiIdentifierFromName } from "./kpi-identifier"

import { Badge, Button, Card, Checkbox, Dialog, DialogBody, DialogContent, DialogSurface, DialogTitle, Dropdown, Option, ProgressBar, Spinner, Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell, Text, Tooltip } from "@fluentui/react-components";
import { Dismiss16Regular, Info16Regular } from "@fluentui/react-icons";
import { KpiFluentInput } from "./kpi-fluent-fields";
import * as React from "react"
import { KpiFluentButton } from "./kpi-fluent-button"
import { KpiFeedback, KpiPageHeader, KpiStatusBadge } from "./kpi-page-elements"
import { useRouter } from "next/navigation"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { listBranches, listDepartments, listEmployees, type AdminRecord } from "@/lib/admin-api"
import { kpiApi, type KpiAssignment, type KpiPeriod } from "@/lib/kpi-api"
import { readKpiToken, scorecardsEnabled } from "@/lib/kpi-session"
import { scorecardApi, type Scorecard, type ScorecardCreate, type ScorecardDraft, type ScoringPolicy } from "@/lib/scorecard-api"
import { scorecardEmployeeNames } from "./scorecard-subject-names"
import { ScorecardDetail } from "./scorecard-detail"

const input = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
const selectInput = "w-full min-w-0"
const button = "rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
const roles = ["COMPANY_ADMIN", "HR_MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER"]
function errorText(error: unknown) { return error instanceof Error ? error.message : "Request failed" }
function directoryLabel(row: AdminRecord) {
  const read = (...keys: string[]) => keys.map((key) => row[key]).find((part): part is string => typeof part === "string" && !!part.trim())?.trim() ?? ""
  const fullName = [read("first_name", "firstName"), read("middle_name", "middleName"), read("last_name", "lastName")].filter(Boolean).join(" ")
  const name = fullName || read("full_name", "fullName", "display_name", "displayName", "name", "employee_name", "employeeName", "department_name", "departmentName", "branch_name", "branchName", "title")
  if (name) return name
  const employeeNo = read("employee_no", "employeeNo", "employee_number", "employeeNumber")
  return employeeNo ? `Employee (${employeeNo})` : "Unnamed"
}
function recordId(row: AdminRecord) { return Number(row.id ?? row.employee_id ?? row.employeeId ?? row.department_id ?? row.departmentId ?? row.branch_id ?? row.branchId) }
function targetSummary(target: Record<string, unknown> | undefined) { return target ? Object.values(target).map(String).join(" · ") : "Not set" }
function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="block space-y-1 text-sm"><span className="font-medium">{label}</span><KpiFluentInput className={input} type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></label>
}
function ScorecardDropdown({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; disabled?: boolean }) {
  const selected = options.find((option) => option.value === value)
  return <Dropdown aria-label={label} className={selectInput} button={{ className: "!w-full !min-w-0" }} value={selected?.label ?? ""} selectedOptions={selected ? [selected.value] : []} disabled={disabled} onOptionSelect={(_, data) => onChange(data.optionValue ?? "")}>
    {options.map((option) => <Option key={option.value} value={option.value} text={option.label}>{option.label}</Option>)}
  </Dropdown>
}
function weightTotal(rows: Array<{ weight: string }>) { return rows.reduce((sum, row) => sum + (Number.isFinite(Number(row.weight)) ? Math.round(Number(row.weight) * 10000) : 0), 0) / 10000 }

export function ScorecardList() {
  const actor = useDashboardActor(), router = useRouter()
  const [rows, setRows] = React.useState<Scorecard[]>([])
  const [employeeNames, setEmployeeNames] = React.useState<Record<number, string>>({})
  const [selectedScorecardId, setSelectedScorecardId] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  React.useEffect(() => {
    if (!scorecardsEnabled || !actor.ready) return
    const token = readKpiToken()
    if (!token) { setError("Sign in to view scorecards"); setLoading(false); return }
    void scorecardApi.list(token).then(async (scorecards) => {
      const names = await scorecardEmployeeNames(token, scorecards.filter((row) => row.subjectType === "employee").map((row) => row.subjectId))
      setEmployeeNames(names)
      setRows(scorecards)
    }).catch((e: unknown) => setError(errorText(e))).finally(() => setLoading(false))
  }, [actor.ready])
  if (!scorecardsEnabled) return <p className="p-6">Scorecards are disabled in this environment.</p>
  const canCreate = actor.roleNames.some((r) => roles.includes(r))
  const selectedScorecard = rows.find((row) => row.id === selectedScorecardId)
  function closeScorecard() {
    setSelectedScorecardId(null)
    const token = readKpiToken()
    if (token) void scorecardApi.list(token).then(setRows).catch((cause: unknown) => setError(errorText(cause)))
  }
  return <div className="space-y-0">
    <KpiPageHeader title="Scorecards" description="Review a person’s KPIs together for a reporting period." flushBelow actions={canCreate ? <Button appearance="subtle" onClick={() => router.push("/dashboard/kpi/scorecards/new")}>New scorecard</Button> : undefined} />
    {loading && <div className="py-4"><Spinner size="small" label="Loading scorecards" /></div>}
    {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
    {!loading && !error && rows.length === 0 && <Card appearance="outline" className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl p-8 text-center">
      <Text as="h2" size={400} weight="semibold">No scorecards yet</Text>
      <Text as="p" size={300} className="max-w-lg text-muted-foreground">Create a scorecard from a person’s KPI assignments to review their progress in one place.</Text>
    </Card>}
    {!loading && !error && rows.length > 0 && <Card appearance="outline" className="overflow-hidden rounded-xl p-0 shadow-sm">
      <div className="overflow-x-auto border-y border-border"><Table aria-label="KPI scorecards" size="small" className="min-w-[42rem] w-full text-left text-sm">
        <TableHeader><TableRow><TableHeaderCell className="p-3">Scorecard</TableHeaderCell><TableHeaderCell className="p-3">Type / owner</TableHeaderCell><TableHeaderCell className="p-3">Period</TableHeaderCell><TableHeaderCell className="p-3">KPIs</TableHeaderCell><TableHeaderCell className="p-3">Status</TableHeaderCell></TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.id} className="cursor-pointer hover:bg-muted/40" onClick={(event) => { if (event.target instanceof Element && event.target.closest("button, a")) return; setSelectedScorecardId(row.id) }}><TableCell className="p-3"><button type="button" className="text-left font-semibold hover:underline focus-visible:underline" onClick={() => setSelectedScorecardId(row.id)}>{row.currentVersion.name}</button><Text as="span" size={200} className="block text-muted-foreground">{row.code}</Text></TableCell><TableCell className="p-3">{row.subjectType === "employee" ? employeeNames[row.subjectId] ?? `Employee #${row.subjectId}` : `${row.subjectType.replaceAll("_", " ")} #${row.subjectId}`}</TableCell><TableCell className="p-3">{row.period.label}</TableCell><TableCell className="p-3">{row.entries.length}</TableCell><TableCell className="p-3"><KpiStatusBadge status={row.status} /></TableCell></TableRow>)}</TableBody>
      </Table></div>
    </Card>}
    <Dialog open={selectedScorecardId !== null} onOpenChange={(_, data) => { if (!data.open) closeScorecard() }}>
      <DialogSurface style={{ width: "min(1100px, calc(100vw - 32px))", maxWidth: "calc(100vw - 32px)", height: "min(900px, calc(100dvh - 32px))", maxHeight: "calc(100dvh - 32px)", padding: 0, overflow: "hidden" }}>
        <DialogBody style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0, gap: 0 }}>
          <DialogTitle style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
            <span className="min-w-0 break-words" style={{ fontFamily: "var(--font-fredoka), sans-serif", fontSize: "clamp(24px, 2.4vw, 32px)", fontWeight: 600, lineHeight: 1.15 }}>{selectedScorecard?.currentVersion.name ?? "Scorecard"}</span>
            <Button appearance="secondary" icon={<Dismiss16Regular aria-hidden="true" />} onClick={closeScorecard}>Close</Button>
          </DialogTitle>
          <DialogContent style={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: "auto", overflowX: "hidden", padding: "0 24px 24px" }}>
            {selectedScorecardId !== null && <ScorecardDetail key={selectedScorecardId} id={selectedScorecardId} embedded />}
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  </div>
}

export function ScorecardBuilder({ scorecardId }: { scorecardId?: number }) {
  const router = useRouter(), actor = useDashboardActor(), token = readKpiToken()
  const [assignments, setAssignments] = React.useState<KpiAssignment[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [periods, setPeriods] = React.useState<KpiPeriod[]>([])
  const [policies, setPolicies] = React.useState<ScoringPolicy[]>([])
  const [existing, setExisting] = React.useState<Scorecard | null>(null)
  const [code, setCode] = React.useState(""), [name, setName] = React.useState(""), [description, setDescription] = React.useState("")
  const [subjectType, setSubjectType] = React.useState("employee"), [subjectId, setSubjectId] = React.useState(""), [periodId, setPeriodId] = React.useState("")
  const [managerId, setManagerId] = React.useState(""), [mode, setMode] = React.useState<"weighted" | "strategic">("weighted")
  const [policyId, setPolicyId] = React.useState(""), [items, setItems] = React.useState<Array<{ assignmentId: number; weight: string; required: boolean }>>([])
  const [selected, setSelected] = React.useState(""), [error, setError] = React.useState(""), [notice, setNotice] = React.useState("")
  const [loading, setLoading] = React.useState(true), [busy, setBusy] = React.useState(false)
  const formRef = React.useRef<HTMLFormElement>(null)
  const savingRef = React.useRef(false)
  React.useEffect(() => {
    if (!actor.ready || !scorecardsEnabled || !token) return
    void Promise.all([kpiApi.assignments(token), kpiApi.periods(token), scorecardApi.policies(token), scorecardId ? scorecardApi.get(token, scorecardId) : Promise.resolve(null)])
      .then(([a, p, s, card]) => { setAssignments(a); setPeriods(p); setPolicies(s); if (card) { setExisting(card); setCode(card.code); setName(card.currentVersion.name); setDescription(card.currentVersion.description ?? ""); setSubjectType(card.subjectType); setSubjectId(String(card.subjectId)); setPeriodId(String(card.periodId)); setManagerId(card.managerEmployeeId ? String(card.managerEmployeeId) : ""); setMode(card.currentVersion.mode); setPolicyId(card.currentVersion.policyVersionId ? String(card.currentVersion.policyVersionId) : ""); setItems(card.currentVersion.entries.map((e) => ({ assignmentId: e.assignmentId, weight: e.weight, required: e.required }))) } })
      .catch((e: unknown) => setError(errorText(e))).finally(() => setLoading(false))
  }, [actor.ready, token, scorecardId])
  React.useEffect(() => {
    if (!actor.ready || !token) return
    let active = true
    void Promise.allSettled([listEmployees(token, { limit: 100 }), listDepartments(token, { limit: 100 }), listBranches(token, { limit: 100 })]).then(([employeeResult, departmentResult, branchResult]) => {
      if (!active) return
      if (employeeResult.status === "fulfilled") setEmployees(employeeResult.value.rows)
      if (departmentResult.status === "fulfilled") setDepartments(departmentResult.value.rows)
      if (branchResult.status === "fulfilled") setBranches(branchResult.value.rows)
    })
    return () => { active = false }
  }, [actor.ready, token])
  const canEdit = actor.roleNames.some((r) => roles.includes(r))
  const available = assignments.filter((a) => a.status === "active" && a.period?.id === Number(periodId) &&
    (subjectType === "organization" || (a.subjectType === subjectType && a.subjectId === Number(subjectId))) && !items.some((i) => i.assignmentId === a.id))
  const subjects = subjectType === "employee" ? employees : subjectType === "department" ? departments : subjectType === "branch" ? branches : []
  const total = weightTotal(items)
  async function save(event?: React.FormEvent, publishAfterSave = false) {
    event?.preventDefault(); if (savingRef.current) return
    if (!name.trim() || !code.trim() || !periodId || (subjectType !== "organization" && !subjectId)) { setError("Enter a name, subject, and reporting period before saving."); return }
    if (!items.length) { setError("Add at least one eligible KPI assignment. An authorized manager can create one in KPI Assignments."); return }
    if (items.some((item) => !Number.isFinite(Number(item.weight)) || Number(item.weight) < 0)) { setError("Weights must be non-negative numbers"); return }
    if (publishAfterSave && mode === "weighted" && total !== 100) { setError("Set the KPI weights to a total of 100% before publishing."); return }
    if (publishAfterSave && mode === "weighted" && !policyId) { setError("Choose a published scoring policy before publishing a weighted scorecard."); return }
    savingRef.current = true; setBusy(true); setError(""); setNotice("")
    try {
      const draft: ScorecardDraft = { name, description, mode, policyVersionId: policyId ? Number(policyId) : undefined, entries: items }
      const card = existing ? await scorecardApi.update(token, existing.id, draft) : await scorecardApi.create(token, { ...draft, code, subjectType, subjectId: Number(subjectId), periodId: Number(periodId), managerEmployeeId: managerId ? Number(managerId) : undefined } as ScorecardCreate)
      setExisting(card)
      if (publishAfterSave) await scorecardApi.publish(token, card.id)
      setNotice(publishAfterSave ? "Scorecard published" : "Draft scorecard saved"); router.push(`/dashboard/kpi/scorecards/${card.id}`)
    } catch (e) { setError(errorText(e)) } finally { savingRef.current = false; setBusy(false) }
  }
  if (!scorecardsEnabled) return <p className="p-6">Scorecards are disabled in this environment.</p>
  if (!actor.ready || loading) return <p className="p-6">Loading scorecard builder…</p>
  if (!canEdit) return <p role="alert" className="p-6">Scorecard editing is not available to your role.</p>
  if (existing?.currentVersion.publishedAt) return <p className="p-6">This configuration is published. Create a draft revision from its details page.</p>
  return <Dialog open onOpenChange={(_, data) => { if (!data.open && !busy) router.push("/dashboard/kpi/scorecards") }}>
    <DialogSurface style={{ width: "min(72rem, calc(100vw - 2rem))", maxWidth: "calc(100vw - 2rem)" }} className="max-h-[90vh] overflow-y-auto">
      <DialogBody>
        <DialogTitle><div className="flex items-center justify-between gap-4"><span>{existing ? "Edit draft scorecard" : "Create scorecard"}</span><Button appearance="secondary" disabled={busy} onClick={() => router.push("/dashboard/kpi/scorecards")}>Close</Button></div></DialogTitle>
        <DialogContent className="max-h-[calc(90vh-7rem)] space-y-5 overflow-y-auto">
          <p className="text-sm text-muted-foreground">Choose who the scorecard is for, select a reporting period, then add the matching KPI assignments.</p>
          {error && <KpiFeedback intent="error">{error}</KpiFeedback>}{notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}
          <form ref={formRef} onSubmit={(event) => void save(event)} className="space-y-4">
            <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
              <Field label="Scorecard identifier" value={code} onChange={setCode} required />
              <Field label="Scorecard name" value={name} onChange={(value) => { if (!existing && (!code || code === kpiIdentifierFromName(name))) setCode(kpiIdentifierFromName(value)); setName(value) }} required />
              <Field label="Description" value={description} onChange={setDescription} />
              <label className="space-y-1 text-sm"><span>Scorecard for</span><ScorecardDropdown label="Scorecard for" value={subjectType} disabled={!!existing} onChange={(value) => { setSubjectType(value); setSubjectId(""); setItems([]) }} options={["employee", "department", "branch", "manager_group", "organization"].map((value) => ({ value, label: value.replaceAll("_", " ") }))} /></label>
              {subjectType === "organization" ? <label className="space-y-1 text-sm"><span>Organization</span><ScorecardDropdown label="Organization" value={subjectId || "0"} disabled={!!existing} onChange={(value) => { setSubjectId(value); setItems([]) }} options={[{ value: "0", label: "Entire organization" }]} /></label> : subjectType === "manager_group" ? <Field label="Manager group ID" type="number" value={subjectId} onChange={(v) => { setSubjectId(v); setItems([]) }} required /> : <label className="space-y-1 text-sm"><span>{subjectType === "employee" ? "Employee" : subjectType === "department" ? "Department" : "Branch"}</span><ScorecardDropdown label={subjectType === "employee" ? "Employee" : subjectType === "department" ? "Department" : "Branch"} value={subjectId} disabled={!!existing} onChange={(value) => { setSubjectId(value); setItems([]) }} options={[{ value: "", label: `Select ${subjectType.replaceAll("_", " ")}` }, ...subjects.flatMap((row) => { const id = recordId(row); return Number.isInteger(id) && id > 0 ? [{ value: String(id), label: directoryLabel(row) }] : [] })]} /></label>}
              <label className="space-y-1 text-sm"><span>Reporting period</span><ScorecardDropdown label="Reporting period" value={periodId} disabled={!!existing} onChange={(value) => { setPeriodId(value); setItems([]) }} options={[{ value: "", label: "Select period" }, ...periods.map((period) => ({ value: String(period.id), label: `${period.label} · ${period.frequency}` }))]} /></label>
              <label className="space-y-1 text-sm"><span>Responsible manager <span className="text-muted-foreground">(optional)</span></span><ScorecardDropdown label="Responsible manager" value={managerId} onChange={setManagerId} options={[{ value: "", label: "No separate manager" }, ...employees.flatMap((row) => { const id = recordId(row); return Number.isInteger(id) && id > 0 ? [{ value: String(id), label: directoryLabel(row) }] : [] })]} /></label>
              <label className="space-y-1 text-sm"><span className="flex items-center gap-1.5">Scorecard mode<Tooltip relationship="description" content={<span><strong>Weighted evaluation:</strong> combines approved KPI results into one score. Each weight is that KPI’s share, and weights must total 100%.<br /><strong>Strategic status only:</strong> shows each KPI’s progress without calculating one overall score.</span>}><Button type="button" appearance="subtle" size="small" icon={<Info16Regular aria-hidden />} aria-label="Explain scorecard modes" /></Tooltip></span><ScorecardDropdown label="Scorecard mode" value={mode} onChange={(value) => { setMode(value as "weighted" | "strategic"); setItems((rows) => rows.map((row) => ({ ...row, weight: value === "strategic" ? "0" : row.weight }))) }} options={[{ value: "weighted", label: "Weighted evaluation" }, { value: "strategic", label: "Strategic status only" }]} /></label>
              <label className="space-y-1 text-sm"><span>Scoring policy <span className="text-muted-foreground">(optional)</span></span><ScorecardDropdown label="Scoring policy" value={policyId} onChange={setPolicyId} options={[{ value: "", label: "Choose a published policy" }, ...policies.flatMap((policy) => policy.versions.filter((version) => version.publishedAt).map((version) => ({ value: String(version.id), label: version.name })))]} /></label>
            </div>
            <section className="space-y-4 border-t border-border pt-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-semibold">KPI assignments</h2><p className="mt-1 text-sm text-muted-foreground">Only active assignments for this subject and reporting period are available. Include every active employee KPI before publishing a personal scorecard.</p></div><Badge appearance="outline" color={available.length ? "brand" : "informative"}>{items.length} selected</Badge></div>
              {subjectType === "employee" && !!subjectId && !!periodId && available.length > 0 && <KpiFeedback intent="warning">{available.length} active {available.length === 1 ? "KPI is" : "KPIs are"} still missing from this scorecard. Add {available.length === 1 ? "it" : "them"} before publishing.</KpiFeedback>}
              <div className="flex flex-wrap gap-2"><div className="min-w-0 flex-1"><ScorecardDropdown label="Available KPI assignment" value={selected} onChange={setSelected} options={[{ value: "", label: "Select an eligible KPI" }, ...available.map((assignment) => ({ value: String(assignment.id), label: `${assignment.definitionVersion?.name ?? "KPI"} · Target ${targetSummary(assignment.currentTarget?.target)}` }))]} /></div><KpiFluentButton type="button" className={button} disabled={!selected} onClick={() => { const id = Number(selected); if (items.some((i) => i.assignmentId === id)) return; setItems((rows) => [...rows, { assignmentId: id, weight: mode === "strategic" ? "0" : "", required: true }]); setSelected("") }}>Add KPI</KpiFluentButton></div>
              {available.length === 0 && <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{!subjectId || !periodId ? "Select a subject and reporting period to see eligible KPI assignments." : "No matching active assignments. Create an assignment for this subject and period first."}</p>}
              <div>{items.map((item) => { const a = assignments.find((row) => row.id === item.assignmentId); return <div key={item.assignmentId} className="grid items-end gap-3 border-b border-border py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto]"><div className="min-w-0"><b className="block truncate">{a?.definitionVersion?.name ?? "KPI assignment"}</b><p className="mt-1 text-xs text-muted-foreground">Target: {targetSummary(a?.currentTarget?.target)}</p></div><Field label={`Weight (%)`} type="number" value={item.weight} onChange={(value) => setItems((rows) => rows.map((r) => r.assignmentId === item.assignmentId ? { ...r, weight: value } : r))} /><Checkbox label="Required" checked={item.required} onChange={(_, data) => setItems((rows) => rows.map((r) => r.assignmentId === item.assignmentId ? { ...r, required: data.checked === true } : r))} /><KpiFluentButton type="button" className="text-sm text-red-700 underline" onClick={() => setItems((rows) => rows.filter((r) => r.assignmentId !== item.assignmentId))}>Remove</KpiFluentButton></div> })}</div>
              <p className="text-sm text-muted-foreground">Weight is each KPI’s share of the overall score. For example, a 60% weight means that KPI contributes 60% of the result. Weighted scorecards must add up to 100%.</p><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium">Weight total</span><span>{total.toFixed(2)}%</span></div><ProgressBar value={mode === "weighted" ? Math.max(0, Math.min(total / 100, 1)) : 1} /></div><Badge color={mode === "strategic" || total === 100 ? "success" : "warning"}>{mode === "strategic" ? "Weights not used" : total === 100 ? "Ready to publish" : "Weighted scorecards need 100%"}</Badge></div>
            </section>
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-card/95 py-3 backdrop-blur-sm"><Button appearance="secondary" disabled={busy} onClick={() => router.push("/dashboard/kpi/scorecards")}>Cancel</Button><Button type="submit" appearance="secondary" disabled={busy}>{busy ? "Saving…" : "Save draft"}</Button>{periodId && <Button type="button" appearance="primary" disabled={busy} onClick={() => void save(undefined, true)}>{busy ? "Publishing…" : "Save & publish"}</Button>}</div>
          </form>
        </DialogContent>
      </DialogBody>
    </DialogSurface>
  </Dialog>
}
