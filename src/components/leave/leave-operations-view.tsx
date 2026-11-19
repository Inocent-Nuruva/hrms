"use client"
import { RecalculateLeaveBalanceButton } from "@/components/leave/leave-recalculation-dialog"

import * as React from "react"
import { RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { showErrorAlert } from "@/lib/error-alert"
import {
  applyLeaveBackfill,
  getLeavePayrollReconciliation,
  getLeaveReadiness,
  listLeaveBackfillBatches,
  listLeaveOperationsHistory,
  previewLeaveBackfill,
  retryEncashmentHandoffs,
  revertLeaveBackfillBatch,
  type BackfillBatch,
  type BackfillPlan,
  type ReadinessReport,
  type ReconciliationResult,
} from "@/lib/leave-engine-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { showSuccessAlert } from "@/lib/success-alert"
import { cn } from "@/lib/utils"

import { LeaveNotificationsPanel } from "./leave-notifications-panel"

const token = () => readStoredSessionTokens().accessToken ?? ""
const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)
const today = () => new Date().toISOString().slice(0, 10)

const TONE: Record<string, string> = {
  blocker: "bg-red-100 text-red-800",
  warning: "bg-amber-100 text-amber-800",
  ok: "bg-emerald-100 text-emerald-800",
  MATCH: "bg-emerald-100 text-emerald-800",
  PAID: "bg-emerald-100 text-emerald-800",
  DIFF: "bg-amber-100 text-amber-800",
  MISMATCH: "bg-red-100 text-red-800",
  FAILED: "bg-red-100 text-red-800",
  MISSING_PAYROLL_RESULT: "bg-amber-100 text-amber-800",
  NOT_SUBMITTED: "bg-amber-100 text-amber-800",
}
const chip = (value: string) => (
  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", TONE[value] ?? "bg-slate-100 text-slate-700")}>
    {value.replace(/_/g, " ").toLowerCase()}
  </span>
)

const TABS = [
  { key: "readiness", label: "Configuration readiness" },
  { key: "reconciliation", label: "Payroll reconciliation" },
  { key: "backfill", label: "Allocation backfill" },
  { key: "notifications", label: "Notifications" },
  { key: "history", label: "History" },
] as const
type Tab = (typeof TABS)[number]["key"]

/**
 * Leave Operations: configuration readiness, payroll reconciliation, the
 * historical allocation backfill and notification settings, for authorised
 * administrators. Mutating actions need leave_operations:execute, ask for
 * confirmation, and are audited on the server.
 */
export function LeaveOperationsView() {
  const actor = useDashboardActor()
  const canExecute = canPerformPermission(actor.permissionLabels, "leave_operations:execute")
  const [tab, setTab] = React.useState<Tab>("readiness")

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        title="Leave operations"
        description="Check the leave set-up, reconcile leave with payroll, run the historical allocation backfill and manage leave notifications. Changes need confirmation and are recorded in the history."
      />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5">
        <p className="text-sm text-muted-foreground">
          Leave balance administration: preview and apply balance recalculations (one employee, a department, a branch or the whole company) and review their history.
        </p>
        <RecalculateLeaveBalanceButton token={token() || null} />
      </div>
      <div className="flex flex-wrap gap-1 border-b border-border" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              tab === t.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "readiness" ? <ReadinessTab /> : null}
      {tab === "reconciliation" ? <ReconciliationTab canExecute={canExecute} /> : null}
      {tab === "backfill" ? <BackfillTab canExecute={canExecute} /> : null}
      {tab === "notifications" ? <LeaveNotificationsPanel /> : null}
      {tab === "history" ? <HistoryTab /> : null}
    </div>
  )
}

