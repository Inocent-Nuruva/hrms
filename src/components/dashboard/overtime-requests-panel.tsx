"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import * as React from "react"
import {
  AddRegular,
  ArrowClockwiseRegular,
  CheckmarkRegular,
  DismissRegular,
} from "@fluentui/react-icons"
import {
  Badge,
  Button,
  Input,
  Tab,
  TabList,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components"
import { toast } from "@/components/ui/fluent-toast-store"

import {
  createMyOvertimeRequest,
  decideOvertimeRequest,
  listHrOvertimeRequests,
  listManagerOvertimeRequests,
  listMyOvertimeRequests,
  type AdminRecord,
} from "@/lib/admin-api"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"

type Queue = "mine" | "manager" | "hr"

function value(row: AdminRecord, camel: string, snake: string) {
  return row[camel] ?? row[snake]
}

function label(row: AdminRecord) {
  const name = row.employee_name
  return typeof name === "string" && name.trim() ? name : `Employee #${value(row, "employeeId", "employee_id") ?? ""}`
}

function minutes(row: AdminRecord, camel: string, snake: string) {
  const number = Number(value(row, camel, snake))
  return Number.isFinite(number) ? number : 0
}

function statusLabel(status: unknown) {
  switch (status) {
    case "PENDING_MANAGER": return "Awaiting manager"
    case "PENDING_HR": return "Awaiting HR"
    case "APPROVED": return "Approved"
    case "REJECTED": return "Rejected"
    default: return String(status ?? "Pending")
  }
}

export function OvertimeRequestsPanel({ token }: { token: string | null }) {
  const actor = useDashboardActor()
  const isHr = actor.roleNames.some((role) => ["HR_MANAGER", "HR_OFFICER", "COMPANY_ADMIN"].includes(role.toUpperCase()))
  const [queue, setQueue] = React.useState<Queue>("mine")
  const [mine, setMine] = React.useState<AdminRecord[]>([])
  const [manager, setManager] = React.useState<AdminRecord[]>([])
  const [hr, setHr] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [workDate, setWorkDate] = React.useState("")
  const [requestedMinutes, setRequestedMinutes] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [reviewing, setReviewing] = React.useState<AdminRecord | null>(null)
  const [comments, setComments] = React.useState("")

  const load = React.useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [myRows, managerRows, hrRows] = await Promise.all([
        listMyOvertimeRequests(token),
        listManagerOvertimeRequests(token),
        isHr ? listHrOvertimeRequests(token) : Promise.resolve([]),
      ])
      setMine(myRows)
      setManager(managerRows)
      setHr(hrRows)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load overtime requests.")
    } finally {
      setLoading(false)
    }
  }, [token, isHr])

  React.useEffect(() => {
    if (actor.ready) void load()
  }, [actor.ready, load])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    const count = Number(requestedMinutes)
    if (!workDate || !Number.isInteger(count) || count < 1 || count > 1440 || !reason.trim()) {
      setError("Enter a date, 1-1440 minutes, and a reason.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createMyOvertimeRequest(token, { work_date: workDate, requested_minutes: count, reason: reason.trim() })
      setWorkDate("")
      setRequestedMinutes("")
      setReason("")
      toast.success("Overtime request sent to your line manager.")
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit overtime request.")
    } finally {
      setSaving(false)
    }
  }

  async function decide(decision: "approve" | "reject") {
    if (!token || !reviewing || queue === "mine") return
    if (decision === "reject" && !comments.trim()) {
      setError("Enter a reason for rejection.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await decideOvertimeRequest(token, queue, Number(reviewing.id), decision, comments.trim())
      toast.success(decision === "approve" ? (queue === "manager" ? "Sent to HR." : "Approved for payroll.") : "Overtime request rejected.")
      setReviewing(null)
      setComments("")
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not review overtime request.")
    } finally {
      setSaving(false)
    }
  }

  const isManager = actor.roleNames.some((role) => /MANAGER|SUPERVISOR|TEAM_LEAD/i.test(role)) || manager.length > 0 || queue === "manager"
  const rows = queue === "mine" ? mine : queue === "manager" ? manager : hr

  return (
    <section className="space-y-4 border-b border-border pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Overtime</h2>
        <Button appearance="subtle" size="small" title="Refresh overtime requests" aria-label="Refresh overtime requests" onClick={() => void load()} disabled={loading || !token} icon={loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <ArrowClockwiseRegular />} />
      </div>

      <TabList size="small" selectedValue={queue} onTabSelect={(_, data) => { setQueue(data.value as Queue); setReviewing(null); setComments(""); setError(null) }} aria-label="Overtime requests">
        {([
          ["mine", "My requests"],
          ...(isManager ? [["manager", `Manager approvals${manager.length ? ` (${manager.length})` : ""}`]] : []),
          ...(isHr ? [["hr", `HR approvals${hr.length ? ` (${hr.length})` : ""}`]] : []),
        ] as [Queue, string][]).map(([id, text]) => (
          <Tab key={id} value={id}>{text}</Tab>
        ))}
      </TabList>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {queue === "mine" ? (
        <form onSubmit={(event) => void submit(event)} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto] md:items-end">
          <label className="grid gap-1 text-sm"><span>Work date</span><DateInput required value={workDate} onChange={(event) => setWorkDate(event.target.value)} className="h-9 min-w-0 rounded-md border border-input bg-background px-3" /></label>
          <label className="grid gap-1 text-sm"><span>Minutes</span><Input appearance="outline" type="number" required min={1} max={1440} step={1} value={requestedMinutes} onChange={(event) => setRequestedMinutes(event.target.value)} className="min-w-0" /></label>
          <label className="grid gap-1 text-sm"><span>Reason</span><Input appearance="outline" type="text" required maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} className="min-w-0" /></label>
          <Button type="submit" appearance="primary" disabled={saving || !token} icon={saving ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <AddRegular />}>Request</Button>
        </form>
      ) : null}

      <div className="overflow-x-auto">
        <Table size="small" className="w-full min-w-[640px]">
          <TableHeader><TableRow>
            {queue !== "mine" ? <TableHeaderCell>Employee</TableHeaderCell> : null}
            <TableHeaderCell>Work date</TableHeaderCell>
            <TableHeaderCell>Requested</TableHeaderCell>
            <TableHeaderCell>Recorded</TableHeaderCell>
            <TableHeaderCell>Reason</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            {queue !== "mine" ? <TableHeaderCell>Action</TableHeaderCell> : null}
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={String(row.id)}>
                {queue !== "mine" ? <TableCell className="font-medium">{label(row)}</TableCell> : null}
                <TableCell>{String(value(row, "workDate", "work_date") ?? "")}</TableCell>
                <TableCell>{minutes(row, "requestedMinutes", "requested_minutes")} min</TableCell>
                <TableCell>{minutes(row, "actualMinutes", "actual_minutes")} min</TableCell>
                <TableCell className="max-w-64 truncate" title={String(row.reason ?? "")}>{String(row.reason ?? "")}</TableCell>
                <TableCell><Badge appearance="tint" color={String(row.status ?? "").includes("APPROVED") ? "success" : String(row.status ?? "").includes("REJECTED") ? "danger" : "warning"}>{statusLabel(row.status)}</Badge></TableCell>
                {queue !== "mine" ? <TableCell><Button appearance="subtle" size="small" onClick={() => { setReviewing(row); setComments(""); setError(null) }}>Review</Button></TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!loading && rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No overtime requests.</p> : null}
      </div>

      {reviewing && queue !== "mine" ? (
        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1 text-sm"><span>Review comments</span><Textarea rows={2} maxLength={2000} value={comments} onChange={(event) => setComments(event.target.value)} className="min-w-0 rounded-md border border-input bg-background px-3 py-2" /></label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" appearance="primary" icon={<CheckmarkRegular />} onClick={() => void decide("approve")} disabled={saving}>Approve</Button>
            <Button type="button" appearance="outline" icon={<DismissRegular />} onClick={() => void decide("reject")} disabled={saving || !comments.trim()}>Reject</Button>
            <Button type="button" appearance="subtle" onClick={() => { setReviewing(null); setComments("") }}>Cancel</Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
