"use client"

import * as React from "react"

import { getLeaveReviewContext, type AdminRecord } from "@/lib/admin-api"

function num(row: AdminRecord | null | undefined, key: string) {
  const value = Number(row?.[key])
  return Number.isFinite(value) ? value : 0
}

function formatDays(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} d`
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "—"
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

function prettyStatus(value: unknown) {
  return String(value ?? "").replace(/_/g, " ").toLowerCase()
}

/**
 * Decision support for a leave approver: the employee's balance for the
 * leave type by the leave end, team members off on overlapping dates, and
 * attendance for the last 30 days.
 */
export function LeaveReviewContext({
  token,
  leaveRequestId,
}: {
  token: string | null
  leaveRequestId: string | number
}) {
  const [data, setData] = React.useState<AdminRecord | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!token || !leaveRequestId) return
    let cancelled = false
    setData(null)
    setError(null)
    getLeaveReviewContext(token, leaveRequestId)
      .then((result) => !cancelled && setData(result))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : "Could not load review details."))
    return () => {
      cancelled = true
    }
  }, [leaveRequestId, token])

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>
  if (!data) return <p role="status" className="text-sm text-muted-foreground">Loading balance and team availability…</p>

  const balance = (data.balance ?? null) as AdminRecord | null
  const overlaps = Array.isArray(data.overlapping_team_leave) ? (data.overlapping_team_leave as AdminRecord[]) : []
  const attendance = ((data.attendance_last_30_days as AdminRecord | undefined)?.by_status ?? []) as AdminRecord[]

  return (
    <section className="grid gap-3 rounded-xl border bg-card p-4 text-sm" aria-label="Leave review details">
      <div>
        <h4 className="font-medium">Balance for this leave type</h4>
        {balance ? (
          <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Available by leave end", num(balance, "available_by_period_end")],
              ["Pending (incl. this)", num(balance, "pending_days")],
              ["Used this year", num(balance, "used_days")],
              ["Carried forward", num(balance, "carried_forward_days")],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-md border px-2.5 py-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-semibold">{formatDays(Number(value))}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-1 text-muted-foreground">No balance is configured for this leave type.</p>
        )}
      </div>
      <div>
        <h4 className="font-medium">Team members off on these dates</h4>
        {overlaps.length ? (
          <ul className="mt-2 divide-y rounded-md border">
            {overlaps.map((row) => (
              <li key={String(row.id)} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="font-medium">{String(row.employee_name ?? "Colleague")}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(row.start_date)} – {formatDate(row.end_date)} · {String(row.leave_type_name ?? "Leave")} · {prettyStatus(row.status)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted-foreground">Nobody else in the team is off on these dates.</p>
        )}
      </div>
      <div>
        <h4 className="font-medium">Attendance, last 30 days</h4>
        {attendance.length ? (
          <p className="mt-1 text-muted-foreground">
            {attendance.map((row) => `${prettyStatus(row.status)}: ${num(row, "days")}`).join(" · ")}
          </p>
        ) : (
          <p className="mt-1 text-muted-foreground">No attendance recorded in the last 30 days.</p>
        )}
      </div>
    </section>
  )
}
