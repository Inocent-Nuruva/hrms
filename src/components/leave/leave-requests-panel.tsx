"use client"

import { StandardTable, StandardTableHeader, StandardTableBody, StandardTableRow, StandardTableHead, StandardTableCell } from "@/components/ui/standard-fluent-table"
import * as React from "react"
import Link from "next/link"
import {
  ArrowDownUp,
  CalendarPlus,
  CircleAlert,
  Download,
  Eye,
  FileText,
  Filter,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Send,
  SquareX,
  TimerOff,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { DateInput } from "@/components/ui/date-input"
import { FluentSelect } from "@/components/ui/fluent-select"
import { FormField } from "@/components/ui/form-field"
import {
  getLeaveRequestSummary,
  getMyLeaveRequestSummary,
  listLeaveRequests,
  listMyLeaveRequests,
  type AdminRecord,
  type LeaveRequestSummary,
  type LeaveRequestView,
} from "@/lib/admin-api"
import { cn } from "@/lib/utils"

/** Views shown on the self-service page. "all" (HR oversight) lives in Leave Management. */
export type LeaveRequestsPanelView = Exclude<LeaveRequestView, "all">

type StatusTab = "all" | "open" | "draft" | "approved" | "rejected" | "cancelled"

type SortKey = "newest" | "oldest" | "start_asc" | "start_desc" | "days_desc"

const SORTS: Record<SortKey, { label: string; sortBy: string; sortOrder: "ASC" | "DESC" }> = {
  newest: { label: "Newest first", sortBy: "created_at", sortOrder: "DESC" },
  oldest: { label: "Oldest first", sortBy: "created_at", sortOrder: "ASC" },
  start_asc: { label: "Start date (earliest)", sortBy: "start_date", sortOrder: "ASC" },
  start_desc: { label: "Start date (latest)", sortBy: "start_date", sortOrder: "DESC" },
  days_desc: { label: "Most days", sortBy: "total_days", sortOrder: "DESC" },
}

const PAGE_SIZE = 15

type Progress = {
  total_levels: number
  completed_levels: number
  current_position: number | null
  rejected_at_position: number | null
  state: string
}

export type LeaveRequestsPanelProps = {
  token: string
  /** Changes whenever the parent reloads, so the panel refetches. */
  refreshSignal: unknown
  leaveTypes: Array<{ id: string; label: string }>
  highlightedRequestId?: string | number | null
  busy?: boolean
  onNewRequest: () => void
  onView: (id: number, row: AdminRecord) => void
  onDownloadPdf: (id: number) => void
  onEndEarly: (id: number, row: AdminRecord) => void
  onEdit: (id: number, row: AdminRecord) => void
  onSubmit: (id: number) => void
  onCancel: (id: number) => void
  /** Where approvers review a request (the Leave Management page). */
  reviewHref: (id: number) => string
}

// ── helpers ────────────────────────────────────────────────────────────────

const asRecord = (value: unknown): AdminRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as AdminRecord) : null

const str = (row: AdminRecord | null, key: string) => {
  const value = row?.[key]
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : ""
}

const num = (row: AdminRecord | null, key: string) => {
  const value = Number(row?.[key])
  return row?.[key] === null || row?.[key] === undefined || !Number.isFinite(value) ? null : value
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "18 Nov – 23 Nov 2026", or "28 Dec 2026 – 3 Jan 2027" across years. */
export function formatLeavePeriod(start: string, end: string) {
  const parse = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    return match ? { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) } : null
  }
  const a = parse(start)
  const b = parse(end)
  if (!a) return "—"
  const fmt = (p: { y: number; m: number; d: number }, withYear: boolean) =>
    `${p.d} ${MONTHS[p.m]}${withYear ? ` ${p.y}` : ""}`
  if (!b || (a.y === b.y && a.m === b.m && a.d === b.d)) return fmt(a, true)
  return a.y === b.y ? `${fmt(a, false)} – ${fmt(b, true)}` : `${fmt(a, true)} – ${fmt(b, true)}`
}

function formatDays(row: AdminRecord) {
  const days = num(row, "total_days")
  if (days === null) return "—"
  const duration = str(row, "duration_type").toLowerCase()
  const label = `${Number.isInteger(days) ? days : days.toFixed(1)} day${days === 1 ? "" : "s"}`
  if (duration.includes("half")) return `${label} (half day)`
  if (duration.includes("hour")) return `${label} (hours)`
  return label
}

