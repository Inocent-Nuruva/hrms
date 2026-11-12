"use client"

import { Button, Dialog, DialogBody, DialogContent, DialogSurface, DialogTitle, Dropdown, Option, Menu, MenuButton, MenuItem, MenuList, MenuPopover, MenuTrigger, Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from "@fluentui/react-components";
import { MoreHorizontal20Regular } from "@fluentui/react-icons";
import { fluentConfirm } from "@/components/ui/fluent-dialog-service"
import { KpiFluentInput, KpiFluentSelect } from "./kpi-fluent-fields";
import * as React from "react"
import { KpiFluentButton } from "./kpi-fluent-button"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Field as FluentField, Input as FluentInput } from "@fluentui/react-components"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { listBranches, listDepartments, listEmployees, type AdminRecord } from "@/lib/admin-api"
import { kpiApi, type KpiAssignment, type KpiDefinition, type KpiDefinitionForm, type KpiPeriod, type KpiTemplate } from "@/lib/kpi-api"
import { kpiEnabled, readKpiToken } from "@/lib/kpi-session"
import { FluentSearchBox } from "@/components/common/fluent-search-box"
import { FluentSelect as FluentDropdownSelect } from "@/components/ui/fluent-select"
import { KpiFeedback, KpiLoading, KpiPageHeader, KpiStatusBadge } from "./kpi-page-elements"
import { KpiCreationWizard } from "./kpi-creation-wizard"
import { validateKpiDefinition } from "./kpi-definition-validation"
import { targetFor } from "./kpi-target-input"
import { KpiModeSelector, type KpiEntryMode } from "./kpi-guided-flow"
import { KpiAssignmentWizard, KpiPeriodWizard, KpiTemplateWizard } from "./kpi-setup-wizards"
import { KpiWorkflowGuidancePanel } from "./kpi-workflow-guidance"
import type { KpiWorkflowGuidance } from "@/lib/kpi-workflow-api"

const fields: KpiDefinitionForm = { code: "", name: "", description: "", category: "", strategicObjective: "", measurementType: "numeric", measurementUnit: "", direction: "higher", frequency: "monthly" }
const pageCopy: Record<string, { title: string; description: string }> = {
  library: { title: "KPI Library", description: "Define measures once, then publish a version before assigning it." },
  create: { title: "Create KPI", description: "Configure a reusable measure. Drafts can be edited before publication." },
  templates: { title: "KPI Templates", description: "Create reusable KPI setups to make new KPIs faster. Set targets when assigning a KPI." },
  periods: { title: "Reporting Periods", description: "Set the dates used by KPI assignments and scorecards." },
  assignments: { title: "KPI Assignments", description: "Assign published definitions to permitted employees or organizational subjects." },
  targets: { title: "Target Revisions", description: "Change an assigned target with a reason while keeping its revision history." },
}
const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
const buttonClass = "rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"

function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Request failed" }
function targetText(target: Record<string, unknown> | undefined) { return target ? Object.entries(target).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : "—" }
function Field({ label, value, onChange, required = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return <FluentField label={label} required={required} className="w-full" size="medium">
    {type === "date"
      ? <KpiFluentInput className={inputClass} value={value} type="date" required={required} onChange={(event) => onChange(event.target.value)} />
      : <FluentInput className="w-full" value={value} type={type === "number" ? "number" : "text"} required={required} onChange={(_, data) => onChange(data.value)} />}
  </FluentField>
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <FluentDropdownSelect
    label={label}
    value={value}
    onChange={onChange}
    options={options.map((option) => ({
      value: option,
      label: option.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase()),
    }))}
    size="medium"
  />
}

