"use client"

import * as React from "react"
import { Button, Card, Field, Input, MessageBar, MessageBarBody, Option, Dropdown, Combobox, Textarea, Table, TableBody, TableCell, TableRow, ProgressBar, Tooltip } from "@fluentui/react-components"
import { Info16Regular } from "@fluentui/react-icons"
import { toast } from "@/components/ui/fluent-toast-store"
import { DateInput } from "@/components/ui/date-input"
import { listBranches, listDepartments, listEmployees, type AdminRecord } from "@/lib/admin-api"
import { kpiApi, type KpiDefinition, type KpiDefinitionForm, type KpiPeriod, type KpiTemplate } from "@/lib/kpi-api"
import { KpiWizardControls, KpiWizardProgress, type KpiFlowStep } from "./kpi-guided-flow"
import { validateKpiDefinition } from "./kpi-definition-validation"
import { targetFor } from "./kpi-target-input"

function Choice({ label, value, options, onChange, info }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void; info?: string }) {
  return <Field label={info ? <span className="inline-flex items-center gap-1">{label}<Tooltip content={info} relationship="description"><Button type="button" appearance="subtle" size="small" icon={<Info16Regular aria-hidden />} aria-label={`About ${label}`} /></Tooltip></span> : label} required><Dropdown aria-label={label} value={options.find(([id]) => id === value)?.[1] ?? ""} selectedOptions={[value]} onOptionSelect={(_, data) => onChange(data.optionValue ?? "")}>{options.map(([id, name]) => <Option key={id} value={id}>{name}</Option>)}</Dropdown></Field>
}
function Summary({ rows }: { rows: Array<[string, string]> }) {
  return <Table aria-label="Review configuration"><TableBody>{rows.map(([label, value]) => <TableRow key={label}><TableCell className="font-semibold">{label}</TableCell><TableCell>{value || "—"}</TableCell></TableRow>)}</TableBody></Table>
}
function Saved({ text, onDone, error }: { text: string; onDone: () => void; error?: string }) {
  return <Card className="space-y-3 p-5"><MessageBar intent="success" role="status"><MessageBarBody>{text}</MessageBarBody></MessageBar>{error && <MessageBar intent="error" role="alert"><MessageBarBody>{error}</MessageBarBody></MessageBar>}<Button appearance="primary" onClick={onDone}>Return to list</Button></Card>
}
function subjectLabel(row: AdminRecord, subjectType: string) {
  const value = (...keys: string[]) => {
    for (const key of keys) {
      const item = row[key]
      if (typeof item === "string" && item.trim()) return item.trim()
    }
    return ""
  }
  if (subjectType === "employee") {
    const name = value("full_name", "fullName", "name") || [value("first_name", "firstName"), value("last_name", "lastName")].filter(Boolean).join(" ")
    const number = value("employee_no", "employee_number", "employeeNumber", "employeeNo")
    return [name || value("email") || `Employee #${row.id}`, number ? `(${number})` : ""].filter(Boolean).join(" ")
  }
  return value("name", "department_name", "departmentName", "branch_name", "branchName", "title") || `#${row.id}`
}
function departmentIdForEmployee(row: AdminRecord | undefined) {
  if (!row) return undefined
  const asId = (value: unknown) => {
    const raw = value && typeof value === "object" ? (value as AdminRecord).id ?? (value as AdminRecord).department_id ?? (value as AdminRecord).departmentId : value
    const id = Number(raw)
    return Number.isInteger(id) && id > 0 ? id : undefined
  }
  const direct = asId(row.primary_department_id ?? row.primaryDepartmentId ?? row.department_id ?? row.departmentId ?? row.primary_department ?? row.primaryDepartment ?? row.department)
  if (direct) return direct
  const departments = Array.isArray(row.departments) ? row.departments as AdminRecord[] : []
  const primary = departments.find((item) => item.is_primary === true || item.isPrimary === true || item.is_primary === 1)
  return asId(primary) ?? asId(departments[0])
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
  { title: "Date boundaries", description: "Set the dates and time zone used for this reporting period." },
  { title: "Review", description: "Confirm the range before creating a reporting period." },
]
export function KpiPeriodWizard({ token, onCreated, onDone, onCancel }: { token: string; onCreated: (period: KpiPeriod) => void; onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = React.useState(0), [label, setLabel] = React.useState(""), [frequency, setFrequency] = React.useState("monthly")
  const [startDate, setStartDate] = React.useState(""), [endDate, setEndDate] = React.useState(""), [busy, setBusy] = React.useState(false), [error, setError] = React.useState("")
  const [timezone, setTimezone] = React.useState("Africa/Dar_es_Salaam")
  const [saved, setSaved] = React.useState<KpiPeriod | null>(null)
  const savingRef = React.useRef(false)
  function next() { if (step === 0 && !label.trim()) { setError("Enter a period name."); return } if (step === 1) { if (!startDate || !endDate || endDate < startDate) { setError("Enter a valid start and end date."); return } try { new Intl.DateTimeFormat("en", { timeZone: timezone.trim() }) } catch { setError("Enter a valid IANA time zone, such as Africa/Dar_es_Salaam."); return } } setError(""); setStep((value) => value + 1) }
  async function submit() { if (savingRef.current || busy || saved) return; savingRef.current = true; setBusy(true); setError(""); try { const period = await kpiApi.createPeriod(token, { label: label.trim(), frequency, startDate, endDate, timezone: timezone.trim() }); setSaved(period); onCreated(period) } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save period") } finally { savingRef.current = false; setBusy(false) } }
  if (saved) return <Saved text={`Reporting period ${saved.label} created.`} onDone={onDone} />
  return <div className="space-y-5">
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="font-semibold">{periodSteps[step].title}</h2><p className="text-sm text-muted-foreground">{periodSteps[step].description}</p></div>
        <span className="shrink-0 text-sm text-muted-foreground">Step {step + 1} of {periodSteps.length}</span>
      </div>
      <ProgressBar value={(step + 1) / periodSteps.length} aria-label={`Step ${step + 1} of ${periodSteps.length}`} />
    </div>
    {step === 0 && <div className="grid gap-4 md:grid-cols-2">
      <Field label="Period name" required><Input value={label} onChange={(_, data) => setLabel(data.value)} /></Field>
      <Choice label="Frequency" value={frequency} options={[["monthly", "Monthly"], ["quarterly", "Quarterly"], ["semiannual", "Twice a year"], ["annual", "Yearly"]]} onChange={setFrequency} info="Frequency means how often results are reported: Monthly is every month; Quarterly is every 3 months; Twice a year is every 6 months; Yearly is once a year." />
    </div>}
    {step === 1 && <div className="grid gap-4 md:grid-cols-2"><Field label="Start date" required><DateInput value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field><Field label="End date" required><DateInput value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field><Field label="Time zone" required hint="Use an IANA time zone, such as Africa/Dar_es_Salaam."><Input value={timezone} list="kpi-timezones" onChange={(_, data) => setTimezone(data.value)} /></Field><datalist id="kpi-timezones"><option value="Africa/Dar_es_Salaam" /><option value="Africa/Nairobi" /><option value="Africa/Kampala" /><option value="UTC" /></datalist></div>}
    {step === 2 && <Summary rows={[["Name", label], ["Frequency", frequency.replace("semiannual", "twice a year").replace("annual", "yearly")], ["Start", startDate], ["End", endDate], ["Time zone", timezone]]} />}
    <KpiWizardControls step={step} steps={periodSteps} busy={busy} error={error} onBack={() => setStep((value) => value - 1)} onNext={next} onCancel={onCancel} onFinish={() => void submit()} finishLabel="Create period" confirmFinish />
  </div>
}

const assignmentSteps: KpiFlowStep[] = [
  { title: "Select subject", description: "Choose an existing employee or authorized organizational subject." },
  { title: "Select KPI", description: "Only published definitions can be assigned." },
  { title: "Reporting period", description: "The period must match the KPI reporting frequency." },
  { title: "Set target", description: "The target belongs to this assignment, not the KPI definition." },
  { title: "Review assignment", description: "Check subject, KPI, period and target, then create the assignment." },
]
export function KpiAssignmentWizard({ token, definitions, periods, initialDefinitionId = "", initialPeriodId = "", onDone, onCancel }: { token: string; definitions: KpiDefinition[]; periods: KpiPeriod[]; initialDefinitionId?: string; initialPeriodId?: string; onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = React.useState(0), [subjectType, setSubjectType] = React.useState("employee"), [subjectId, setSubjectId] = React.useState("")
  const [subjectSearch, setSubjectSearch] = React.useState("")
  const [definitionId, setDefinitionId] = React.useState(initialDefinitionId), [periodId, setPeriodId] = React.useState(initialPeriodId), [target, setTarget] = React.useState("")
  const [managerId, setManagerId] = React.useState(""), [managerSearch, setManagerSearch] = React.useState(""), [managerOptions, setManagerOptions] = React.useState<AdminRecord[]>([]), [subjects, setSubjects] = React.useState<AdminRecord[]>([])
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState("")
  const savingRef = React.useRef(false)
  const selectedSubject = subjects.find((row) => String(row.id) === subjectId)
  const managerDepartmentId = subjectType === "department" && Number(subjectId) > 0 ? Number(subjectId) : subjectType === "employee" ? departmentIdForEmployee(selectedSubject) : undefined
  React.useEffect(() => { let active = true; const timer = setTimeout(() => { const params = { limit: 100, search: subjectId ? "" : subjectSearch.trim() }; const request = subjectType === "department" ? listDepartments(token, params) : subjectType === "branch" ? listBranches(token, params) : listEmployees(token, params); void request.then((data) => { if (active) setSubjects(data.rows) }).catch(() => { if (active) setSubjects([]) }) }, 200); return () => { active = false; clearTimeout(timer) } }, [token, subjectType, subjectSearch, subjectId])
  React.useEffect(() => { let active = true; const timer = setTimeout(() => { void listEmployees(token, { limit: 100, search: managerId ? "" : managerSearch.trim(), department_id: managerDepartmentId }).then((data) => { if (active) setManagerOptions(data.rows) }).catch(() => { if (active) setManagerOptions([]) }) }, 200); return () => { active = false; clearTimeout(timer) } }, [token, managerSearch, managerId, managerDepartmentId])
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
    if (savingRef.current || busy || !definition?.currentVersion) return
    savingRef.current = true; setBusy(true); setError("")
    try {
      const assignment = await kpiApi.createAssignment(token, { subjectType, subjectId: Number(subjectId), definitionId: definition.id, periodId: Number(periodId), managerEmployeeId: managerId ? Number(managerId) : undefined, target: targetFor(definition.currentVersion.measurementType, definition.currentVersion.direction, target) })
      toast.success(`Assignment #${assignment.id} created for ${assignment.definitionVersion?.name ?? definition.currentVersion.name}.`)
      onDone()
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create assignment") }
    finally { savingRef.current = false; setBusy(false) }
  }
  return <div className="space-y-4"><KpiWizardProgress steps={assignmentSteps} step={step} />
    {step === 0 && <div className="grid gap-4 md:grid-cols-2"><Choice label="Subject type" value={subjectType} options={[["employee","Employee"],["department","Department"],["branch","Branch"],["manager_group","Manager reporting group"]]} onChange={(value) => { setSubjectType(value); setSubjectId(""); setSubjectSearch(""); setManagerId(""); setManagerSearch("") }} /><div className="md:col-span-2"><Field label="Authorized subject" hint="Search and select an existing subject. Results are limited to your permission scope."><div className="relative"><Combobox aria-label="Authorized subject" placeholder="Search by name" value={subjectSearch} selectedOptions={subjectId ? [subjectId] : []} onChange={(event) => { setSubjectSearch(event.target.value); setSubjectId(""); setManagerId(""); setManagerSearch("") }} onOptionSelect={(_, data) => { const selected = subjects.find((row) => String(row.id) === data.optionValue); if (selected) { setSubjectId(String(selected.id)); setSubjectSearch(subjectLabel(selected, subjectType)); setManagerId(""); setManagerSearch("") } }} className="!w-full">{subjects.map((row) => <Option key={String(row.id)} value={String(row.id)} text={subjectLabel(row, subjectType)}>{subjectLabel(row, subjectType)}</Option>)}</Combobox></div></Field></div><div className="md:col-span-2"><Field label="Responsible manager (optional)" hint={managerDepartmentId ? "Choose a manager from the selected employee’s department. Leave blank if no separate manager is needed." : "Choose the manager who will oversee this assignment. Leave blank if no separate manager is needed."}><div className="relative"><Combobox aria-label="Responsible manager (optional)" placeholder="Search by name" value={managerSearch} selectedOptions={managerId ? [managerId] : []} onChange={(event) => { setManagerSearch(event.target.value); setManagerId("") }} onOptionSelect={(_, data) => { const selected = managerOptions.find((row) => String(row.id) === data.optionValue); if (selected) { setManagerId(String(selected.id)); setManagerSearch(subjectLabel(selected, "employee")) } }} className="!w-full">{managerOptions.map((row) => <Option key={String(row.id)} value={String(row.id)} text={subjectLabel(row, "employee")}>{subjectLabel(row, "employee")}</Option>)}</Combobox></div>{managerDepartmentId && managerOptions.length === 0 && <p className="mt-1 text-sm text-muted-foreground">No manager is available in this department.</p>}</Field></div><p className="text-sm md:col-span-2">Can&apos;t find a subject? Ask HR to check that it is available to you.</p></div>}
    {step === 1 && <Card className="space-y-3 p-5"><Choice label="Published KPI" value={definitionId} options={[["","Select a KPI"], ...definitions.filter((row) => row.status === "published" && row.currentVersion?.publishedAt).map((row) => [String(row.id), `${row.code} · ${row.currentVersion?.name ?? ""}`] as [string,string])]} onChange={(value) => { setDefinitionId(value); setPeriodId("") }} /><p className="text-sm">Definitions describe the measure. This assignment will record a specific subject, period and target.</p></Card>}
    {step === 2 && <Card className="space-y-3 p-5"><Choice label="Reporting period" value={periodId} options={[["","Select a period"], ...matchingPeriods.map((row) => [String(row.id), row.label] as [string,string])]} onChange={setPeriodId} />{matchingPeriods.length === 0 && <MessageBar intent="info"><MessageBarBody>No matching period exists. Create a reporting period first.</MessageBarBody></MessageBar>}</Card>}
    {step === 3 && <Card className="space-y-3 p-5"><Field label={`Target ${definition?.currentVersion?.measurementUnit ?? ""}`} required hint="Numeric value, true/false, description, or min,max for a range."><Input value={target} onChange={(_, data) => setTarget(data.value)} /></Field><p className="text-sm">Target changes later require a reason and create a revision history.</p></Card>}
    {step === 4 && <Card className="space-y-3 p-5"><Summary rows={[["Subject",subjects.find((row) => String(row.id) === subjectId) ? subjectLabel(subjects.find((row) => String(row.id) === subjectId)!, subjectType) : subjectType],["KPI",definition?.currentVersion?.name ?? ""],["Period",periods.find((row) => row.id === Number(periodId))?.label ?? ""],["Target",target],["Manager",managerOptions.find((row) => String(row.id) === managerId) ? subjectLabel(managerOptions.find((row) => String(row.id) === managerId)!, "employee") : "Not specified"]]} /></Card>}
    <KpiWizardControls step={step} steps={assignmentSteps} busy={busy} error={error} onBack={() => setStep((value) => value - 1)} onNext={next} onCancel={onCancel} onFinish={() => void submit()} finishLabel="Create assignment" />
  </div>
}
