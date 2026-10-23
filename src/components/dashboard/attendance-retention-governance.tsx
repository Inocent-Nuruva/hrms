"use client"

import * as React from "react"
import { ArrowClockwise20Regular, Database20Regular } from "@fluentui/react-icons"
import {
  createAttendanceRetentionHold,
  getAttendanceRetentionGovernanceReadiness,
  listAttendanceRetentionHolds,
  listAttendanceRetentionPurgeApprovals,
  listAttendanceLocationAccessLogs,
  releaseAttendanceRetentionHold,
  requestAttendanceRetentionPurgeApproval,
  reviewAttendanceRetentionPurgeApproval,
  type AdminRecord,
} from "@/lib/admin-api"
import { Button } from "@/components/ui/button"

type Category = "RAW_HIKVISION_LOG" | "MOBILE_SELFIE" | "ATTENDANCE_LOCATION" | "FIELD_VISIT_LOCATION"

function records(input: unknown): AdminRecord[] {
  return Array.isArray(input) ? input.filter((row): row is AdminRecord => typeof row === "object" && row !== null) : []
}

function display(record: AdminRecord, key: string) {
  const value = record[key]
  return value === undefined || value === null || value === "" ? "—" : String(value)
}

export function AttendanceRetentionGovernance({
  token,
  canManage,
  canReview,
  canViewLocation,
  canReadGovernance,
}: {
  token: string
  canManage: boolean
  canReview: boolean
  canViewLocation: boolean
  canReadGovernance: boolean
}) {
  const [readiness, setReadiness] = React.useState<AdminRecord>({})
  const [holds, setHolds] = React.useState<AdminRecord[]>([])
  const [approvals, setApprovals] = React.useState<AdminRecord[]>([])
  const [locationAccessLogs, setLocationAccessLogs] = React.useState<AdminRecord[]>([])
  const [category, setCategory] = React.useState<Category>("RAW_HIKVISION_LOG")
  const [recordId, setRecordId] = React.useState("")
  const [holdReason, setHoldReason] = React.useState("")
  const [purgeCategory, setPurgeCategory] = React.useState<Category>("RAW_HIKVISION_LOG")
  const [retentionDays, setRetentionDays] = React.useState("180")
  const [purgeReason, setPurgeReason] = React.useState("")
  const [reasonById, setReasonById] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      const [status, holdRows, approvalRows, locationRows] = await Promise.all([
        canReadGovernance ? getAttendanceRetentionGovernanceReadiness(token) : Promise.resolve(null),
        canReadGovernance ? listAttendanceRetentionHolds(token) : Promise.resolve([]),
        canReadGovernance ? listAttendanceRetentionPurgeApprovals(token) : Promise.resolve([]),
        canViewLocation ? listAttendanceLocationAccessLogs(token) : Promise.resolve([]),
      ])
      const readinessStatus = status ?? {}
      setReadiness(readinessStatus)
      setHolds(records(holdRows))
      setApprovals(records(approvalRows))
      setLocationAccessLogs(records(locationRows))
      const defaultDays = purgeCategory === "RAW_HIKVISION_LOG"
        ? readinessStatus.raw_log_retention_days
        : purgeCategory === "MOBILE_SELFIE" ? readinessStatus.selfie_retention_days : purgeCategory === "ATTENDANCE_LOCATION" ? readinessStatus.location_retention_days : readinessStatus.field_location_retention_days
      if (typeof defaultDays === "number" && defaultDays > 0) setRetentionDays(String(defaultDays))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load attendance retention controls.")
    } finally {
      setBusy(false)
    }
  }, [canReadGovernance, canViewLocation, purgeCategory, token])

  React.useEffect(() => { void refresh() }, [refresh])

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
      setNotice(success)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The attendance retention action failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-4 grid gap-4 border-b border-border pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Database20Regular className="size-4" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Attendance retention safeguards</h3>
            <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">Legal holds protect source records from automated purge. Purge runs require independent approval and enabled deployment flags.</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => void refresh()} disabled={busy} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Refresh retention safeguards" title="Refresh retention safeguards"><ArrowClockwise20Regular className={busy ? "animate-spin" : undefined} aria-hidden /></Button>
      </div>

      {canReadGovernance ? <div className="grid divide-y divide-border border-y border-border text-xs sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        <p className="px-3 py-2">Raw Hikvision<br /><strong>{display(readiness, "raw_log_retention_days")} days</strong> · purge {String(readiness.raw_log_purge_enabled ?? false)}</p>
        <p className="px-3 py-2">Mobile selfies<br /><strong>{display(readiness, "selfie_retention_days")} days</strong> · purge {String(readiness.selfie_purge_enabled ?? false)}</p>
        <p className="px-3 py-2">Attendance locations<br /><strong>{display(readiness, "location_retention_days")} days</strong> · purge {String(readiness.location_purge_enabled ?? false)}</p>
        <p className="px-3 py-2">Field visit locations<br /><strong>{display(readiness, "field_location_retention_days")} days</strong> · purge {String(readiness.field_location_purge_enabled ?? false)}</p>
      </div> : null}

      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {notice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}

      {canManage && canReadGovernance ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <form className="grid gap-2 rounded-lg border border-border/70 p-3" onSubmit={(event) => {
            event.preventDefault()
            const id = Number(recordId)
            if (!Number.isInteger(id) || id < 1) { setError("Enter a valid attendance record ID."); return }
            if (holdReason.trim().length < 5) { setError("Enter a legal-hold reason with at least 5 characters."); return }
            void runAction(() => createAttendanceRetentionHold(token, { category, recordId: id, reason: holdReason.trim() }), "Legal hold recorded.")
            setRecordId("")
            setHoldReason("")
          }}>
            <h4 className="text-xs font-semibold">Place a legal hold</h4>
            <select aria-label="Retention hold category" value={category} onChange={(event) => setCategory(event.target.value as Category)} className="h-9 rounded-md border border-input bg-background px-2 text-xs">
              <option value="RAW_HIKVISION_LOG">Raw Hikvision log</option>
              <option value="MOBILE_SELFIE">Mobile punch selfie</option>
              <option value="ATTENDANCE_LOCATION">Attendance location data</option>
              <option value="FIELD_VISIT_LOCATION">Field visit location data</option>
            </select>
            <input type="number" min={1} value={recordId} onChange={(event) => setRecordId(event.target.value)} placeholder="Source record ID" className="h-9 rounded-md border border-input bg-background px-2 text-xs" />
            <textarea value={holdReason} onChange={(event) => setHoldReason(event.target.value)} maxLength={1000} minLength={5} required placeholder="Legal or investigation reference and reason" className="min-h-16 rounded-md border border-input bg-background p-2 text-xs" />
            <button type="submit" disabled={busy} className="justify-self-start rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Place hold</button>
          </form>

          <form className="grid gap-2 rounded-lg border border-border/70 p-3" onSubmit={(event) => {
            event.preventDefault()
            if (purgeReason.trim().length < 10) { setError("Enter a purge request reason with at least 10 characters."); return }
            void runAction(() => requestAttendanceRetentionPurgeApproval(token, {
              category: purgeCategory,
              retentionDays: Number(retentionDays),
              reason: purgeReason.trim(),
            }), "One-time purge approval request submitted. A different operator must review it.")
            setPurgeReason("")
          }}>
            <h4 className="text-xs font-semibold">Request one approved purge run</h4>
            <select aria-label="Purge category" value={purgeCategory} onChange={(event) => setPurgeCategory(event.target.value as Category)} className="h-9 rounded-md border border-input bg-background px-2 text-xs">
              <option value="RAW_HIKVISION_LOG">Raw Hikvision logs</option>
              <option value="MOBILE_SELFIE">Mobile selfies</option>
              <option value="ATTENDANCE_LOCATION">Attendance location data</option>
              <option value="FIELD_VISIT_LOCATION">Field visit location data</option>
            </select>
            <input type="number" min={1} max={3650} value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs" aria-label="Approved retention period in days" />
            <textarea value={purgeReason} onChange={(event) => setPurgeReason(event.target.value)} maxLength={1000} minLength={10} required placeholder="Business/privacy approval reference and requested deletion scope" className="min-h-16 rounded-md border border-input bg-background p-2 text-xs" />
            <button type="submit" disabled={busy} className="justify-self-start rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Request approval</button>
          </form>
        </div>
      ) : null}

      <div className="grid gap-4 border-t border-border pt-4 lg:grid-cols-3">
      {canReadGovernance ? <div className="grid content-start gap-2">
        <h4 className="text-xs font-semibold">Legal holds ({holds.length})</h4>
        {holds.length === 0 ? <p className="text-xs text-muted-foreground">No retention holds recorded.</p> : holds.map((hold) => {
          const id = String(hold.id ?? "")
          const active = hold.active === true
          return (
            <article key={id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-xs">
              <p><strong>{display(hold, "category")} #{display(hold, "recordId")}</strong> · {active ? "ACTIVE" : "RELEASED"} · {display(hold, "reason")}</p>
              {active && canManage ? <div className="flex flex-wrap gap-2"><input value={reasonById[id] ?? ""} onChange={(event) => setReasonById((previous) => ({ ...previous, [id]: event.target.value }))} placeholder="Release reason" className="h-8 rounded-md border border-input bg-background px-2" /><button type="button" disabled={busy} onClick={() => void runAction(() => releaseAttendanceRetentionHold(token, id, reasonById[id] ?? ""), "Legal hold released.")} className="rounded-md border border-border px-2 py-1 font-semibold disabled:opacity-50">Release hold</button></div> : null}
            </article>
          )
        })}
      </div> : null}

      {canViewLocation ? <div className="grid content-start gap-2">
        <h4 className="text-xs font-semibold">Attendance location access history ({locationAccessLogs.length})</h4>
        {locationAccessLogs.length === 0 ? <p className="text-xs text-muted-foreground">No attendance location reads recorded.</p> : locationAccessLogs.map((row) => (
          <article key={String(row.id)} className="border-t border-border py-2 text-xs">
            <strong>{display(row, "accessType")}</strong> · actor {display(row, "actorCompanyUserId")} · employee {display(row, "employeeId")} · {display(row, "recordCount")} record(s) · {display(row, "purpose")} · {display(row, "accessedAt")}
          </article>
        ))}
      </div> : null}

      {canReadGovernance ? <div className="grid content-start gap-2">
        <h4 className="text-xs font-semibold">Purge approval history ({approvals.length})</h4>
        {approvals.length === 0 ? <p className="text-xs text-muted-foreground">No purge requests recorded.</p> : approvals.map((approval) => {
          const id = String(approval.id ?? "")
          const pending = String(approval.status ?? "").toUpperCase() === "PENDING"
          return (
            <article key={id} className="grid gap-2 border-t border-border py-2 text-xs">
              <p><strong>{display(approval, "category")} · {display(approval, "retentionDays")} days · {display(approval, "status")}</strong> · requested by {display(approval, "requestedByCompanyUserId")} · {display(approval, "reason")}</p>
              {pending && canReview ? <div className="flex flex-wrap gap-2"><input value={reasonById[`approval-${id}`] ?? ""} onChange={(event) => setReasonById((previous) => ({ ...previous, [`approval-${id}`]: event.target.value }))} placeholder="Review note (required)" className="h-8 min-w-56 flex-1 rounded-md border border-input bg-background px-2" /><button type="button" disabled={busy} onClick={() => void runAction(() => reviewAttendanceRetentionPurgeApproval(token, id, { decision: "APPROVE", note: reasonById[`approval-${id}`] ?? "" }), "Purge request approved for a single run.")} className="rounded-md border border-border px-2 py-1 font-semibold disabled:opacity-50">Approve</button><button type="button" disabled={busy} onClick={() => void runAction(() => reviewAttendanceRetentionPurgeApproval(token, id, { decision: "REJECT", note: reasonById[`approval-${id}`] ?? "" }), "Purge request rejected.")} className="rounded-md border border-border px-2 py-1 font-semibold disabled:opacity-50">Reject</button></div> : null}
            </article>
          )
        })}
      </div> : null}
      </div>
    </section>
  )
}
