"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"

import { listLeaveTeamCalendar, type LeaveTeamCalendarEntry } from "@/lib/admin-api"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, options ?? { month: "short", day: "numeric" })
}

function statusLabel(status: string) {
  switch (status) {
    case "pending_department_manager": return "Manager review"
    case "pending_hr": return "HR review"
    case "in_review": return "In review"
    case "approved": return "Approved"
    default: return status.replaceAll("_", " ")
  }
}

function statusClass(status: string) {
  return status === "approved"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-800"
}

export function LeaveTeamCalendar() {
  const [month, setMonth] = React.useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = React.useState(() => dateKey(new Date()))
  const [entries, setEntries] = React.useState<LeaveTeamCalendarEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const fromDate = dateKey(new Date(month.getFullYear(), month.getMonth(), 1))
  const toDate = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0))

  const load = React.useCallback(async () => {
    const token = typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!token) {
      setError("Sign in again to view your team calendar.")
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await listLeaveTeamCalendar(token, fromDate, toDate)
      setEntries(result)
    } catch (reason) {
      setEntries([])
      setError(reason instanceof Error ? reason.message : "Could not load the team leave calendar.")
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate])

  React.useEffect(() => {
    void load()
  }, [load])

  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay())
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index)
    const key = dateKey(date)
    return {
      date,
      key,
      inMonth: date.getMonth() === month.getMonth(),
      entries: entries.filter((entry) => entry.start_date <= key && entry.end_date >= key),
    }
  })
  const selectedEntries = entries.filter(
    (entry) => entry.start_date <= selectedDate && entry.end_date >= selectedDate,
  )
  const today = dateKey(new Date())

  function moveMonth(offset: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1)
    setMonth(next)
    setSelectedDate(dateKey(new Date(next.getFullYear(), next.getMonth(), 1)))
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Team leave calendar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View approved leave and requests awaiting review for your direct reports and managed departments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
          <div className="flex items-center rounded-md border border-border">
            <button
              type="button"
              aria-label="Previous month"
              className="grid size-9 place-items-center rounded-l-md hover:bg-muted"
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <span className="min-w-36 text-center text-sm font-medium">
              {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              aria-label="Next month"
              className="grid size-9 place-items-center rounded-r-md hover:bg-muted"
              onClick={() => moveMonth(1)}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]">
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-1 py-2 text-center text-xs font-semibold text-muted-foreground sm:py-3">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, key, inMonth, entries: dayEntries }) => (
              <button
                key={key}
                type="button"
                aria-label={`${formatDate(key, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${dayEntries.length ? `, ${dayEntries.length} leave entries` : ""}`}
                aria-pressed={selectedDate === key}
                onClick={() => {
                  setSelectedDate(key)
                  if (!inMonth) {
                    setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
                  }
                }}
                className={`min-h-16 border-b border-r border-border p-1.5 text-left transition-colors sm:min-h-24 sm:p-2 ${
                  !inMonth ? "bg-muted/20 text-muted-foreground/55" : "bg-background"
                } ${selectedDate === key ? "bg-primary/5 ring-2 ring-inset ring-primary/50" : "hover:bg-muted/40"}`}
              >
                <span className={`grid size-7 place-items-center rounded-full text-xs ${key === today ? "bg-primary text-primary-foreground" : ""}`}>
                  {date.getDate()}
                </span>
                <span className="mt-1 hidden space-y-1 sm:block">
                  {dayEntries.slice(0, 2).map((entry) => (
                    <span
                      key={entry.request_id}
                      className={`block truncate rounded px-1.5 py-0.5 text-[10px] leading-4 ${
                        entry.status === "approved" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {entry.employee_name}
                    </span>
                  ))}
                  {dayEntries.length > 2 ? (
                    <span className="block px-1 text-[10px] text-muted-foreground">+{dayEntries.length - 2} more</span>
                  ) : null}
                </span>
                {dayEntries.length ? (
                  <span className="mt-1 flex gap-0.5 sm:hidden" aria-hidden="true">
                    {dayEntries.slice(0, 3).map((entry) => (
                      <span key={entry.request_id} className={`size-1.5 rounded-full ${entry.status === "approved" ? "bg-emerald-500" : "bg-amber-500"}`} />
                    ))}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <aside className="min-h-56 rounded-lg border border-border bg-background p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-semibold">{formatDate(selectedDate, { weekday: "long", month: "long", day: "numeric" })}</h3>
            <span className="text-xs text-muted-foreground">{selectedEntries.length} {selectedEntries.length === 1 ? "entry" : "entries"}</span>
          </div>
          {loading ? <p className="mt-5 text-sm text-muted-foreground">Loading team leave…</p> : null}
          {error ? <p role="alert" className="mt-5 text-sm text-rose-600">{error}</p> : null}
          {!loading && !error && selectedEntries.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">No team leave on this date.</p>
          ) : null}
          <ul className="mt-3 space-y-2">
            {!loading && !error ? selectedEntries.map((entry) => (
              <li key={entry.request_id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{entry.employee_name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{entry.leave_type}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass(entry.status)}`}>
                    {statusLabel(entry.status)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDate(entry.start_date)}–{formatDate(entry.end_date)} · {entry.total_days} {entry.total_days === 1 ? "day" : "days"}
                </p>
              </li>
            )) : null}
          </ul>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            Medical details, reasons, attachments, and private notes are not shown here.
          </p>
        </aside>
      </div>
    </section>
  )
}
