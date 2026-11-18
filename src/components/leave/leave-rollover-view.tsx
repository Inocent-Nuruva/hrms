"use client"

import * as React from "react"
import { DownloadIcon, RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { showErrorAlert } from "@/lib/error-alert"
import {
  ROLLOVER_STATUS_LABEL,
  approveRolloverRun,
  cancelRolloverRun,
  createRolloverRun,
  days,
  downloadRolloverReport,
  getRolloverRun,
  listRolloverRuns,
  refreshRolloverRun,
  statusTone,
  submitRolloverRun,
  type RolloverLine,
  type RolloverRun,
} from "@/lib/leave-engine-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { showSuccessAlert } from "@/lib/success-alert"
import { cn } from "@/lib/utils"
import { LeaveCycleSchedulePanel } from "./leave-cycle-schedule-panel"

function token() {
  return readStoredSessionTokens().accessToken
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function StatusChip({ status, label }: { status: string; label?: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", statusTone(status))}>
      {label ?? status}
    </span>
  )
}

/**
 * Year-end leave rollover: prepare a preview of how every unused balance is
 * carried, encashed, lapsed or retained, review exceptions, approve and post.
 */
export function LeaveRolloverView() {
  const actor = useDashboardActor()
  const canManage = canPerformPermission(actor.permissionLabels, "leave_rollover:manage")
  const canApprove = canPerformPermission(actor.permissionLabels, "leave_rollover:approve")
  const [runs, setRuns] = React.useState<RolloverRun[]>([])
  const [selected, setSelected] = React.useState<RolloverRun | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const [year, setYear] = React.useState(String(new Date().getFullYear() - 1))
  const [filter, setFilter] = React.useState<"all" | "exceptions" | "lapse" | "retained">("all")
  const [search, setSearch] = React.useState("")

  const loadRuns = React.useCallback(async () => {
    try {
      setRuns(await listRolloverRuns(token()))
    } catch (error) {
      showErrorAlert(errorText(error, "Could not load rollover runs."))
    } finally {
      setLoaded(true)
    }
  }, [])

  React.useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  async function act(label: string, action: () => Promise<RolloverRun>) {
    setBusy(true)
    try {
      const run = await action()
      setSelected(await getRolloverRun(token(), run.id))
      await loadRuns()
      showSuccessAlert(label)
    } catch (error) {
      showErrorAlert(errorText(error, "The rollover action failed."))
    } finally {
      setBusy(false)
    }
  }

  async function open(run: RolloverRun) {
    setBusy(true)
    try {
      setSelected(await getRolloverRun(token(), run.id))
    } catch (error) {
      showErrorAlert(errorText(error, "Could not open the run."))
    } finally {
      setBusy(false)
    }
  }

  async function download(run: RolloverRun) {
    try {
      const { blob, filename } = await downloadRolloverReport(token(), run.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      showErrorAlert(errorText(error, "Download failed."))
    }
  }

  const lines = (selected?.lines ?? []).filter((line) => {
    if (filter === "exceptions" && !line.exceptions.length) return false
    if (filter === "lapse" && Number(line.lapse_days) <= 0) return false
    if (filter === "retained" && Number(line.retained_days) <= 0) return false
    const term = search.trim().toLowerCase()
    if (!term) return true
    return [line.employee_name, line.employee_no, line.leave_type_name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  })
  const totals = selected?.totals ?? {}
  const editable = selected && ["draft", "previewed", "pending_approval"].includes(selected.status)

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        title="Year-end leave rollover"
        description="Preview how each unused balance is carried forward, encashed, lapsed or retained under the policy in effect at year end, then approve and post. Posted years are closed and no longer recalculated."
        actions={
          <Button size="sm" variant="outline" onClick={() => void loadRuns()}>
            <RefreshCwIcon className="mr-1 size-4" /> Refresh
          </Button>
        }
      />

      {canManage ? (
        <section className="flex flex-col gap-2 rounded-lg border border-border p-4 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Leave year to close</span>
            <Input
              inputMode="numeric"
              value={year}
              onChange={(event) => setYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-32"
              aria-label="Leave year to close"
            />
          </label>
          <Button
            size="sm"
            disabled={busy || year.length !== 4}
            onClick={() =>
              void act(`Preview prepared for ${year}`, () => createRolloverRun(token(), { from_leave_year: year }))
            }
          >
            Prepare preview
          </Button>
          <p className="text-xs text-muted-foreground sm:ml-2">
            Re-running for the same year refreshes the open preview instead of creating a second run.
          </p>
        </section>
      ) : null}

      <LeaveCycleSchedulePanel canManage={canManage} />

      <section className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Run</th>
              <th className="px-3 py-2">Year</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Mode</th>
              <th className="px-3 py-2 text-right">Lines</th>
              <th className="px-3 py-2 text-right">Exceptions</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  {loaded ? "No rollover runs yet." : "Loading runs…"}
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.id} className={cn("border-t border-border", selected?.id === run.id && "bg-muted/30")}>
                  <td className="px-3 py-2">#{run.id}</td>
                  <td className="px-3 py-2">{run.from_leave_year}</td>
                  <td className="px-3 py-2">
                    <StatusChip status={run.status} label={ROLLOVER_STATUS_LABEL[run.status]} />
                  </td>
                  <td className="px-3 py-2">{run.execution_mode === "automatic" ? "Automatic" : "HR approval"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{run.totals?.lines ?? "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{run.exception_count}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => void open(run)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {selected ? (
        <section className="space-y-4" aria-label={`Rollover run ${selected.id}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Run #{selected.id} · closing {selected.from_leave_year}{" "}
                <StatusChip status={selected.status} label={ROLLOVER_STATUS_LABEL[selected.status]} />
              </h2>
              {selected.error ? <p className="text-sm text-rose-600">{selected.error}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {canManage && editable ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("Preview recalculated", () => refreshRolloverRun(token(), selected.id))}>
                  Recalculate
                </Button>
              ) : null}
              {canManage && selected.status === "previewed" ? (
                <Button size="sm" disabled={busy} onClick={() => void act("Submitted for approval", () => submitRolloverRun(token(), selected.id))}>
                  Submit for approval
                </Button>
              ) : null}
              {canApprove && ["pending_approval", "approved", "partially_failed", "failed"].includes(selected.status) ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm("Approve and post this rollover? Posted years are closed and lapses are recorded in the balance history.")) return
                    void act("Rollover posted", () => approveRolloverRun(token(), selected.id))
                  }}
                >
                  {["partially_failed", "failed"].includes(selected.status) ? "Retry posting" : "Approve and post"}
                </Button>
              ) : null}
              {canManage && editable ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    const reason = window.prompt("Why is this run being cancelled?")
                    if (!reason) return
                    void act("Run cancelled", () => cancelRolloverRun(token(), selected.id, reason))
                  }}
                >
                  Cancel run
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => void download(selected)}>
                <DownloadIcon className="mr-1 size-4" /> Report (CSV)
              </Button>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Unused", totals.unused_days],
              ["Carry forward", totals.carry_forward_days],
              ["Encash", totals.encash_days],
              ["Lapse", totals.lapse_days],
              ["Retained", totals.retained_days],
              ["Encash amount", totals.encash_amount],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-border p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-base font-semibold tabular-nums">{days(value)}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Search employee or leave type"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="sm:max-w-xs"
              aria-label="Search lines"
            />
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filter lines">
              {(["all", "exceptions", "lapse", "retained"] as const).map((value) => (
                <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>
                  {value === "all" ? "All" : value === "exceptions" ? "With exceptions" : value === "lapse" ? "Lapsing" : "Retained"}
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[960px] text-sm" data-testid="rollover-lines">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Leave type</th>
                  <th className="px-3 py-2 text-right">Opening</th>
                  <th className="px-3 py-2 text-right">Accrued</th>
                  <th className="px-3 py-2 text-right">Used</th>
                  <th className="px-3 py-2 text-right">Unused</th>
                  <th className="px-3 py-2 text-right">Carry</th>
                  <th className="px-3 py-2 text-right">Encash</th>
                  <th className="px-3 py-2 text-right">Lapse</th>
                  <th className="px-3 py-2 text-right">Retained</th>
                  <th className="px-3 py-2 text-right">Closing</th>
                  <th className="px-3 py-2">Status / exceptions</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line: RolloverLine) => (
                  <tr key={line.id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{line.employee_name ?? `#${line.employee_id}`}</div>
                      <div className="text-xs text-muted-foreground">
                        {line.employee_no ?? ""} {line.policy_version_no ? `· policy v${line.policy_version_no}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2">{line.leave_type_name ?? line.leave_type_id}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{days(line.opening_days)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{days(line.accrued_days)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{days(line.used_days)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{days(line.unused_days)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{days(line.carry_forward_days)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {days(line.encash_days)}
                      {line.encash_amount ? <div className="text-xs text-muted-foreground">{line.encash_amount} {line.currency}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{days(line.lapse_days)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{days(line.retained_days)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{days(line.closing_days)}</td>
                    <td className="px-3 py-2">
                      <StatusChip status={line.status} />
                      {line.error ? <p className="mt-1 text-xs text-rose-600">{line.error}</p> : null}
                      {line.exceptions.map((item) => (
                        <p
                          key={item.code}
                          className={cn(
                            "mt-1 text-xs",
                            item.severity === "error" ? "text-rose-600" : item.severity === "warning" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
                          )}
                        >
                          {item.message}
                        </p>
                      ))}
                    </td>
                  </tr>
                ))}
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-6 text-center text-muted-foreground">
                      No lines match.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Lines with blocking exceptions (for example leave still awaiting approval) are skipped when posting; their year stays open. Days that cannot lawfully lapse are retained, never removed.
          </p>
        </section>
      ) : null}
    </div>
  )
}