type StatusMeta = { label: string; tone: "good" | "bad" | "warn" | "info" | "muted" }

function statusMeta(status: string): StatusMeta {
  switch (status) {
    case "approved":
      return { label: "Approved", tone: "good" }
    case "rejected":
      return { label: "Rejected", tone: "bad" }
    case "cancelled":
      return { label: "Cancelled", tone: "muted" }
    case "draft":
      return { label: "Draft", tone: "info" }
    case "returned_for_correction":
      return { label: "Returned", tone: "warn" }
    default:
      return { label: "Pending", tone: "warn" }
  }
}

const TONE_CLASS: Record<StatusMeta["tone"], string> = {
  good: "bg-emerald-500/12 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300",
  bad: "bg-rose-500/12 text-rose-700 ring-rose-600/20 dark:text-rose-300",
  warn: "bg-amber-500/15 text-amber-800 ring-amber-600/25 dark:text-amber-300",
  info: "bg-sky-500/12 text-sky-700 ring-sky-600/20 dark:text-sky-300",
  muted: "bg-muted text-muted-foreground ring-border",
}

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE_CLASS[meta.tone],
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  )
}

function readProgress(row: AdminRecord): Progress | null {
  const p = asRecord(row.approval_progress)
  if (!p) return null
  return {
    total_levels: num(p, "total_levels") ?? 0,
    completed_levels: num(p, "completed_levels") ?? 0,
    current_position: num(p, "current_position"),
    rejected_at_position: num(p, "rejected_at_position"),
    state: str(p, "state"),
  }
}

/** One line describing where the request stands, e.g. "Level 2 of 3 · Pending". */
export function describeProgress(row: AdminRecord): string {
  const status = str(row, "status")
  const p = readProgress(row)
  if (status === "draft") return "Not submitted"
  if (status === "cancelled") return "Cancelled"
  if (status === "returned_for_correction") return "Returned for changes"
  if (!p || !p.total_levels) {
    return status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Awaiting approval"
  }
  if (status === "rejected") {
    return p.rejected_at_position ? `Rejected at Level ${p.rejected_at_position}` : "Rejected"
  }
  if (status === "approved") return `${p.completed_levels} of ${p.total_levels} · Approved`
  return p.current_position
    ? `Level ${p.current_position} of ${p.total_levels} · Pending`
    : `${p.completed_levels} of ${p.total_levels} completed`
}

function ProgressBar({ row }: { row: AdminRecord }) {
  const p = readProgress(row)
  const status = str(row, "status")
  if (!p || !p.total_levels || status === "draft") return null
  return (
    <div className="mt-1 flex gap-0.5" aria-hidden>
      {Array.from({ length: p.total_levels }, (_, i) => {
        const position = i + 1
        const done = position <= p.completed_levels
        const current = p.current_position === position
        const rejected = p.rejected_at_position === position
        return (
          <span
            key={position}
            className={cn(
              "h-1 w-5 rounded-full",
              rejected
                ? "bg-rose-500"
                : done
                  ? "bg-emerald-500"
                  : current
                    ? "bg-amber-500"
                    : "bg-muted-foreground/20",
            )}
          />
        )
      })}
    </div>
  )
}

function employeeOf(row: AdminRecord) {
  const e = asRecord(row.employee)
  const name = [str(e, "first_name"), str(e, "last_name")].filter(Boolean).join(" ")
  const unit = str(asRecord(e?.primary_department ?? null), "name") || str(asRecord(e?.primary_branch ?? null), "name")
  return { name: name || "—", number: str(e, "employee_no"), unit }
}

function leaveTypeOf(row: AdminRecord) {
  return str(asRecord(row.leave_type), "name") || str(row, "leave_type_name") || "Leave"
}

function referenceOf(row: AdminRecord) {
  return str(row, "leave_no") || (num(row, "id") !== null ? `LR-${num(row, "id")}` : "—")
}

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// ── component ──────────────────────────────────────────────────────────────

