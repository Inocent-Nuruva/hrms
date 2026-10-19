"use client"

import * as React from "react"
import {
  cancelAttendanceWorkFromHomeRequest,
  createAttendanceWorkFromHomeRequest,
  listAttendanceWorkFromHomeRequests,
  reviewAttendanceWorkFromHomeRequest,
} from "@/lib/admin-api"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

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
  if (error instanceof Error && error.message) return error.message
  return "The work-from-home request could not be completed."
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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Work from home</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Remote attendance is available only for a remote-enabled shift and an approved request covering that date.
        </p>
      </header>

      {message ? <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

      {canRequest ? (
        <form onSubmit={submitRequest} className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
          <h2 className="text-lg font-medium sm:col-span-2">Request remote work dates</h2>
          <label className="grid gap-1 text-sm">
            Start date
            <input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-md border border-input bg-background px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            End date
            <input required type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-md border border-input bg-background px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Reason
            <textarea required maxLength={2000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-md border border-input bg-background px-3 py-2" />
          </label>
          <button disabled={saving} type="submit" className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 sm:col-span-2">
            {saving ? "Submitting…" : "Submit request"}
          </button>
        </form>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">{canReview ? "Company requests" : "My requests"}</h2>
          <button type="button" onClick={() => void refresh()} disabled={loading || saving} className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50">Refresh</button>
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading requests…</p> : null}
        {!loading && requests.length === 0 ? <p className="text-sm text-muted-foreground">No work-from-home requests found.</p> : null}
        <div className="divide-y divide-border">
          {requests.map((request) => (
            <article key={request.id} className="grid gap-3 py-4 md:grid-cols-[1fr_auto]">
              <div className="space-y-1">
                <p className="font-medium">{request.employee_name || `Employee #${request.employee_id}`} · {request.start_date}{request.end_date !== request.start_date ? ` – ${request.end_date}` : ""}</p>
                <p className="text-sm text-muted-foreground">{request.reason}</p>
                {request.review_comment ? <p className="text-sm">Review note: {request.review_comment}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{request.status}</span>
                {canReview && request.status === "PENDING" ? (
                  <>
                    <input aria-label={`Review note for request ${request.id}`} value={comments[request.id] ?? ""} onChange={(event) => setComments((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Rejection reason" className="min-w-36 rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
                    <button type="button" disabled={saving} onClick={() => void review(request, "APPROVE")} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">Approve</button>
                    <button type="button" disabled={saving} onClick={() => void review(request, "REJECT")} className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50">Reject</button>
                  </>
                ) : null}
                {canRequest && request.status === "PENDING" ? <button type="button" disabled={saving} onClick={() => void cancel(request)} className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50">Cancel</button> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
