"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  disableBrowserPush,
  enableBrowserPush,
  getBrowserPushStatus,
} from "@/lib/browser-push"

type PushStatus = Awaited<ReturnType<typeof getBrowserPushStatus>>

export function BrowserNotificationSettings() {
  const [status, setStatus] = React.useState<PushStatus | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    let active = true
    void getBrowserPushStatus()
      .then((result) => { if (active) setStatus(result) })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not check browser notifications.") })
    return () => { active = false }
  }, [])

  const toggle = async () => {
    if (!status || busy) return
    setBusy(true)
    setError("")
    try {
      if (status.enabled) await disableBrowserPush()
      else await enableBrowserPush()
      setStatus(await getBrowserPushStatus())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update browser notifications.")
    } finally {
      setBusy(false)
    }
  }

  const available = status?.supported && status.available
  const denied = status?.permission === "denied"
  return <section aria-label="Browser notifications" className="mb-6 rounded-lg border border-border p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold">Desktop notifications</h3>
        <p className="mt-1 text-sm text-muted-foreground">Show a system alert when this app is minimized or closed. Notifications appear inside the app while it is focused.</p>
        <p className="mt-2 text-sm" role="status">{!status ? "Checking browser support…" : !status.supported ? "This browser or connection does not support push notifications." : !status.available ? "Browser push is not configured on the server yet." : denied ? "Notifications are blocked in your browser settings." : status.enabled ? "Enabled on this browser." : "Off on this browser."}</p>
      </div>
      {available && <Button type="button" variant={status.enabled ? "outline" : "default"} disabled={busy || denied} onClick={() => void toggle()}>{busy ? "Updating…" : status.enabled ? "Turn off" : "Enable"}</Button>}
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </section>
}
