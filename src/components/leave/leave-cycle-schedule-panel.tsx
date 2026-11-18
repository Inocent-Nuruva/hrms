"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { showErrorAlert } from "@/lib/error-alert"
import { createRolloverRun, days, listLeaveCycles, type LeaveCycleRow } from "@/lib/leave-engine-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { showSuccessAlert } from "@/lib/success-alert"
import { cn } from "@/lib/utils"

const STATUS: Record<LeaveCycleRow["processing_status"], { label: string; tone: string }> = {
  open: { label: "Cycle running", tone: "bg-slate-100 text-slate-700" },
  due: { label: "Rollover due", tone: "bg-amber-100 text-amber-800" },
  failed: { label: "Rollover failed", tone: "bg-red-100 text-red-800" },
  closed: { label: "Closed", tone: "bg-emerald-100 text-emerald-800" },
}

const date = (v: string | null) => (v ? String(v).slice(0, 10) : "—")

/**
 * Per-employee leave cycles (calendar, anniversary or custom): current
 * cycle, next rollover date and the last rollover result for each balance.
 */
export function LeaveCycleSchedulePanel({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = React.useState<LeaveCycleRow[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const limit = 25

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await listLeaveCycles(readStoredSessionTokens().accessToken ?? "", {
        status: status || undefined,
        search: search.trim() || undefined,
        page,
        limit,
      })
      setRows(res.data)
      setTotal(res.meta.total)
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not load leave cycles.")
    } finally {
      setLoading(false)
    }
  }, [status, search, page])

  React.useEffect(() => {
    void load()
  }, [load])

  async function retry(row: LeaveCycleRow) {
    try {
      await createRolloverRun(readStoredSessionTokens().accessToken ?? "", {
        from_leave_year: row.leave_year,
        leave_type_id: row.leave_type_id,
        notes: `Prepared from the leave cycles list for balance #${row.balance_id}`,
      })
      showSuccessAlert(`Rollover preview prepared for ${row.leave_type_name} ${row.leave_year}.`)
      await load()
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not prepare the rollover.")
    }
  }

  const pages = Math.max(1, Math.ceil(total / limit))
  return (
    <section className="space-y-3 rounded-lg border border-border p-4" aria-label="Leave cycles">
      <div>
        <h2 className="text-sm font-semibold">Leave cycles</h2>
        <p className="text-xs text-muted-foreground">
          Each balance follows its own leave year (calendar, employment anniversary or company custom year). A balance
          rolls over only after its own cycle has ended.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Search employee name or number"
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
          className="sm:max-w-xs"
          aria-label="Search employees"
        />
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value)
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="open">Cycle running</option>
          <option value="due">Rollover due</option>
          <option value="failed">Rollover failed</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Leave type</th>
              <th className="px-3 py-2">Current cycle</th>
              <th className="px-3 py-2">Next rollover</th>
              <th className="px-3 py-2 text-right">Balance (est.)</th>
              <th className="px-3 py-2 text-right">Carry / encash / lapse</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last run</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const s = STATUS[row.processing_status]
              const errors = [row.last_error, ...(row.last_exceptions ?? []).map((x) => x.message)].filter(Boolean)
              return (
                <tr key={row.balance_id} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.employee_name}</div>
                    <div className="text-xs text-muted-foreground">{row.employee_no ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2">{row.leave_type_name}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {date(row.cycle_start)} – {date(row.cycle_end)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{row.closed_at ? "—" : date(row.next_rollover_date)}</td>
                  <td className="px-3 py-2 text-right">{days(row.eligible_balance_estimate)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {row.last_line_status
                      ? `${days(row.carry_forward_days)} / ${days(row.encash_days)} / ${days(row.lapse_days)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", s.tone)}>{s.label}</span>
                    {errors.length ? <div className="mt-1 max-w-xs text-xs text-red-700">{errors.join("; ")}</div> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {row.last_run_id ? `#${row.last_run_id} · ${date(row.last_execution_at)}` : "Never"}
                  </td>
                  <td className="px-3 py-2">
                    {canManage && row.retry_available ? (
                      <Button size="sm" variant="outline" onClick={() => void retry(row)}>
                        {row.processing_status === "failed" ? "Retry" : "Prepare"}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  {loading ? "Loading…" : "No leave cycles match."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total} balance(s)</span>
        <span className="inline-flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          Page {page} of {pages}
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </span>
      </div>
    </section>
  )
}
