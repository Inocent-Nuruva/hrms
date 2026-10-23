"use client"

import * as React from "react"
import { Button } from "@fluentui/react-components"
import {
  Alert20Regular,
  ArrowSync20Regular,
  CheckmarkCircle20Regular,
  Send20Regular,
} from "@fluentui/react-icons"
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
        : "No eligible recipients were found. Assign device sync access to an active company operator, then retry.")
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the attendance sync alert test.")
    } finally {
      setBusy(false)
    }
  }

  const isReady = readiness?.ready === true

  return (
    <section className="mb-4 flex flex-wrap items-center justify-between gap-3 border-y border-border/70 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${isReady ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"}`}>
          {isReady ? <CheckmarkCircle20Regular /> : <Alert20Regular />}
        </span>
        <div className="grid min-w-0 gap-0.5">
          <h3 className="text-sm font-semibold">Sync alerts</h3>
          {busy && readiness === null ? <p className="text-xs text-muted-foreground">Checking alert readiness…</p> : (
            <p className="text-xs text-muted-foreground">
              {isReady
                ? `${String(readiness?.recipient_count)} active operator(s) can receive sync failure alerts.`
                : "No eligible alert recipient is configured."}
            </p>
          )}
          {message ? <p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">{message}</p> : null}
          {error ? <p role="alert" className="text-xs text-red-600">{error}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          appearance="subtle"
          size="small"
          icon={<ArrowSync20Regular className={busy ? "animate-spin" : undefined} />}
          aria-label="Refresh sync alert readiness"
          title="Refresh"
          onClick={() => void refresh()}
          disabled={busy}
        />
        {canTest ? (
          <Button
            appearance="outline"
            size="small"
            icon={<Send20Regular />}
            onClick={() => void sendTest()}
            disabled={busy || !isReady}
          >
            {busy ? "Sending…" : "Send test"}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
