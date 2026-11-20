"use client"

import { Button, Dialog, DialogBody, DialogContent, DialogSurface, DialogTitle, Dropdown, Option, Menu, MenuButton, MenuItem, MenuList, MenuPopover, MenuTrigger, Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from "@fluentui/react-components";
import { MoreHorizontal20Regular } from "@fluentui/react-icons";
import { fluentConfirm } from "@/components/ui/fluent-dialog-service"
import { KpiFluentInput } from "./kpi-fluent-fields";
import * as React from "react"
import { KpiFluentButton } from "./kpi-fluent-button"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Field as FluentField, Input as FluentInput, Textarea as FluentTextarea } from "@fluentui/react-components"
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
import type { KpiEntryMode } from "./kpi-guided-flow"
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
function targetInputValue(assignment: KpiAssignment) {
  const target = assignment.currentTarget?.target
  if (!target) return ""
  if (assignment.definitionVersion.direction === "range" && target.min !== undefined && target.max !== undefined) return `${target.min},${target.max}`
  if (target.value !== undefined) return String(target.value)
  return String(target.description ?? "")
}
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
function assignmentSubjectLabel(row: AdminRecord, type: string) {
  const read = (...keys: string[]) => {
    for (const key of keys) {
      const value = row[key]
      if (typeof value === "string" && value.trim()) return value.trim()
    }
    return ""
  }
  if (type === "employee") {
    const name = read("full_name", "fullName", "name") || [read("first_name", "firstName"), read("last_name", "lastName")].filter(Boolean).join(" ")
    const number = read("employee_no", "employee_number", "employeeNumber", "employeeNo")
    return [name || read("email"), number ? `(${number})` : ""].filter(Boolean).join(" ")
  }
  return read("name", "department_name", "departmentName", "branch_name", "branchName", "title")
}

