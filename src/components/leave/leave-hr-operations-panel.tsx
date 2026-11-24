"use client"

import { StandardTable, StandardTableHeader, StandardTableBody, StandardTableRow, StandardTableHead, StandardTableCell } from "@/components/ui/standard-fluent-table"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  listLeaveExitSettlements,
  runLeaveCarryForward,
  runLeaveExitSettlement,
  type AdminRecord,
  approveLeaveExitSettlement,
} from "@/lib/admin-api"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft - awaiting HR approval",
  approved: "Approved - finalised when offboarding completes",
  void: "Void (offboarding cancelled/rejected)",
  pending_payroll: "Waiting for payroll",
  final_settlement: "Paid through final settlement",
  paid: "Paid",
  recovery_draft: "Recovery draft (Finance)",
  needs_wage: "Needs wage",
}

const num = (v: unknown) => (typeof v === "number" ? v.toFixed(2) : v == null ? "—" : String(v))

/**
 * HR leave operations without their own screen before: exit settlements
 * (GET/POST /api/leave/exit-settlements) and the manual carry-forward run
 * (POST /api/leave/carry-forward/run). Each card follows the backend permission.
 */
export function LeaveHrOperationsPanel({
  token,
  leaveTypeLabel,
}: {
  token: string | null
  leaveTypeLabel: (leaveTypeId: number | null) => string
}) {
  const actor = useDashboardActor()
  const canView = canPerformPermission(actor.permissionLabels, "leave_balances:list")
  const canManage = canPerformPermission(actor.permissionLabels, "leave_balances:manage")

  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [employeeFilter, setEmployeeFilter] = React.useState("")
  const [runEmployee, setRunEmployee] = React.useState("")
  const [runDate, setRunDate] = React.useState("")
  const [carryYear, setCarryYear] = React.useState(String(new Date().getFullYear()))
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!token || !canView) return
    try {
      const id = Number(employeeFilter)
      setRows(await listLeaveExitSettlements(token, Number.isInteger(id) && id > 0 ? id : undefined))
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not load exit settlements.")
    }
  }, [canView, employeeFilter, token])

  React.useEffect(() => {
    void load()
  }, [load])

  if (!canView) return null

  const runSettlement = async () => {
    const id = Number(runEmployee)
    if (!token || !Number.isInteger(id) || id <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(runDate)) {
      showErrorAlert("Enter an employee ID and an exit date.")
      return
    }
    setBusy(true)
    try {
      await runLeaveExitSettlement(token, { employee_id: id, exit_date: runDate })
      showSuccessAlert("Exit settlement calculated.")
      setEmployeeFilter(String(id))
      await load()
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not calculate the settlement.")
    } finally {
      setBusy(false)
    }
  }

  const approveSettlement = async (offboardingRequestId: number) => {
    if (!token) return
    if (
      !window.confirm(
        "Approve this exit leave settlement? It is finalised (future leave closed, days sent to the final settlement) when offboarding completes, or now if it already has.",
      )
    )
      return
    setBusy(true)
    try {
      await approveLeaveExitSettlement(token, offboardingRequestId)
      showSuccessAlert("Exit leave settlement approved.")
      await load()
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not approve the settlement.")
    } finally {
      setBusy(false)
    }
  }

  const runCarry = async () => {
    if (!token || !/^\d{4}$/.test(carryYear)) {
      showErrorAlert("Enter a four-digit leave year.")
      return
    }
    if (!window.confirm(`Record carry-forward and apply due expiries for ${carryYear} now? This normally runs every night.`)) return
    setBusy(true)
    try {
      await runLeaveCarryForward(token, carryYear)
      showSuccessAlert(`Carry-forward processed for ${carryYear}.`)
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Carry-forward failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Exit leave settlements</h3>
            <p className="text-xs text-muted-foreground">
              Days owed or recoverable at exit. Payment happens through the offboarding final settlement; these rows record the days.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="h-8 w-36"
              inputMode="numeric"
              placeholder="Employee ID"
              aria-label="Filter by employee ID"
              value={employeeFilter}
              onChange={(event) => setEmployeeFilter(event.target.value.replace(/\D/g, ""))}
            />
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        </header>
        {canManage ? (
          <div className="mb-3 flex flex-wrap items-end gap-2 rounded-md bg-muted/40 p-2">
            <Input
              className="h-8 w-36"
              inputMode="numeric"
              placeholder="Employee ID"
              aria-label="Employee ID to settle"
              value={runEmployee}
              onChange={(event) => setRunEmployee(event.target.value.replace(/\D/g, ""))}
            />
            <Input
              className="h-8 w-40"
              type="date"
              aria-label="Exit date"
              value={runDate}
              onChange={(event) => setRunDate(event.target.value)}
            />
            <Button size="sm" disabled={busy} onClick={() => void runSettlement()}>
              Calculate settlement
            </Button>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <StandardTable className="w-full min-w-[720px] text-left text-xs">
            <StandardTableHeader className="text-muted-foreground">
              <StandardTableRow>
                {["Employee", "Leave type", "Exit date", "Earned", "Carried", "Used", "Settlement days", "Status", ""].map((h) => (
                  <StandardTableHead key={h} className="px-2 py-1.5 font-semibold">
                    {h}
                  </StandardTableHead>
                ))}
              </StandardTableRow>
            </StandardTableHeader>
            <StandardTableBody className="divide-y divide-border">
              {rows.map((row) => {
                const days = Number(row.settlement_days)
                const status = String(row.status ?? "")
                return (
                  <StandardTableRow key={String(row.id)}>
                    <StandardTableCell className="px-2 py-1.5">#{String(row.employee_id)}</StandardTableCell>
                    <StandardTableCell className="px-2 py-1.5">{leaveTypeLabel(Number(row.leave_type_id) || null)}</StandardTableCell>
                    <StandardTableCell className="px-2 py-1.5">{String(row.exit_date ?? "").slice(0, 10)}</StandardTableCell>
                    <StandardTableCell className="px-2 py-1.5">{num(row.earned_to_exit_days)}</StandardTableCell>
                    <StandardTableCell className="px-2 py-1.5">{num(row.carried_forward_days)}</StandardTableCell>
                    <StandardTableCell className="px-2 py-1.5">{num(row.used_days)}</StandardTableCell>
                    <StandardTableCell className={`px-2 py-1.5 font-semibold ${days < 0 ? "text-rose-600" : ""}`}>
                      {num(days)} {days < 0 ? "(recover)" : ""}
                    </StandardTableCell>
                    <StandardTableCell className="px-2 py-1.5">{STATUS_LABEL[status] ?? status}</StandardTableCell>
                    <StandardTableCell className="px-2 py-1.5">
                      {canManage && status === "draft" && row.offboarding_request_id ? (
                        <button
                          type="button"
                          className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                          disabled={busy}
                          onClick={() => void approveSettlement(Number(row.offboarding_request_id))}
                        >
                          Approve
                        </button>
                      ) : null}
                    </StandardTableCell>
                  </StandardTableRow>
                )
              })}
              {rows.length === 0 ? (
                <StandardTableRow>
                  <StandardTableCell colSpan={9} className="px-2 py-6 text-center text-muted-foreground">
                    No exit settlements yet.
                  </StandardTableCell>
                </StandardTableRow>
              ) : null}
            </StandardTableBody>
          </StandardTable>
        </div>
      </section>

      {canManage ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Carry-forward and expiry</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Runs automatically at 01:30 every day. Run it now after correcting balances or policies.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="h-8 w-28"
              inputMode="numeric"
              aria-label="Leave year"
              value={carryYear}
              onChange={(event) => setCarryYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
            />
            <Button size="sm" disabled={busy} onClick={() => void runCarry()}>
              Run carry-forward now
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
