"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { fluentPrompt } from "@/components/ui/fluent-dialog-service"
import {
  cancelLeaveActingAssignment,
  checkLeaveActingCandidate,
  getLeaveActingAssignment,
  listEmployees,
  saveLeaveActingAssignment,
  type LeaveActingAssignment,
  type LeaveActingAssignmentInput,
  type LeaveActingPerson,
} from "@/lib/admin-api"
import { cn } from "@/lib/utils"

const PENDING_LEAVE = [
  "draft",
  "submitted",
  "in_review",
  "pending_department_manager",
  "pending_hr",
  "returned_for_correction",
]

const STATUS_STYLE: Record<LeaveActingAssignment["status"], string> = {
  PENDING: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  ACTIVE: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-muted text-muted-foreground line-through",
}
const STATUS_LABEL: Record<LeaveActingAssignment["status"], string> = {
  PENDING: "Scheduled",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

export function ActingStatusBadge({ status }: { status: LeaveActingAssignment["status"] }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  )
}

function personLine(p: LeaveActingPerson | null) {
  if (!p) return "-"
  return [p.employee_no, p.position_name, p.department_name].filter(Boolean).join(" · ")
}

function fromRecord(row: Record<string, unknown>): LeaveActingPerson | null {
  const id = Number(row.id)
  if (!Number.isInteger(id)) return null
  const nested = (key: string) => {
    const value = row[key]
    return value && typeof value === "object" ? ((value as Record<string, unknown>).name as string) ?? null : null
  }
  const name =
    [row.first_name, row.last_name].filter((v) => typeof v === "string" && v).join(" ") ||
    (typeof row.full_name === "string" ? row.full_name : "") ||
    `Employee #${id}`
  return {
    id,
    name,
    employee_no: typeof row.employee_no === "string" ? row.employee_no : "",
    department_name:
      nested("primary_department") ?? (typeof row.department_name === "string" ? row.department_name : null),
    position_name:
      nested("primary_position") ?? (typeof row.position_name === "string" ? row.position_name : null),
  }
}

export type ActingDraft = LeaveActingAssignmentInput | null

/**
 * Acting Employee / Leave Delegation section of a leave request. Approvers
 * (and HR) appoint a colleague to cover. On a request still awaiting the
 * viewer's decision the selection is sent with the approve / recommend
 * action (same transaction) through `onDraftChange`; otherwise it is saved
 * directly.
 */
