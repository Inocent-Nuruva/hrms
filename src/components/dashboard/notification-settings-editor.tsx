"use client"

import * as React from "react"
import { updateNotificationRule, updateNotificationTemplate, type AdminRecord } from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { primaryButtonClass, secondaryButtonClass } from "@/components/dashboard/talent-visuals"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Checkbox } from "@/components/ui/checkbox"

function PrioritySelect({ initial, disabled }: { initial: string; disabled?: boolean }) {
  const [value, setValue] = React.useState(initial)
  return <>
    <FluentSelect id="notification-priority" ariaLabel="Priority" value={value} onChange={setValue} disabled={disabled}
      options={["LOW", "MEDIUM", "HIGH", "URGENT"].map(item => ({ value: item, label: item }))} />
    <input type="hidden" name="priority" value={value} />
  </>
}

const templateFields = [
  ["title", "title", "Title", 180],
  ["system_message", "systemMessage", "In-app message", 2000],
  ["email_subject", "emailSubject", "Email subject", 220],
  ["email_body", "emailBody", "Email body", 8000],
  ["mobile_message", "mobileMessage", "Mobile message", 500],
] as const
const timingFields = [
  ["reminder_before_minutes", "reminderBeforeMinutes", "Reminder before (minutes)"],
  ["reminder_after_minutes", "reminderAfterMinutes", "Reminder after (minutes)"],
  ["escalation_after_minutes", "escalationAfterMinutes", "Escalation after (minutes)"],
  ["repeat_interval_minutes", "repeatIntervalMinutes", "Repeat interval (minutes)"],
] as const

export function NotificationSettingsEditor({ kind, id, row, onSaved }: {
  kind: "template" | "rule"; id: string | number; row: AdminRecord; onSaved: (value: AdminRecord) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")
  const value = (key: string, alias: string) => String(row[key] ?? row[alias] ?? "")
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setError("")
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) ?? "").trim()
    const payload: AdminRecord = {}
    if (kind === "template") {
      for (const [key] of templateFields) payload[key] = text(key) || null
      if (!payload.title || !payload.system_message) { setError("Enter a title and in-app message."); return }
    } else {
      for (const [key] of timingFields) payload[key] = text(key) ? Number(text(key)) : null
      payload.priority = text("priority")
      payload.channels = form.getAll("channels").map(String)
    }
    setSaving(true)
    try {
      const token = readStoredSessionTokens().accessToken
      const updated = kind === "template" ? await updateNotificationTemplate(token, id, payload) : await updateNotificationRule(token, id, payload)
      if (!updated) throw new Error("The server did not return the saved settings.")
      onSaved(updated)
      setEditing(false)
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save changes.") }
    finally { setSaving(false) }
  }

  if (!editing) return <button className={secondaryButtonClass} type="button" onClick={() => { setError(""); setEditing(true) }}>Edit {kind}</button>
  return <form aria-label={`Edit ${kind}`} className="w-full rounded-lg border border-border p-3" onSubmit={submit}>
    <fieldset className="grid gap-3 text-sm sm:grid-cols-2" disabled={saving}>
      {kind === "template" ? templateFields.map(([key, alias, label, length]) => <FormField key={key} className="sm:col-span-2" label={label} htmlFor={`notification-${key}`} required={key === "title" || key === "system_message"}>
        <Textarea id={`notification-${key}`} formatting={false} name={key} defaultValue={value(key, alias)} maxLength={length} rows={key.includes("message") || key === "email_body" ? 3 : 1} required={key === "title" || key === "system_message"} />
      </FormField>) : <>
        {timingFields.map(([key, alias, label]) => <FormField key={key} label={label} htmlFor={`notification-${key}`}>
          <Input id={`notification-${key}`} type="number" min={0} max={2147483647} step={1} name={key} defaultValue={value(key, alias)} />
        </FormField>)}
        <FormField label="Priority" htmlFor="notification-priority"><PrioritySelect initial={value("priority", "priority") || "MEDIUM"} disabled={saving} /></FormField>
        <fieldset><legend>Delivery channels</legend><p className="text-xs text-muted-foreground">Leave all channels clear to use the event’s default delivery channels.</p>
          {["IN_APP", "EMAIL", "SMS", "PUSH"].map(channel => <label className="mr-3 inline-flex items-center gap-1" key={channel}><Checkbox name="channels" value={channel} defaultChecked={Array.isArray(row.channels) && row.channels.includes(channel)} disabled={saving} />{channel === "IN_APP" ? "In-app" : channel}</label>)}
        </fieldset>
      </>}
      {error && <p className="sm:col-span-2" role="alert">{error}</p>}
      <div className="flex gap-2 sm:col-span-2"><button className={primaryButtonClass} type="submit">Save {kind}</button><button className={secondaryButtonClass} type="button" onClick={() => setEditing(false)}>Cancel</button></div>
    </fieldset>
  </form>
}
