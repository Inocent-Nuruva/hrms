"use client"

import * as React from "react"
import { getSmsGateway, saveSmsGateway, type SmsGatewaySettings } from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { primaryButtonClass } from "@/components/dashboard/talent-visuals"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Checkbox } from "@/components/ui/checkbox"

function EndpointSelect({ initial, endpoints, disabled }: { initial: string; endpoints: string[]; disabled?: boolean }) {
  const [value, setValue] = React.useState(initial)
  return <>
    <FluentSelect id="sms-endpoint" ariaLabel="Provider endpoint" value={value} onChange={setValue} disabled={disabled}
      placeholder="Choose an approved endpoint" options={endpoints.map(url => ({ value: url, label: url }))} />
    <input type="hidden" name="endpoint" value={value} />
  </>
}

export function SmsGatewaySettingsPanel({ canEdit }: { canEdit: boolean }) {
  const [settings, setSettings] = React.useState<SmsGatewaySettings | null>(null)
  const [error, setError] = React.useState("")
  const [saved, setSaved] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [revision, setRevision] = React.useState(0)
  React.useEffect(() => {
    let active = true
    getSmsGateway(readStoredSessionTokens().accessToken).then(result => {
      if (active) setSettings(result)
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : "Could not load the SMS gateway.") })
    return () => { active = false }
  }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settings || !canEdit || busy) return
    const fields = new FormData(event.currentTarget)
    if (!String(fields.get("endpoint") ?? "")) { setError("Choose an approved endpoint."); return }
    const password = String(fields.get("password") ?? "")
    setBusy(true)
    setError("")
    setSaved(false)
    try {
      const result = await saveSmsGateway(readStoredSessionTokens().accessToken, {
        endpoint: fields.get("endpoint"), username: fields.get("username"), shortcode: fields.get("shortcode"),
        channel: fields.get("channel"), enabled: fields.has("enabled"), ...(password ? { password } : {}),
      })
      setSettings(result)
      setRevision(n => n + 1)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the SMS gateway.")
    } finally { setBusy(false) }
  }

  return <section aria-label="SMS gateway" className="space-y-3 rounded-xl border border-border bg-card p-4">
    <h2 className="font-semibold">SMS gateway</h2>
    {error && <p role="alert">{error}</p>}
    {saved && <p role="status">SMS gateway saved.</p>}
    {!settings && !error && <p role="status">Loading SMS gateway…</p>}
    {settings && <form key={revision} onSubmit={submit} onChange={() => setSaved(false)}>
      <fieldset disabled={!canEdit || busy} className="grid gap-3 sm:grid-cols-2">
        <FormField label="Provider endpoint" htmlFor="sms-endpoint" required>
          <EndpointSelect initial={settings.endpoint || ""} endpoints={settings.approved_endpoints} disabled={!canEdit || busy} />
        </FormField>
        <FormField label="Provider account" htmlFor="sms-username" required><Input id="sms-username" name="username" autoComplete="off" required maxLength={160} defaultValue={settings.username} /></FormField>
        <FormField label="Gateway password" htmlFor="sms-password" hint={settings.password_configured ? "A password is configured. Leave blank to keep it for this account." : "Enter the password supplied by your provider."}>
          <Input id="sms-password" name="password" type="password" autoComplete="new-password" maxLength={2048} disabled={!settings.password_storage_ready} />
        </FormField>
        <FormField label="Sender short code" htmlFor="sms-shortcode" required><Input id="sms-shortcode" name="shortcode" required maxLength={80} defaultValue={settings.shortcode} /></FormField>
        <FormField label="Channel" htmlFor="sms-channel"><Input id="sms-channel" name="channel" maxLength={80} defaultValue={settings.channel} /></FormField>
        <label className="flex items-center gap-2 text-sm"><Checkbox name="enabled" defaultChecked={settings.enabled} disabled={!canEdit || busy} onCheckedChange={() => setSaved(false)} />Enable gateway</label>
        {canEdit && !settings.password_storage_ready && <p className="text-sm sm:col-span-2">Ask the installation administrator to configure the field-encryption key to store a new password.</p>}
        {canEdit && !settings.approved_endpoints.length && <p className="text-sm sm:col-span-2">Ask the installation administrator to register the provider endpoint.</p>}
        {canEdit && <div><button className={primaryButtonClass} type="submit" disabled={!settings.approved_endpoints.length}>{busy ? "Saving…" : "Save gateway"}</button></div>}
      </fieldset>
    </form>}
  </section>
}
