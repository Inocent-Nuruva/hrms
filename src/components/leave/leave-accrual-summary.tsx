"use client"

import * as React from "react"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import {
  getEmployeeLeaveAccrual,
  getMyLeaveAccrual,
  type LeaveAccrualSummaryRow,
} from "@/lib/admin-api"
import { RecalculateLeaveBalanceButton } from "@/components/leave/leave-recalculation-dialog"
import { LeaveBalanceShowcase, type LeaveBalanceItem } from "@/components/leave/leave-balance-showcase"

const FREQUENCY: Record<LeaveAccrualSummaryRow["accrual_frequency"], string> = {
  daily: "Earned daily",
  weekly: "Earned weekly",
  monthly: "Earned monthly",
  yearly: "Credited yearly",
  manual: "Set by HR",
}
const d = (n: number) => n.toFixed(2).replace(/\.00$/, "")
const date = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "-"

/** Balances with how they are earned: entitlement vs accrued vs available. */
export function LeaveAccrualTable({ rows }: { rows: LeaveAccrualSummaryRow[] }) {
  if (!rows.length)
    return <p className="text-sm text-muted-foreground">No leave balances for this leave year yet.</p>
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {rows.map((r) => {
        const upfront = r.accrual_frequency === "yearly" && r.accrued_days === r.entitlement_days
        return (
          <li key={r.leave_type_id} className="space-y-1.5 rounded-lg border border-border px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">{r.leave_type_name ?? "Leave"}</p>
              <p className="text-lg font-semibold tabular-nums">
                {d(r.available_days)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">available</span>
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
              <dt className="text-muted-foreground">Annual entitlement</dt>
              <dd className="text-right tabular-nums">{d(r.entitlement_days)}</dd>
              <dt className="text-muted-foreground">Accrued so far</dt>
              <dd className="text-right tabular-nums">{d(r.accrued_days)}</dd>
              {r.carried_forward_days ? (
                <>
                  <dt className="text-muted-foreground">Carried forward</dt>
                  <dd className="text-right tabular-nums">{d(r.carried_forward_days)}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Used</dt>
              <dd className="text-right tabular-nums">{d(r.used_days)}</dd>
              <dt className="text-muted-foreground">Pending approval</dt>
              <dd className="text-right tabular-nums">{d(r.pending_days)}</dd>
            </dl>
            <p className="text-xs text-muted-foreground">
              {FREQUENCY[r.accrual_frequency]}
              {upfront ? " (full entitlement at the start of the leave year)" : ""}
              {r.accrual_start_date ? ` · from ${date(r.accrual_start_date)}` : ""}
              {r.next_accrual_date ? ` · next +${d(r.next_accrual_amount)} on ${date(r.next_accrual_date)}` : ""}
            </p>
            {r.probation_status === "on_probation" ? (
              <p className="rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
                On probation: no {r.leave_type_name ?? "leave"} is earned yet.
                {r.expected_accrual_start_date ? ` Expected to start ${date(r.expected_accrual_start_date)}, once confirmed.` : ""}
              </p>
            ) : r.probation_status === "not_confirmed" ? (
              <p className="text-xs text-muted-foreground">{r.accrual_explanation}</p>
            ) : null}
            {r.review_pending ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">A correction to this balance is awaiting HR review.</p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Employee profile → Leave balance (HR), with Recalculate Leave Balance. */
export function EmployeeLeaveBalanceCard({
  token,
  employeeId,
  employeeName,
}: {
  token: string | null
  employeeId: number | null
  employeeName: string | null
}) {
  const actor = useDashboardActor()
  const canView = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_balances:list", "leave_balances:manage"],
    mode: "any",
  })
  const [rows, setRows] = React.useState<LeaveAccrualSummaryRow[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!token || !employeeId || !canView) return
    let active = true
    setRows(null)
    setError(null)
    getEmployeeLeaveAccrual(token, employeeId)
      .then((result) => { if (active) setRows(result) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Could not load leave balances.") })
    return () => { active = false }
  }, [canView, employeeId, token])
  if (!canView || !employeeId) return null
  const items: LeaveBalanceItem[] = (rows ?? []).map((row) => {
    const upfront = row.accrual_frequency === "yearly" && row.accrued_days === row.entitlement_days
    const accrualNote = `${FREQUENCY[row.accrual_frequency]}${upfront ? " (full entitlement at the start of the leave year)" : ""}${row.accrual_start_date ? ` · from ${date(row.accrual_start_date)}` : ""}${row.next_accrual_date ? ` · next +${d(row.next_accrual_amount)} on ${date(row.next_accrual_date)}` : ""}`
    const notices = [
      row.probation_status === "on_probation" ? `On probation: no ${row.leave_type_name ?? "leave"} is earned yet.${row.expected_accrual_start_date ? ` Expected to start ${date(row.expected_accrual_start_date)}, once confirmed.` : ""}` : null,
      row.probation_status === "not_confirmed" ? row.accrual_explanation : null,
      row.review_pending ? "A correction to this balance is awaiting HR review." : null,
    ].filter((notice): notice is string => Boolean(notice))
    return {
      key: `${row.fiscal_year}-${row.leave_type_id}`,
      name: row.leave_type_name ?? "Leave",
      fiscalYear: row.fiscal_year,
      entitlement: row.entitlement_days,
      accrued: row.accrued_days,
      used: row.used_days,
      pending: row.pending_days,
      available: row.available_days,
      carriedForward: row.carried_forward_days,
      expired: null,
      creditDate: null,
      accrualNote,
      notices,
    }
  })
  const action = <RecalculateLeaveBalanceButton token={token} employeeId={employeeId} employeeName={employeeName} />
  return (
    <section aria-label="Leave balance" className="min-w-0 space-y-2">
      {items.length > 0 ? <LeaveBalanceShowcase items={items} fiscalYear={rows?.[0]?.fiscal_year ?? String(new Date().getFullYear())} title="Leave balance" description={employeeName ? `Entitlement, usage and availability for ${employeeName}.` : "Employee leave entitlement, usage and availability."} ariaLabel="Employee leave balances" actions={action} /> : <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">Leave balance</h3>{action}</div>}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {rows?.length === 0 ? <p className="text-sm text-muted-foreground">No leave balances for this leave year yet.</p> : !rows && !error ? <p className="text-sm text-muted-foreground" role="status">Loading…</p> : null}
    </section>
  )
}

/** Self-service: how my balances are earned. */
export function MyLeaveAccrualPanel({ token }: { token: string | null }) {
  const [rows, setRows] = React.useState<LeaveAccrualSummaryRow[] | null>(null)
  React.useEffect(() => {
    if (!token) return
    getMyLeaveAccrual(token).then(setRows).catch(() => setRows(null))
  }, [token])
  if (!rows) return null
  return (
    <section aria-label="How my leave is earned" className="space-y-2">
      <h3 className="text-sm font-semibold">How your leave is earned</h3>
      <LeaveAccrualTable rows={rows} />
    </section>
  )
}
