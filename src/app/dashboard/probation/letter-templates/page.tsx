"use client"

import * as React from "react"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { listProbationLetterTemplates, saveProbationLetterTemplate, type AdminRecord } from "@/lib/admin-api"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const types = { CONFIRMATION: "Confirmation", EXTENSION: "Extension", NOT_CONFIRMED: "Non-confirmation" }

function fields(row?: AdminRecord) {
  return {
    letterhead: String(row?.letterhead ?? ""), body: String(row?.body ?? ""),
    signatory_name: String(row?.signatoryName ?? row?.signatory_name ?? ""),
    signatory_title: String(row?.signatoryTitle ?? row?.signatory_title ?? ""),
  }
}

export default function ProbationLetterTemplates() {
  const actor = useDashboardActor()
  const allowed = actor.ready && canPerformPermission(actor.permissionLabels, "probation_letters:generate")
  const [kind, setKind] = React.useState("CONFIRMATION")
  const [templates, setTemplates] = React.useState<AdminRecord[]>([])
  const [draft, setDraft] = React.useState<ReturnType<typeof fields> | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const token = actor.ready ? readStoredSessionTokens().accessToken : ""
  const form = draft ?? fields(templates.find(row => (row.letterType ?? row.letter_type) === kind))

  React.useEffect(() => {
    let active = true
    setLoaded(false)
    setTemplates([])
    setDraft(null)
    setMessage("")
    if (allowed && token) {
      listProbationLetterTemplates(token).then(rows => {
        if (active) { setTemplates(rows); setLoaded(true) }
      }).catch((error: Error) => { if (active) setMessage(error.message) })
    }
    return () => { active = false }
  }, [allowed, token])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!allowed || !loaded || busy || token !== readStoredSessionTokens().accessToken) return
    setBusy(true)
    setMessage("")
    try {
      await saveProbationLetterTemplate(token, { ...form, letter_type: kind })
      const rows = await listProbationLetterTemplates(token)
      if (token === readStoredSessionTokens().accessToken) { setTemplates(rows); setDraft(null); setMessage("Template saved.") }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save template.")
    } finally { setBusy(false) }
  }

  if (!actor.ready) return null
  if (!allowed) return <p role="alert">You do not have access to probation letter templates.</p>
  return <section className="mx-auto grid w-full max-w-3xl gap-4 p-4 sm:p-6">
    <h1 className="text-2xl font-semibold">Letter templates</h1>
    <form onSubmit={submit} className="grid gap-4">
      <fieldset disabled={busy || !loaded} className="grid gap-4">
        <label className="grid gap-1">Letter type
          <select className="rounded border p-2" value={kind} onChange={event => {
            setKind(event.target.value)
            setDraft(null)
            setMessage("")
          }}>
            {Object.entries(types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-1">Letterhead<Input required maxLength={1000} value={form.letterhead} onChange={e => setDraft({ ...form, letterhead:e.target.value })}/></label>
        <label className="grid gap-1">Letter body<Textarea aria-label="Letter body" formatting={false} required rows={8} maxLength={10000} value={form.body} onChange={e => setDraft({ ...form, body:e.target.value })}/></label>
        <label className="grid gap-1">Signatory name<Input required maxLength={160} value={form.signatory_name} onChange={e => setDraft({ ...form, signatory_name:e.target.value })}/></label>
        <label className="grid gap-1">Signatory title<Input required maxLength={160} value={form.signatory_title} onChange={e => setDraft({ ...form, signatory_title:e.target.value })}/></label>
        <Button className="justify-self-start" type="submit">{busy ? "Saving…" : "Save template"}</Button>
      </fieldset>
    </form>
    <p role="status">{message || (!loaded ? "Loading templates…" : "")}</p>
  </section>
}