export function ActingEmployeePanel({
  token,
  leaveRequestId,
  leaveStatus,
  leaveStart,
  leaveEnd,
  absentEmployeeId,
  savesWithDecision = false,
  onDraftChange,
}: {
  token: string | null
  leaveRequestId: number
  leaveStatus: string
  leaveStart: string
  leaveEnd: string
  absentEmployeeId: number | null
  /** The viewer can approve this request now: offer "save with my decision". */
  savesWithDecision?: boolean
  onDraftChange?: (draft: ActingDraft) => void
}) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [current, setCurrent] = React.useState<LeaveActingAssignment | null>(null)
  const [history, setHistory] = React.useState<LeaveActingAssignment[]>([])
  const [canManage, setCanManage] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<LeaveActingPerson[]>([])
  const [searching, setSearching] = React.useState(false)
  const [selected, setSelected] = React.useState<LeaveActingPerson | null>(null)
  const [start, setStart] = React.useState(leaveStart.slice(0, 10))
  const [end, setEnd] = React.useState(leaveEnd.slice(0, 10))
  const [responsibilities, setResponsibilities] = React.useState("")
  const [routeApprovals, setRouteApprovals] = React.useState(false)
  const [check, setCheck] = React.useState<{ error?: string; warnings: string[] } | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)

  const leavePending = PENDING_LEAVE.includes(leaveStatus)
  const withDecision = savesWithDecision && leavePending
  const listId = React.useId()

  const load = React.useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await getLeaveActingAssignment(token, leaveRequestId)
      setCurrent(data.current)
      setHistory(data.history.filter((h) => h.status === "CANCELLED"))
      setCanManage(data.can_manage)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the acting employee.")
    } finally {
      setLoading(false)
    }
  }, [leaveRequestId, token])

  React.useEffect(() => {
    void load()
  }, [load])

  // Employee search (debounced; active employees only, never the absentee).
  React.useEffect(() => {
    if (!editing || !token || query.trim().length < 2) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const page = await listEmployees(
          token,
          { search: query.trim(), limit: 8, employment_status: "active" },
          { signal: controller.signal },
        )
        setResults(
          page.rows
            .map((r) => fromRecord(r as Record<string, unknown>))
            .filter((p): p is LeaveActingPerson => !!p && p.id !== absentEmployeeId),
        )
      } catch {
        if (!controller.signal.aborted) setResults([])
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 300)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [absentEmployeeId, editing, query, token])

  const input = React.useMemo<LeaveActingAssignmentInput | null>(
    () =>
      selected
        ? {
            acting_employee_id: selected.id,
            start_date: start,
            end_date: end,
            responsibilities: responsibilities.trim() || undefined,
            route_approvals: routeApprovals,
          }
        : null,
    [end, responsibilities, routeApprovals, selected, start],
  )

  // Server-side validation of the candidate (overlapping leave, status, dates).
  React.useEffect(() => {
    if (!editing || !token || !input) {
      setCheck(null)
      return
    }
    let alive = true
    const timer = window.setTimeout(async () => {
      try {
        const result = await checkLeaveActingCandidate(token, leaveRequestId, input)
        if (alive) setCheck({ warnings: result.warnings })
      } catch (e) {
        if (alive) setCheck({ error: e instanceof Error ? e.message : "Not eligible.", warnings: [] })
      }
    }, 250)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [editing, input, leaveRequestId, token])

  const valid = !!input && !check?.error && start <= end

  // Hand the draft to the approve action while it is valid.
  React.useEffect(() => {
    if (!withDecision || !onDraftChange) return
    onDraftChange(editing && valid ? input : null)
  }, [editing, input, onDraftChange, valid, withDecision])
  React.useEffect(() => () => onDraftChange?.(null), [onDraftChange])

  const startEditing = () => {
    setEditing(true)
    setNotice(null)
    if (current?.acting_employee) {
      setSelected(current.acting_employee)
      setStart(current.start_date.slice(0, 10))
      setEnd(current.end_date.slice(0, 10))
      setResponsibilities(current.responsibilities ?? "")
      setRouteApprovals(current.route_approvals)
    } else {
      setSelected(null)
      setStart(leaveStart.slice(0, 10))
      setEnd(leaveEnd.slice(0, 10))
      setResponsibilities("")
      setRouteApprovals(false)
    }
  }

  const saveNow = async () => {
    if (!token || !input) return
    setBusy(true)
    setError(null)
    try {
      const result = await saveLeaveActingAssignment(token, leaveRequestId, input)
      setNotice(
        result.warnings.length
          ? `Saved. Note: ${result.warnings.join(" ")}`
          : "Acting employee saved and notified.",
      )
      setEditing(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the acting employee.")
    } finally {
      setBusy(false)
    }
  }

  const cancelCurrent = async () => {
    if (!token || !current) return
    const reason = await fluentPrompt("Why is this acting appointment being withdrawn?", "", {
      title: "Withdraw acting employee",
      confirmLabel: "Withdraw",
    })
    if (reason === null) return
    setBusy(true)
    setError(null)
    try {
      await cancelLeaveActingAssignment(token, current.id, reason || undefined)
      setNotice("Acting appointment withdrawn.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not withdraw the appointment.")
    } finally {
      setBusy(false)
    }
  }

  const closed = ["cancelled", "rejected"].includes(leaveStatus)
  const canEdit = canManage && !closed && current?.status !== "COMPLETED"

  return (
    <section className="space-y-2" aria-labelledby={`${listId}-title`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id={`${listId}-title`}
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Acting Employee / Leave Delegation
        </h3>
        {canEdit && !editing ? (
          <Button size="sm" variant="outline" onClick={startEditing} disabled={busy}>
            {current ? "Change" : "Appoint acting employee"}
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground" role="status">Loading…</p>
      ) : current && current.acting_employee ? (
        <div className="space-y-2 rounded-lg border border-border px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{current.acting_employee.name}</p>
            <ActingStatusBadge status={current.status} />
          </div>
          <p className="text-xs text-muted-foreground">{personLine(current.acting_employee)}</p>
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] text-muted-foreground">Delegation period</dt>
              <dd>{current.start_date.slice(0, 10)} – {current.end_date.slice(0, 10)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Appointed by</dt>
              <dd>{current.appointed_by?.name ?? "-"}</dd>
            </div>
            {current.responsibilities ? (
              <div className="sm:col-span-2">
                <dt className="text-[11px] text-muted-foreground">Responsibilities</dt>
                <dd className="whitespace-pre-wrap">{current.responsibilities}</dd>
              </div>
            ) : null}
            {current.route_approvals ? (
              <div className="sm:col-span-2 text-xs text-muted-foreground">
                Leave approvals addressed to the absent employee go to the acting employee during this period.
              </div>
            ) : null}
          </dl>
          {canEdit && (current.status === "PENDING" || current.status === "ACTIVE") && !editing ? (
            <Button size="sm" variant="ghost" onClick={cancelCurrent} disabled={busy}>
              Withdraw appointment
            </Button>
          ) : null}
        </div>
      ) : !editing ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
          Not assigned.
        </p>
      ) : null}

      {editing ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-3 py-3">
          <div className="space-y-1.5">
            <label htmlFor={`${listId}-search`} className="text-xs font-medium">
              Acting employee
            </label>
            {selected ? (
              <div className="flex items-start justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{selected.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{personLine(selected)}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id={`${listId}-search`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or employee number"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={results.length > 0}
                  aria-controls={`${listId}-results`}
                />
                {searching ? (
                  <p className="text-xs text-muted-foreground" role="status">Searching…</p>
                ) : null}
                {results.length ? (
                  <ul
                    id={`${listId}-results`}
                    role="listbox"
                    className="max-h-56 overflow-y-auto rounded-md border border-border bg-background"
                  >
                    {results.map((p) => (
                      <li key={p.id} role="option" aria-selected={false}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                          onClick={() => {
                            setSelected(p)
                            setQuery("")
                            setResults([])
                          }}
                        >
                          <span className="block text-sm font-medium">{p.name}</span>
                          <span className="block text-xs text-muted-foreground">{personLine(p)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : query.trim().length >= 2 && !searching ? (
                  <p className="text-xs text-muted-foreground">No active employees match.</p>
                ) : null}
              </>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={`${listId}-start`} className="text-xs font-medium">From</label>
              <Input
                id={`${listId}-start`}
                type="date"
                value={start}
                min={leaveStart.slice(0, 10)}
                max={leaveEnd.slice(0, 10)}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${listId}-end`} className="text-xs font-medium">To</label>
              <Input
                id={`${listId}-end`}
                type="date"
                value={end}
                min={start}
                max={leaveEnd.slice(0, 10)}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Defaults to the leave dates and follows them if the leave is extended or ended early.
          </p>

          <div className="space-y-1.5">
            <label htmlFor={`${listId}-resp`} className="text-xs font-medium">
              Responsibilities to cover
            </label>
            <Textarea
              id={`${listId}-resp`}
              value={responsibilities}
              maxLength={2000}
              rows={3}
              onChange={(e) => setResponsibilities(e.target.value)}
              placeholder="e.g. Approve routine requests, attend the weekly operations meeting"
            />
          </div>

          <label className="flex items-start gap-3 text-sm">
            <Switch
              checked={routeApprovals}
              onCheckedChange={setRouteApprovals}
              aria-describedby={`${listId}-route-help`}
            />
            <span>
              Route leave approvals to the acting employee
              <span id={`${listId}-route-help`} className="block text-xs text-muted-foreground">
                Time-limited to the delegation period. No other permissions are passed on.
              </span>
            </span>
          </label>

          {check?.error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {check.error}
            </p>
          ) : null}
          {check?.warnings.length ? (
            <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-200" role="status">
              {check.warnings.join(" ")}
            </p>
          ) : null}
          {withDecision && valid ? (
            <p className="text-xs text-muted-foreground" role="status">
              This appointment will be saved together with your approval.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={saveNow} disabled={!valid || busy}>
              {busy ? "Saving…" : withDecision ? "Save now" : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}
      {notice ? (
        <p className="text-sm text-muted-foreground" role="status">{notice}</p>
      ) : null}
      {history.length ? (
        <p className="text-[11px] text-muted-foreground">
          Previously appointed: {history.map((h) => h.acting_employee?.name ?? "-").join(", ")}
        </p>
      ) : null}
    </section>
  )
}
