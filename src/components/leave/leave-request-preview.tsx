"use client"

import * as React from "react"

import {
  previewLeaveRequest,
  previewMyLeaveRequest,
  type AdminRecord,
  type LeaveRequestPreview,
} from "@/lib/admin-api"
import { cn } from "@/lib/utils"

function days(value: number | null | undefined) {
  if (value === null || value === undefined) return "-"
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} d`
}

/**
 * Asks the server how it will count a leave request (working days, weekly
 * offs, public holidays), whether documents are needed, notice and balance.
 * The server is the source of truth; this hook only debounces the call.
 */
export function useLeaveRequestPreview({
  token,
  mode,
  payload,
}: {
  token: string | null
  mode: "self" | "hr"
  /** null while the form is incomplete. */
  payload: AdminRecord | null
}) {
  const [preview, setPreview] = React.useState<LeaveRequestPreview | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const key = payload ? JSON.stringify(payload) : null

  React.useEffect(() => {
    if (!token || !key) {
      setPreview(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = window.setTimeout(() => {
      const body = JSON.parse(key) as AdminRecord
      const call = mode === "self" ? previewMyLeaveRequest : previewLeaveRequest
      call(token, body)
        .then((result) => {
          if (cancelled) return
          setPreview(result)
          setError(null)
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setPreview(null)
          setError(err instanceof Error ? err.message : "Could not check this request.")
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [key, mode, token])

  return { preview, error, loading }
}

/** The server's breakdown of a leave request, shown inside request forms. */
export function LeaveRequestPreviewPanel({
  preview,
  error,
  loading,
  className,
}: {
  preview: LeaveRequestPreview | null
  error: string | null
  loading: boolean
  className?: string
}) {
  if (error) {
    return <p className={cn("text-xs text-rose-600", className)}>{error}</p>
  }
  if (!preview) {
    return loading ? (
      <p className={cn("text-xs text-muted-foreground", className)}>Checking dates…</p>
    ) : null
  }
  const evidence = preview.evidence
  const evidenceText = !evidence.requires_attachment
    ? "Not required"
    : evidence.required
      ? evidence.allow_deferred
        ? `Required, due within ${evidence.grace_days} day(s) of submission`
        : "Required before submission"
      : evidence.required_after_days !== null
        ? `Not needed (only beyond ${evidence.required_after_days} working day(s))`
        : "Not required"
  const tiles: Array<{ label: string; value: string }> = [
    { label: "Calendar days", value: days(preview.calendar_days) },
    { label: "Weekly off days", value: days(preview.weekly_off_days) },
    { label: "Public holidays", value: days(preview.public_holiday_days) },
    { label: "Leave days charged", value: days(preview.chargeable_days) },
  ]
  return (
    <div
      className={cn("space-y-2 rounded-lg border border-border bg-muted/30 p-3", className)}
      aria-live="polite"
      data-testid="leave-request-preview"
    >
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label}>
            <dt className="text-[11px] font-medium text-muted-foreground">{tile.label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{tile.value}</dd>
          </div>
        ))}
      </dl>
      <dl className="grid gap-1 text-xs sm:grid-cols-2">
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Supporting document:</dt>
          <dd className="font-medium">{evidenceText}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Can be booked for these dates:</dt>
          <dd className="font-medium tabular-nums">{days(preview.balance.bookable_for_dates)}</dd>
        </div>
        {preview.notice.minimum_days > 0 ? (
          <div className="flex gap-1 sm:col-span-2">
            <dt className="text-muted-foreground">Notice:</dt>
            <dd className={cn("font-medium", !preview.notice.satisfied && "text-amber-700 dark:text-amber-300")}>
              {preview.notice.satisfied
                ? `${preview.notice.minimum_days} day(s) required, met`
                : preview.notice.override_applied
                  ? `${preview.notice.minimum_days} day(s) required; HR override will be recorded`
                  : `${preview.notice.minimum_days} day(s) required; ${Math.max(preview.notice.days_until_start, 0)} given`}
            </dd>
          </div>
        ) : null}
      </dl>
      {preview.issues.length ? (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-rose-600">
          {preview.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
