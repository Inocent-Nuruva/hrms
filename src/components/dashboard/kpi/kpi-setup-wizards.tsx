"use client"

import * as React from "react"
import { Button, Card, Field, Input, MessageBar, MessageBarBody, Option, Dropdown, Textarea, Table, TableBody, TableCell, TableRow } from "@fluentui/react-components"
import { DateInput } from "@/components/ui/date-input"
import { listBranches, listDepartments, listEmployees, type AdminRecord } from "@/lib/admin-api"
import { kpiApi, type KpiAssignment, type KpiDefinition, type KpiDefinitionForm, type KpiPeriod, type KpiTemplate } from "@/lib/kpi-api"
import { KpiWizardControls, KpiWizardProgress, type KpiFlowStep } from "./kpi-guided-flow"
import { validateKpiDefinition } from "./kpi-definition-validation"
import { targetFor } from "./kpi-target-input"

function Choice({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <Field label={label} required><Dropdown aria-label={label} value={options.find(([id]) => id === value)?.[1] ?? ""} selectedOptions={[value]} onOptionSelect={(_, data) => onChange(data.optionValue ?? "")}>{options.map(([id, name]) => <Option key={id} value={id}>{name}</Option>)}</Dropdown></Field>
}
function Summary({ rows }: { rows: Array<[string, string]> }) {
  return <Table aria-label="Review configuration"><TableBody>{rows.map(([label, value]) => <TableRow key={label}><TableCell className="font-semibold">{label}</TableCell><TableCell>{value || "—"}</TableCell></TableRow>)}</TableBody></Table>
}
function Saved({ text, onDone, error }: { text: string; onDone: () => void; error?: string }) {
  return <Card className="space-y-3 p-5"><MessageBar intent="success" role="status"><MessageBarBody>{text}</MessageBarBody></MessageBar>{error && <MessageBar intent="error" role="alert"><MessageBarBody>{error}</MessageBarBody></MessageBar>}<Button appearance="primary" onClick={onDone}>Return to list</Button></Card>
}

const templateInitial: KpiDefinitionForm = { code: "", name: "", description: "", category: "", strategicObjective: "", measurementType: "numeric", measurementUnit: "", direction: "higher", frequency: "monthly" }
const templateSteps: KpiFlowStep[] = [
  { title: "Template information", description: "A KPI template stores one reusable definition configuration." },
  { title: "Measurement", description: "Set the measurement rule without assigning a target." },
  { title: "Classification", description: "Select its department classification and frequency." },
  { title: "Review", description: "No employee or numerical target will be assigned." },
  { title: "Save or publish", description: "Create a draft or publish this reusable template." },
]

export function KpiTemplateWizard({ token, definitions, onDone, onCancel }: { token: string; definitions: KpiDefinition[]; onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = React.useState(0), [form, setForm] = React.useState<KpiDefinitionForm>(templateInitial)
  const [sourceId, setSourceId] = React.useState("")
  const [classification, setClassification] = React.useState(""), [busy, setBusy] = React.useState(false), [error, setError] = React.useState("")
  const [saved, setSaved] = React.useState<KpiTemplate | null>(null)
  const savingRef = React.useRef(false)
  const [publish, setPublish] = React.useState(false)
  function update(key: keyof KpiDefinitionForm, value: string) { setForm((current) => ({ ...current, [key]: value })); setError("") }
  function next() {
    if (step === 0 && (!form.code.trim() || !form.name.trim() || !form.category.trim())) { setError("Enter the template code, name and category."); return }
    if (step === 1 && validateKpiDefinition(form)) { setError(validateKpiDefinition(form) ?? "Invalid measurement configuration."); return }
    setError(""); setStep((value) => value + 1)
  }
  async function submit() {
    if (savingRef.current || busy || saved) return
    const issue = validateKpiDefinition(form)
    if (issue) { setError(issue); return }
    savingRef.current = true; setBusy(true); setError("")
    try {
      const draft = await kpiApi.createTemplate(token, { ...form, code: form.code.trim().toUpperCase(), departmentClassification: classification.trim() })
      if (!publish) setSaved(draft)
      else { try { setSaved(await kpiApi.publishTemplate(token, draft.id)) } catch (cause) { setSaved(draft); setError(`Draft saved, but publication failed: ${cause instanceof Error ? cause.message : "Request failed"}`) } }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save template") }
    finally { savingRef.current = false; setBusy(false) }
  }
  if (saved) return <Saved text={`Template ${saved.code} ${saved.status === "published" ? "published" : "saved as draft"}.`} error={error} onDone={onDone} />
  return <div className="space-y-4"><KpiWizardProgress steps={templateSteps} step={step} />
    {step === 0 && <div className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><Choice label="Start from a published KPI (optional)" value={sourceId} options={[["","Start empty"], ...definitions.filter((row) => row.status === "published" && row.currentVersion?.publishedAt).map((row) => [String(row.id), `${row.code} · ${row.currentVersion?.name ?? ""}`] as [string,string])]} onChange={(value) => { setSourceId(value); const source = definitions.find((row) => row.id === Number(value)); if (source?.currentVersion) { const version = source.currentVersion; setForm({ code: "", name: version.name, description: version.description ?? "", category: version.category, strategicObjective: version.strategicObjective ?? "", measurementType: version.measurementType, measurementUnit: version.measurementUnit ?? "", direction: version.direction, frequency: version.frequency }) } }} /></div><Field label="Template code" required><Input value={form.code} onChange={(_, data) => update("code", data.value.toUpperCase())} /></Field><Field label="Template name" required><Input value={form.name} onChange={(_, data) => update("name", data.value)} /></Field><Field label="Category" required><Input value={form.category} onChange={(_, data) => update("category", data.value)} /></Field><Field label="Description"><Textarea value={form.description ?? ""} onChange={(_, data) => update("description", data.value)} /></Field></div>}
    {step === 1 && <Card className="grid gap-3 p-5 md:grid-cols-2"><Choice label="Measurement type" value={form.measurementType} options={[["numeric","Number"],["percentage","Percentage"],["currency","Currency"],["duration","Duration"],["binary","Binary"],["milestone","Milestone"],["qualitative","Qualitative"]]} onChange={(value) => setForm((current) => ({ ...current, measurementType: value, measurementUnit: value === "percentage" ? "%" : "", direction: ["binary","milestone","qualitative"].includes(value) ? "not_applicable" : "higher" }))} /><Field label="Measurement unit"><Input value={form.measurementUnit ?? ""} disabled={form.measurementType === "percentage"} onChange={(_, data) => update("measurementUnit", data.value)} /></Field>{!["binary","milestone","qualitative"].includes(form.measurementType) && <Choice label="Performance direction" value={form.direction} options={[["higher","Higher is better"],["lower","Lower is better"],["exact","Exact target"],["range","Acceptable range"]]} onChange={(value) => update("direction", value)} />}</Card>}
    {step === 2 && <Card className="grid gap-3 p-5 md:grid-cols-2"><Field label="Department classification"><Input value={classification} onChange={(_, data) => setClassification(data.value)} /></Field><Choice label="Reporting frequency" value={form.frequency} options={[["monthly","Monthly"],["quarterly","Quarterly"],["semiannual","Semiannual"],["annual","Annual"]]} onChange={(value) => update("frequency", value)} /><p className="text-sm md:col-span-2">This template does not contain scorecard entries or employee targets. Use Scorecard Templates for reusable multi-KPI structures.</p></Card>}
    {step >= 3 && <Card className="space-y-3 p-5"><Summary rows={[["Code",form.code],["Name",form.name],["Category",form.category],["Measurement",form.measurementType],["Unit",form.measurementUnit ?? ""],["Direction",form.direction],["Frequency",form.frequency],["Department",classification]]} />{step === 4 && <Choice label="Save action" value={publish ? "publish" : "draft"} options={[["draft","Save draft"],["publish","Save and publish"]]} onChange={(value) => setPublish(value === "publish")} />}</Card>}
    <KpiWizardControls step={step} steps={templateSteps} busy={busy} error={error} onBack={() => { setError(""); setStep((value) => value - 1) }} onNext={next} onCancel={onCancel} onFinish={() => void submit()} finishLabel={publish ? "Save and publish" : "Save draft"} confirmFinish={publish} />
  </div>
}

const periodSteps: KpiFlowStep[] = [
  { title: "Period information", description: "Choose a name and supported reporting frequency." },
  { title: "Date boundaries", description: "Use explicit dates. Existing organization timezone rules apply." },
  { title: "Review", description: "Confirm the range before creating a reporting period." },
]
export function KpiPeriodWizard({ token, onDone, onCancel }: { token: string; onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = React.useState(0), [label, setLabel] = React.useState(""), [frequency, setFrequency] = React.useState("monthly")
  const [startDate, setStartDate] = React.useState(""), [endDate, setEndDate] = React.useState(""), [busy, setBusy] = React.useState(false), [error, setError] = React.useState("")
  const [saved, setSaved] = React.useState<KpiPeriod | null>(null)
  const savingRef = React.useRef(false)
  function next() { if (step === 0 && !label.trim()) { setError("Enter a period name."); return } if (step === 1 && (!startDate || !endDate || endDate < startDate)) { setError("Enter a valid start and end date."); return } setError(""); setStep((value) => value + 1) }
  async function submit() { if (savingRef.current || busy || saved) return; savingRef.current = true; setBusy(true); setError(""); try { setSaved(await kpiApi.createPeriod(token, { label: label.trim(), frequency, startDate, endDate })) } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save period") } finally { savingRef.current = false; setBusy(false) } }
  if (saved) return <Saved text={`Reporting period ${saved.label} created.`} onDone={onDone} />
  return <div className="space-y-4"><KpiWizardProgress steps={periodSteps} step={step} />{step === 0 && <Card className="grid gap-3 p-5 md:grid-cols-2"><Field label="Period name" required><Input value={label} onChange={(_, data) => setLabel(data.value)} /></Field><Choice label="Frequency" value={frequency} options={[["monthly","Monthly"],["quarterly","Quarterly"],["semiannual","Semiannual"],["annual","Annual"]]} onChange={setFrequency} /></Card>}{step === 1 && <Card className="grid gap-3 p-5 md:grid-cols-2"><Field label="Start date" required><DateInput value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field><Field label="End date" required><DateInput value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field></Card>}{step === 2 && <Card className="p-5"><Summary rows={[["Name",label],["Frequency",frequency],["Start",startDate],["End",endDate]]} /></Card>}<KpiWizardControls step={step} steps={periodSteps} busy={busy} error={error} onBack={() => setStep((value) => value - 1)} onNext={next} onCancel={onCancel} onFinish={() => void submit()} finishLabel="Create period" confirmFinish /></div>
}

const assignmentSteps: KpiFlowStep[] = [
  { title: "Select subject", description: "Choose an existing employee or authorized organizational subject." },
  { title: "Select KPI", description: "Only published definitions can be assigned." },
  { title: "Reporting period", description: "The period must match the KPI reporting frequency." },
  { title: "Set target", description: "The target belongs to this assignment, not the KPI definition." },
  { title: "Review assignment", description: "Check subject, KPI, period and target." },
  { title: "Confirm", description: "Create one assignment. The backend checks scope and overlap." },
]
export function KpiAssignmentWizard({ token, definitions, periods, onDone, onCancel }: { token: string; definitions: KpiDefinition[]; periods: KpiPeriod[]; onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = React.useState(0), [subjectType, setSubjectType] = React.useState("employee"), [subjectId, setSubjectId] = React.useState("")
  const [subjectSearch, setSubjectSearch] = React.useState("")
  const [definitionId, setDefinitionId] = React.useState(""), [periodId, setPeriodId] = React.useState(""), [target, setTarget] = React.useState("")
  const [managerId, setManagerId] = React.useState(""), [subjects, setSubjects] = React.useState<AdminRecord[]>([])
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(""), [saved, setSaved] = React.useState<KpiAssignment | null>(null)
  const savingRef = React.useRef(false)
  React.useEffect(() => { let active = true; const timer = setTimeout(() => { const params = { limit: 100, search: subjectSearch.trim() }; const request = subjectType === "department" ? listDepartments(token, params) : subjectType === "branch" ? listBranches(token, params) : listEmployees(token, params); void request.then((data) => { if (active) setSubjects(data.rows) }).catch(() => { if (active) setSubjects([]) }) }, 200); return () => { active = false; clearTimeout(timer) } }, [token, subjectType, subjectSearch])
  const definition = definitions.find((row) => row.id === Number(definitionId))
  const matchingPeriods = periods.filter((row) => row.frequency === definition?.currentVersion?.frequency)
  function next() {
    let issue = ""
    if (step === 0 && (!subjectId || !Number.isInteger(Number(subjectId)) || Number(subjectId) < 1)) issue = "Select an authorized subject."
    if (step === 1 && (!definition || definition.status !== "published" || !definition.currentVersion?.publishedAt)) issue = "Select a published KPI definition."
    if (step === 2 && !matchingPeriods.some((row) => row.id === Number(periodId))) issue = "Select a reporting period matching the KPI frequency."
    if (step === 3) { try { targetFor(definition?.currentVersion?.measurementType ?? "", definition?.currentVersion?.direction ?? "", target) } catch (cause) { issue = cause instanceof Error ? cause.message : "Invalid target" } }
    if (issue) { setError(issue); return } setError(""); setStep((value) => value + 1)
  }
  async function submit() {
    if (savingRef.current || busy || saved || !definition?.currentVersion) return
    savingRef.current = true; setBusy(true); setError("")
    try { setSaved(await kpiApi.createAssignment(token, { subjectType, subjectId: Number(subjectId), definitionId: definition.id, periodId: Number(periodId), managerEmployeeId: managerId ? Number(managerId) : undefined, target: targetFor(definition.currentVersion.measurementType, definition.currentVersion.direction, target) })) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create assignment") }
    finally { savingRef.current = false; setBusy(false) }
  }
  if (saved) return <Saved text={`Assignment #${saved.id} created for ${saved.definitionVersion?.name ?? definition?.currentVersion?.name}.`} onDone={onDone} />
  return <div className="space-y-4"><KpiWizardProgress steps={assignmentSteps} step={step} />
    {step === 0 && <Card className="grid gap-3 p-5 md:grid-cols-2"><Choice label="Subject type" value={subjectType} options={[["employee","Employee"],["department","Department"],["branch","Branch"],["manager_group","Manager reporting group"]]} onChange={(value) => { setSubjectType(value); setSubjectId(""); setSubjectSearch("") }} /><Field label="Search subjects" hint="Search the existing HRMS records; results remain permission scoped."><Input value={subjectSearch} onChange={(_, data) => setSubjectSearch(data.value)} /></Field><Choice label="Authorized subject" value={subjectId} options={[["","Select a subject"], ...subjects.map((row) => [String(row.id), String(row.name ?? `#${row.id}`)] as [string,string])]} onChange={setSubjectId} /><Field label="Responsible manager employee ID" hint="Use an existing authorized manager where required."><Input type="number" value={managerId} onChange={(_, data) => setManagerId(data.value)} /></Field><p className="text-sm md:col-span-2">If a subject is not listed, ask HR to verify your scope. The backend checks every reference.</p></Card>}
    {step === 1 && <Card className="space-y-3 p-5"><Choice label="Published KPI" value={definitionId} options={[["","Select a KPI"], ...definitions.filter((row) => row.status === "published" && row.currentVersion?.publishedAt).map((row) => [String(row.id), `${row.code} · ${row.currentVersion?.name ?? ""}`] as [string,string])]} onChange={(value) => { setDefinitionId(value); setPeriodId("") }} /><p className="text-sm">Definitions describe the measure. This assignment will record a specific subject, period and target.</p></Card>}
    {step === 2 && <Card className="space-y-3 p-5"><Choice label="Reporting period" value={periodId} options={[["","Select a period"], ...matchingPeriods.map((row) => [String(row.id), row.label] as [string,string])]} onChange={setPeriodId} />{matchingPeriods.length === 0 && <MessageBar intent="info"><MessageBarBody>No matching period exists. Create a reporting period first.</MessageBarBody></MessageBar>}</Card>}
    {step === 3 && <Card className="space-y-3 p-5"><Field label={`Target ${definition?.currentVersion?.measurementUnit ?? ""}`} required hint="Numeric value, true/false, description, or min,max for a range."><Input value={target} onChange={(_, data) => setTarget(data.value)} /></Field><p className="text-sm">Target changes later require a reason and create a revision history.</p></Card>}
    {step >= 4 && <Card className="space-y-3 p-5"><Summary rows={[["Subject",`${subjectType} #${subjectId}`],["KPI",definition?.currentVersion?.name ?? ""],["Period",periods.find((row) => row.id === Number(periodId))?.label ?? ""],["Target",target],["Manager",managerId || "Not specified"]]} />{step === 5 && <MessageBar intent="info"><MessageBarBody>This action creates a real assignment. Overlaps and organization scope are validated by the backend.</MessageBarBody></MessageBar>}</Card>}
    <KpiWizardControls step={step} steps={assignmentSteps} busy={busy} error={error} onBack={() => setStep((value) => value - 1)} onNext={next} onCancel={onCancel} onFinish={() => void submit()} finishLabel="Create assignment" confirmFinish />
  </div>
}
