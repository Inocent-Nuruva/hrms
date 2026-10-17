"use client"

import * as React from "react"
import { toast } from "@/components/ui/fluent-toast-store"
import {
  downloadEmploymentLetter,
  generateEmploymentLetter,
  listEmploymentLetterTemplates,
  saveEmploymentLetterTemplate,
  type AdminRecord,
} from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"

type LetterKind = "OFFER" | "APPOINTMENT"
type TemplateForm = { title: string; body: string; signatory_name: string; signatory_title: string }
const EMPTY: TemplateForm = { title: "", body: "", signatory_name: "", signatory_title: "" }
const FIELDS = "{{company_name}}, {{employee_name}}, {{employee_number}}, {{position}}, {{department}}, {{hire_date}}, {{salary}}, {{currency}}, {{pay_frequency}}, {{issue_date}}"

export function EmploymentLettersView() {
  const [templates, setTemplates] = React.useState<AdminRecord[]>([])
  const [kind, setKind] = React.useState<LetterKind>("OFFER")
  const [form, setForm] = React.useState<TemplateForm>(EMPTY)
  const [recordId, setRecordId] = React.useState("")
  const [generatedId, setGeneratedId] = React.useState<number | null>(null)
  const [busy, setBusy] = React.useState(false)

  const token = () => readStoredSessionTokens().accessToken.trim()
  const load = React.useCallback(async () => {
    const access = token()
    if (!access) return
    const rows = await listEmploymentLetterTemplates(access)
    setTemplates(rows)
  }, [])

  React.useEffect(() => { void load().catch((error) => toast.error(error instanceof Error ? error.message : "Could not load letter templates.")) }, [load])
  React.useEffect(() => {
    const row = templates.find((item) => String(item.letter_type ?? item.letterType).toUpperCase() === kind)
    setForm(row ? {
      title: String(row.title ?? ""),
      body: String(row.body ?? ""),
      signatory_name: String(row.signatory_name ?? row.signatoryName ?? ""),
      signatory_title: String(row.signatory_title ?? row.signatoryTitle ?? ""),
    } : EMPTY)
  }, [kind, templates])

  async function save() {
    const access = token()
    if (!access) return
    setBusy(true)
    try {
      await saveEmploymentLetterTemplate(access, { letter_type: kind, ...form })
      await load()
      toast.success("Letter template saved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the template.")
    } finally { setBusy(false) }
  }

  async function generate() {
    const access = token()
    const id = Number(recordId)
    if (!access || !Number.isInteger(id) || id < 1) return
    setBusy(true)
    try {
      const result = await generateEmploymentLetter(access, kind === "OFFER" ? "offer" : "appointment", id)
      if (!result) throw new Error("The letter was generated but no document record was returned.")
      setGeneratedId(Number(result.id))
      toast.success("Letter generated.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate the letter.")
    } finally { setBusy(false) }
  }

  async function download() {
    const access = token()
    if (!access || !generatedId) return
    try {
      const blob = await downloadEmploymentLetter(access, generatedId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${kind.toLowerCase()}-letter.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download the letter.")
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold">Employment letter templates</h2>
          <p className="mt-1 text-sm text-muted-foreground">Available fields: {FIELDS}</p>
        </div>
        <label className="grid gap-1 text-sm">Letter type
          <select className="h-10 rounded-md border border-border bg-background px-3" value={kind} onChange={(event) => setKind(event.target.value as LetterKind)}>
            <option value="OFFER">Offer</option><option value="APPOINTMENT">Appointment</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">Title<input className="h-10 rounded-md border border-border bg-background px-3" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label className="grid gap-1 text-sm">Letter body<textarea className="min-h-44 rounded-md border border-border bg-background p-3" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">Signatory name<input className="h-10 rounded-md border border-border bg-background px-3" value={form.signatory_name} onChange={(event) => setForm({ ...form, signatory_name: event.target.value })} /></label>
          <label className="grid gap-1 text-sm">Signatory title<input className="h-10 rounded-md border border-border bg-background px-3" value={form.signatory_title} onChange={(event) => setForm({ ...form, signatory_title: event.target.value })} /></label>
        </div>
        <button type="button" disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" onClick={() => void save()}>{busy ? "Saving…" : "Save template"}</button>
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div><h2 className="text-base font-semibold">Generate a letter</h2><p className="mt-1 text-sm text-muted-foreground">Offer letters use a recruitment candidate ID. Appointment letters use an employee ID.</p></div>
        <label className="grid gap-1 text-sm">{kind === "OFFER" ? "Recruitment candidate ID" : "Employee ID"}<input inputMode="numeric" className="h-10 rounded-md border border-border bg-background px-3" value={recordId} onChange={(event) => setRecordId(event.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || !recordId} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" onClick={() => void generate()}>{busy ? "Working…" : `Generate ${kind.toLowerCase()} letter`}</button>
          {generatedId ? <button type="button" className="rounded-md border border-border px-4 py-2 text-sm font-medium" onClick={() => void download()}>Download PDF</button> : null}
        </div>
      </div>
    </section>
  )
}