export function KpiWorkspace({ view = "library" }: { view?: string }) {
  const router = useRouter()
  const actor = useDashboardActor()
  const canDefine = actor.roleNames?.some((role) => ["COMPANY_ADMIN", "HR_MANAGER"].includes(role)) ?? false
  const legacyCanAssign = actor.roleNames?.some((role) => ["COMPANY_ADMIN", "HR_MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER"].includes(role)) ?? false
  const canAssign = legacyCanAssign || actor.permissionLabels.includes("kpi_assignments:create")
  const canUpdateAssignment = legacyCanAssign || actor.permissionLabels.includes("kpi_assignments:update")
  const hasLegacyManagementRole = actor.roleNames?.some((role) => ["COMPANY_ADMIN", "HR_MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER", "MANAGEMENT"].includes(role)) ?? false
  const canRead = hasLegacyManagementRole || actor.permissionLabels.includes("kpi_assignments:read")
  const [definitions, setDefinitions] = React.useState<KpiDefinition[]>([])
  const [templates, setTemplates] = React.useState<KpiTemplate[]>([])
  const [periods, setPeriods] = React.useState<KpiPeriod[]>([])
  const [assignments, setAssignments] = React.useState<KpiAssignment[]>([])
  const [workflowGuidance, setWorkflowGuidance] = React.useState<KpiWorkflowGuidance | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [showTemplateForm, setShowTemplateForm] = React.useState(false)
  const [showPeriodForm, setShowPeriodForm] = React.useState(false)
  const [showAssignmentForm, setShowAssignmentForm] = React.useState(false)
  const [viewTemplateId, setViewTemplateId] = React.useState<number | null>(null)
  const [useTemplateId, setUseTemplateId] = React.useState<number | null>(null)
  const [newKpiCode, setNewKpiCode] = React.useState("")
  const [creationMode, setCreationMode] = React.useState<"guided" | "manual">("guided")
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [setupMode, setSetupMode] = React.useState<KpiEntryMode>("choose")
  const [form, setForm] = React.useState<KpiDefinitionForm>(fields)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [classification, setClassification] = React.useState("")
  const [periodForm, setPeriodForm] = React.useState({ frequency: "monthly", label: "", startDate: "", endDate: "" })
  const [assignmentForm, setAssignmentForm] = React.useState({ definitionId: "", periodId: "", subjectType: "employee", subjectId: "", managerEmployeeId: "", target: "" })
  const [targetForm, setTargetForm] = React.useState({ assignmentId: "", target: "", reason: "" })
  const [subjectOptions, setSubjectOptions] = React.useState<AdminRecord[]>([])
  const token = readKpiToken()
  const load = React.useCallback(async (options?: { silent?: boolean }) => {
    if (!kpiEnabled || !canRead || !token) { setLoading(false); return }
    if (!options?.silent) setLoading(true)
    setError("")
    try {
      const [d, t, p, a] = await Promise.all([kpiApi.definitions(token), canDefine ? kpiApi.templates(token) : Promise.resolve([]), kpiApi.periods(token), kpiApi.assignments(token)])
      setDefinitions(d); setTemplates(t); setPeriods(p); setAssignments(a)
    } catch (err) { setError(errorMessage(err)) } finally { if (!options?.silent) setLoading(false) }
  }, [canRead, canDefine, token, setError, setAssignments, setDefinitions, setTemplates, setPeriods, setLoading])
  React.useEffect(() => { void load() }, [load])
  React.useEffect(() => {
    if (view !== "assignments") return
    const params = new URLSearchParams(window.location.search)
    const definitionId = Number(params.get("definition"))
    if (Number.isInteger(definitionId) && definitionId > 0) {
      const periodId = Number(params.get("period"))
      setAssignmentForm((current) => ({ ...current, definitionId: String(definitionId), ...(Number.isInteger(periodId) && periodId > 0 ? { periodId: String(periodId) } : {}) }))
      setShowAssignmentForm(true)
    }
  }, [view])
  React.useEffect(() => {
    if (view !== "targets") return
    const assignmentId = Number(new URLSearchParams(window.location.search).get("assignment"))
    if (Number.isInteger(assignmentId) && assignmentId > 0) {
      setTargetForm((current) => ({ ...current, assignmentId: String(assignmentId) }))
    }
  }, [view])
  React.useEffect(() => {
    if (!canAssign || !token || view !== "assignments") return
    const request = assignmentForm.subjectType === "department"
      ? listDepartments(token, { limit: 100 })
      : assignmentForm.subjectType === "branch"
        ? listBranches(token, { limit: 100 })
        : listEmployees(token, { limit: 100 })
    void request.then((result) => setSubjectOptions(result.rows)).catch(() => setSubjectOptions([]))
  }, [canAssign, token, view, assignmentForm.subjectType])
  React.useEffect(() => {
    if (view !== "create" || !canDefine || !token) return
    const params = new URLSearchParams(window.location.search)
    const id = Number(params.get("edit"))
    if (params.get("mode") === "guided") setCreationMode("guided")
    if (params.get("mode") === "manual" || (Number.isInteger(id) && id > 0)) setCreationMode("manual")
    if (!Number.isInteger(id) || id <= 0) return
    void kpiApi.definition(token, id).then((definition) => {
      const draft = definition.versions?.[0]
      if (!draft || draft.publishedAt) throw new Error("This KPI has no editable draft")
      setEditingId(id)
      setForm({ code: definition.code, name: draft.name, description: draft.description ?? "", category: draft.category, strategicObjective: draft.strategicObjective ?? "", measurementType: draft.measurementType, measurementUnit: draft.measurementUnit ?? "", direction: draft.direction, frequency: draft.frequency })
    }).catch((err: unknown) => setError(errorMessage(err)))
  }, [view, canDefine, token])
  async function action(task: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("")
    try { await task(); setNotice(success); await load({ silent: true }); window.dispatchEvent(new Event("hrms:refresh-page-data")); return true } catch (err) { setError(errorMessage(err)); return false } finally { setBusy(false) }
  }
  async function createKpiFromTemplate(publish: boolean) {
    const template = templates.find((row) => row.id === useTemplateId)
    if (!template || !newKpiCode.trim()) { setError("Enter a new KPI identifier before continuing."); return }
    const saved = await action(async () => {
      const draft = await kpiApi.createFromTemplate(token, template.id, newKpiCode.trim())
      return publish ? kpiApi.publishDefinition(token, draft.id) : draft
    }, publish ? "KPI created and published. It is ready to be assigned." : "KPI saved as a draft. You can review and publish it later.")
    if (saved) { setUseTemplateId(null); setNewKpiCode("") }
  }
  function setField<K extends keyof KpiDefinitionForm>(key: K, value: KpiDefinitionForm[K]) { setForm((current) => ({ ...current, [key]: value })) }
  const filteredDefinitions = definitions.filter((row) =>
    (statusFilter === "all" || row.status === statusFilter || (statusFilter === "draft" && row.status !== "archived" && (!!row.draftVersion || !row.currentVersion?.publishedAt))) &&
    `${row.code} ${row.currentVersion?.name ?? ""} ${row.currentVersion?.category ?? ""}`.toLowerCase().includes(search.toLowerCase()))
  const filteredTemplates = templates.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(search.toLowerCase()))
  const selectedAssignment = assignments.find((row) => row.id === Number(targetForm.assignmentId))
  const canReviseTarget = legacyCanAssign || actor.permissionLabels.includes("kpi_targets:revise")
  const blockedAssignment = workflowGuidance?.actions.find((item) => item.id === "create-assignment" && item.blocked)
  if (!kpiEnabled) return <p className="p-6 text-sm">KPI Phase 1A is disabled in this environment.</p>
  if (!actor.ready) return <p className="p-6 text-sm">Checking access…</p>
  if (!canRead) return <p className="p-6 text-sm" role="alert">You do not have KPI management access.</p>
  const page = pageCopy[view] ?? pageCopy.library
  const isDefinitionForm = view === "create" || view === "library"
  const openCreateDialog = () => { setForm(fields); setEditingId(null); setCreationMode("guided"); setError(""); setCreateDialogOpen(true) }
  const manualForm = <form aria-label={isDefinitionForm ? "Create KPI definition" : "Create KPI template"} className={`grid gap-x-6 gap-y-5 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6 md:grid-cols-2 ${isDefinitionForm ? "max-w-5xl" : ""}`} onSubmit={(event) => { event.preventDefault(); const problem = validateKpiDefinition(form); if (problem) { setError(problem); return } void action(() => isDefinitionForm ? editingId ? kpiApi.updateDefinition(token, editingId, form) : kpiApi.createDefinition(token, form) : editingId ? kpiApi.updateTemplate(token, editingId, { ...form, departmentClassification: classification }) : kpiApi.createTemplate(token, { ...form, departmentClassification: classification }), isDefinitionForm ? "KPI definition saved" : "Template saved").then((saved) => { if (saved && isDefinitionForm && view === "library") setCreateDialogOpen(false) }) }}>
      <Field label="Identifier" value={form.code} onChange={(v) => setField("code", v)} required /><Field label="Name" value={form.name} onChange={(v) => setField("name", v)} required />
      <Field label="Description" value={form.description ?? ""} onChange={(v) => setField("description", v)} /><Field label="Category" value={form.category} onChange={(v) => setField("category", v)} required />
      <Field label="Strategic objective" value={form.strategicObjective ?? ""} onChange={(v) => setField("strategicObjective", v)} />
      {!isDefinitionForm && <Field label="Department classification" value={classification} onChange={setClassification} />}
      <Select label="Measurement type" value={form.measurementType} onChange={(v) => setForm((current) => ({ ...current, measurementType: v, direction: ["binary", "milestone", "qualitative"].includes(v) ? "not_applicable" : "higher", measurementUnit: v === "percentage" ? "%" : "" }))} options={["numeric", "percentage", "currency", "duration", "binary", "milestone", "qualitative"]} />
      <Field label="Unit (ISO currency / duration unit when applicable)" value={form.measurementUnit ?? ""} onChange={(v) => setField("measurementUnit", v)} />
      <Select label="Direction" value={form.direction} onChange={(v) => setField("direction", v)} options={["higher", "lower", "exact", "range", "not_applicable"]} />
      <Select label="Frequency" value={form.frequency} onChange={(v) => setField("frequency", v)} options={["monthly", "quarterly", "semiannual", "annual"]} />
      {isDefinitionForm && <Field label="Owner employee ID (optional)" type="number" value={form.ownerEmployeeId?.toString() ?? ""} onChange={(v) => setField("ownerEmployeeId", v ? Number(v) : undefined)} />}
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5 md:col-span-2"><KpiFluentButton className={buttonClass} disabled={busy}>{busy ? "Saving…" : editingId ? "Save draft" : isDefinitionForm ? "Create draft KPI" : "Create draft template"}</KpiFluentButton>{editingId && <KpiFluentButton type="button" className="text-sm underline" onClick={() => { setEditingId(null); setForm(fields) }}>Cancel edit</KpiFluentButton>}</div>
    </form>
  return <div className="space-y-4 pt-3">
    {view === "library" && <h1 className="sr-only">KPI Library</h1>}
    {view !== "library" && <KpiPageHeader title={page.title} description={page.description} actions={<>
        {view === "templates" && canDefine && <KpiFluentButton type="button" className={buttonClass} onClick={() => { if (showTemplateForm) { setShowTemplateForm(false); setSetupMode("choose"); return } setEditingId(null); setForm(fields); setSetupMode("guided"); setShowTemplateForm(true) }}>{showTemplateForm ? "Close form" : "Create template"}</KpiFluentButton>}
        {view === "periods" && canDefine && <KpiFluentButton type="button" className={buttonClass} onClick={() => { setSetupMode("choose"); setShowPeriodForm((value) => !value) }}>{showPeriodForm ? "Close form" : "Create period"}</KpiFluentButton>}
        {view === "assignments" && canAssign && <KpiFluentButton type="button" className={buttonClass} disabled={!!blockedAssignment} title={blockedAssignment?.reason} onClick={() => { setSetupMode("choose"); setShowAssignmentForm((value) => !value) }}>{showAssignmentForm ? "Close form" : "Assign KPI"}</KpiFluentButton>}
        {view === "targets" && <Button as="a" href="/dashboard/kpi/assignments" appearance="secondary">View assignments</Button>}
        {view !== "library" && view !== "templates" && <Button as="a" href="/dashboard/kpi" appearance="secondary">KPI Library</Button>}
    </>} />}
    {view === "assignments" && <KpiWorkflowGuidancePanel compact onGuidance={setWorkflowGuidance} />}
    {view === "assignments" && blockedAssignment && <KpiFeedback intent="warning">{blockedAssignment.reason} Responsible: {blockedAssignment.owner}.</KpiFeedback>}
    {(view === "assignments" || view === "targets") && canAssign && <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Related planning tasks"><Link className="hover:text-foreground hover:underline" href="/dashboard/kpi/assignments">Assignments</Link><Link className="hover:text-foreground hover:underline" href="/dashboard/kpi/targets">Target revisions</Link><Link className="hover:text-foreground hover:underline" href="/dashboard/kpi/scorecards">Scorecards</Link></div>}
    {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
    {notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}
    {loading ? <KpiLoading label="Loading KPI data…" /> : null}
    {view === "create" && canDefine && !editingId && creationMode === "guided" && <KpiCreationWizard token={token} periods={periods} onCancel={() => router.push("/dashboard/kpi")} />}
    {view === "templates" && canDefine && <Dialog open={showTemplateForm && !editingId && setupMode === "guided"} onOpenChange={(_, data) => { if (!data.open && !busy) { setShowTemplateForm(false); setSetupMode("choose") } }}><DialogSurface style={{ width: "min(64rem, calc(100vw - 2rem))", maxWidth: "calc(100vw - 2rem)" }} className="max-h-[90vh] overflow-y-auto"><DialogBody><DialogTitle><div className="flex items-center justify-between gap-4"><span>Create KPI template</span><Button appearance="subtle" onClick={() => { setShowTemplateForm(false); setSetupMode("choose") }}>Close</Button></div></DialogTitle><DialogContent className="max-h-[calc(90vh-8rem)] overflow-y-auto">{error && <KpiFeedback intent="error">{error}</KpiFeedback>}<KpiTemplateWizard token={token} definitions={definitions} onCancel={() => { setShowTemplateForm(false); setSetupMode("choose") }} onDone={() => { setShowTemplateForm(false); setSetupMode("choose"); void load() }} /></DialogContent></DialogBody></DialogSurface></Dialog>}
    {view === "periods" && canDefine && showPeriodForm && setupMode === "choose" && <KpiModeSelector title="Reporting Period" description="Set the period name, frequency and explicit date boundaries step by step." onSelect={setSetupMode} />}
    {view === "periods" && canDefine && showPeriodForm && setupMode === "guided" && <KpiPeriodWizard token={token} onCancel={() => setSetupMode("choose")} onDone={() => { setShowPeriodForm(false); setSetupMode("choose"); void load() }} />}
    {view === "assignments" && canAssign && !blockedAssignment && showAssignmentForm && setupMode === "choose" && <KpiModeSelector title="KPI Assignment" description="Select an authorized subject, published KPI, matching period and assignment target." onSelect={setSetupMode} />}
    {view === "assignments" && canAssign && !blockedAssignment && showAssignmentForm && setupMode === "guided" && <KpiAssignmentWizard token={token} definitions={definitions} periods={periods} onCancel={() => setSetupMode("choose")} onDone={() => { setShowAssignmentForm(false); setSetupMode("choose"); void load(); window.dispatchEvent(new Event("hrms:refresh-page-data")) }} />}
    {view === "library" && canDefine && <Dialog open={createDialogOpen} onOpenChange={(_, data) => setCreateDialogOpen(data.open)}><DialogSurface className="max-h-[90vh] overflow-y-auto"><DialogBody><DialogTitle>Create KPI</DialogTitle><DialogContent className="space-y-4">{error && <KpiFeedback intent="error">{error}</KpiFeedback>}{notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}<KpiCreationWizard token={token} periods={periods} onCancel={() => setCreateDialogOpen(false)} onCreated={() => void load({ silent: true })} /></DialogContent></DialogBody></DialogSurface></Dialog>}
    {view === "library" && <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label="KPI definitions">
      <div className="grid gap-3 border-b border-border p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(14rem,1fr)_auto] sm:items-center"><FluentSearchBox size="medium" aria-label="Search KPI definitions" placeholder="Search code, name or category" value={search} onChange={(_, data) => setSearch(data.value)} className="w-full min-w-0" /><Dropdown aria-label="Filter KPI status" value={{ all: "All statuses", draft: "Draft", published: "Published", archived: "Archived" }[statusFilter]} selectedOptions={[statusFilter]} onOptionSelect={(_, data) => setStatusFilter(data.optionValue ?? "all")} className="w-full min-w-36 sm:w-32 [&_.fui-Dropdown__button]:!px-3"><Option value="all">All statuses</Option><Option value="draft">Draft</Option><Option value="published">Published</Option><Option value="archived">Archived</Option></Dropdown></div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end"><p className="whitespace-nowrap text-xs text-muted-foreground">{filteredDefinitions.length} of {definitions.length} definitions</p>{canDefine && <Button type="button" onClick={openCreateDialog} appearance="primary">Create KPI</Button>}</div>
      </div>
      {loading ? <p className="px-4 py-8 text-sm text-muted-foreground">Loading KPI definitions…</p> : filteredDefinitions.length === 0 ? <div className="px-4 py-10 text-center"><p className="font-medium text-foreground">{definitions.length ? "No KPIs match these filters." : "No KPIs have been created yet."}</p><p className="mt-1 text-sm text-muted-foreground">{definitions.length ? "Try another search or status." : "Create a draft KPI, then publish it before assignment."}</p>{canDefine && !definitions.length && <Button type="button" onClick={openCreateDialog} appearance="primary" className="mt-4">Create KPI</Button>}</div> : <div className="overflow-x-auto"><Table aria-label="KPI definitions" size="small" className="w-full table-fixed text-left text-sm" style={{ tableLayout: "fixed" }}><TableHeader><TableRow><TableHeaderCell className="w-[14%] px-2 py-1.5">KPI code</TableHeaderCell><TableHeaderCell className="w-[23%] px-2 py-1.5">KPI name</TableHeaderCell><TableHeaderCell className="w-[24%] px-2 py-1.5">Measurement</TableHeaderCell><TableHeaderCell className="w-[10%] px-2 py-1.5">Version</TableHeaderCell><TableHeaderCell className="w-[15%] px-2 py-1.5">Status</TableHeaderCell><TableHeaderCell className="w-[14%] px-2 py-1.5 text-center">Actions</TableHeaderCell></TableRow></TableHeader><TableBody>{filteredDefinitions.map((row) => <TableRow key={row.id}><TableCell className="px-2 py-1.5 font-mono text-xs">{row.code}</TableCell><TableCell className="px-2 py-1.5"><span className="font-medium">{row.currentVersion?.name ?? "Unnamed KPI"}</span><span className="block text-xs text-muted-foreground">{row.currentVersion?.category ?? "Uncategorized"}</span></TableCell><TableCell className="px-2 py-1.5">{row.currentVersion?.measurementType?.replaceAll("_", " ") ?? "—"}{row.currentVersion?.measurementUnit ? ` · ${row.currentVersion.measurementUnit}` : ""}</TableCell><TableCell className="px-2 py-1.5">{row.currentVersion?.version ? `v${row.currentVersion.version}` : "—"}</TableCell><TableCell className="px-2 py-1.5"><KpiStatusBadge status={row.status === "published" && (!!row.draftVersion || !row.currentVersion?.publishedAt) ? "draft_revision" : row.status} /></TableCell><TableCell className="px-2 py-1.5 text-center"><Menu><MenuTrigger disableButtonEnhancement><MenuButton appearance="subtle" size="small" icon={<MoreHorizontal20Regular aria-hidden />} aria-label={`Actions for ${row.code}`} /></MenuTrigger><MenuPopover><MenuList><MenuItem onClick={() => router.push(`/dashboard/kpi/definitions/${row.id}`)}>View & history</MenuItem>{canDefine && row.status !== "archived" && (!!row.draftVersion || !row.currentVersion?.publishedAt) && <><MenuItem onClick={() => router.push(`/dashboard/kpi/create?edit=${row.id}`)}>Edit draft</MenuItem><MenuItem disabled={busy} onClick={() => void action(() => kpiApi.publishDefinition(token, row.id), "KPI published. You can now assign it.")}>Publish</MenuItem></>}{canDefine && row.status === "published" && <MenuItem disabled={busy} onClick={() => { void fluentConfirm(`Archive ${row.code}? Existing assignments and history will remain.`).then((confirmed) => { if (confirmed) void action(() => kpiApi.archiveDefinition(token, row.id), "KPI archived") }) }}>Archive</MenuItem>}{canAssign && row.status === "published" && !!row.currentVersion?.publishedAt && <MenuItem onClick={() => router.push(`/dashboard/kpi/assignments?definition=${row.id}`)}>Assign</MenuItem>}</MenuList></MenuPopover></Menu></TableCell></TableRow>)}</TableBody></Table></div>}
    </section>}
    {((view === "create" && creationMode === "manual") || (view === "templates" && editingId !== null)) && canDefine && manualForm}
    {view === "templates" && <section className="space-y-3" aria-label="KPI templates"><div className="w-full md:w-1/4"><Field label="Search templates" value={search} onChange={setSearch} /></div>{loading ? <KpiLoading label="Loading KPI templates…" /> : filteredTemplates.length === 0 ? <div className="rounded-lg border border-border px-4 py-10 text-center text-sm text-muted-foreground">No templates found.</div> : <div className="overflow-x-auto rounded-lg border border-border"><Table aria-label="KPI templates" size="small" className="w-full table-fixed text-left text-sm" style={{ tableLayout: "fixed" }}><TableHeader><TableRow><TableHeaderCell className="w-[18%] px-2 py-1.5">Template code</TableHeaderCell><TableHeaderCell className="w-[23%] px-2 py-1.5">Template name</TableHeaderCell><TableHeaderCell className="w-[20%] px-2 py-1.5">Category</TableHeaderCell><TableHeaderCell className="w-[21%] px-2 py-1.5">Status</TableHeaderCell><TableHeaderCell className="w-[18%] px-2 py-1.5 text-left">Actions</TableHeaderCell></TableRow></TableHeader><TableBody>{filteredTemplates.map((row) => <React.Fragment key={row.id}><TableRow><TableCell className="px-2 py-1.5 font-mono text-xs">{row.code}</TableCell><TableCell className="px-2 py-1.5 font-medium">{row.name}</TableCell><TableCell className="px-2 py-1.5">{row.category || "—"}</TableCell><TableCell className="px-2 py-1.5"><KpiStatusBadge status={row.status} /></TableCell><TableCell className="px-2 py-1.5 text-left"><div className="flex justify-start"><Menu><MenuTrigger disableButtonEnhancement><MenuButton appearance="subtle" size="small" icon={<MoreHorizontal20Regular aria-hidden />} aria-label={`Actions for template ${row.code}`} /></MenuTrigger><MenuPopover><MenuList><MenuItem onClick={() => setViewTemplateId(row.id)}>View details</MenuItem>{row.status === "draft" && <><MenuItem onClick={() => { setEditingId(row.id); setShowTemplateForm(true); setSetupMode("manual"); setForm(row); setClassification(row.departmentClassification ?? "") }}>Edit</MenuItem><MenuItem disabled={busy} onClick={() => void action(() => kpiApi.publishTemplate(token, row.id), "Template published")}>Publish</MenuItem></>}{row.status === "published" && <MenuItem disabled={busy} onClick={() => { setError(""); setNewKpiCode(""); setUseTemplateId(row.id) }}>Use template</MenuItem>}</MenuList></MenuPopover></Menu></div></TableCell></TableRow></React.Fragment>)}</TableBody></Table></div>}</section>}
    {view === "templates" && <Dialog open={viewTemplateId !== null} onOpenChange={(_, data) => { if (!data.open) setViewTemplateId(null) }}><DialogSurface className="max-h-[90vh] overflow-y-auto"><DialogBody><DialogTitle>{templates.find((row) => row.id === viewTemplateId)?.name ?? "KPI template details"}</DialogTitle><DialogContent className="space-y-4">{(() => { const template = templates.find((row) => row.id === viewTemplateId); if (!template) return null; return <><p className="text-sm text-muted-foreground">Review the reusable KPI settings below.</p><div className="overflow-x-auto"><Table aria-label="KPI template details" className="w-full text-left text-sm"><TableHeader><TableRow><TableHeaderCell className="w-1/3">Setting</TableHeaderCell><TableHeaderCell>Value</TableHeaderCell></TableRow></TableHeader><TableBody>{[["Template code", template.code], ["Category", template.category], ["Measurement", `${template.measurementType.replaceAll("_", " ")}${template.measurementUnit ? ` · ${template.measurementUnit}` : ""}`], ["Direction", template.direction.replaceAll("_", " ")], ["Frequency", template.frequency], ["Department", template.departmentClassification || "Not set"], ["Description", template.description || "No description provided."], ["Strategic objective", template.strategicObjective || "Not set"]].map(([label, value]) => <TableRow key={label}><TableCell className="font-medium">{label}</TableCell><TableCell>{value}</TableCell></TableRow>)}</TableBody></Table></div></> })()}</DialogContent><div className="flex justify-end border-t border-border pt-4"><Button appearance="secondary" onClick={() => setViewTemplateId(null)}>Close</Button></div></DialogBody></DialogSurface></Dialog>}
    {view === "templates" && <Dialog open={useTemplateId !== null} onOpenChange={(_, data) => { if (!data.open && !busy) { setUseTemplateId(null); setNewKpiCode(""); setError("") } }}><DialogSurface className="max-h-[90vh] overflow-y-auto"><DialogBody><DialogTitle>Review KPI from template</DialogTitle><DialogContent className="space-y-4">{(() => { const template = templates.find((row) => row.id === useTemplateId); if (!template) return null; return <><div><h2 className="font-semibold">Check the copied KPI details</h2><p className="text-sm text-muted-foreground">Review what will be copied, then save it for later or publish it for use.</p></div><dl className="grid gap-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">{[["Template", `${template.name} · ${template.code}`], ["Category", template.category], ["Measurement", `${template.measurementType.replaceAll("_", " ")}${template.measurementUnit ? ` · ${template.measurementUnit}` : ""}`], ["Direction", template.direction.replaceAll("_", " ")], ["Frequency", template.frequency], ["Department", template.departmentClassification || "Not set"], ["Description", template.description || "No description provided."], ["Strategic objective", template.strategicObjective || "Not set"]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl><Field label="New KPI identifier" value={newKpiCode} onChange={setNewKpiCode} required />{error && <KpiFeedback intent="error">{error}</KpiFeedback>}</> })()}</DialogContent><div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4"><Button appearance="subtle" disabled={busy} onClick={() => { setUseTemplateId(null); setNewKpiCode(""); setError("") }}>Cancel</Button><div className="flex flex-wrap gap-2"><Button appearance="secondary" disabled={busy} onClick={() => void createKpiFromTemplate(false)}>{busy ? "Saving…" : "Save as draft"}</Button><Button appearance="primary" disabled={busy} onClick={() => void createKpiFromTemplate(true)}>{busy ? "Saving…" : "Publish KPI"}</Button></div></div></DialogBody></DialogSurface></Dialog>}
    {view === "periods" && canDefine && <section className="space-y-4">{showPeriodForm && setupMode === "manual" && <form className="grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); void action(() => kpiApi.createPeriod(token, periodForm), "Reporting period saved") }}><Select label="Frequency" value={periodForm.frequency} onChange={(v) => setPeriodForm((p) => ({ ...p, frequency: v }))} options={["monthly", "quarterly", "semiannual", "annual"]} /><Field label="Label" value={periodForm.label} onChange={(v) => setPeriodForm((p) => ({ ...p, label: v }))} required /><Field label="Start" type="date" value={periodForm.startDate} onChange={(v) => setPeriodForm((p) => ({ ...p, startDate: v }))} required /><Field label="End" type="date" value={periodForm.endDate} onChange={(v) => setPeriodForm((p) => ({ ...p, endDate: v }))} required /><KpiFluentButton className={buttonClass} disabled={busy}>Save period</KpiFluentButton></form>}<div className="space-y-2">{periods.map((row) => <p key={row.id} className="rounded-lg border p-3 text-sm">{row.label} · {row.frequency} · {row.startDate} to {row.endDate} · {row.timezone ?? "Timezone not configured"}</p>)}{!loading && periods.length === 0 && <p>No periods configured.</p>}</div></section>}
    {view === "assignments" && canRead && <section className="space-y-4">{canAssign && !blockedAssignment && showAssignmentForm && setupMode === "manual" && <form className="grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); const def = definitions.find((d) => d.id === Number(assignmentForm.definitionId)); if (!def?.currentVersion) { setError("Select a KPI definition"); return } let target: Record<string, unknown>; try { target = targetFor(def.currentVersion.measurementType, def.currentVersion.direction, assignmentForm.target) } catch (err) { setError(errorMessage(err)); return } void action(() => kpiApi.createAssignment(token, { definitionId: def.id, periodId: Number(assignmentForm.periodId), subjectType: assignmentForm.subjectType, subjectId: Number(assignmentForm.subjectId), managerEmployeeId: assignmentForm.managerEmployeeId ? Number(assignmentForm.managerEmployeeId) : undefined, target }), "Assignment saved") }}>
      <label className="space-y-1 text-sm"><span>KPI</span><KpiFluentSelect aria-label="KPI" className={inputClass} required value={assignmentForm.definitionId} onChange={(e) => setAssignmentForm((p) => ({ ...p, definitionId: e.target.value }))}><option value="">Select KPI</option>{definitions.filter((d) => d.status === "published" && !!d.currentVersion?.publishedAt).map((d) => <option value={d.id} key={d.id}>{d.code} · {d.currentVersion?.name}</option>)}</KpiFluentSelect></label>
      <label className="space-y-1 text-sm"><span>Period</span><KpiFluentSelect aria-label="Period" className={inputClass} required value={assignmentForm.periodId} onChange={(e) => setAssignmentForm((p) => ({ ...p, periodId: e.target.value }))}><option value="">Select period</option>{periods.map((p) => <option value={p.id} key={p.id}>{p.label}</option>)}</KpiFluentSelect></label>
      <Select label="Subject type" value={assignmentForm.subjectType} onChange={(v) => setAssignmentForm((p) => ({ ...p, subjectType: v }))} options={["employee", "department", "branch", "manager_group"]} />
      <label className="space-y-1 text-sm"><span>Select {assignmentForm.subjectType.replaceAll("_", " ")}</span><KpiFluentSelect aria-label="Assignment subject" className={inputClass} value={assignmentForm.subjectId} onChange={(event) => setAssignmentForm((p) => ({ ...p, subjectId: event.target.value }))}><option value="">Choose from available records</option>{subjectOptions.map((row) => { const id = Number(row.id); if (!Number.isInteger(id)) return null; const name = [row.first_name, row.last_name].filter((value) => typeof value === "string").join(" ") || String(row.name ?? row.employee_no ?? id); return <option key={id} value={id}>{name} · #{id}</option> })}</KpiFluentSelect></label>
      <Field label="Subject ID (if not listed)" type="number" value={assignmentForm.subjectId} onChange={(v) => setAssignmentForm((p) => ({ ...p, subjectId: v }))} required /><Field label="Responsible manager employee ID" type="number" value={assignmentForm.managerEmployeeId} onChange={(v) => setAssignmentForm((p) => ({ ...p, managerEmployeeId: v }))} /><Field label="Target (number, true/false, description, or min,max)" value={assignmentForm.target} onChange={(v) => setAssignmentForm((p) => ({ ...p, target: v }))} required /><KpiFluentButton className={buttonClass} disabled={busy}>Save assignment</KpiFluentButton>
    </form>}<div className="space-y-2">{assignments.map((row) => <div className="flex flex-wrap justify-between gap-3 rounded-lg border p-4 text-sm" key={row.id}><span>#{row.id} · {row.definitionVersion?.name} · {row.subjectType} #{row.subjectId} · {row.period?.label} · {targetText(row.currentTarget?.target)} · {row.status}</span><div className="flex flex-wrap gap-3"><Link className="text-primary hover:underline" href={`/dashboard/kpi/targets?assignment=${row.id}`}>View & manage target</Link>{row.status === "active" && canUpdateAssignment && <KpiFluentButton className="text-red-700 underline" disabled={busy} onClick={() => void action(() => kpiApi.updateAssignment(token, row.id, { status: "inactive" }), "Assignment deactivated")}>Deactivate</KpiFluentButton>}</div></div>)}{!loading && assignments.length === 0 && <p>No assignments found.</p>}</div></section>}
    {view === "targets" && canReviseTarget && <section className="space-y-4"><form className="grid gap-4 rounded-lg border p-5 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); if (!selectedAssignment) return; let target: Record<string, unknown>; try { target = targetFor(selectedAssignment.definitionVersion.measurementType, selectedAssignment.definitionVersion.direction, targetForm.target) } catch (err) { setError(errorMessage(err)); return } void action(() => kpiApi.reviseTarget(token, selectedAssignment.id, target, targetForm.reason), "Target revision saved") }}><label className="space-y-1 text-sm"><span>Assignment</span><KpiFluentSelect aria-label="Assignment" className={inputClass} required value={targetForm.assignmentId} onChange={(e) => setTargetForm((p) => ({ ...p, assignmentId: e.target.value }))}><option value="">Select assignment</option>{assignments.filter((a) => a.status === "active").map((a) => <option key={a.id} value={a.id}>#{a.id} · {a.definitionVersion?.name} · {a.period?.label}</option>)}</KpiFluentSelect></label><Field label="New target" value={targetForm.target} onChange={(v) => setTargetForm((p) => ({ ...p, target: v }))} required /><Field label="Reason" value={targetForm.reason} onChange={(v) => setTargetForm((p) => ({ ...p, reason: v }))} required /><KpiFluentButton className={buttonClass} disabled={busy}>Save revision</KpiFluentButton></form>{selectedAssignment && <div className="rounded-lg border p-4 text-sm"><p>Current target: {targetText(selectedAssignment.currentTarget?.target)}</p><KpiFluentButton className="mt-2 text-primary underline" onClick={() => { void kpiApi.assignment(token, selectedAssignment.id).then((detail) => setAssignments((rows) => rows.map((row) => row.id === detail.id ? detail : row))).catch((err: unknown) => setError(errorMessage(err))) }}>View revision history</KpiFluentButton>{selectedAssignment.targetHistory?.map((revision) => <p key={revision.revision} className="mt-2">Revision {revision.revision}: {targetText(revision.target)} · {revision.reason} · {new Date(revision.changedAt).toLocaleString()}</p>)}</div>}</section>}
  </div>
}
