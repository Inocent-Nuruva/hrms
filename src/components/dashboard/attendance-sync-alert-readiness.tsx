"use client"

import * as React from "react"
import { getAttendanceSyncAlertReadiness, sendAttendanceSyncAlertTest, type AdminRecord } from "@/lib/admin-api"

export function AttendanceSyncAlertReadiness({
  token,
  canTest,
}: {
  token: string
  canTest: boolean
}) {
  const [readiness, setReadiness] = React.useState<AdminRecord | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      setReadiness(await getAttendanceSyncAlertReadiness(token))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not check sync alert readiness.")
    } finally {
      setBusy(false)
    }
  }, [token])

  React.useEffect(() => { void refresh() }, [refresh])

  const sendTest = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await sendAttendanceSyncAlertTest(token)
      const data = typeof result === "object" && result !== null ? result as AdminRecord : {}
      setMessage(Number(data.queued_count ?? 0) > 0
        ? `Test alert queued for ${String(data.queued_count)} operator(s). Confirm it appears in the recipients’ notifications.`
        : "No eligible recipients were found. Grant access_control_sync:execute to an active company operator, then retry.")
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the attendance sync alert test.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-1">
        <h3 className="text-sm font-semibold">Sync failure alert recipients</h3>
        {busy && readiness === null ? <p className="text-xs text-muted-foreground">Checking readiness…</p> : (
          <p className="text-xs text-muted-foreground">
            {readiness?.ready === true
              ? `${String(readiness.recipient_count)} active operator(s) have ${String(readiness.required_permission)}.`
              : "No active company operator currently has access_control_sync:execute."}
          </p>
        )}
        {message ? <p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">{message}</p> : null}
        {error ? <p role="alert" className="text-xs text-red-600">{error}</p> : null}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void refresh()} disabled={busy} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-50">Refresh</button>
        {canTest ? <button type="button" onClick={() => void sendTest()} disabled={busy || readiness?.ready !== true} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{busy ? "Sending…" : "Send test alert"}</button> : null}
      </div>
    </section>
  )
}
