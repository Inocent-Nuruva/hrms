"use client"

import * as React from "react"
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components"
import {
  ArrowClockwise20Regular,
  CheckmarkCircle20Regular,
  Eye20Regular,
  MoneyHand20Regular,
} from "@fluentui/react-icons"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { PayrollEmployeeSalaryDialog } from "@/components/dashboard/payroll-employee-salary-dialog"
import { toast } from "@/components/ui/fluent-toast-store"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  approveEmployeePayrollSalary,
  listPayrollSalaryStructures,
  listSalaryApprovals,
  type AdminRecord,
} from "@/lib/admin-api"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"

function record(value: unknown): AdminRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : {}
}

function text(row: AdminRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return ""
}

function money(row: AdminRecord) {
  const value = Number(row.baseSalary)
  return `${text(row, "currency") || "TZS"} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}`
}

export function SalaryApprovalsView() {
  const actor = useDashboardActor()
  const canApprove = canPerformPermission(actor.permissionLabels, "payroll:salary:approve")
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [structures, setStructures] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busyId, setBusyId] = React.useState("")
  const [selected, setSelected] = React.useState<AdminRecord | null>(null)

  const refresh = React.useCallback(async () => {
    const token = readStoredSessionTokens().accessToken.trim()
    if (!token) return
    setLoading(true)
    try {
      const [approvalRows, structureRows] = await Promise.all([
        listSalaryApprovals(token),
        listPayrollSalaryStructures(token),
      ])
      setRows(approvalRows)
      setStructures(structureRows)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Salary approvals could not be loaded")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  async function approve(row: AdminRecord) {
    const employee = record(row.employee)
    const employeeId = text(employee, "id")
    const token = readStoredSessionTokens().accessToken.trim()
    if (!token || !employeeId) return
    setBusyId(text(row, "id"))
    try {
      await approveEmployeePayrollSalary(token, employeeId)
      toast.success("Starting salary approved")
      await refresh()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Salary could not be approved")
    } finally {
      setBusyId("")
    }
  }

  const pendingCount = rows.filter((row) => text(row, "status") === "PENDING_APPROVAL").length

  return (
    <section className="w-full min-w-0">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <MoneyHand20Regular />
            <h1 className="text-base font-semibold">Salary approvals</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Review starting salaries, assigned approvers, and completed decisions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge appearance="tint" color={pendingCount ? "warning" : "success"}>{pendingCount} pending</Badge>
          <Button appearance="subtle" icon={<ArrowClockwise20Regular />} aria-label="Refresh salary approvals" onClick={() => void refresh()} />
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-56 items-center justify-center"><FluentLoadingIndicator /></div>
      ) : rows.length ? (
        <div className="w-full overflow-x-auto">
          <Table aria-label="Salary approvals" className="w-full min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Employee</TableHeaderCell>
                <TableHeaderCell>Salary</TableHeaderCell>
                <TableHeaderCell>Structure</TableHeaderCell>
                <TableHeaderCell>Submitted by</TableHeaderCell>
                <TableHeaderCell>Approver</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const employee = record(row.employee)
                const approval = record(row.approval)
                const submittedBy = record(approval.submitted_by)
                const assignedTo = record(approval.assigned_to)
                const approvedBy = record(approval.approved_by)
                const pending = text(row, "status") === "PENDING_APPROVAL"
                return (
                  <TableRow key={text(row, "id")}>
                    <TableCell><div className="font-medium">{text(employee, "name")}</div><div className="text-xs text-muted-foreground">{text(employee, "employee_no")}</div></TableCell>
                    <TableCell>{money(row)}</TableCell>
                    <TableCell>{text(row, "salaryStructureCode") || "—"}</TableCell>
                    <TableCell>{text(submittedBy, "name") || "Not recorded"}</TableCell>
                    <TableCell>{text(approvedBy, "name") || text(assignedTo, "name") || "Any eligible approver"}</TableCell>
                    <TableCell><Badge appearance="tint" color={pending ? "warning" : "success"}>{pending ? "Pending approval" : "Approved"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button appearance="subtle" icon={<Eye20Regular />} onClick={() => setSelected(row)}>Review</Button>
                        {pending && canApprove ? <Button appearance="primary" icon={<CheckmarkCircle20Regular />} disabled={busyId === text(row, "id")} onClick={() => void approve(row)}>Approve</Button> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-center">
          <CheckmarkCircle20Regular className="text-emerald-600" />
          <p className="font-medium">No salary approvals yet</p>
          <p className="text-sm text-muted-foreground">New starting salary assignments will appear here.</p>
        </div>
      )}

      {selected ? (
        <PayrollEmployeeSalaryDialog
          open
          onOpenChange={(open) => { if (!open) setSelected(null) }}
          employeeId={text(record(selected.employee), "id")}
          employeeLabel={`${text(record(selected.employee), "name")} (${text(record(selected.employee), "employee_no")})`}
          structures={structures}
          canEdit={false}
          canApprove={canApprove}
          onChanged={() => void refresh()}
          drawer
        />
      ) : null}
    </section>
  )
}
