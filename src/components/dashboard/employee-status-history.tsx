"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { listEmployeeEmploymentHistory, type EmploymentEventRecord } from "@/lib/admin-api"
import { cn } from "@/lib/utils"

const STATUS_REFRESH_EVENT = "hrms:employee-status-updated"

const SUSPENSION_REASON_LABELS: Record<string, string> = {
  disciplinary: "Disciplinary",
  investigation: "Pending investigation",
  medical: "Medical",
  administrative: "Administrative",
  other: "Other",
}

const EXIT_REASON_LABELS: Record<string, string> = {
  resignation: "Resignation",
  termination: "Termination",
  end_of_contract: "End of contract",
  retirement: "Retirement",
  other: "Other",
}

function label(value: unknown) {
  const text = typeof value === "string" ? value : ""
  return text ? text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, " ") : ""
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/** Human-readable detail rows for the structured values a status change stores. */
function detailRows(event: EmploymentEventRecord): Array<[string, string]> {
  const values = record(event.new_values) ?? {}
  const rows: Array<[string, string]> = []

  const suspension = record(values.suspension)
  if (suspension) {
    rows.push(["Reason", SUSPENSION_REASON_LABELS[String(suspension.reason)] ?? label(suspension.reason)])
    rows.push(["Start date", String(suspension.start_date ?? "-")])
    rows.push(["Expected end date", suspension.expected_end_date ? String(suspension.expected_end_date) : "Open-ended"])
    rows.push(["Pay status", label(suspension.pay_status)])
    const actions = [
      suspension.pause_attendance ? "attendance paused" : null,
      suspension.disable_login ? "login disabled" : null,
      suspension.notify_manager ? "manager notified" : null,
    ].filter(Boolean)
    if (actions.length) rows.push(["Actions", actions.join(", ")])
  }

  const exit = record(values.exit)
  if (exit) {
    rows.push(["Exit date", String(exit.exit_date ?? "-")])
    rows.push(["Last working day", String(exit.last_working_day ?? "-")])
    rows.push([
      "Reason",
      [EXIT_REASON_LABELS[String(exit.reason)] ?? label(exit.reason), exit.reason_details ? String(exit.reason_details) : null]
        .filter(Boolean)
        .join(": "),
    ])
    if (typeof exit.rehire_eligible === "boolean") rows.push(["Rehire eligible", exit.rehire_eligible ? "Yes" : "No"])
    if (exit.offboarding_code) rows.push(["Offboarding", String(exit.offboarding_code)])
  }

  const schedule = record(values.schedule)
  if (schedule) {
    rows.push(["Schedule assigned", `${label(schedule.mode)} #${String(schedule.id)} from ${String(schedule.effective_from ?? "-")}`])
  }
  const scheduleEnded = record(values.schedule_ended)
  if (scheduleEnded) rows.push(["Schedule ended", String(scheduleEnded.end_date ?? "-")])

  const lifted = record(values.suspension_lifted)
  if (lifted) {
    const restored = [lifted.attendance_resumed ? "attendance resumed" : null, lifted.login_restored ? "login restored" : null].filter(
      Boolean,
    )
    if (restored.length) rows.push(["Suspension lifted", restored.join(", ")])
  }
  if (values.pending_status) rows.push(["Pending status", label(values.pending_status)])
  return rows
}

export function EmployeeStatusHistorySection({ employeeId, token }: { employeeId: number | null; token: string }) {
  const [events, setEvents] = React.useState<EmploymentEventRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    if (!token || employeeId === null) return
    setLoading(true)
    setError(null)
    try {
      setEvents(await listEmployeeEmploymentHistory(token, employeeId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the status history.")
    } finally {
      setLoading(false)
    }
  }, [employeeId, token])

  React.useEffect(() => {
    void refresh()
    const onUpdated = () => void refresh()
    window.addEventListener(STATUS_REFRESH_EVENT, onUpdated)
    return () => window.removeEventListener(STATUS_REFRESH_EVENT, onUpdated)
  }, [refresh])

  return (
    <section aria-label="Status history" className="grid gap-3">
      <div>
        <h3 className="text-base font-semibold">Status History</h3>
        <p className="text-xs text-muted-foreground">Employment changes and applied movements, newest first.</p>
      </div>
      {loading && !events.length ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </p>
      ) : error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : !events.length ? (
        <p className="py-2 text-sm text-muted-foreground">No status history yet.</p>
      ) : (
        <ol className="grid gap-0">
          {events.map((event) => {
            const rows = detailRows(event)
            const from = record(event.old_values)?.employment_status
            const to = record(event.new_values)?.employment_status
            return (
              <li key={event.id} className="relative border-l border-border pb-4 pl-4 last:pb-0">
                <span
                  className={cn(
                    "absolute -left-[5px] top-1.5 size-2.5 rounded-full",
                    event.event_type === "EXITED" ? "bg-rose-500" : event.event_type === "OTHER" ? "bg-sky-500" : "bg-primary",
                  )}
                  aria-hidden
                />
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-medium text-slate-800">{event.title}</p>
                  <p className="text-xs text-muted-foreground">Effective {event.effective_date}</p>
                </div>
                {typeof from === "string" && typeof to === "string" && from !== to ? (
                  <p className="text-xs text-slate-600">
                    {label(from)} → {label(to)}
                  </p>
                ) : null}
                {rows.length ? (
                  <dl className="mt-1 grid gap-x-3 gap-y-0.5 text-xs sm:grid-cols-[140px_1fr]">
                    {rows.map(([key, value]) => (
                      <React.Fragment key={key}>
                        <dt className="text-slate-500">{key}</dt>
                        <dd className="text-slate-800">{value}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                ) : null}
                {event.description ? (
                  <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{event.description}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {event.created_by_name ? `By ${event.created_by_name} · ` : ""}
                  {event.created_at ? new Date(event.created_at).toLocaleString() : ""}
                </p>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
