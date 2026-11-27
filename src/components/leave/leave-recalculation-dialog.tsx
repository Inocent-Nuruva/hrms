"use client"

import { StandardTable, StandardTableHeader, StandardTableBody, StandardTableRow, StandardTableHead, StandardTableCell } from "@/components/ui/standard-fluent-table"
import * as React from "react"
import { RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { DateInput } from "@/components/ui/date-input"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import {
  applyLeaveRecalculation,
  downloadLeaveRecalculationReport,
  getLeaveRecalculation,
  leaveRecalculationAction,
  listBranches,
  listDepartments,
  listEmployees,
  listLeaveRecalculations,
  listLeaveTypes,
  startLeaveRecalculation,
  type LeaveRecalculationLine,
  type LeaveRecalculationRun,
} from "@/lib/admin-api"
import { cn } from "@/lib/utils"

type Option = { id: number; name: string }
type Scope = LeaveRecalculationRun["scope_type"]

const PERM = {
  preview: "leave_balance_recalculation:preview",
  employee: "leave_balance_recalculation:employee",
  bulk: "leave_balance_recalculation:bulk",
  approve: "leave_balance_recalculation:approve",
  history: "leave_balance_recalculation:history",
}

const STATUS_LABEL: Record<LeaveRecalculationRun["status"], string> = {
  queued: "Queued",
  previewing: "Calculating preview",
  preview_ready: "Preview ready",
  pending_approval: "Awaiting approval",
  approved: "Approved – applying",
  applying: "Applying",
  completed: "Completed",
  partially_failed: "Partially failed",
  failed: "Failed",
  cancelled: "Cancelled",
  superseded: "Superseded",
}
const BUSY: LeaveRecalculationRun["status"][] = ["queued", "previewing", "approved", "applying"]

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam" }).format(new Date())
const num = (v: string | number) => Number(v).toFixed(2)
const toOptions = (rows: Array<Record<string, unknown>>): Option[] =>
  rows
    .map((r) => ({ id: Number(r.id), name: String(r.name ?? r.code ?? `#${r.id}`) }))
    .filter((o) => Number.isInteger(o.id))

function errorText(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback
}

/**
 * "Recalculate Leave Balance": preview (dry run) → review differences →
 * apply with a reason (bulk scopes go to an independent approver) →
 * progress and history. Shared by the employee profile, Leave Balances and
 * leave-balance administration.
 */
export function RecalculateLeaveBalanceButton({
  token,
  employeeId,
  employeeName,
  className,
}: {
  token: string | null
  /** Pre-selects one employee (Employee Information → Leave Balance). */
  employeeId?: number | null
  employeeName?: string | null
  className?: string
}) {
  const actor = useDashboardActor()
  const can = (p: string) => canPerformPermission(actor.permissionLabels, p)
  const [open, setOpen] = React.useState(false)
  if (!can(PERM.preview) && !can(PERM.history)) return null
  return (
    <>
      <button
        type="button"
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
        Recalculate leave balance
      </button>
      {open ? (
        <LeaveRecalculationDialog
          token={token}
          employeeId={employeeId ?? null}
          employeeName={employeeName ?? null}
          onClose={() => setOpen(false)}
          can={can}
        />
      ) : null}
    </>
  )
}

function LeaveRecalculationDialog({
  token,
  employeeId,
  employeeName,
  onClose,
  can,
}: {
  token: string | null
  employeeId: number | null
  employeeName: string | null
  onClose: () => void
  can: (p: string) => boolean
}) {
  const id = React.useId()
  const canBulk = can(PERM.bulk)
  const [view, setView] = React.useState<"new" | "run" | "history">(can(PERM.preview) ? "new" : "history")
  const [scope, setScope] = React.useState<Scope>(employeeId ? "employee" : canBulk ? "department" : "employee")
  const [scopeId, setScopeId] = React.useState<string>(employeeId ? String(employeeId) : "")
  const [leaveTypeId, setLeaveTypeId] = React.useState("")
  const [asOf, setAsOf] = React.useState(today())
  const [departments, setDepartments] = React.useState<Option[]>([])
  const [branches, setBranches] = React.useState<Option[]>([])
  const [types, setTypes] = React.useState<Option[]>([])
  const [run, setRun] = React.useState<LeaveRecalculationRun | null>(null)
  const [lines, setLines] = React.useState<LeaveRecalculationLine[]>([])
  const [onlyChanged, setOnlyChanged] = React.useState(true)
  const [history, setHistory] = React.useState<LeaveRecalculationRun[]>([])
  const [reason, setReason] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!token) return
    void listLeaveTypes(token, { page: 1, limit: 100 })
      .then((r) => setTypes(toOptions(r.rows as Array<Record<string, unknown>>)))
      .catch(() => undefined)
    if (!canBulk) return
    void listDepartments(token, { page: 1, limit: 100 })
      .then((r) => setDepartments(toOptions(r.rows as Array<Record<string, unknown>>)))
      .catch(() => undefined)
    void listBranches(token, { page: 1, limit: 100 })
      .then((r) => setBranches(toOptions(r.rows as Array<Record<string, unknown>>)))
      .catch(() => undefined)
  }, [canBulk, token])

  const loadRun = React.useCallback(
    async (runId: number) => {
      if (!token) return
      const data = await getLeaveRecalculation(token, runId, { only_changed: onlyChanged, limit: 200 })
      setRun(data.run)
      setLines(data.lines)
    },
    [onlyChanged, token],
  )

  // Poll while the background job works.
  React.useEffect(() => {
    if (!run || !BUSY.includes(run.status)) return
    const timer = window.setInterval(() => void loadRun(run.id).catch(() => undefined), 2000)
    return () => window.clearInterval(timer)
  }, [loadRun, run])

  React.useEffect(() => {
    if (run) void loadRun(run.id).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyChanged])

  const loadHistory = React.useCallback(async () => {
    if (!token) return
    try {
      const data = await listLeaveRecalculations(token, { employee_id: employeeId ?? undefined, limit: 30 })
      setHistory(data.data)
    } catch (e) {
      setError(errorText(e, "Could not load recalculation history."))
    }
  }, [employeeId, token])

  React.useEffect(() => {
    if (view === "history") void loadHistory()
  }, [loadHistory, view])

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fn()
      if (done) setNotice(done)
    } catch (e) {
      const payload = (e as { payload?: { run_id?: number } }).payload
      setError(errorText(e, "Something went wrong."))
      if (payload?.run_id) {
        setView("run")
        await loadRun(payload.run_id).catch(() => undefined)
      }
    } finally {
      setBusy(false)
    }
  }

  const startPreview = () =>
    act(async () => {
      if (!token) return
      const created = await startLeaveRecalculation(token, {
        scope_type: scope,
        scope_id: scope === "company" ? undefined : Number(scopeId),
        leave_type_id: leaveTypeId ? Number(leaveTypeId) : undefined,
        as_of_date: asOf,
      })
      setView("run")
      setRun(created)
      setLines([])
    })

  const applyRun = () =>
    act(async () => {
      if (!token || !run) return
      const updated = await applyLeaveRecalculation(token, run.id, reason.trim())
      setRun(updated)
      setReason("")
    }, run?.scope_type === "employee" ? "Corrections are being applied." : "Submitted. Another authorised HR user must approve before corrections are posted.")

  const runAction = (action: "approve" | "cancel" | "retry") =>
    act(async () => {
      if (!token || !run) return
      setRun(await leaveRecalculationAction(token, run.id, action))
    })

  const download = () =>
    act(async () => {
      if (!token || !run) return
      const { blob, filename } = await downloadLeaveRecalculationReport(token, run.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    })

  const scopeReady = scope === "company" || !!scopeId
  const canApply =
    run?.status === "preview_ready" &&
    run.lines_changed > 0 &&
    can(run.scope_type === "employee" ? PERM.employee : PERM.bulk)
  const pastCutoff = run ? run.as_of_date !== today() : false

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogPopup from="bottom" className="w-[calc(100%-1rem)] max-w-4xl" bodyClassName="!max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recalculate leave balance</DialogTitle>
          <DialogDescription>
            A preview recalculates balances from hire date, probation, policy and leave taken without changing anything.
            Corrections are posted only after you apply them with a reason{canBulk ? "; bulk corrections also need an independent approver" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border" role="tablist">
          {(
            [
              ["new", "New preview", can(PERM.preview)],
              ["run", run ? run.reference : "Current run", !!run],
              ["history", "History", can(PERM.history) || can(PERM.preview)],
            ] as const
          )
            .filter(([, , show]) => show)
            .map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm",
                  view === key ? "border-primary font-semibold" : "border-transparent text-muted-foreground",
                )}
                onClick={() => setView(key)}
              >
                {label}
              </button>
            ))}
        </div>

        {error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>
        ) : null}
        {notice ? <p className="text-sm text-muted-foreground" role="status">{notice}</p> : null}

        {view === "new" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={`${id}-scope`} className="text-xs font-medium">Scope</label>
              <FluentSelect
                id={`${id}-scope`}
                ariaLabel="Scope"
                value={scope}
                disabled={!!employeeId && !canBulk}
                onChange={(value) => {
                  setScope(value as Scope)
                  setScopeId(value === "employee" && employeeId ? String(employeeId) : "")
                }}
                options={[
                  { value: "employee", label: "One employee" },
                  ...(canBulk
                    ? [
                        { value: "department", label: "Department" },
                        { value: "branch", label: "Branch" },
                        { value: "company", label: "All employees in the company" },
                      ]
                    : []),
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-target`} className="text-xs font-medium">
                {scope === "employee" ? "Employee" : scope === "department" ? "Department" : scope === "branch" ? "Branch" : "Company"}
              </label>
              {scope === "employee" ? (
                employeeId ? (
                  <p id={`${id}-target`} className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-2 text-sm">
                    {employeeName ?? `Employee #${employeeId}`}
                  </p>
                ) : (
                  <EmployeePicker token={token} inputId={`${id}-target`} value={scopeId} onChange={setScopeId} />
                )
              ) : scope === "company" ? (
                <p id={`${id}-target`} className="flex h-9 items-center text-sm text-muted-foreground">Every active employee</p>
              ) : (
                <FluentSelect
                  id={`${id}-target`}
                  ariaLabel={scope === "department" ? "Department" : "Branch"}
                  placeholder="Choose…"
                  value={scopeId}
                  onChange={setScopeId}
                  options={(scope === "department" ? departments : branches).map((o) => ({ value: String(o.id), label: o.name }))}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-type`} className="text-xs font-medium">Leave type</label>
              <FluentSelect
                id={`${id}-type`}
                ariaLabel="Leave type"
                placeholder="All leave types"
                value={leaveTypeId}
                onChange={setLeaveTypeId}
                options={[{ value: "", label: "All leave types" }, ...types.map((o) => ({ value: String(o.id), label: o.name }))]}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-asof`} className="text-xs font-medium">Cutoff date</label>
              <DateInput id={`${id}-asof`} aria-label="Cutoff date" max={today()} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Defaults to today. A past cutoff is for review only; corrections are applied as at today.</p>
            </div>
            <div className="sm:col-span-2">
              <Button onClick={startPreview} disabled={busy || !scopeReady || !token}>
                {busy ? "Starting…" : "Run preview (no changes)"}
              </Button>
            </div>
          </div>
        ) : null}

        {view === "run" && run ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{run.reference}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{STATUS_LABEL[run.status]}</span>
              <span className="text-muted-foreground">
                {run.scope_type} · as at {run.as_of_date} · {run.employees_done}/{run.employees_total} employees · {run.lines_changed} change(s)
                {run.lines_applied ? ` · ${run.lines_applied} applied` : ""}
                {run.lines_failed ? ` · ${run.lines_failed} failed` : ""}
                {run.lines_skipped ? ` · ${run.lines_skipped} skipped` : ""}
              </span>
            </div>
            {BUSY.includes(run.status) ? (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={run.employees_total || 1} aria-valuenow={run.employees_done}>
                <div className="h-full bg-primary transition-all" style={{ width: `${run.employees_total ? (100 * run.employees_done) / run.employees_total : 10}%` }} />
              </div>
            ) : null}
            {run.trigger !== "manual" ? (
              <p className="text-xs text-muted-foreground">
                Started automatically ({run.trigger === "initial" ? "initial reconciliation after the accrual upgrade" : run.trigger.replace("_", " ")}). Nothing changes until it is applied.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={onlyChanged} onCheckedChange={(checked) => setOnlyChanged(checked)} />
                Only show differences
              </label>
              <Button size="sm" variant="outline" onClick={download} disabled={busy}>Download report (CSV)</Button>
              {["queued", "preview_ready", "pending_approval"].includes(run.status) ? (
                <Button size="sm" variant="ghost" onClick={() => void runAction("cancel")} disabled={busy}>Cancel run</Button>
              ) : null}
              {(run.status === "partially_failed" || run.status === "failed") && can(run.scope_type === "employee" ? PERM.employee : PERM.bulk) ? (
                <Button size="sm" variant="outline" onClick={() => void runAction("retry")} disabled={busy}>Retry failed</Button>
              ) : null}
              {run.status === "pending_approval" && can(PERM.approve) ? (
                <Button size="sm" onClick={() => void runAction("approve")} disabled={busy}>Approve and apply</Button>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <StandardTable className="w-full min-w-190 text-sm">
                <StandardTableHeader className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <StandardTableRow>
                    <StandardTableHead className="px-2 py-2">Employee</StandardTableHead>
                    <StandardTableHead className="px-2 py-2">Leave type</StandardTableHead>
                    <StandardTableHead className="px-2 py-2 text-right">Current balance</StandardTableHead>
                    <StandardTableHead className="px-2 py-2 text-right">Recalculated</StandardTableHead>
                    <StandardTableHead className="px-2 py-2 text-right">Difference</StandardTableHead>
                    <StandardTableHead className="px-2 py-2">How it was calculated</StandardTableHead>
                    <StandardTableHead className="px-2 py-2">Status</StandardTableHead>
                  </StandardTableRow>
                </StandardTableHeader>
                <StandardTableBody>
                  {lines.length ? (
                    lines.map((l) => {
                      const diff = Number(l.difference_days)
                      return (
                        <StandardTableRow key={l.id} className="border-t border-border align-top">
                          <StandardTableCell className="px-2 py-2">
                            <span className="block font-medium">{l.employee_name ?? `#${l.employee_id}`}</span>
                            <span className="block text-xs text-muted-foreground">{l.employee_no}</span>
                          </StandardTableCell>
                          <StandardTableCell className="px-2 py-2">{l.leave_type_name ?? "-"}</StandardTableCell>
                          <StandardTableCell className="px-2 py-2 text-right tabular-nums">{num(l.current_available_days)}</StandardTableCell>
                          <StandardTableCell className="px-2 py-2 text-right tabular-nums">{num(l.recalculated_available_days)}</StandardTableCell>
                          <StandardTableCell className={cn("px-2 py-2 text-right font-semibold tabular-nums", diff < 0 ? "text-destructive" : diff > 0 ? "text-emerald-700 dark:text-emerald-400" : "")}>
                            {diff > 0 ? "+" : ""}{num(diff)}
                          </StandardTableCell>
                          <StandardTableCell className="px-2 py-2 text-xs text-muted-foreground">
                            Accrued {num(l.current_accrued_days)} → {num(l.recalculated_accrued_days)} of {num(l.entitlement_days)}
                            {l.accrual_frequency ? ` · ${l.accrual_frequency}` : ""}
                            {l.policy_version ? ` · policy v${l.policy_version}` : ""}
                            <br />
                            Hire {l.hire_date ?? "-"}
                            {l.accrual_start_basis === "probation_completion" ? ` · probation ${l.probation_status?.replace("_", " ")}` : ""}
                            {` · accrues from ${l.accrual_start_date ?? "not yet"}`}
                            <br />
                            Used {num(l.used_days)} · pending {num(l.pending_days)} · adjustments {num(l.adjusted_days)}
                            {l.warnings?.length ? <span className="mt-1 block text-amber-700 dark:text-amber-300">{l.warnings.join(" ")}</span> : null}
                            {l.error ? <span className="mt-1 block text-destructive">{l.error}</span> : null}
                          </StandardTableCell>
                          <StandardTableCell className="px-2 py-2 text-xs">{l.status}</StandardTableCell>
                        </StandardTableRow>
                      )
                    })
                  ) : (
                    <StandardTableRow>
                      <StandardTableCell colSpan={7} className="px-2 py-6 text-center text-sm text-muted-foreground">
                        {BUSY.includes(run.status) ? "Calculating…" : "No differences: balances already match."}
                      </StandardTableCell>
                    </StandardTableRow>
                  )}
                </StandardTableBody>
              </StandardTable>
            </div>

            {canApply ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                {pastCutoff ? (
                  <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
                    This preview used a past cutoff ({run.as_of_date}). Run a new preview as at today to apply corrections.
                  </p>
                ) : (
                  <>
                    <label htmlFor={`${id}-reason`} className="text-xs font-medium">Reason for applying these corrections</label>
                    <Textarea id={`${id}-reason`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual Leave now accrues monthly after probation (policy v3)" />
                    <Button onClick={applyRun} disabled={busy || reason.trim().length < 5}>
                      {run.scope_type === "employee" ? `Apply ${run.lines_changed} correction(s)` : `Submit ${run.lines_changed} correction(s) for approval`}
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {view === "history" ? (
          <div className="overflow-x-auto rounded-md border border-border">
            <StandardTable className="w-full min-w-160 text-sm">
              <StandardTableHeader className="bg-muted/50 text-left text-xs text-muted-foreground">
                <StandardTableRow>
                  <StandardTableHead className="px-2 py-2">Reference</StandardTableHead>
                  <StandardTableHead className="px-2 py-2">Scope</StandardTableHead>
                  <StandardTableHead className="px-2 py-2">Status</StandardTableHead>
                  <StandardTableHead className="px-2 py-2 text-right">Changes</StandardTableHead>
                  <StandardTableHead className="px-2 py-2">Reason</StandardTableHead>
                  <StandardTableHead className="px-2 py-2">Created</StandardTableHead>
                </StandardTableRow>
              </StandardTableHeader>
              <StandardTableBody>
                {history.length ? (
                  history.map((h) => (
                    <StandardTableRow key={h.id} className="cursor-pointer border-t border-border hover:bg-muted/40" onClick={() => { setView("run"); void loadRun(h.id) }}>
                      <StandardTableCell className="px-2 py-2 font-medium">{h.reference}</StandardTableCell>
                      <StandardTableCell className="px-2 py-2">{h.scope_type}{h.trigger !== "manual" ? ` (${h.trigger})` : ""}</StandardTableCell>
                      <StandardTableCell className="px-2 py-2">{STATUS_LABEL[h.status]}</StandardTableCell>
                      <StandardTableCell className="px-2 py-2 text-right tabular-nums">{h.lines_applied || h.lines_changed}</StandardTableCell>
                      <StandardTableCell className="max-w-55 truncate px-2 py-2 text-xs text-muted-foreground" title={h.reason ?? ""}>{h.reason ?? "-"}</StandardTableCell>
                      <StandardTableCell className="px-2 py-2 text-xs">{new Date(h.created_at).toLocaleString()}</StandardTableCell>
                    </StandardTableRow>
                  ))
                ) : (
                  <StandardTableRow><StandardTableCell colSpan={6} className="px-2 py-6 text-center text-muted-foreground">No recalculations yet.</StandardTableCell></StandardTableRow>
                )}
              </StandardTableBody>
            </StandardTable>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Close</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}

function EmployeePicker({
  token,
  inputId,
  value,
  onChange,
}: {
  token: string | null
  inputId: string
  value: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<Option[]>([])
  const [label, setLabel] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!token || query.trim().length < 2) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void listEmployees(token, { search: query.trim(), limit: 8 }, { signal: controller.signal })
        .then((page) =>
          setResults(
            (page.rows as Array<Record<string, unknown>>).map((r) => ({
              id: Number(r.id),
              name: `${[r.first_name, r.last_name].filter(Boolean).join(" ")}${r.employee_no ? ` (${String(r.employee_no)})` : ""}`,
            })),
          ),
        )
        .catch(() => undefined)
    }, 300)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query, token])
  if (value && label)
    return (
      <div className="flex h-9 items-center justify-between rounded-md border border-border px-2 text-sm">
        <span className="truncate">{label}</span>
        <button
          type="button"
          className="text-xs text-primary"
          onClick={() => {
            onChange("")
            setLabel(null)
          }}
        >
          Change
        </button>
      </div>
    )
  return (
    <div className="space-y-1">
      <Input id={inputId} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or employee number" autoComplete="off" />
      {results.length ? (
        <ul role="listbox" className="max-h-44 overflow-y-auto rounded-md border border-border bg-background">
          {results.map((o) => (
            <li key={o.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange(String(o.id))
                  setLabel(o.name)
                  setQuery("")
                }}
              >
                {o.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