function ReadinessTab() {
  const [report, setReport] = React.useState<ReadinessReport | null>(null)
  const [loading, setLoading] = React.useState(false)
  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setReport(await getLeaveReadiness(token()))
    } catch (e) {
      showErrorAlert(errorText(e, "Could not run the readiness check."))
    } finally {
      setLoading(false)
    }
  }, [])
  React.useEffect(() => {
    void load()
  }, [load])
  const order = { blocker: 0, warning: 1, ok: 2 } as const
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {report
            ? `${report.summary.blocker} blocker(s), ${report.summary.warning} warning(s), ${report.summary.ok} ok · checked ${new Date(report.generated_at).toLocaleString()}`
            : loading
              ? "Checking…"
              : ""}
        </p>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCwIcon className="mr-1 size-4" /> Run check
        </Button>
      </div>
      {report?.blocked_features.length ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Blocked until fixed:</p>
          <ul className="list-disc pl-5">
            {report.blocked_features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Area</th>
              <th className="px-3 py-2">Finding</th>
              <th className="px-3 py-2">Owner</th>
            </tr>
          </thead>
          <tbody>
            {[...(report?.findings ?? [])]
              .sort((a, b) => order[a.severity] - order[b.severity])
              .map((f, i) => (
                <tr key={`${f.code}-${i}`} className="border-t border-border align-top">
                  <td className="px-3 py-2">{chip(f.severity)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{f.area.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2">
                    {f.subject ? <span className="font-medium">{f.subject}: </span> : null}
                    {f.message}
                  </td>
                  <td className="px-3 py-2">{f.owner}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ReconciliationTab({ canExecute }: { canExecute: boolean }) {
  const [from, setFrom] = React.useState(`${today().slice(0, 4)}-01-01`)
  const [to, setTo] = React.useState(today())
  const [data, setData] = React.useState<ReconciliationResult | null>(null)
  const [onlyIssues, setOnlyIssues] = React.useState(true)
  const [loading, setLoading] = React.useState(false)

  async function run() {
    setLoading(true)
    try {
      setData(await getLeavePayrollReconciliation(token(), from, to))
    } catch (e) {
      showErrorAlert(errorText(e, "Could not reconcile."))
    } finally {
      setLoading(false)
    }
  }
  async function retry() {
    if (!window.confirm("Send approved year-end encashments that are not yet in payroll to the next open payroll period?")) return
    try {
      const r = await retryEncashmentHandoffs(token())
      showSuccessAlert(`${r.handed_off} sent to payroll, ${r.failed} still failing.`)
      await run()
    } catch (e) {
      showErrorAlert(errorText(e, "Retry failed."))
    }
  }
  const ok = new Set(["MATCH", "PAID", "VOID", "NOT_PAYABLE"])
  const filter = <T extends { status: string }>(rows: T[]) => (onlyIssues ? rows.filter((r) => !ok.has(r.status)) : rows)

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">From</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">To</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </label>
        <Button size="sm" onClick={() => void run()} disabled={loading || !from || !to}>
          {loading ? "Reconciling…" : "Reconcile"}
        </Button>
        {canExecute ? (
          <Button size="sm" variant="outline" onClick={() => void retry()}>
            Retry encashment handoffs
          </Button>
        ) : null}
        <label className="flex items-center gap-2 text-sm sm:ml-auto">
          <input type="checkbox" className="size-4" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
          Show only items needing attention
        </label>
      </div>
      {data ? (
        <>
          <ReconTable
            title="Encashments"
            rows={filter(data.encashments)}
            columns={[
              ["encashment_id", "#"],
              ["employee_id", "Employee"],
              ["source", "Source"],
              ["approved_days", "Days"],
              ["payable_amount", "Amount"],
              ["payroll_period_code", "Period"],
              ["payroll_input_status", "Payroll input"],
              ["payment_status", "Payment"],
            ]}
          />
          <ReconTable
            title="Exit settlements"
            rows={filter(data.exit_settlements)}
            columns={[
              ["settlement_id", "#"],
              ["employee_id", "Employee"],
              ["exit_date", "Exit date"],
              ["settlement_days", "Days"],
              ["leave_status", "Leave status"],
              ["final_settlement_item_status", "Final settlement"],
              ["final_settlement_amount", "Amount"],
            ]}
          />
          <ReconTable
            title="Leave days in payroll"
            rows={filter(data.leave_days)}
            columns={[
              ["period_code", "Period"],
              ["employee_id", "Employee"],
              ["recorded_days", "Payroll days"],
              ["expected_days", "Leave days"],
              ["payroll_run_status", "Run"],
            ]}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Choose a date range and reconcile.</p>
      )}
    </section>
  )
}

function ReconTable({
  title,
  rows,
  columns,
}: {
  title: string
  rows: Array<Record<string, unknown> & { status: string; notes: string }>
  columns: Array<[string, string]>
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">
        {title} <span className="font-normal text-muted-foreground">({rows.length})</span>
      </h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[820px] text-xs">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              {columns.map(([, label]) => (
                <th key={label} className="px-2 py-1.5">
                  {label}
                </th>
              ))}
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border align-top">
                {columns.map(([key]) => (
                  <td key={key} className="px-2 py-1.5 whitespace-nowrap">
                    {r[key] == null || r[key] === "" ? "—" : String(r[key])}
                  </td>
                ))}
                <td className="px-2 py-1.5">{chip(r.status)}</td>
                <td className="max-w-sm px-2 py-1.5">{r.notes}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-2 py-4 text-center text-muted-foreground">
                  Nothing to show.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BackfillTab({ canExecute }: { canExecute: boolean }) {
  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")
  const [employeeId, setEmployeeId] = React.useState("")
  const [plan, setPlan] = React.useState<BackfillPlan | null>(null)
  const [batches, setBatches] = React.useState<BackfillBatch[]>([])
  const [busy, setBusy] = React.useState(false)
  const range = () => ({
    from: from || undefined,
    to: to || undefined,
    employee_id: employeeId ? Number(employeeId) : undefined,
  })
  const loadBatches = React.useCallback(async () => {
    try {
      setBatches(await listLeaveBackfillBatches(token()))
    } catch (e) {
      showErrorAlert(errorText(e, "Could not load backfill batches."))
    }
  }, [])
  React.useEffect(() => {
    void loadBatches()
  }, [loadBatches])

  async function act(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      showErrorAlert(errorText(e, "The operation failed."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Older approved leave has no day-by-day breakdown, so payroll places it all in its start month. The backfill rebuilds
        the breakdown only where a rule reproduces the recorded total exactly; anything else is flagged for review. Leave
        totals, balances and the ledger are never changed, and every applied batch can be reverted.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">From</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">To</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Employee ID (optional)</span>
          <Input inputMode="numeric" value={employeeId} onChange={(e) => setEmployeeId(e.target.value.replace(/\D/g, ""))} className="w-36" />
        </label>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => void act(async () => setPlan(await previewLeaveBackfill(token(), range())))}
        >
          Preview (dry run)
        </Button>
        {canExecute ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !plan || plan.proposed === 0}
            onClick={() =>
              void act(async () => {
                if (
                  window.prompt(
                    `Apply the backfill to ${plan?.proposed ?? 0} leave request(s)? Type APPLY to confirm.`,
                  ) !== "APPLY"
                )
                  return
                const r = await applyLeaveBackfill(token(), range())
                showSuccessAlert(`Applied to ${r.applied} request(s)${r.batchId ? ` (batch ${r.batchId})` : ""}.`)
                setPlan(null)
                await loadBatches()
              })
            }
          >
            Apply
          </Button>
        ) : null}
      </div>

      {plan ? (
        <div className="space-y-2">
          <p className="text-sm">
            Scanned {plan.scanned} · <strong>{plan.proposed}</strong> can be rebuilt · {plan.needsReview} need manual review
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Leave no.</th>
                  <th className="px-2 py-1.5">Employee</th>
                  <th className="px-2 py-1.5">Days</th>
                  <th className="px-2 py-1.5">Result</th>
                  <th className="px-2 py-1.5">Method / reason</th>
                </tr>
              </thead>
              <tbody>
                {plan.candidates.map((c) => (
                  <tr key={c.leaveRequestId} className="border-t border-border">
                    <td className="px-2 py-1.5">{c.leaveNo}</td>
                    <td className="px-2 py-1.5">{c.employeeId}</td>
                    <td className="px-2 py-1.5">{c.totalDays}</td>
                    <td className="px-2 py-1.5">{chip(c.status === "PROPOSED" ? "ok" : "warning")}</td>
                    <td className="px-2 py-1.5">{c.method ?? c.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Applied batches</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">Batch</th>
                <th className="px-2 py-1.5">By</th>
                <th className="px-2 py-1.5">Applied</th>
                <th className="px-2 py-1.5">Reverted</th>
                <th className="px-2 py-1.5">When</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.batch_id} className="border-t border-border">
                  <td className="px-2 py-1.5 font-mono">{b.batch_id.slice(0, 8)}</td>
                  <td className="px-2 py-1.5">{b.actor}</td>
                  <td className="px-2 py-1.5">{b.applied}</td>
                  <td className="px-2 py-1.5">{b.reverted}</td>
                  <td className="px-2 py-1.5">{new Date(b.applied_at ?? b.created_at).toLocaleString()}</td>
                  <td className="px-2 py-1.5">
                    {canExecute && b.applied > 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            if (window.prompt("Revert this batch? Type REVERT to confirm.") !== "REVERT") return
                            const r = await revertLeaveBackfillBatch(token(), b.batch_id)
                            showSuccessAlert(`Reverted ${r.reverted} request(s).`)
                            await loadBatches()
                          })
                        }
                      >
                        Revert
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!batches.length ? (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">
                    No backfill has been applied.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function HistoryTab() {
  const [rows, setRows] = React.useState<Awaited<ReturnType<typeof listLeaveOperationsHistory>>>([])
  React.useEffect(() => {
    listLeaveOperationsHistory(token())
      .then(setRows)
      .catch((e) => showErrorAlert(errorText(e, "Could not load history.")))
  }, [])
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] text-xs">
        <thead className="bg-muted/40 text-left text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5">When</th>
            <th className="px-2 py-1.5">Action</th>
            <th className="px-2 py-1.5">By (company user)</th>
            <th className="px-2 py-1.5">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="px-2 py-1.5 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
              <td className="px-2 py-1.5">{r.action.replace("leave_operations.", "").replace(/_/g, " ")}</td>
              <td className="px-2 py-1.5">{r.actor_company_user_id ?? "—"}</td>
              <td className="max-w-md px-2 py-1.5 font-mono break-all">{JSON.stringify(r.payload)}</td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={4} className="px-2 py-4 text-center text-muted-foreground">
                No operations recorded yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
