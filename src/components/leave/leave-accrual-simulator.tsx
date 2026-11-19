"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { readStoredSessionTokens } from "@/lib/session-client"
import { simulateLeaveAccrual, type LeaveAccrualSimulationInput } from "@/lib/admin-api"

type Result = Awaited<ReturnType<typeof simulateLeaveAccrual>>

/**
 * Accrual preview while editing a policy: the balance an example employee
 * would have earned at the end of each month of the first leave year. Uses
 * the server's accrual engine (the same one balances use); no data is read
 * or changed.
 */
export function LeaveAccrualSimulator({
  frequency,
  entitlement,
  startBasis,
  timing,
  prorate,
}: {
  frequency: string
  entitlement: string
  startBasis: string
  timing: string
  prorate: boolean
}) {
  const year = new Date().getFullYear()
  const [open, setOpen] = React.useState(false)
  const [hire, setHire] = React.useState(`${year}-01-01`)
  const [probation, setProbation] = React.useState("6")
  const [result, setResult] = React.useState<Result | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const id = React.useId()

  React.useEffect(() => {
    if (!open) return
    const token = readStoredSessionTokens().accessToken ?? ""
    const days = Number(entitlement)
    if (!token || !Number.isFinite(days) || days <= 0) {
      setResult(null)
      return
    }
    const body: LeaveAccrualSimulationInput = {
      frequency: (frequency || "yearly") as LeaveAccrualSimulationInput["frequency"],
      entitlement_days: days,
      accrual_start_basis: startBasis as LeaveAccrualSimulationInput["accrual_start_basis"],
      accrual_timing: timing as LeaveAccrualSimulationInput["accrual_timing"],
      prorate,
      cycle_start: `${hire.slice(0, 4)}-01-01`,
      hire_date: hire,
      probation_months: Number(probation) || 0,
    }
    let alive = true
    const timer = window.setTimeout(() => {
      simulateLeaveAccrual(token, body)
        .then((r) => {
          if (alive) {
            setResult(r)
            setError(null)
          }
        })
        .catch((e) => alive && setError(e instanceof Error ? e.message : "Preview unavailable."))
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [entitlement, frequency, hire, open, probation, prorate, startBasis, timing])

  return (
    <div className="rounded-md border border-dashed border-border px-3 py-2">
      <button type="button" className="text-xs font-medium text-primary" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? "Hide accrual preview" : "Preview accrual for an example employee"}
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs" htmlFor={`${id}-hire`}>
              Hire date
              <Input id={`${id}-hire`} type="date" value={hire} onChange={(e) => setHire(e.target.value || `${year}-01-01`)} />
            </label>
            <label className="space-y-1 text-xs" htmlFor={`${id}-prob`}>
              Probation (months, confirmed on time)
              <Input id={`${id}-prob`} inputMode="numeric" value={probation} onChange={(e) => setProbation(e.target.value.replace(/\D/g, "").slice(0, 2))} />
            </label>
          </div>
          {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
          {result ? (
            <>
              <p className="text-xs text-muted-foreground">
                {result.explanation} Leave year {result.cycle_start} – {result.cycle_end}.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs tabular-nums">
                  <thead>
                    <tr className="text-muted-foreground">
                      {result.months.map((m) => (
                        <th key={m.as_of} className="px-1 py-0.5 font-normal">
                          {new Date(`${m.as_of}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {result.months.map((m) => (
                        <td key={m.as_of} className="px-1 py-0.5 text-center">{m.accrued}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">Days earned by the end of each month (before leave taken).</p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
