"use client"

import * as React from "react"
import {
  Button, Card, Dialog, DialogActions, DialogBody, DialogContent,
  DialogSurface, DialogTitle, Dropdown, Field, Input, MessageBar,
  MessageBarBody, Option, Table, TableBody, TableCell,
  TableRow, Textarea, Tooltip,
} from "@fluentui/react-components"
import { CheckmarkCircle24Filled, Info20Regular } from "@fluentui/react-icons"
import { kpiApi, type KpiDefinition, type KpiDefinitionForm, type KpiPeriod } from "@/lib/kpi-api"
import { validateKpiDefinition, validateKpiDefinitionStep } from "./kpi-definition-validation"

const initial: KpiDefinitionForm = {
  code: "", name: "", description: "", category: "", strategicObjective: "",
  measurementType: "numeric", measurementUnit: "", direction: "higher", frequency: "monthly",
}

const types = [
  ["percentage", "Percentage"], ["numeric", "Number or count"], ["currency", "Monetary value"],
  ["duration", "Time or duration"], ["binary", "Yes or no"], ["milestone", "Milestone"],
  ["qualitative", "Qualitative"],
] as const
const directions = [
  ["higher", "Higher is better"], ["lower", "Lower is better"],
  ["exact", "Exact target"], ["range", "Acceptable range"],
] as const
const frequencies = [
  ["monthly", "Monthly"], ["quarterly", "Quarterly"], ["semiannual", "Semiannual"], ["annual", "Annual"],
] as const

function Choice({ value, choices, onChange, label }: {
  value: string; choices: readonly (readonly [string, string])[]; onChange: (value: string) => void; label: string
}) {
  const selected = choices.find(([key]) => key === value)
  return <Dropdown aria-label={label} value={selected?.[1] ?? ""} selectedOptions={[value]} onOptionSelect={(_, data) => onChange(data.optionValue ?? "")} className="w-full min-w-0 [&_.fui-Dropdown__button]:!w-full [&_.fui-Dropdown__button]:!min-w-0">
    {choices.map(([key, text]) => <Option key={key} value={key} text={text}>{text}</Option>)}
  </Dropdown>
}