export function KpiWorkspace({ view = "library" }: { view?: string }) {
  const router = useRouter()
  const actor = useDashboardActor()
  const canDefine = actor.roleNames?.some((role) => ["COMPANY_ADMIN", "HR_MANAGER"].includes(role)) ?? false
  const legacyCanAssign = actor.roleNames?.some((role) => ["COMPANY_ADMIN", "HR_MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER"].includes(role)) ?? false
  const canCreateDefinition = legacyCanAssign || actor.permissionLabels.includes("kpi_definitions:create")
  const canAssign = legacyCanAssign || actor.permissionLabels.includes("kpi_assignments:create")
  const canUpdateAssignment = legacyCanAssign || actor.permissionLabels.includes("kpi_assignments:update")
  const hasLegacyManagementRole = actor.roleNames?.some((role) => ["COMPANY_ADMIN", "HR_MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER", "MANAGEMENT"].includes(role)) ?? false
  const canReadAssignments = hasLegacyManagementRole || actor.permissionLabels.includes("kpi_assignments:read")
  const canRead = hasLegacyManagementRole || actor.permissionLabels.includes("kpi_assignments:read") || canCreateDefinition
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
  const [showTargetRevisionDialog, setShowTargetRevisionDialog] = React.useState(false)
  const [viewTemplateId, setViewTemplateId] = React.useState<number | null>(null)
  const [useTemplateId, setUseTemplateId] = React.useState<number | null>(null)
  const [newKpiCode, setNewKpiCode] = React.useState("")
  const [creationMode, setCreationMode] = React.useState<"guided" | "manual">("guided")
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [setupMode, setSetupMode] = React.useState<KpiEntryMode>("choose")
  const [form, setForm] = React.useState<KpiDefinitionForm>(fields)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [classification, setClassification] = React.useState("")
  const [assignmentPrefill, setAssignmentPrefill] = React.useState({ definitionId: "", periodId: "" })
  const [targetForm, setTargetForm] = React.useState({ assignmentId: "", target: "", reason: "" })
  const [assignmentSubjectNames, setAssignmentSubjectNames] = React.useState<Record<string, string>>({})
  const token = readKpiToken()
  const load = React.useCallback(async (options?: { silent?: boolean }) => {
    if (!kpiEnabled || !canRead || !token) { setLoading(false); return }
    if (!options?.silent) setLoading(true)
    setError("")
    try {
      const [d, t, p, a] = await Promise.all([kpiApi.definitions(token), canDefine ? kpiApi.templates(token) : Promise.resolve([]), kpiApi.periods(token), canReadAssignments ? kpiApi.assignments(token) : Promise.resolve([])])
      setDefinitions(d); setTemplates(t); setPeriods(p); setAssignments(a)
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) setError(errorMessage(err))
    } finally { if (!options?.silent) setLoading(false) }
  }, [canRead, canDefine, canReadAssignments, token, setError, setAssignments, setDefinitions, setTemplates, setPeriods, setLoading])
  React.useEffect(() => { void load() }, [load])
  React.useEffect(() => {
    if (view !== "assignments") return
    const params = new URLSearchParams(window.location.search)
    const definitionId = Number(params.get("definition"))
    if (Number.isInteger(definitionId) && definitionId > 0) {
      const periodId = Number(params.get("period"))
      setAssignmentPrefill({ definitionId: String(definitionId), periodId: Number.isInteger(periodId) && periodId > 0 ? String(periodId) : "" })
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
    if (!canRead || !token || !["assignments", "targets"].includes(view)) return
    let active = true
    void Promise.allSettled([listEmployees(token, { limit: 100 }), listDepartments(token, { limit: 100 }), listBranches(token, { limit: 100 })]).then((results) => {
      if (!active) return
      const labels: Record<string, string> = {}
      for (const [index, result] of results.entries()) {
        if (result.status !== "fulfilled") continue
        const type = index === 0 ? "employee" : index === 1 ? "department" : "branch"
        for (const row of result.value.rows) {
          const id = Number(row.id ?? row.employee_id ?? row.department_id ?? row.branch_id)
          if (!Number.isInteger(id)) continue
          labels[`${type}:${id}`] = assignmentSubjectLabel(row, type) || `${type === "employee" ? "Employee" : type === "department" ? "Department" : "Branch"} #${id}`
        }
      }
      setAssignmentSubjectNames(labels)
    })
    return () => { active = false }
  }, [canRead, token, view])
  React.useEffect(() => {
    if (view !== "create" || !canCreateDefinition || !token) return
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
  }, [view, canCreateDefinition, canDefine, token])
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
  const targetPrefillId = React.useRef<number | null>(null)
  const targetHistoryRequestIds = React.useRef(new Set<number>())
  const targetRevisionDialogOpen = view === "targets" || (view === "assignments" && showTargetRevisionDialog)
  React.useEffect(() => {
    if (!targetRevisionDialogOpen || !selectedAssignment) return
    if (targetPrefillId.current !== selectedAssignment.id) {
      targetPrefillId.current = selectedAssignment.id
      setTargetForm((current) => ({ ...current, target: targetInputValue(selectedAssignment) }))
    }
    if (selectedAssignment.targetHistory !== undefined || targetHistoryRequestIds.current.has(selectedAssignment.id)) return
    const assignmentId = selectedAssignment.id
    targetHistoryRequestIds.current.add(assignmentId)
    void kpiApi.assignment(token, assignmentId).then((detail) => {
      setAssignments((rows) => rows.map((row) => row.id === detail.id ? detail : row))
    }).catch((err: unknown) => {
      targetHistoryRequestIds.current.delete(assignmentId)
      setError(errorMessage(err))
    })
  }, [targetRevisionDialogOpen, selectedAssignment, token])
  const canReviseTarget = legacyCanAssign || actor.permissionLabels.includes("kpi_targets:revise")
  const blockedAssignment = workflowGuidance?.actions.find((item) => item.id === "create-assignment" && item.blocked)
  if (!kpiEnabled) return <p className="p-6 text-sm">KPI Phase 1A is disabled in this environment.</p>
  if (!actor.ready) return <p className="p-6 text-sm">Checking access…</p>
  if (view === "create" && !canCreateDefinition) return <p className="p-6 text-sm" role="alert">KPI creation is not assigned to your role in the active company. Ask your administrator for access.</p>
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
        {view === "periods" && canDefine && <KpiFluentButton type="button" className={buttonClass} onClick={() => setShowPeriodForm((value) => !value)}>{showPeriodForm ? "Close form" : "Create period"}</KpiFluentButton>}
        {view === "assignments" && canAssign && <KpiFluentButton type="button" className={buttonClass} disabled={!!blockedAssignment} title={blockedAssignment?.reason} onClick={() => setShowAssignmentForm(true)}>Assign a KPI</KpiFluentButton>}
        {view === "assignments" && canReviseTarget && <Button type="button" onClick={() => { setTargetForm({ assignmentId: "", target: "", reason: "" }); setShowTargetRevisionDialog(true) }} appearance="subtle" className="!border-0 !bg-transparent !text-white hover:!bg-white/10 hover:!text-white">Revise a target</Button>}
        {view === "targets" && <Button as="a" href="/dashboard/kpi/assignments" appearance="secondary">View assignments</Button>}
        {view !== "library" && view !== "templates" && view !== "assignments" && <Button as="a" href="/dashboard/kpi" appearance="secondary">KPI Library</Button>}
    </>} />}
    {view === "assignments" && <KpiWorkflowGuidancePanel guidanceOnly onGuidance={setWorkflowGuidance} />}
    {view === "assignments" && blockedAssignment && assignments.length > 0 && <KpiFeedback intent="warning">{blockedAssignment.reason} Responsible: {blockedAssignment.owner}.</KpiFeedback>}
    {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
    {notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}
    {loading ? <KpiLoading label="Loading KPI data…" /> : null}
    {view === "create" && canCreateDefinition && !editingId && creationMode === "guided" && <KpiCreationWizard token={token} periods={periods} onCancel={() => router.push("/dashboard/kpi")} />}
    {view === "templates" && canDefine && <Dialog open={showTemplateForm && !editingId && setupMode === "guided"} onOpenChange={(_, data) => { if (!data.open && !busy) { setShowTemplateForm(false); setSetupMode("choose") } }}><DialogSurface style={{ width: "min(64rem, calc(100vw - 2rem))", maxWidth: "calc(100vw - 2rem)" }} className="max-h-[90vh] overflow-y-auto"><DialogBody><DialogTitle><div className="flex items-center justify-between gap-4"><span>Create KPI template</span><Button appearance="subtle" onClick={() => { setShowTemplateForm(false); setSetupMode("choose") }}>Close</Button></div></DialogTitle><DialogContent className="max-h-[calc(90vh-8rem)] overflow-y-auto">{error && <KpiFeedback intent="error">{error}</KpiFeedback>}<KpiTemplateWizard token={token} definitions={definitions} onCancel={() => { setShowTemplateForm(false); setSetupMode("choose") }} onDone={() => { setShowTemplateForm(false); setSetupMode("choose"); void load() }} /></DialogContent></DialogBody></DialogSurface></Dialog>}
    {view === "periods" && canDefine && <Dialog open={showPeriodForm} onOpenChange={(_, data) => { if (!data.open && !busy) setShowPeriodForm(false) }}><DialogSurface style={{ width: "min(64rem, calc(100vw - 2rem))", maxWidth: "calc(100vw - 2rem)" }} className="max-h-[90vh] overflow-y-auto"><DialogBody><DialogTitle><div className="flex items-center justify-between gap-4"><span>Create reporting period</span><Button appearance="subtle" disabled={busy} onClick={() => setShowPeriodForm(false)}>Close</Button></div></DialogTitle><DialogContent className="max-h-[calc(90vh-8rem)] overflow-y-auto">{error && <KpiFeedback intent="error">{error}</KpiFeedback>}<KpiPeriodWizard token={token} onCancel={() => setShowPeriodForm(false)} onDone={() => { setShowPeriodForm(false); void load() }} /></DialogContent></DialogBody></DialogSurface></Dialog>}
    {view === "assignments" && canAssign && !blockedAssignment && <Dialog open={showAssignmentForm} onOpenChange={(_, data) => { if (!data.open && !busy) setShowAssignmentForm(false) }}><DialogSurface style={{ width: "min(64rem, calc(100vw - 2rem))", maxWidth: "calc(100vw - 2rem)" }} className="max-h-[90vh] overflow-y-auto"><DialogBody><DialogTitle><div className="flex items-center justify-between gap-4"><span>Assign a KPI</span><Button appearance="subtle" disabled={busy} onClick={() => setShowAssignmentForm(false)}>Close</Button></div></DialogTitle><DialogContent className="max-h-[calc(90vh-8rem)] overflow-y-auto">{error && <KpiFeedback intent="error">{error}</KpiFeedback>}<KpiAssignmentWizard token={token} definitions={definitions} periods={periods} initialDefinitionId={assignmentPrefill.definitionId} initialPeriodId={assignmentPrefill.periodId} onCancel={() => setShowAssignmentForm(false)} onDone={() => { setShowAssignmentForm(false); void load(); window.dispatchEvent(new Event("hrms:refresh-page-data")) }} /></DialogContent></DialogBody></DialogSurface></Dialog>}
    {view === "library" && canCreateDefinition && <Dialog open={createDialogOpen} onOpenChange={(_, data) => setCreateDialogOpen(data.open)}><DialogSurface className="max-h-[90vh] overflow-y-auto"><DialogBody><DialogTitle>Create KPI</DialogTitle><DialogContent className="space-y-4">{error && <KpiFeedback intent="error">{error}</KpiFeedback>}{notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}<KpiCreationWizard token={token} periods={periods} onCancel={() => setCreateDialogOpen(false)} onCreated={() => void load({ silent: true })} /></DialogContent></DialogBody></DialogSurface></Dialog>}
    {view === "library" && <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label="KPI definitions">
      <div className="grid gap-3 border-b border-border p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="grid min-w-0 gap-3 sm:items-center" style={{ gridTemplateColumns: "minmax(0, 1fr) 7rem" }}><FluentSearchBox size="medium" aria-label="Search KPI definitions" placeholder="Search code, name or category" value={search} onChange={(_, data) => setSearch(data.value)} className="w-full min-w-0" /><div className="min-w-0" style={{ width: "7rem" }}><Dropdown aria-label="Filter KPI status" value={{ all: "All statuses", draft: "Draft", published: "Published", archived: "Archived" }[statusFilter]} selectedOptions={[statusFilter]} onOptionSelect={(_, data) => setStatusFilter(data.optionValue ?? "all")} className="!w-full !min-w-0 [&_.fui-Dropdown__button]:!h-10 [&_.fui-Dropdown__button]:!w-full [&_.fui-Dropdown__button]:!min-w-0 [&_.fui-Dropdown__button]:!px-3"><Option value="all">All statuses</Option><Option value="draft">Draft</Option><Option value="published">Published</Option><Option value="archived">Archived</Option></Dropdown></div></div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end"><p className="whitespace-nowrap text-xs text-muted-foreground">{filteredDefinitions.length} of {definitions.length} definitions</p>{canCreateDefinition && <Button type="button" onClick={openCreateDialog} appearance="primary" data-hrms-button-tone="brand" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Create KPI</Button>}</div>
      </div>
      {loading ? <p className="px-4 py-8 text-sm text-muted-foreground">Loading KPI definitions…</p> : filteredDefinitions.length === 0 ? <div className="px-4 py-10 text-center"><p className="font-medium text-foreground">{definitions.length ? "No KPIs match these filters." : "No KPIs have been created yet."}</p><p className="mt-1 text-sm text-muted-foreground">{definitions.length ? "Try another search or status." : "Create a draft KPI, then publish it before assignment."}</p>{canCreateDefinition && !definitions.length && <Button type="button" onClick={openCreateDialog} appearance="primary" data-hrms-button-tone="brand" className="mt-4" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Create KPI</Button>}</div> : <div className="overflow-x-auto"><Table aria-label="KPI definitions" size="small" className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}><TableHeader><TableRow><TableHeaderCell className="w-[18%] px-2 py-1.5">KPI code</TableHeaderCell><TableHeaderCell className="w-[24%] px-2 py-1.5">KPI name</TableHeaderCell><TableHeaderCell className="w-[20%] px-2 py-1.5">Measurement</TableHeaderCell><TableHeaderCell className="w-[9%] px-2 py-1.5">Version</TableHeaderCell><TableHeaderCell className="w-[15%] px-2 py-1.5">Status</TableHeaderCell><TableHeaderCell className="w-[14%] px-2 py-1.5 text-center">Actions</TableHeaderCell></TableRow></TableHeader><TableBody>{filteredDefinitions.map((row) => <TableRow key={row.id} className="cursor-pointer hover:bg-muted/40 focus-within:bg-muted/40" onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        if (event.target instanceof Element && event.target.closest("a, button, [role='button'], [role='menuitem']")) return
        router.push(`/dashboard/kpi/definitions/${row.id}`)
      }}><TableCell className="break-all px-2 py-1.5 font-mono text-xs align-middle">{row.code}</TableCell><TableCell className="px-2 py-1.5 align-middle"><Link href={`/dashboard/kpi/definitions/${row.id}`} className="block break-words font-medium leading-5 hover:underline focus-visible:underline">{row.currentVersion?.name ?? "Unnamed KPI"}</Link><span className="block break-words text-xs text-muted-foreground">{row.currentVersion?.category ?? "Uncategorized"}</span></TableCell><TableCell className="break-words px-2 py-1.5 align-middle">{row.currentVersion?.measurementType?.replaceAll("_", " ") ?? "—"}{row.currentVersion?.measurementUnit ? ` · ${row.currentVersion.measurementUnit}` : ""}</TableCell><TableCell className="whitespace-nowrap px-2 py-1.5 align-middle">{row.currentVersion?.version ? `v${row.currentVersion.version}` : "—"}</TableCell><TableCell className="whitespace-nowrap px-2 py-1.5 align-middle"><KpiStatusBadge status={row.status === "published" && (!!row.draftVersion || !row.currentVersion?.publishedAt) ? "draft_revision" : row.status} /></TableCell><TableCell className="px-2 py-1.5 text-center align-middle"><Menu><MenuTrigger disableButtonEnhancement><MenuButton appearance="subtle" size="small" icon={<MoreHorizontal20Regular aria-hidden />} aria-label={`Actions for ${row.code}`} /></MenuTrigger><MenuPopover><MenuList><MenuItem onClick={() => router.push(`/dashboard/kpi/definitions/${row.id}`)}>View & history</MenuItem>{canCreateDefinition && row.status !== "archived" && (!!row.draftVersion || !row.currentVersion?.publishedAt) && <><MenuItem onClick={() => router.push(`/dashboard/kpi/create?edit=${row.id}`)}>Edit draft</MenuItem><MenuItem disabled={busy} onClick={() => void action(() => kpiApi.publishDefinition(token, row.id), "KPI published. You can now assign it.")}>Publish</MenuItem></>}{canDefine && row.status === "published" && <MenuItem disabled={busy} onClick={() => { void fluentConfirm(`Archive ${row.code}? Existing assignments and history will remain.`).then((confirmed) => { if (confirmed) void action(() => kpiApi.archiveDefinition(token, row.id), "KPI archived") }) }}>Archive</MenuItem>}{canAssign && row.status === "published" && !!row.currentVersion?.publishedAt && <MenuItem onClick={() => router.push(`/dashboard/kpi/assignments?definition=${row.id}`)}>Assign</MenuItem>}</MenuList></MenuPopover></Menu></TableCell></TableRow>)}</TableBody></Table></div>}
    </section>}
    {((view === "create" && creationMode === "manual" && canCreateDefinition) || (view === "templates" && editingId !== null && canDefine)) && manualForm}
    {view === "templates" && <section className="space-y-3" aria-label="KPI templates"><div className="w-full md:w-1/4"><Field label="Search templates" value={search} onChange={setSearch} /></div>{loading ? <KpiLoading label="Loading KPI templates…" /> : filteredTemplates.length === 0 ? <div className="rounded-lg border border-border px-4 py-10 text-center text-sm text-muted-foreground">No templates found.</div> : <div className="overflow-x-auto rounded-lg border border-border"><Table aria-label="KPI templates" size="small" className="w-full table-fixed text-left text-sm" style={{ tableLayout: "fixed" }}><TableHeader><TableRow><TableHeaderCell className="w-[18%] px-2 py-1.5">Template code</TableHeaderCell><TableHeaderCell className="w-[23%] px-2 py-1.5">Template name</TableHeaderCell><TableHeaderCell className="w-[20%] px-2 py-1.5">Category</TableHeaderCell><TableHeaderCell className="w-[21%] px-2 py-1.5">Status</TableHeaderCell><TableHeaderCell className="w-[18%] px-2 py-1.5 text-left">Actions</TableHeaderCell></TableRow></TableHeader><TableBody>{filteredTemplates.map((row) => <React.Fragment key={row.id}><TableRow><TableCell className="px-2 py-1.5 font-mono text-xs">{row.code}</TableCell><TableCell className="px-2 py-1.5 font-medium">{row.name}</TableCell><TableCell className="px-2 py-1.5">{row.category || "—"}</TableCell><TableCell className="px-2 py-1.5"><KpiStatusBadge status={row.status} /></TableCell><TableCell className="px-2 py-1.5 text-left"><div className="flex justify-start"><Menu><MenuTrigger disableButtonEnhancement><MenuButton appearance="subtle" size="small" icon={<MoreHorizontal20Regular aria-hidden />} aria-label={`Actions for template ${row.code}`} /></MenuTrigger><MenuPopover><MenuList><MenuItem onClick={() => setViewTemplateId(row.id)}>View details</MenuItem>{row.status === "draft" && <><MenuItem onClick={() => { setEditingId(row.id); setShowTemplateForm(true); setSetupMode("manual"); setForm(row); setClassification(row.departmentClassification ?? "") }}>Edit</MenuItem><MenuItem disabled={busy} onClick={() => void action(() => kpiApi.publishTemplate(token, row.id), "Template published")}>Publish</MenuItem></>}{row.status === "published" && <MenuItem disabled={busy} onClick={() => { setError(""); setNewKpiCode(""); setUseTemplateId(row.id) }}>Use template</MenuItem>}</MenuList></MenuPopover></Menu></div></TableCell></TableRow></React.Fragment>)}</TableBody></Table></div>}</section>}
    {view === "templates" && <Dialog open={viewTemplateId !== null} onOpenChange={(_, data) => { if (!data.open) setViewTemplateId(null) }}><DialogSurface className="max-h-[90vh] overflow-y-auto"><DialogBody><DialogTitle>{templates.find((row) => row.id === viewTemplateId)?.name ?? "KPI template details"}</DialogTitle><DialogContent className="space-y-4">{(() => { const template = templates.find((row) => row.id === viewTemplateId); if (!template) return null; return <><p className="text-sm text-muted-foreground">Review the reusable KPI settings below.</p><div className="overflow-x-auto"><Table aria-label="KPI template details" className="w-full text-left text-sm"><TableHeader><TableRow><TableHeaderCell className="w-1/3">Setting</TableHeaderCell><TableHeaderCell>Value</TableHeaderCell></TableRow></TableHeader><TableBody>{[["Template code", template.code], ["Category", template.category], ["Measurement", `${template.measurementType.replaceAll("_", " ")}${template.measurementUnit ? ` · ${template.measurementUnit}` : ""}`], ["Direction", template.direction.replaceAll("_", " ")], ["Frequency", template.frequency], ["Department", template.departmentClassification || "Not set"], ["Description", template.description || "No description provided."], ["Strategic objective", template.strategicObjective || "Not set"]].map(([label, value]) => <TableRow key={label}><TableCell className="font-medium">{label}</TableCell><TableCell>{value}</TableCell></TableRow>)}</TableBody></Table></div></> })()}</DialogContent><div className="flex justify-end border-t border-border pt-4"><Button appearance="secondary" onClick={() => setViewTemplateId(null)}>Close</Button></div></DialogBody></DialogSurface></Dialog>}
    {view === "templates" && <Dialog open={useTemplateId !== null} onOpenChange={(_, data) => { if (!data.open && !busy) { setUseTemplateId(null); setNewKpiCode(""); setError("") } }}><DialogSurface className="max-h-[90vh] overflow-y-auto"><DialogBody><DialogTitle>Review KPI from template</DialogTitle><DialogContent className="space-y-4">{(() => { const template = templates.find((row) => row.id === useTemplateId); if (!template) return null; return <><div><h2 className="font-semibold">Check the copied KPI details</h2><p className="text-sm text-muted-foreground">Review what will be copied, then save it for later or publish it for use.</p></div><dl className="grid gap-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">{[["Template", `${template.name} · ${template.code}`], ["Category", template.category], ["Measurement", `${template.measurementType.replaceAll("_", " ")}${template.measurementUnit ? ` · ${template.measurementUnit}` : ""}`], ["Direction", template.direction.replaceAll("_", " ")], ["Frequency", template.frequency], ["Department", template.departmentClassification || "Not set"], ["Description", template.description || "No description provided."], ["Strategic objective", template.strategicObjective || "Not set"]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl><Field label="New KPI identifier" value={newKpiCode} onChange={setNewKpiCode} required />{error && <KpiFeedback intent="error">{error}</KpiFeedback>}</> })()}</DialogContent><div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4"><Button appearance="subtle" disabled={busy} onClick={() => { setUseTemplateId(null); setNewKpiCode(""); setError("") }}>Cancel</Button><div className="flex flex-wrap gap-2"><Button appearance="secondary" disabled={busy} onClick={() => void createKpiFromTemplate(false)}>{busy ? "Saving…" : "Save as draft"}</Button><Button appearance="primary" disabled={busy} onClick={() => void createKpiFromTemplate(true)}>{busy ? "Saving…" : "Publish KPI"}</Button></div></div></DialogBody></DialogSurface></Dialog>}
    {view === "periods" && canDefine && <section aria-label="Reporting periods">{loading ? <KpiLoading label="Loading reporting periods…" /> : periods.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No periods configured.</p> : <div className="overflow-x-auto rounded-lg border border-border bg-card"><Table aria-label="Reporting periods" size="small" className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}><TableHeader><TableRow><TableHeaderCell className="w-[25%] px-3 py-2">Period name</TableHeaderCell><TableHeaderCell className="w-[18%] px-3 py-2">Frequency</TableHeaderCell><TableHeaderCell className="w-[18%] px-3 py-2">Start date</TableHeaderCell><TableHeaderCell className="w-[18%] px-3 py-2">End date</TableHeaderCell><TableHeaderCell className="w-[21%] px-3 py-2">Time zone</TableHeaderCell></TableRow></TableHeader><TableBody>{periods.map((row) => <TableRow key={row.id}><TableCell className="break-words px-3 py-2 font-medium">{row.label}</TableCell><TableCell className="px-3 py-2 capitalize">{row.frequency.replace("semiannual", "twice a year").replace("annual", "yearly")}</TableCell><TableCell className="whitespace-nowrap px-3 py-2">{row.startDate}</TableCell><TableCell className="whitespace-nowrap px-3 py-2">{row.endDate}</TableCell><TableCell className="break-words px-3 py-2">{row.timezone ?? "Not configured"}</TableCell></TableRow>)}</TableBody></Table></div>}</section>}
    {view === "assignments" && canRead && <section className="space-y-4">{!loading && assignments.length === 0 ? <div className="rounded-lg border border-border bg-card px-5 py-8 text-center"><h2 className="font-semibold">No KPI assignments yet</h2><p className="mt-2 text-sm text-muted-foreground">{!definitions.some((definition) => definition.status === "published" && definition.currentVersion?.publishedAt) ? "Publish a KPI before assigning it." : periods.length === 0 ? "Create a reporting period before assigning a KPI." : blockedAssignment ? blockedAssignment.reason : canAssign ? "Use Assign a KPI above to select a person or team, reporting period, and target." : "Your company has not assigned a KPI yet."}</p>{!definitions.some((definition) => definition.status === "published" && definition.currentVersion?.publishedAt) && canCreateDefinition && <Link className="mt-3 inline-flex text-sm font-medium text-primary underline" href="/dashboard/kpi">Open KPI Library</Link>}{definitions.some((definition) => definition.status === "published" && definition.currentVersion?.publishedAt) && periods.length === 0 && canDefine && <Link className="mt-3 inline-flex text-sm font-medium text-primary underline" href="/dashboard/kpi/periods">Create reporting period</Link>}{blockedAssignment?.resolveHref && <Link className="mt-3 inline-flex text-sm font-medium text-primary underline" href={blockedAssignment.resolveHref}>Resolve prerequisite</Link>}</div> : <div className="overflow-x-auto"><Table aria-label="KPI assignments" size="small" className="w-full text-left text-sm"><TableHeader><TableRow><TableHeaderCell className="px-3 py-2">KPI</TableHeaderCell><TableHeaderCell className="px-3 py-2">Subject</TableHeaderCell><TableHeaderCell className="px-3 py-2">Reporting period</TableHeaderCell><TableHeaderCell className="px-3 py-2">Target</TableHeaderCell><TableHeaderCell className="px-3 py-2">Status</TableHeaderCell><TableHeaderCell className="w-16 px-3 py-2 text-center">Actions</TableHeaderCell></TableRow></TableHeader><TableBody>{assignments.map((row) => { const lookup = assignmentSubjectNames[`${row.subjectType}:${row.subjectId}`]; const embedded = row as KpiAssignment & { subjectName?: string; employeeName?: string; subject?: AdminRecord }; const subjectName = embedded.subjectName || embedded.employeeName || (embedded.subject ? assignmentSubjectLabel(embedded.subject, row.subjectType) : "") || lookup || `${row.subjectType.replaceAll("_", " ")} #${row.subjectId}`; return <TableRow key={row.id}><TableCell className="max-w-64 break-words px-3 py-2 font-medium">{row.definitionVersion?.name ?? "—"}</TableCell><TableCell className="max-w-56 break-words px-3 py-2">{subjectName}</TableCell><TableCell className="px-3 py-2">{row.period?.label ?? "—"}</TableCell><TableCell className="px-3 py-2"><span className="inline-flex rounded-full border border-primary/25 bg-primary/5 px-2 py-1 text-sm font-medium text-primary">{targetText(row.currentTarget?.target)}</span></TableCell><TableCell className="px-3 py-2"><KpiStatusBadge status={row.status} /></TableCell><TableCell className="w-16 px-3 py-2 text-center"><Menu><MenuTrigger disableButtonEnhancement><MenuButton appearance="subtle" size="small" icon={<MoreHorizontal20Regular aria-hidden />} aria-label={`Actions for assignment ${row.id}`} /></MenuTrigger><MenuPopover><MenuList><MenuItem onClick={() => { setTargetForm({ assignmentId: String(row.id), target: targetInputValue(row), reason: "" }); setShowTargetRevisionDialog(true) }}>Revise target</MenuItem>{row.status === "active" && canUpdateAssignment && <MenuItem disabled={busy} onClick={() => { void fluentConfirm("Deactivate this KPI assignment? The employee will no longer be able to record results for it.").then((confirmed) => { if (confirmed) void action(() => kpiApi.updateAssignment(token, row.id, { status: "inactive" }), "Assignment deactivated") }) }}>Deactivate</MenuItem>}</MenuList></MenuPopover></Menu></TableCell></TableRow> })}</TableBody></Table></div>}</section>}
    {(view === "targets" || (view === "assignments" && showTargetRevisionDialog)) && canReviseTarget && <Dialog open onOpenChange={(_, data) => { if (!data.open) { if (view === "targets") router.push("/dashboard/kpi/assignments"); else setShowTargetRevisionDialog(false) } }}><DialogSurface style={{ width: "min(64rem, calc(100vw - 2rem))", maxWidth: "calc(100vw - 2rem)" }} className="max-h-[90vh] overflow-y-auto"><DialogBody><DialogTitle><div className="flex items-center justify-between gap-4"><span>Revise KPI target</span><Button appearance="secondary" className="!border-primary !font-semibold !text-primary hover:!bg-primary/10" onClick={() => { if (view === "targets") router.push("/dashboard/kpi/assignments"); else setShowTargetRevisionDialog(false) }}>Close</Button></div></DialogTitle><DialogContent className="max-h-[calc(90vh-8rem)] overflow-y-auto"><section className="space-y-3" aria-label="Target revision">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (!selectedAssignment) return; let target: Record<string, unknown>; try { target = targetFor(selectedAssignment.definitionVersion.measurementType, selectedAssignment.definitionVersion.direction, targetForm.target) } catch (err) { setError(errorMessage(err)); return } const assignmentId = selectedAssignment.id; void action(() => kpiApi.reviseTarget(token, assignmentId, target, targetForm.reason), "Target revision saved").then(async (saved) => { if (!saved) return; try { const detail = await kpiApi.assignment(token, assignmentId); setAssignments((rows) => rows.map((row) => row.id === detail.id ? detail : row)) } catch (err) { setError(errorMessage(err)) } }) }}>
        <label className="space-y-1 text-sm md:col-span-2"><span className="font-medium">Assignment</span><Dropdown aria-label="Assignment" className="w-full" button={{ className: "!w-full" }} value={selectedAssignment ? `${selectedAssignment.definitionVersion?.name ?? "KPI"} · ${assignmentSubjectNames[`${selectedAssignment.subjectType}:${selectedAssignment.subjectId}`] || selectedAssignment.subjectType.replaceAll("_", " ")} · ${selectedAssignment.period?.label ?? "Period"}` : "Select an assignment"} selectedOptions={targetForm.assignmentId ? [targetForm.assignmentId] : []} onOptionSelect={(_, data) => { const assignmentId = data.optionValue ?? ""; const assignment = assignments.find((item) => item.id === Number(assignmentId)); setTargetForm((current) => ({ ...current, assignmentId, target: assignment ? targetInputValue(assignment) : "", reason: "" })) }}><Option value="" text="Select an assignment">Select an assignment</Option>{assignments.map((assignment) => { const lookup = assignmentSubjectNames[`${assignment.subjectType}:${assignment.subjectId}`]; const employee = assignment.subjectType === "employee" ? lookup || "Employee" : `${assignment.subjectType.replaceAll("_", " ")} · ${lookup || "Unassigned"}`; const label = `${assignment.definitionVersion?.name ?? "KPI"} · ${employee} · ${assignment.period?.label ?? "Period"}`; return <Option key={assignment.id} value={String(assignment.id)} text={label}><span className="flex w-full items-center justify-between gap-3"><span className="min-w-0 truncate">{label}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${assignment.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>{assignment.status === "active" ? "Active" : "Inactive"}</span></span></Option> })}</Dropdown></label>
        {selectedAssignment && <div className="grid gap-x-5 gap-y-2 border-y border-border py-3 text-sm sm:grid-cols-2 md:col-span-2"><div><span className="text-[var(--primary)]">KPI</span><p className="font-medium">{selectedAssignment.definitionVersion?.name ?? "—"}</p></div><div><span className="text-[var(--primary)]">Assigned to</span><p className="font-medium">{assignmentSubjectNames[`${selectedAssignment.subjectType}:${selectedAssignment.subjectId}`] || selectedAssignment.subjectType.replaceAll("_", " ")}</p></div><div><span className="text-[var(--primary)]">Reporting period</span><p className="font-medium">{selectedAssignment.period?.label ?? "—"}</p></div><div><span className="text-[var(--primary)]">Current target</span><p className="font-medium">{targetText(selectedAssignment.currentTarget?.target)}</p></div></div>}
        {selectedAssignment?.status !== "active" && selectedAssignment && <p className="text-sm text-muted-foreground md:col-span-2">This assignment is inactive, so its target can’t be revised.</p>}
        <label className="space-y-1 text-sm"><span className="font-medium">New target{selectedAssignment?.definitionVersion.measurementUnit ? ` (${selectedAssignment.definitionVersion.measurementUnit})` : ""}<span className="ml-1 text-red-600" aria-hidden="true">*</span></span><FluentInput className="w-full" aria-label="New target" value={targetForm.target} required disabled={selectedAssignment?.status !== "active"} onChange={(_, data) => setTargetForm((current) => ({ ...current, target: data.value }))} /><span className="block text-xs text-muted-foreground">{selectedAssignment?.definitionVersion.direction === "range" ? "Enter the minimum and maximum, separated by a comma (for example, 10,20)." : selectedAssignment?.definitionVersion.measurementType === "binary" ? "Enter true or false." : ["numeric", "percentage", "currency", "duration"].includes(selectedAssignment?.definitionVersion.measurementType ?? "") ? "Enter the new numeric target." : "Describe the new target."}</span></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Reason<span className="ml-1 text-red-600" aria-hidden="true">*</span></span><FluentTextarea className="w-full" aria-label="Reason for target change" value={targetForm.reason} required disabled={selectedAssignment?.status !== "active"} rows={3} onChange={(_, data) => setTargetForm((current) => ({ ...current, reason: data.value }))} placeholder="Explain why this target is changing" /></label>
        <div className="flex justify-end md:col-span-2"><Button type="submit" appearance="primary" disabled={busy || !selectedAssignment || selectedAssignment.status !== "active"}>{busy ? "Saving…" : "Save target revision"}</Button></div>
      </form>
      {selectedAssignment && <div className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5"><div><h2 className="font-semibold">Target revision history</h2><p className="text-sm text-muted-foreground">Changes are recorded with the reason provided.</p></div>{selectedAssignment.targetHistory?.length ? <div className="overflow-x-auto"><Table aria-label="Target revision history" size="small" className="w-full text-left text-sm"><TableHeader><TableRow><TableHeaderCell>Revision</TableHeaderCell><TableHeaderCell>Target</TableHeaderCell><TableHeaderCell>Reason</TableHeaderCell><TableHeaderCell>Changed</TableHeaderCell></TableRow></TableHeader><TableBody>{selectedAssignment.targetHistory.map((revision) => <TableRow key={`${revision.revision}-${revision.changedAt}`}><TableCell className="font-medium">{revision.revision}</TableCell><TableCell>{targetText(revision.target)}</TableCell><TableCell>{revision.reason}</TableCell><TableCell>{new Date(revision.changedAt).toLocaleString()}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="text-sm text-muted-foreground">No previous target revisions.</p>}<Button appearance="subtle" size="small" onClick={() => { void kpiApi.assignment(token, selectedAssignment.id).then((detail) => setAssignments((rows) => rows.map((row) => row.id === detail.id ? detail : row))).catch((err: unknown) => setError(errorMessage(err))) }}>Refresh history</Button></div>}
    </section></DialogContent></DialogBody></DialogSurface></Dialog>}
  </div>
}
