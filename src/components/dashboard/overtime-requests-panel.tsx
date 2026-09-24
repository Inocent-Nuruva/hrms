"use client"

import * as React from "react"
import { CheckIcon, Loader2Icon, PlusIcon, RefreshCwIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

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
        <button type="button" title="Refresh overtime requests" aria-label="Refresh overtime requests" onClick={() => void load()} disabled={loading || !token} className="inline-flex size-9 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-50">
          {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
        </button>
      </div>

      <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Overtime requests">
        {([
          ["mine", "My requests"],
          ...(isManager ? [["manager", `Manager approvals${manager.length ? ` (${manager.length})` : ""}`]] : []),
          ...(isHr ? [["hr", `HR approvals${hr.length ? ` (${hr.length})` : ""}`]] : []),
        ] as [Queue, string][]).map(([id, text]) => (
          <button key={id} type="button" role="tab" aria-selected={queue === id} onClick={() => { setQueue(id); setReviewing(null); setComments(""); setError(null) }} className={`border-b-2 px-3 py-2 text-sm font-medium ${queue === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {text}
          </button>
        ))}
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {queue === "mine" ? (
        <form onSubmit={(event) => void submit(event)} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto] md:items-end">
          <label className="grid gap-1 text-sm"><span>Work date</span><input type="date" required value={workDate} onChange={(event) => setWorkDate(event.target.value)} className="h-9 min-w-0 rounded-md border border-input bg-background px-3" /></label>
          <label className="grid gap-1 text-sm"><span>Minutes</span><input type="number" required min={1} max={1440} step={1} value={requestedMinutes} onChange={(event) => setRequestedMinutes(event.target.value)} className="h-9 min-w-0 rounded-md border border-input bg-background px-3" /></label>
          <label className="grid gap-1 text-sm"><span>Reason</span><input type="text" required maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} className="h-9 min-w-0 rounded-md border border-input bg-background px-3" /></label>
          <button type="submit" disabled={saving || !token} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />} Request
          </button>
        </form>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground"><tr>
            {queue !== "mine" ? <th className="px-2 py-2 font-medium">Employee</th> : null}
            <th className="px-2 py-2 font-medium">Work date</th>
            <th className="px-2 py-2 font-medium">Requested</th>
            <th className="px-2 py-2 font-medium">Recorded</th>
            <th className="px-2 py-2 font-medium">Reason</th>
            <th className="px-2 py-2 font-medium">Status</th>
            {queue !== "mine" ? <th className="px-2 py-2 font-medium">Action</th> : null}
          </tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)} className="border-b border-border/70">
                {queue !== "mine" ? <td className="px-2 py-2 font-medium">{label(row)}</td> : null}
                <td className="px-2 py-2">{String(value(row, "workDate", "work_date") ?? "")}</td>
                <td className="px-2 py-2">{minutes(row, "requestedMinutes", "requested_minutes")} min</td>
                <td className="px-2 py-2">{minutes(row, "actualMinutes", "actual_minutes")} min</td>
                <td className="max-w-64 truncate px-2 py-2" title={String(row.reason ?? "")}>{String(row.reason ?? "")}</td>
                <td className="px-2 py-2">{statusLabel(row.status)}</td>
                {queue !== "mine" ? <td className="px-2 py-2"><button type="button" onClick={() => { setReviewing(row); setComments(""); setError(null) }} className="font-medium text-primary hover:underline">Review</button></td> : null}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No overtime requests.</p> : null}
      </div>

      {reviewing && queue !== "mine" ? (
        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1 text-sm"><span>Review comments</span><textarea rows={2} maxLength={2000} value={comments} onChange={(event) => setComments(event.target.value)} className="min-w-0 rounded-md border border-input bg-background px-3 py-2" /></label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void decide("approve")} disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"><CheckIcon className="size-4" /> Approve</button>
            <button type="button" onClick={() => void decide("reject")} disabled={saving || !comments.trim()} className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive px-3 text-sm font-medium text-destructive disabled:opacity-50"><XIcon className="size-4" /> Reject</button>
            <button type="button" onClick={() => { setReviewing(null); setComments("") }} className="h-9 px-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
