"use client"

import * as React from "react"

import { getLeaveBalanceProjection, type AdminRecord } from "@/lib/admin-api"
import { cn } from "@/lib/utils"

type Period = "day" | "week" | "month" | "year"

const PERIODS: Array<{ value: Period; label: string; endLabel: string }> = [
  { value: "day", label: "Today", endLabel: "today" },
  { value: "week", label: "This week", endLabel: "end of week" },
  { value: "month", label: "This month", endLabel: "end of month" },
  { value: "year", label: "This year", endLabel: "year end" },
]

function num(row: AdminRecord, key: string) {
  const value = Number(row[key])
  return Number.isFinite(value) ? value : 0
}

function days(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} d`
}

/**
 * Pro-rata leave at a point in time: accrued, available, pending, used and
 * projected days for today, this week, this month or the leave year. Only
 * leave types that accrue progressively are shown.
 */
export function LeaveAccrualProjectionCard({
  token,
  employeeId,
  self = true,
}: {
  token: string | null
  employeeId?: number
  self?: boolean
}) {
  const [period, setPeriod] = React.useState<Period>("month")
  const [data, setData] = React.useState<AdminRecord | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!token) return
    let cancelled = false
    setError(null)
    getLeaveBalanceProjection(token, { period, self, employee_id: employeeId })
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load accrual projection.")
      })
    return () => {
      cancelled = true
    }
  }, [employeeId, period, self, token])

  const rows = (Array.isArray(data?.balances) ? (data?.balances as AdminRecord[]) : []).filter((row) =>
    ["daily", "monthly"].includes(String(row.accrual_method)),
  )
  if (!error && rows.length === 0) return null
  const endLabel = PERIODS.find((item) => item.value === period)?.endLabel ?? ""

  return (
    <section className="min-w-0 space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Accrued leave</h3>
          <p className="text-xs text-muted-foreground">
            Leave builds up day by day from your start date. You can book what will have accrued by the last day of your leave.
          </p>
        </div>
        <div role="tablist" aria-label="Accrual period" className="flex flex-wrap gap-1">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={period === item.value}
              onClick={() => setPeriod(item.value)}
              className={cn(
                "h-7 rounded-md border px-2.5 text-xs font-medium transition",
                period === item.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {rows.map((row) => {
        const metrics = [
          { label: "Accrued so far", value: num(row, "accrued_to_date") },
          { label: `Accrued by ${endLabel}`, value: num(row, "accrued_by_period_end") },
          { label: "Available now", value: num(row, "available_now"), strong: true },
          { label: `Available by ${endLabel}`, value: num(row, "available_by_period_end") },
          { label: "Pending approval", value: num(row, "pending_days") },
          { label: "Used", value: num(row, "used_days") },
          { label: "Carried forward", value: num(row, "carried_forward_days") },
          { label: "Projected at year end", value: num(row, "projected_year_end_balance") },
        ]
        return (
          <div key={String(row.leave_type_id)} className="space-y-2">
            <p className="text-xs font-semibold text-foreground">
              {String(row.leave_type_name ?? "Leave")}{" "}
              <span className="font-normal text-muted-foreground">
                · {days(num(row, "annual_entitlement_days"))} a year
              </span>
            </p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className={cn(
                    "min-w-0 rounded-md border border-border/70 px-2.5 py-2",
                    metric.strong && "border-primary/40 bg-primary/5",
                  )}
                >
                  <dt className="truncate text-[11px] text-muted-foreground">{metric.label}</dt>
                  <dd className={cn("text-sm font-semibold", metric.strong ? "text-primary" : "text-foreground")}>
                    {days(metric.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )
      })}
    </section>
  )
}
