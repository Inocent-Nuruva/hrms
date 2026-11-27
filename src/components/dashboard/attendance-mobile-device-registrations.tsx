"use client"

import { Input } from "@/components/ui/input"
import * as React from "react"
import { ArrowClockwise20Regular, DeviceEq20Regular, TrayItemAdd20Regular } from "@fluentui/react-icons"
import {
  listAttendanceMobileDeviceRegistrationAudit,
  listAttendanceMobileDeviceRegistrations,
  releaseAttendanceMobileDeviceRegistration,
  type AdminRecord,
} from "@/lib/admin-api"
import { Button } from "@/components/ui/button"

function value(record: AdminRecord, key: string) {
  const item = record[key]
  return item === null || item === undefined || item === "" ? "—" : String(item)
}

function recordValue(input: unknown): AdminRecord {
  return typeof input === "object" && input !== null ? input as AdminRecord : {}
}

export function AttendanceMobileDeviceRegistrations({
  token,
  canRelease,
}: {
  token: string
  canRelease: boolean
}) {
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [reasonById, setReasonById] = React.useState<Record<string, string>>({})
  const [releasingId, setReleasingId] = React.useState<string | null>(null)
  const [historyById, setHistoryById] = React.useState<Record<string, AdminRecord[]>>({})
  const [historyLoadingId, setHistoryLoadingId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      setRows(await listAttendanceMobileDeviceRegistrations(token))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load registered attendance devices.")
    } finally {
      setLoading(false)
    }
  }, [token])

  React.useEffect(() => { void load() }, [load])

  const release = async (id: string) => {
    const reason = reasonById[id]?.trim() ?? ""
    if (reason.length < 5) {
      setError("Enter a release reason with at least 5 characters.")
      return
    }
    setReleasingId(id)
    setError(null)
    try {
      await releaseAttendanceMobileDeviceRegistration(token, id, reason)
      setReasonById((previous) => ({ ...previous, [id]: "" }))
      await load()
      setHistoryById((previous) => { const next = { ...previous }; delete next[id]; return next })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not release this device.")
    } finally {
      setReleasingId(null)
    }
  }

  const toggleHistory = async (id: string) => {
    if (historyById[id]) {
      setHistoryById((previous) => { const next = { ...previous }; delete next[id]; return next })
      return
    }
    setHistoryLoadingId(id)
    setError(null)
    try {
      const history = await listAttendanceMobileDeviceRegistrationAudit(token, id)
      setHistoryById((previous) => ({ ...previous, [id]: history }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load device history.")
    } finally {
      setHistoryLoadingId(null)
    }
  }

  return (
    <section className="mb-4 grid gap-3 border-y border-border py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <DeviceEq20Regular className="size-4" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Mobile app device registrations</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Installations enroll when an employee punches under a policy that blocks device sharing.</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => void load()} disabled={loading} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Refresh device registrations" title="Refresh device registrations">
          <ArrowClockwise20Regular className={loading ? "animate-spin" : undefined} aria-hidden />
        </Button>
      </div>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {loading && rows.length === 0 ? <p className="text-sm text-muted-foreground">Loading registrations…</p> : null}
      {!loading && rows.length === 0 ? <div className="flex items-center gap-3 py-3"><TrayItemAdd20Regular className="size-5 text-muted-foreground" aria-hidden /><div><p className="text-sm font-medium text-foreground">No enrolled devices</p><p className="text-xs text-muted-foreground">New mobile installations will appear here after the first protected punch.</p></div></div> : null}
      {rows.map((row) => {
        const id = String(row.id ?? "")
        const isActive = String(row.status ?? "").toUpperCase() === "ACTIVE"
        const deviceInfo = recordValue(row.device_info)
        const model = value(deviceInfo, "deviceModel")
        const platform = value(deviceInfo, "platform")
        const appVersion = value(deviceInfo, "appVersion")
        return (
          <article key={id} className="grid gap-2 border-t border-border py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1 text-xs">
                <p className="font-semibold">{platform} · {model} <span className="ml-1 rounded bg-muted px-1.5 py-0.5 font-normal">{String(row.status ?? "unknown")}</span></p>
                <p>Employee: {value(row, "employee_name")}{!isActive && row.last_employee_name ? ` (last: ${value(row, "last_employee_name")})` : ""}</p>
                <p>App version: {appVersion} · Last seen: {value(row, "last_seen_at")}</p>
                <p className="break-all font-mono text-[10px] text-muted-foreground">Installation ID: {value(row, "device_identifier")}</p>
                {!isActive && row.release_reason ? <p>Last release reason: {value(row, "release_reason")}</p> : null}
              </div>
              <button type="button" onClick={() => void toggleHistory(id)} disabled={historyLoadingId === id} className="rounded-md border border-border px-2.5 py-1 text-xs font-medium disabled:opacity-50">
                {historyLoadingId === id ? "Loading…" : historyById[id] ? "Hide history" : "View history"}
              </button>
            </div>
            {isActive && canRelease ? (
              <div className="flex flex-wrap gap-2">
                <Input
                  value={reasonById[id] ?? ""}
                  onChange={(event) => setReasonById((previous) => ({ ...previous, [id]: event.target.value }))}
                  maxLength={500}
                  aria-label={`Reason to release device ${id}`}
                  placeholder="Required release reason"
                  className="min-w-64 flex-1"
                />
                <button type="button" onClick={() => void release(id)} disabled={releasingId === id} className="rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300">
                  {releasingId === id ? "Releasing…" : "Release device"}
                </button>
              </div>
            ) : null}
            {historyById[id] ? (
              <ol className="grid gap-1 border-l border-border pl-3 text-xs">
                {historyById[id].map((entry) => (
                  <li key={String(entry.id)}>
                    <span className="font-semibold">{value(entry, "action")}</span> · {value(entry, "created_at")} · {value(entry, "reason")}
                  </li>
                ))}
                {historyById[id].length === 0 ? <li className="text-muted-foreground">No audit events.</li> : null}
              </ol>
            ) : null}
          </article>
        )
      })}
    </section>
  )
}