export function KpiCreationWizard({ token, periods, onCancel, onCreated }: {
  token: string; periods: KpiPeriod[]; onCancel: () => void; onCreated?: () => void
}) {
  const [step, setStep] = React.useState(1)
  const [form, setForm] = React.useState<KpiDefinitionForm>(initial)
  const [periodId, setPeriodId] = React.useState("")
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [confirmDiscard, setConfirmDiscard] = React.useState(false)
  const [created, setCreated] = React.useState<KpiDefinition | null>(null)
  const [notice, setNotice] = React.useState("")
  const savingRef = React.useRef(false)
  const matchingPeriods = periods.filter((period) => period.frequency === form.frequency)

  function change<K extends keyof KpiDefinitionForm>(key: K, value: KpiDefinitionForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setError("")
  }
  function next() {
    const section = step === 1 ? "basic" : step === 2 ? "measurement" : "planning"
    const problem = validateKpiDefinitionStep(form, section)
    if (problem) { setError(problem); return }
    setError("")
    setStep((current) => Math.min(4, current + 1))
  }
  function cancel() {
    if (JSON.stringify(form) !== JSON.stringify(initial) || periodId) setConfirmDiscard(true)
    else onCancel()
  }
  async function save(publish: boolean) {
    if (savingRef.current || busy || created) return
    const problem = validateKpiDefinition(form)
    if (problem) { setError(problem); return }
    savingRef.current = true; setBusy(true); setError(""); setNotice("")
    try {
      const draft = await kpiApi.createDefinition(token, { ...form, code: form.code.trim().toUpperCase(), name: form.name.trim(), category: form.category.trim() })
      setCreated(draft)
      setStep(5)
      if (publish) {
        try {
          const published = await kpiApi.publishDefinition(token, draft.id)
          setCreated(published)
          setNotice("KPI published. You can now assign it to an authorized subject.")
        } catch (cause) {
          setError(`Draft saved, but publication failed: ${cause instanceof Error ? cause.message : "Request failed"}`)
        }
      } else setNotice("Draft KPI saved. Publish it when its definition is ready.")
      onCreated?.()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not save KPI"
      setError(/KPI role and active company are required|Active company context is required/i.test(message)
        ? "This account cannot create a KPI in the active company. Check that your role has KPI creation access, then sign in again. Your entries are still here."
        : message)
    } finally { savingRef.current = false; setBusy(false) }
  }

  return <div className="space-y-5" aria-label="Guided KPI creation">
    {error && <MessageBar intent="error" role="alert"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
    {notice && <MessageBar intent="success" role="status"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}

    {step === 1 && <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><h3 className="font-semibold">Describe what will be measured</h3><p className="text-sm text-muted-foreground">Choose a clear result you can measure, such as tasks completed, customer ratings, time to resolve a request, or orders delivered on time.</p></div>
      <Field label="KPI name" required className="content-start"><Input value={form.name} maxLength={160} onChange={(_, data) => change("name", data.value)} placeholder="e.g. Monthly Policy Renewal Rate" /></Field>
      <Field label="KPI code" required hint="2–80 letters, digits, underscores or hyphens; start with a letter." className="content-start"><Input value={form.code} maxLength={80} onChange={(_, data) => change("code", data.value.toUpperCase())} placeholder="e.g. RENEWAL_RATE" /></Field>
      <Field label="Category" required className="content-start"><Input value={form.category} maxLength={100} onChange={(_, data) => change("category", data.value)} placeholder="e.g. Sales" /></Field>
      <Field label="Strategic objective or purpose" className="content-start"><Input value={form.strategicObjective ?? ""} onChange={(_, data) => change("strategicObjective", data.value)} /></Field>
      <Field label="Description" className="content-start md:col-span-2"><Textarea value={form.description ?? ""} onChange={(_, data) => change("description", data.value)} rows={3} placeholder="What does this KPI measure, and why?" /></Field>
    </div>}

    {step === 2 && <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><h3 className="font-semibold">Choose a measurement rule</h3><p className="text-sm text-muted-foreground">The definition describes the measure. Actual values and targets are recorded later on assignments; scorecards use the existing scoring policy.</p></div>
      <Field label="Measurement type" required className="min-w-0 content-start"><Choice label="Measurement type" value={form.measurementType} choices={types} onChange={(value) => setForm((current) => ({ ...current, measurementType: value, measurementUnit: value === "percentage" ? "%" : "", direction: ["binary", "milestone", "qualitative"].includes(value) ? "not_applicable" : "higher" }))} /></Field>
      {!["binary", "milestone", "qualitative"].includes(form.measurementType) && <Field label="Performance direction" required hint="Higher is better for rates or volume; lower is better for time or cost." className="min-w-0 content-start"><Choice label="Performance direction" value={form.direction} choices={directions} onChange={(value) => change("direction", value)} /></Field>}
      {form.measurementType === "currency" && <Field label="Currency code" required hint="Use a three-letter ISO code such as TZS." className="min-w-0 content-start"><Input value={form.measurementUnit ?? ""} maxLength={3} onChange={(_, data) => change("measurementUnit", data.value.toUpperCase())} /></Field>}
      {form.measurementType === "duration" && <Field label="Duration unit" required className="min-w-0 content-start"><Choice label="Duration unit" value={form.measurementUnit ?? ""} choices={[["seconds", "Seconds"], ["minutes", "Minutes"], ["hours", "Hours"], ["days", "Days"]]} onChange={(value) => change("measurementUnit", value)} /></Field>}
      {form.measurementType === "numeric" && <Field label="Measurement unit" hint="Optional, for example policies or claims." className="min-w-0 content-start"><Input value={form.measurementUnit ?? ""} onChange={(_, data) => change("measurementUnit", data.value)} /></Field>}
      {form.measurementType === "percentage" && <Field label="Measurement unit" className="min-w-0 content-start"><Input value="%" disabled /></Field>}
      {["binary", "milestone", "qualitative"].includes(form.measurementType) && <p className="md:col-span-2 text-sm text-muted-foreground">This measurement has no numeric direction. Any rubric or scoring rule must come from an approved scoring policy.</p>}
    </div>}

    {step === 3 && <div className="space-y-4">
      <div className="flex items-center gap-2"><h3 className="font-semibold">Plan the reporting period and target</h3><Tooltip content="Choose how often the KPI is reported. Employee-specific targets are set only when the KPI is assigned. This wizard will not change an employee record or assign a target." relationship="description"><Button appearance="subtle" size="small" icon={<Info20Regular />} aria-label="About reporting periods" /></Tooltip></div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Reporting frequency" required className="content-start"><Choice label="Reporting frequency" value={form.frequency} choices={frequencies} onChange={(value) => { change("frequency", value); setPeriodId("") }} /></Field>
        <Field label="Period for the next assignment" hint="Optional. This selection is only carried to the assignment form after saving." className="content-start"><Choice label="Period for the next assignment" value={periodId} choices={[["", "Choose later"], ...matchingPeriods.map((period) => [String(period.id), period.label] as const)]} onChange={setPeriodId} /></Field></div>
      {matchingPeriods.length === 0 && <div role="status" className="flex items-start gap-3 rounded-md px-4 py-3 text-sm" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}><Info20Regular className="mt-0.5 shrink-0" aria-hidden="true" /><p>No {form.frequency} period is configured yet. Save the definition, then create a reporting period before assignment.</p></div>}
    </div>}

    {step === 4 && <Card className="space-y-4 p-5"><div><h3 className="font-semibold">Review your KPI</h3><p className="text-sm text-muted-foreground">Saving creates a draft. Publishing makes the version available for assignments. Neither action assigns employees or sets targets.</p></div>
      <Table aria-label="KPI definition review"><TableBody>{[
        ["Name", form.name], ["Code", form.code.toUpperCase()], ["Category", form.category],
        ["Description", form.description || "—"], ["Objective", form.strategicObjective || "—"],
        ["Measurement", types.find(([value]) => value === form.measurementType)?.[1] ?? form.measurementType],
        ["Unit", form.measurementUnit || "—"], ["Direction", form.direction.replaceAll("_", " ")],
        ["Frequency", form.frequency], ["Next assignment period", matchingPeriods.find((period) => String(period.id) === periodId)?.label ?? "Choose later"],
      ].map(([key, value]) => <TableRow key={key}><TableCell className="font-medium">{key}</TableCell><TableCell>{value}</TableCell></TableRow>)}</TableBody></Table>
    </Card>}

    {step === 5 && created && <Card className="space-y-4 p-5"><div className="flex items-center gap-3"><CheckmarkCircle24Filled className="text-[color:var(--colorPaletteGreenForeground1)]" aria-hidden /><div><h3 className="font-semibold">KPI {created.status === "published" ? "published" : "draft saved"}</h3><p className="text-sm text-muted-foreground">{created.currentVersion?.name ?? form.name} · {created.code} · {created.status}</p></div></div>
      <p className="text-sm text-muted-foreground">{created.status === "published" ? "You can now assign this KPI and set a target." : "Publish the draft before using it in a new assignment."}</p>
      <div className="flex flex-wrap gap-2"><Button as="a" href={`/dashboard/kpi/definitions/${created.id}`} appearance="primary">View created KPI</Button>{created.status === "published" && <Button as="a" href={`/dashboard/kpi/assignments?definition=${created.id}${periodId ? `&period=${periodId}` : ""}`} appearance="secondary">Assign KPI</Button>}<Button appearance="secondary" onClick={() => { setForm(initial); setPeriodId(""); setCreated(null); setNotice(""); setError(""); setStep(1) }}>Create another KPI</Button><Button as="a" href="/dashboard/kpi" appearance="subtle">Return to KPI Library</Button></div>
    </Card>}

    {step < 5 && <div className="flex flex-wrap justify-between gap-2"><Button appearance="subtle" onClick={cancel} disabled={busy}>Cancel</Button><div className="flex flex-wrap gap-2">{step > 1 && <Button appearance="secondary" disabled={busy} onClick={() => { setError(""); setStep((current) => current - 1) }}>Back</Button>}{step < 4 ? <Button appearance="primary" onClick={next}>Continue</Button> : <><Button appearance="secondary" disabled={busy} onClick={() => void save(false)}>{busy ? "Saving…" : "Save Draft"}</Button><Button appearance="primary" disabled={busy} onClick={() => void save(true)}>{busy ? "Saving…" : "Save & Publish"}</Button></>}</div></div>}

    <Dialog open={confirmDiscard} onOpenChange={(_, data) => setConfirmDiscard(data.open)}><DialogSurface><DialogBody><DialogTitle>Discard this KPI?</DialogTitle><DialogContent>Your unsaved definition information will be lost.</DialogContent><DialogActions><Button appearance="secondary" onClick={() => setConfirmDiscard(false)}>Keep editing</Button><Button appearance="primary" onClick={() => { setConfirmDiscard(false); onCancel() }}>Discard changes</Button></DialogActions></DialogBody></DialogSurface></Dialog>
  </div>
}
