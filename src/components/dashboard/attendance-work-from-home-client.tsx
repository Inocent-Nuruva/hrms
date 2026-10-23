"use client"

import * as React from "react"
import { Badge as FluentBadge } from "@fluentui/react-components"
import { CalendarDays, CheckCircle2, Clock3, Home, Inbox, RefreshCw, Send, XCircle } from "lucide-react"
import {
  cancelAttendanceWorkFromHomeRequest,
  createAttendanceWorkFromHomeRequest,
  listAttendanceWorkFromHomeRequests,
  reviewAttendanceWorkFromHomeRequest,
} from "@/lib/admin-api"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type WorkFromHomeRequest = {
  id: number
  employee_id: number
  employee_name?: string | null
  start_date: string
  end_date: string
  reason: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  review_comment?: string | null
}

function readToken() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
    if (!raw) return ""
    const tokens = JSON.parse(raw) as {
      accessToken?: string
      access_token?: string
    }
    return (tokens.accessToken ?? tokens.access_token ?? "").trim()
  } catch {
    return ""
  }
}

function readRequests(value: unknown): WorkFromHomeRequest[] {
  if (Array.isArray(value)) return value as WorkFromHomeRequest[]
  if (typeof value !== "object" || value === null) return []
  const record = value as Record<string, unknown>
  const rows = Array.isArray(record.data) ? record.data : []
  return rows as WorkFromHomeRequest[]
}

function errorMessage(error: unknown) {
  if (error instanceof Error && /databaseName|Cannot read properties of undefined/i.test(error.message)) {
    return "Work-from-home requests are temporarily unavailable. Refresh in a moment."
  }
  if (error instanceof Error && error.message) return error.message
  return "The work-from-home request could not be completed."
}

function requestStatusColor(status: WorkFromHomeRequest["status"]) {
  if (status === "APPROVED") return "success" as const
  if (status === "PENDING") return "warning" as const
  if (status === "REJECTED") return "danger" as const
  return "informative" as const
}

