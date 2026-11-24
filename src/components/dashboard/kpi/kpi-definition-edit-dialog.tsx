"use client"

import * as React from "react"
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input, Textarea } from "@fluentui/react-components"
import { Dismiss16Regular, Save16Regular } from "@fluentui/react-icons"
import { FluentSelect } from "@/components/ui/fluent-select"
import { kpiApi, type KpiDefinitionForm } from "@/lib/kpi-api"
import { readKpiToken } from "@/lib/kpi-session"
import { validateKpiDefinition } from "./kpi-definition-validation"

const measurementOptions = [
  { value: "numeric", label: "Number or count" },
  { value: "percentage", label: "Percentage" },
  { value: "currency", label: "Monetary value" },
  { value: "duration", label: "Time or duration" },
  { value: "binary", label: "Yes or no" },
  { value: "milestone", label: "Milestone" },
  { value: "qualitative", label: "Qualitative" },
]
const directionOptions = [
  { value: "higher", label: "Higher is better" },
  { value: "lower", label: "Lower is better" },
  { value: "exact", label: "Exact target" },
  { value: "range", label: "Acceptable range" },
  { value: "not_applicable", label: "Not applicable" },
]
const frequencyOptions = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semiannual", label: "Semiannual" },
  { value: "annual", label: "Annual" },
]

export function KpiDefinitionEditDialog({ definitionId, onClose, onSaved }: {
  definitionId: number | null
  onClose: () => void
  onSaved: () => void
}) {
  const token = readKpiToken()
  const [form, setForm] = React.useState<KpiDefinitionForm | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const savingRef = React.useRef(false)

  React.useEffect(() => {
    if (definitionId === null) return
    let active = true
    setForm(null)
    setError("")
    setLoading(true)
    if (!token) {
      setError("Sign in again to edit this KPI.")
      setLoading(false)
      return
    }
    void kpiApi.definition(token, definitionId).then((definition) => {
      if (!active) return
      const draft = definition.versions?.[0]
      if (!draft || draft.publishedAt) throw new Error("This KPI has no editable draft.")
      setForm({
        code: definition.code,
        name: draft.name,
        description: draft.description ?? "",
        category: draft.category,
        strategicObjective: draft.strategicObjective ?? "",
        measurementType: draft.measurementType,
        measurementUnit: draft.measurementUnit ?? "",
        direction: draft.direction,
        frequency: draft.frequency,
        ownerEmployeeId: draft.ownerEmployeeId ?? undefined,
      })
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load this KPI draft.")
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [definitionId, token])

  function change<K extends keyof KpiDefinitionForm>(key: K, value: KpiDefinitionForm[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current)
    setError("")
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form || definitionId === null || !token || savingRef.current) return
    const problem = validateKpiDefinition(form)
    if (problem) { setError(problem); return }
    savingRef.current = true
    setBusy(true)
    setError("")
    try {
      await kpiApi.updateDefinition(token, definitionId, {
        ...form,
        name: form.name.trim(),
        category: form.category.trim(),
        code: form.code.trim().toUpperCase(),
      })
      window.dispatchEvent(new Event("hrms:refresh-page-data"))
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this KPI draft.")
    } finally {
      savingRef.current = false
      setBusy(false)
    }
  }

  return <Dialog open={definitionId !== null} onOpenChange={(_, data) => { if (!data.open && !busy) onClose() }}>
    <DialogSurface style={{ width: "min(760px, calc(100vw - 32px))", maxWidth: "calc(100vw - 32px)" }} className="max-h-[calc(100dvh-32px)] overflow-y-auto">
      <DialogBody>
        <DialogTitle>Edit draft KPI</DialogTitle>
        <DialogContent>
          {loading && <p role="status" className="py-6 text-sm text-muted-foreground">Loading draft…</p>}
          {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
          {form && <form id="edit-kpi-draft-form" onSubmit={(event) => void save(event)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="KPI name" required><Input value={form.name} maxLength={160} onChange={(_, data) => change("name", data.value)} /></Field>
              <Field label="KPI code" hint="The code cannot change after creation."><Input value={form.code} disabled /></Field>
              <Field label="Category" required><Input value={form.category} maxLength={100} onChange={(_, data) => change("category", data.value)} /></Field>
              <Field label="Strategic objective"><Input value={form.strategicObjective ?? ""} onChange={(_, data) => change("strategicObjective", data.value)} /></Field>
              <Field label="Description" className="sm:col-span-2"><Textarea value={form.description ?? ""} rows={3} onChange={(_, data) => change("description", data.value)} /></Field>
            </div>
            <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
              <FluentSelect label="Measurement type" value={form.measurementType} options={measurementOptions} onChange={(value) => setForm((current) => current ? { ...current, measurementType: value, measurementUnit: value === "percentage" ? "%" : "", direction: ["binary", "milestone", "qualitative"].includes(value) ? "not_applicable" : "higher" } : current)} />
              <FluentSelect label="Performance direction" value={form.direction} options={directionOptions.filter((option) => ["binary", "milestone", "qualitative"].includes(form.measurementType) ? option.value === "not_applicable" : option.value !== "not_applicable")} onChange={(value) => change("direction", value)} />
              <Field label="Measurement unit" hint={form.measurementType === "currency" ? "Use a three-letter currency code such as TZS." : form.measurementType === "duration" ? "Use seconds, minutes, hours or days." : undefined}><Input value={form.measurementUnit ?? ""} disabled={form.measurementType === "percentage" || form.measurementType === "binary"} maxLength={60} onChange={(_, data) => change("measurementUnit", form.measurementType === "currency" ? data.value.toUpperCase() : data.value)} /></Field>
              <FluentSelect label="Reporting frequency" value={form.frequency} options={frequencyOptions} onChange={(value) => change("frequency", value)} />
              <Field label="Owner employee ID" hint="Optional"><Input type="number" min={1} value={form.ownerEmployeeId?.toString() ?? ""} onChange={(_, data) => change("ownerEmployeeId", data.value ? Number(data.value) : undefined)} /></Field>
            </div>
          </form>}
        </DialogContent>
        <DialogActions>
          <Button appearance="secondary" icon={<Dismiss16Regular aria-hidden="true" />} disabled={busy} onClick={onClose}>Cancel</Button>
          <Button appearance="primary" icon={<Save16Regular aria-hidden="true" />} disabled={!form || busy} type="submit" form="edit-kpi-draft-form">{busy ? "Saving…" : "Save draft"}</Button>
        </DialogActions>
      </DialogBody>
    </DialogSurface>
  </Dialog>
}
