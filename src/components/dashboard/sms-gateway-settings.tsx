"use client"

import * as React from "react"
import { getSmsGateway, saveSmsGateway, type SmsGatewaySettings } from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { primaryButtonClass } from "@/components/dashboard/talent-visuals"

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

  const control = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
  return <section aria-label="SMS gateway" className="space-y-3 rounded-xl border border-border bg-card p-4">
    <h2 className="font-semibold">SMS gateway</h2>
    {error && <p role="alert">{error}</p>}
    {saved && <p role="status">SMS gateway saved.</p>}
    {!settings && !error && <p role="status">Loading SMS gateway…</p>}
    {settings && <form key={revision} onSubmit={submit} onChange={() => setSaved(false)}>
      <fieldset disabled={!canEdit || busy} className="grid gap-3 sm:grid-cols-2">
        <label>Provider endpoint<select className={control} name="endpoint" required defaultValue={settings.endpoint || ""}>
          <option value="">Choose an approved endpoint</option>
          {settings.approved_endpoints.map(url => <option key={url} value={url}>{url}</option>)}
        </select></label>
        <label>Provider account<input className={control} name="username" autoComplete="off" required maxLength={160} defaultValue={settings.username} /></label>
        <label>Gateway password<input className={control} name="password" type="password" autoComplete="new-password" maxLength={2048} disabled={!settings.password_storage_ready} />
          <span className="text-xs text-muted-foreground">{settings.password_configured ? "A password is configured. Leave blank to keep it for this account." : "Enter the password supplied by your provider."}</span>
        </label>
        <label>Sender short code<input className={control} name="shortcode" required maxLength={80} defaultValue={settings.shortcode} /></label>
        <label>Channel<input className={control} name="channel" maxLength={80} defaultValue={settings.channel} /></label>
        <label className="flex items-center gap-2"><input name="enabled" type="checkbox" defaultChecked={settings.enabled} />Enable gateway</label>
        {canEdit && !settings.password_storage_ready && <p className="text-sm sm:col-span-2">Ask the installation administrator to configure the field-encryption key to store a new password.</p>}
        {canEdit && !settings.approved_endpoints.length && <p className="text-sm sm:col-span-2">Ask the installation administrator to register the provider endpoint.</p>}
        {canEdit && <div><button className={primaryButtonClass} type="submit" disabled={!settings.approved_endpoints.length}>{busy ? "Saving…" : "Save gateway"}</button></div>}
      </fieldset>
    </form>}
  </section>
}
