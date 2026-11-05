"use client"

import type { AdminRecord } from "@/lib/admin-api"
import { cn } from "@/lib/utils"

/**
 * Shared helpers for the two-stage self-service approval workflow
 * (employee → manager → HR) used by attendance corrections and profile updates.
 */

export type SelfServiceStatusMeta = {
  label: string
  className: string
  terminal: boolean
}

const STATUS_META: Record<string, SelfServiceStatusMeta> = {
  draft: {
    label: "Draft",
    className: "border-slate-200 bg-white text-slate-600",
    terminal: false,
  },
  submitted: {
    label: "Pending manager",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    terminal: false,
  },
  pending_manager_approval: {
    label: "Pending manager",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    terminal: false,
  },
  pending_hr_approval: {
    label: "Pending HR",
    className: "border-sky-200 bg-sky-50 text-sky-700",
    terminal: false,
  },
  returned_for_correction: {
    label: "Returned",
    className: "border-orange-200 bg-orange-50 text-orange-700",
    terminal: false,
  },
  approved: {
    label: "Approved",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    terminal: true,
  },
  rejected: {
    label: "Rejected",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    terminal: true,
  },
  cancelled: {
    label: "Cancelled",
    className: "border-slate-200 bg-slate-100 text-slate-700",
    terminal: true,
  },
}

export function getSelfServiceStatusMeta(value: unknown): SelfServiceStatusMeta | null {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""
  return STATUS_META[normalized] ?? null
}

/** Status filter options for reviewer queues; `queue` means "awaiting my decision". */
export const SELF_SERVICE_REVIEW_STATUS_OPTIONS = [
  { value: "queue", label: "Awaiting my review" },
  { value: "all", label: "All statuses" },
  { value: "pending_manager_approval", label: "Pending manager" },
  { value: "pending_hr_approval", label: "Pending HR" },
  { value: "returned_for_correction", label: "Returned" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
] as const

export function reviewStatusFilterToQuery(value: string) {
  return value === "queue" ? undefined : value
}

/** Whether the signed-in reviewer may act, using the API's per-row flags. */
export function canReviewSelfServiceRequest(row: AdminRecord | null) {
  if (!row) return false
  if (typeof row.can_approve === "boolean") return row.can_approve
  const meta = getSelfServiceStatusMeta(row.status)
  return Boolean(meta && !meta.terminal && row.status !== "draft" && row.status !== "returned_for_correction")
}

export function isFinalApproval(row: AdminRecord | null) {
  return row?.is_final_approval === true || row?.review_stage === "hr"
}

const ACTION_LABELS: Record<string, string> = {
  submitted: "Submitted",
  resubmitted: "Resubmitted",
  approved: "Approved",
  rejected: "Rejected",
  returned_for_correction: "Returned for correction",
  cancelled: "Cancelled",
}

const STAGE_LABELS: Record<string, string> = {
  employee: "Employee",
  manager: "Manager",
  hr: "HR",
}

function formatTimestamp(value: unknown) {
  if (typeof value !== "string" || !value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export function SelfServiceApprovalTimeline({
  history,
  className,
}: {
  history: unknown
  className?: string
}) {
  const entries = Array.isArray(history)
    ? history.filter((item): item is AdminRecord => !!item && typeof item === "object")
    : []

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-semibold text-foreground">Approval history</p>
      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-2.5 py-2 text-xs text-muted-foreground">
          No decisions recorded yet.
        </p>
      ) : (
        <ol className="space-y-1.5 border-l border-border pl-3">
          {entries.map((entry, index) => {
            const action = String(entry.action ?? "")
            const stage = String(entry.stage ?? "")
            const skipped =
              !!entry.metadata &&
              typeof entry.metadata === "object" &&
              (entry.metadata as AdminRecord).manager_stage_skipped === true
            const meta = getSelfServiceStatusMeta(entry.to_status)
            return (
              <li key={String(entry.id ?? index)} className="relative">
                <span
                  className="absolute -left-[17px] top-1.5 size-2 rounded-full bg-primary"
                  aria-hidden
                />
                <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
                  <span className="font-medium text-foreground">
                    {ACTION_LABELS[action] ?? action}
                  </span>
                  <span className="text-muted-foreground">
                    by {STAGE_LABELS[stage] ?? stage}
                  </span>
                  {meta ? (
                    <span
                      className={cn(
                        "rounded border px-1 py-0 text-[10px]",
                        meta.className
                      )}
                    >
                      {meta.label}
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {formatTimestamp(entry.created_at)}
                  {skipped ? " · HR approved before manager review" : ""}
                </p>
                {typeof entry.comment === "string" && entry.comment.trim() ? (
                  <p className="mt-0.5 text-[11px] text-foreground">“{entry.comment}”</p>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