export function LeaveRequestsPanel(props: LeaveRequestsPanelProps) {
  const { token, refreshSignal, leaveTypes, highlightedRequestId, busy } = props
  const [view, setView] = React.useState<LeaveRequestsPanelView>("mine")
  const [status, setStatus] = React.useState<StatusTab>("all")
  const [search, setSearch] = React.useState("")
  const [leaveTypeId, setLeaveTypeId] = React.useState("")
  const [fromDate, setFromDate] = React.useState("")
  const [toDate, setToDate] = React.useState("")
  const [sort, setSort] = React.useState<SortKey>("newest")
  const [page, setPage] = React.useState(1)
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [reloadTick, setReloadTick] = React.useState(0)

  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [summary, setSummary] = React.useState<LeaveRequestSummary | null>(null)
  const [isApprover, setIsApprover] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const debouncedSearch = useDebounced(search, 350)
  const isQueue = view !== "mine"
  const activeFilterCount = [leaveTypeId, fromDate, toDate].filter(Boolean).length + (debouncedSearch.trim() ? 1 : 0)

  // Any change to view or filters starts again from page 1.
  React.useEffect(() => {
    setPage(1)
  }, [view, status, debouncedSearch, leaveTypeId, fromDate, toDate, sort])

  React.useEffect(() => {
    if (!token) return
    let cancelled = false
    const filters = {
      search: debouncedSearch.trim() || undefined,
      leave_type_id: leaveTypeId ? Number(leaveTypeId) : undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
    }
    const listParams = {
      ...filters,
      page,
      limit: PAGE_SIZE,
      sortBy: SORTS[sort].sortBy,
      sortOrder: SORTS[sort].sortOrder,
      status: status === "all" ? undefined : status,
    }
    setLoading(true)
    setError(null)
    Promise.all([
      view === "mine" ? listMyLeaveRequests(token, listParams) : listLeaveRequests(token, { ...listParams, view }),
      view === "mine" ? getMyLeaveRequestSummary(token, filters) : getLeaveRequestSummary(token, { ...filters, view }),
    ])
      .then(([list, counts]) => {
        if (cancelled) return
        setRows(list.rows)
        setTotal(list.total ?? list.rows.length)
        setTotalPages(Math.max(1, list.totalPages ?? 1))
        setSummary(counts)
        if (view === "mine") setIsApprover(counts.pending_my_approval !== null)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setRows([])
        setError(reason instanceof Error ? reason.message : "Could not load leave requests.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, view, status, debouncedSearch, leaveTypeId, fromDate, toDate, sort, page, refreshSignal, reloadTick])

  // Learn whether the user approves anything even when they open on another view.
  React.useEffect(() => {
    if (!token) return
    let cancelled = false
    getMyLeaveRequestSummary(token)
      .then((counts) => {
        if (!cancelled) setIsApprover(counts.pending_my_approval !== null)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [token, refreshSignal])

  const clearFilters = () => {
    setSearch("")
    setLeaveTypeId("")
    setFromDate("")
    setToDate("")
  }

  const viewTabs: Array<{ key: LeaveRequestsPanelView; label: string; count?: number | null }> = [
    { key: "mine", label: "My requests" },
    ...(isApprover
      ? [
          { key: "pending_my_approval" as const, label: "Pending my approval", count: summary?.pending_my_approval ?? null },
          { key: "my_approval_history" as const, label: "My approval history" },
        ]
      : []),
  ]

  const statusTabs: Array<{ key: StatusTab; label: string; count: number | undefined }> = [
    { key: "all", label: "All", count: summary?.total },
    { key: "open", label: "Open", count: summary?.open },
    ...(view === "mine" ? [{ key: "draft" as const, label: "Draft", count: summary?.draft }] : []),
    { key: "approved", label: "Approved", count: summary?.approved },
    { key: "rejected", label: "Rejected", count: summary?.rejected },
    { key: "cancelled", label: "Cancelled", count: summary?.cancelled },
  ]

  const stats = [
    { label: "Total requests", value: summary?.total },
    { label: "Open", value: summary?.open, tone: "text-amber-700 dark:text-amber-300" },
    { label: "Approved", value: summary?.approved, tone: "text-emerald-700 dark:text-emerald-300" },
    { label: "Rejected", value: summary?.rejected, tone: "text-rose-700 dark:text-rose-300" },
    ...(isApprover && summary?.pending_my_approval !== null && summary?.pending_my_approval !== undefined
      ? [{ label: "Pending my approval", value: summary.pending_my_approval, tone: "text-primary" }]
      : []),
  ]

  return (
    <div className="min-w-0 space-y-4">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Leave Requests</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage leave applications, track approvals, and view request history.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setReloadTick((tick) => tick + 1)}
            disabled={loading}
            aria-label="Refresh leave requests"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button type="button" onClick={props.onNewRequest}>
            <CalendarPlus className="size-4" />
            New Leave Request
          </Button>
        </div>
      </header>

      {/* Summary */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4 lg:flex">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0 flex-1 bg-card px-4 py-3">
            <dt className="truncate text-xs font-medium text-muted-foreground">{stat.label}</dt>
            <dd className={cn("mt-0.5 text-xl font-semibold tabular-nums text-foreground", stat.tone)}>
              {stat.value ?? "—"}
            </dd>
          </div>
        ))}
      </dl>

      {/* View switch (approvers only) */}
      {viewTabs.length > 1 ? (
        <div
          role="tablist"
          aria-label="Leave request views"
          className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1"
        >
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={view === tab.key}
              onClick={() => {
                setView(tab.key)
                setStatus(tab.key === "pending_my_approval" ? "all" : status)
              }}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                view === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {typeof tab.count === "number" && tab.count > 0 ? (
                <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {/* Status tabs */}
      {view !== "pending_my_approval" ? (
        <div role="tablist" aria-label="Filter by status" className="flex gap-1 overflow-x-auto border-b border-border">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={status === tab.key}
              onClick={() => setStatus(tab.key)}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition",
                status === tab.key
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {tab.count ?? "·"}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={isQueue ? "Search employee name, number or reference" : "Search by leave reference"}
            aria-label="Search leave requests"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            aria-expanded={filtersOpen}
            aria-controls="leave-request-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Filter className="size-4" />
            Filters
            {activeFilterCount ? (
              <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
          <div className="inline-flex items-center gap-1.5">
            <ArrowDownUp className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <FluentSelect
              className="w-44"
              ariaLabel="Sort"
              value={sort}
              onChange={(value) => setSort(value as SortKey)}
              options={(Object.keys(SORTS) as SortKey[]).map((key) => ({ value: key, label: SORTS[key].label }))}
            />
          </div>
          {activeFilterCount ? (
            <Button type="button" variant="ghost" onClick={clearFilters}>
              <X className="size-4" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          ) : null}
        </div>
      </div>

      {filtersOpen ? (
        <div
          id="leave-request-filters"
          className="grid gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-3"
        >
          <FormField label="Leave type">
            <FluentSelect
              ariaLabel="Leave type"
              placeholder="All leave types"
              value={leaveTypeId}
              onChange={setLeaveTypeId}
              options={[
                { value: "", label: "All leave types" },
                ...leaveTypes.map((type) => ({ value: type.id, label: type.label })),
              ]}
            />
          </FormField>
          <FormField label="From">
            <DateInput aria-label="From" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
          </FormField>
          <FormField label="To">
            <DateInput aria-label="To" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
          </FormField>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-900 dark:text-rose-200">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setReloadTick((tick) => tick + 1)}>
            Try again
          </Button>
        </div>
      ) : null}

      {/* Table (md+) */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <div className="max-h-[70vh] overflow-auto">
          <StandardTable className="w-full text-left text-sm">
            <StandardTableHeader className="sticky top-0 z-10 bg-muted/80 text-xs font-medium text-muted-foreground backdrop-blur">
              <StandardTableRow>
                <StandardTableHead scope="col" className="px-4 py-2.5 font-medium">Request</StandardTableHead>
                {isQueue ? <StandardTableHead scope="col" className="px-4 py-2.5 font-medium">Employee</StandardTableHead> : null}
                <StandardTableHead scope="col" className="px-4 py-2.5 font-medium">Leave period</StandardTableHead>
                <StandardTableHead scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">Days</StandardTableHead>
                <StandardTableHead scope="col" className="px-4 py-2.5 font-medium">Approval progress</StandardTableHead>
                <StandardTableHead scope="col" className="px-4 py-2.5 font-medium">Status</StandardTableHead>
                <StandardTableHead scope="col" className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </StandardTableHead>
              </StandardTableRow>
            </StandardTableHeader>
            <StandardTableBody className="divide-y divide-border">
              {loading
                ? Array.from({ length: 5 }, (_, i) => (
                    <StandardTableRow key={`skeleton-${i}`} aria-hidden>
                      {Array.from({ length: isQueue ? 7 : 6 }, (__, j) => (
                        <StandardTableCell key={j} className="px-4 py-3.5">
                          <div className="h-3.5 w-full max-w-28 animate-pulse rounded bg-muted" />
                        </StandardTableCell>
                      ))}
                    </StandardTableRow>
                  ))
                : rows.map((row) => (
                    <DesktopRow key={String(row.id)} row={row} view={view} panel={props} busy={busy} highlighted={isHighlighted(row, highlightedRequestId)} />
                  ))}
            </StandardTableBody>
          </StandardTable>
        </div>
      </div>

      {/* Cards (mobile) */}
      <ul className="space-y-2 md:hidden">
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
              <li key={`card-skeleton-${i}`} aria-hidden className="h-28 animate-pulse rounded-xl border border-border bg-muted/40" />
            ))
          : rows.map((row) => (
              <MobileCard key={String(row.id)} row={row} view={view} panel={props} busy={busy} highlighted={isHighlighted(row, highlightedRequestId)} />
            ))}
      </ul>

      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          view={view}
          filtered={activeFilterCount > 0 || status !== "all"}
          onClear={() => {
            clearFilters()
            setStatus("all")
          }}
          onNewRequest={props.onNewRequest}
        />
      ) : null}

      {/* Pagination */}
      {!loading && total > 0 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="tabular-nums">
              {page} / {totalPages}
            </span>
            <Button type="button" size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  )
}

function isHighlighted(row: AdminRecord, highlighted?: string | number | null) {
  if (!highlighted) return false
  return String(row.id) === String(highlighted) || str(row, "leave_no") === String(highlighted)
}

// ── row actions ────────────────────────────────────────────────────────────

type RowActionsArgs = {
  row: AdminRecord
  view: LeaveRequestsPanelView
  panel: LeaveRequestsPanelProps
  busy?: boolean
}

function ownActions(row: AdminRecord) {
  const status = str(row, "status")
  const today = new Date().toISOString().slice(0, 10)
  return {
    canEdit: status === "draft" || status === "returned_for_correction",
    canSubmit: status === "draft",
    // The API still enforces policy cutoffs and start dates.
    canCancel: [
      "draft",
      "pending_department_manager",
      "pending_hr",
      "in_review",
      "submitted",
      "returned_for_correction",
      "approved",
    ].includes(status),
    canEndEarly:
      status === "approved" && str(row, "start_date").slice(0, 10) <= today && str(row, "end_date").slice(0, 10) > today,
    isDraft: status === "draft",
    isReturned: status === "returned_for_correction",
  }
}

function PrimaryAction({ row, view, panel, busy }: RowActionsArgs) {
  const id = num(row, "id")
  if (id === null) return null
  if (view !== "mine") {
    return (
      <Link
        href={panel.reviewHref(id)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-foreground transition hover:bg-muted"
      >
        <Eye className="size-4" />
        {view === "pending_my_approval" ? "Review" : "View"}
      </Link>
    )
  }
  const actions = ownActions(row)
  if (actions.isReturned) {
    return (
      <Button type="button" size="sm" disabled={busy} onClick={() => panel.onEdit(id, row)}>
        <Pencil className="size-4" />
        Edit & resubmit
      </Button>
    )
  }
  return (
    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => panel.onView(id, row)}>
      <Eye className="size-4" />
      View
    </Button>
  )
}

function MoreActions({ row, view, panel, busy }: RowActionsArgs) {
  const id = num(row, "id")
  if (id === null || view !== "mine") return null
  const actions = ownActions(row)
  const reference = referenceOf(row)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
        aria-label={`More actions for ${reference}`}
        disabled={busy}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {actions.isReturned ? (
          <DropdownMenuItem onClick={() => panel.onView(id, row)}>
            <Eye className="size-4" />
            View details
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => panel.onDownloadPdf(id)}>
          <Download className="size-4" />
          Download PDF
        </DropdownMenuItem>
        {actions.canEdit && !actions.isReturned ? (
          <DropdownMenuItem onClick={() => panel.onEdit(id, row)}>
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
        ) : null}
        {actions.canSubmit ? (
          <DropdownMenuItem onClick={() => panel.onSubmit(id)}>
            <Send className="size-4" />
            Submit request
          </DropdownMenuItem>
        ) : null}
        {actions.canEndEarly ? (
          <DropdownMenuItem onClick={() => panel.onEndEarly(id, row)}>
            <TimerOff className="size-4" />
            End leave early
          </DropdownMenuItem>
        ) : null}
        {actions.canCancel ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => panel.onCancel(id)}>
              <SquareX className="size-4" />
              {actions.isDraft ? "Discard draft" : "Cancel request"}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DesktopRow({ highlighted, ...args }: RowActionsArgs & { highlighted: boolean }) {
  const { row, view } = args
  const employee = employeeOf(row)
  return (
    <tr className={cn("transition-colors hover:bg-muted/40", highlighted && "bg-primary/5")}>
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-foreground">{leaveTypeOf(row)}</p>
        <p className="font-mono text-xs text-muted-foreground">{referenceOf(row)}</p>
      </td>
      {view !== "mine" ? (
        <td className="px-4 py-3 align-top">
          <p className="font-medium text-foreground">{employee.name}</p>
          <p className="text-xs text-muted-foreground">
            {[employee.number, employee.unit].filter(Boolean).join(" · ") || "—"}
          </p>
        </td>
      ) : null}
      <td className="whitespace-nowrap px-4 py-3 align-top text-foreground">
        {formatLeavePeriod(str(row, "start_date"), str(row, "end_date"))}
        <p className="text-xs text-muted-foreground lg:hidden">{formatDays(row)}</p>
      </td>
      <td className="hidden whitespace-nowrap px-4 py-3 align-top tabular-nums text-foreground lg:table-cell">
        {formatDays(row)}
      </td>
      <td className="px-4 py-3 align-top">
        <p className="whitespace-nowrap text-xs text-foreground">{describeProgress(row)}</p>
        <ProgressBar row={row} />
      </td>
      <td className="px-4 py-3 align-top">
        <StatusBadge status={str(row, "status")} />
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center justify-end gap-1">
          <PrimaryAction {...args} />
          <MoreActions {...args} />
        </div>
      </td>
    </tr>
  )
}

function MobileCard({ highlighted, ...args }: RowActionsArgs & { highlighted: boolean }) {
  const { row, view } = args
  const employee = employeeOf(row)
  return (
    <li className={cn("rounded-xl border border-border bg-card p-3", highlighted && "border-primary/50 bg-primary/5")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{leaveTypeOf(row)}</p>
          <p className="font-mono text-xs text-muted-foreground">{referenceOf(row)}</p>
        </div>
        <StatusBadge status={str(row, "status")} />
      </div>
      {view !== "mine" ? (
        <p className="mt-2 truncate text-sm text-foreground">
          {employee.name}
          {employee.number ? <span className="text-muted-foreground"> · {employee.number}</span> : null}
        </p>
      ) : null}
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Dates</dt>
          <dd className="font-medium text-foreground">{formatLeavePeriod(str(row, "start_date"), str(row, "end_date"))}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Days</dt>
          <dd className="font-medium text-foreground">{formatDays(row)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Approval</dt>
          <dd className="font-medium text-foreground">{describeProgress(row)}</dd>
          <ProgressBar row={row} />
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-2">
        <PrimaryAction {...args} />
        <MoreActions {...args} />
      </div>
    </li>
  )
}

function EmptyState({
  view,
  filtered,
  onClear,
  onNewRequest,
}: {
  view: LeaveRequestsPanelView
  filtered: boolean
  onClear: () => void
  onNewRequest: () => void
}) {
  const copy = filtered
    ? { title: "No requests match these filters", body: "Try a different status, date range or search." }
    : view === "pending_my_approval"
      ? { title: "Nothing waiting for you", body: "Requests appear here when they reach your approval level." }
      : view === "my_approval_history"
        ? { title: "No decisions yet", body: "Requests you approve, reject or return will be listed here." }
        : { title: "No leave requests yet", body: "When you need time off, create a request and follow its approval here." }
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-12 text-center">
      <FileText className="size-8 text-muted-foreground" aria-hidden />
      <p className="mt-3 font-medium text-foreground">{copy.title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{copy.body}</p>
      {filtered ? (
        <Button type="button" variant="outline" className="mt-4" onClick={onClear}>
          Clear filters
        </Button>
      ) : view === "mine" ? (
        <Button type="button" className="mt-4" onClick={onNewRequest}>
          <CalendarPlus className="size-4" />
          New Leave Request
        </Button>
      ) : null}
    </div>
  )
}