export function AttendanceWorkFromHomeClient() {
  const actor = useDashboardActor()
  const canReview = actor.permissionLabels.includes("attendance_processing:execute")
  const canRequest = actor.accessMode === "employee"
  const [token, setToken] = React.useState("")
  const [requests, setRequests] = React.useState<WorkFromHomeRequest[]>([])
  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [comments, setComments] = React.useState<Record<number, string>>({})
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [error, setError] = React.useState("")
  const pendingCount = requests.filter((request) => request.status === "PENDING").length
  const approvedCount = requests.filter((request) => request.status === "APPROVED").length
  const closedCount = requests.filter((request) => ["REJECTED", "CANCELLED"].includes(request.status)).length

  React.useEffect(() => {
    setToken(readToken())
  }, [])

  const refresh = React.useCallback(async () => {
    if (!token) {
      setLoading(false)
      setError("Sign in again to manage work-from-home requests.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const payload = await listAttendanceWorkFromHomeRequests(token, !canReview)
      setRequests(readRequests(payload))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [canReview, token])

  React.useEffect(() => {
    if (actor.ready && token) void refresh()
  }, [actor.ready, refresh, token])

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return
    setSaving(true)
    setError("")
    setMessage("")
    try {
      await createAttendanceWorkFromHomeRequest(token, {
        start_date: startDate,
        end_date: endDate,
        reason,
      })
      setStartDate("")
      setEndDate("")
      setReason("")
      setMessage("Request submitted for approval.")
      await refresh()
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setSaving(false)
    }
  }

  const review = async (
    request: WorkFromHomeRequest,
    decision: "APPROVE" | "REJECT",
  ) => {
    if (!token) return
    const comment = comments[request.id]?.trim() ?? ""
    if (decision === "REJECT" && !comment) {
      setError("Add a reason before rejecting this request.")
      return
    }
    setSaving(true)
    setError("")
    setMessage("")
    try {
      await reviewAttendanceWorkFromHomeRequest(token, request.id, {
        decision,
        comment: comment || undefined,
      })
      setMessage(decision === "APPROVE" ? "Request approved." : "Request rejected.")
      await refresh()
    } catch (reviewError) {
      setError(errorMessage(reviewError))
    } finally {
      setSaving(false)
    }
  }

  const cancel = async (request: WorkFromHomeRequest) => {
    if (!token) return
    setSaving(true)
    setError("")
    setMessage("")
    try {
      await cancelAttendanceWorkFromHomeRequest(token, request.id)
      setMessage("Request cancelled.")
      await refresh()
    } catch (cancelError) {
      setError(errorMessage(cancelError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="flex w-full flex-col gap-5 px-4 py-5 sm:px-5">
      <header className="flex items-start gap-3 border-b border-border pb-4">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Home className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Work from home</h1>
          <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
            Request remote-work dates and track approval before recording attendance away from the office.
          </p>
        </div>
      </header>

      {message ? <p role="status" className="border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p role="alert" className="border-l-4 border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {canRequest ? (
        <form onSubmit={submitRequest} className="grid gap-3 border-y border-border py-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,12rem)_1fr_auto] sm:items-end">
          <div className="sm:col-span-4">
            <h2 className="font-semibold text-foreground">New remote-work request</h2>
            <p className="text-xs text-muted-foreground">Approval must cover every requested date.</p>
          </div>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Start date
            <Input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            End date
            <Input required type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Reason
            <Textarea required maxLength={2000} rows={1} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why do you need to work remotely?" className="min-h-8 resize-none" />
          </label>
          <Button disabled={saving} type="submit" size="sm" className="gap-2">
            <Send aria-hidden />
            {saving ? "Submitting…" : "Submit request"}
          </Button>
        </form>
      ) : null}

      <section className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <div className="mr-auto">
            <h2 className="font-semibold text-foreground">{canReview ? "Company requests" : "My requests"}</h2>
            <p className="text-xs text-muted-foreground">{canReview ? "Review remote-work requests across the company." : "Track your submitted requests and decisions."}</p>
          </div>
          <FluentBadge appearance="tint" color="warning" shape="rounded">{pendingCount} pending</FluentBadge>
          <FluentBadge appearance="tint" color="success" shape="rounded">{approvedCount} approved</FluentBadge>
          <FluentBadge appearance="tint" color="informative" shape="rounded">{closedCount} closed</FluentBadge>
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading || saving} className="gap-2">
            <RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden />
            Refresh
          </Button>
        </div>
        {loading ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading requests…</p> : null}
        {!loading && requests.length === 0 ? (
          <div className="flex items-center gap-3 py-8">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Inbox className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-medium text-foreground">{canReview ? "No requests need review" : "No remote-work requests yet"}</p>
              <p className="text-sm text-muted-foreground">{canReview ? "New employee requests will appear here." : "Submit a request to begin the approval process."}</p>
            </div>
          </div>
        ) : null}
        <div className="divide-y divide-border">
          {requests.map((request) => (
            <article key={request.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarDays className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{request.employee_name || `Employee #${request.employee_id}`}</p>
                    <FluentBadge appearance="tint" color={requestStatusColor(request.status)} shape="rounded">{request.status.toLowerCase()}</FluentBadge>
                  </div>
                  <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">{request.start_date}{request.end_date !== request.start_date ? ` – ${request.end_date}` : ""}</p>
                  <p className="mt-1 text-sm text-foreground/80">{request.reason}</p>
                  {request.review_comment ? <p className="mt-1 text-xs text-muted-foreground">Review note: {request.review_comment}</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                {canReview && request.status === "PENDING" ? (
                  <>
                    <Input aria-label={`Review note for request ${request.id}`} value={comments[request.id] ?? ""} onChange={(event) => setComments((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Comment or rejection reason" className="min-w-48" />
                    <Button type="button" size="sm" disabled={saving} onClick={() => void review(request, "APPROVE")} className="gap-1.5"><CheckCircle2 aria-hidden />Approve</Button>
                    <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void review(request, "REJECT")} className="gap-1.5"><XCircle aria-hidden />Reject</Button>
                  </>
                ) : null}
                {canRequest && request.status === "PENDING" ? <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void cancel(request)} className="gap-1.5"><Clock3 aria-hidden />Cancel request</Button> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
