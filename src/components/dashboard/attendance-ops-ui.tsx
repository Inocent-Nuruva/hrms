"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Shared building blocks for the Attendance Operations pages (daily
 * summaries, processing exceptions, recalculation jobs, unmatched logs,
 * mobile punches, device sync logs, exemptions). The data table, toolbar,
 * filters, pagination and phone card layout come from ResizableTable; these
 * pieces add the page head, clickable status counters, status badges and the
 * shift timeline so every attendance page looks the same.
 */

export type AttendanceTone = "neutral" | "ok" | "late" | "warn" | "bad" | "info"

const TONE: Record<AttendanceTone, { dot: string; text: string; badge: string; ring: string; bar: string }> = {
  neutral: {
    dot: "bg-muted-foreground",
    text: "text-foreground",
    badge: "bg-muted text-muted-foreground",
    ring: "border-primary ring-1 ring-primary",
    bar: "bg-muted-foreground",
  },
  ok: {
    dot: "bg-emerald-600 dark:bg-emerald-400",
    text: "text-emerald-700 dark:text-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    ring: "border-emerald-600 ring-1 ring-emerald-600 dark:border-emerald-400 dark:ring-emerald-400",
    bar: "bg-emerald-600 dark:bg-emerald-400",
  },
  late: {
    dot: "bg-violet-600 dark:bg-violet-400",
    text: "text-violet-700 dark:text-violet-400",
    badge: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    ring: "border-violet-600 ring-1 ring-violet-600 dark:border-violet-400 dark:ring-violet-400",
    bar: "bg-violet-600 dark:bg-violet-400",
  },
  warn: {
    dot: "bg-amber-600 dark:bg-amber-400",
    text: "text-amber-700 dark:text-amber-400",
    badge: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    ring: "border-amber-600 ring-1 ring-amber-600 dark:border-amber-400 dark:ring-amber-400",
    bar: "bg-amber-600 dark:bg-amber-400",
  },
  bad: {
    dot: "bg-rose-600 dark:bg-rose-400",
    text: "text-rose-700 dark:text-rose-400",
    badge: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    ring: "border-rose-600 ring-1 ring-rose-600 dark:border-rose-400 dark:ring-rose-400",
    bar: "bg-rose-600 dark:bg-rose-400",
  },
  info: {
    dot: "bg-sky-600 dark:bg-sky-400",
    text: "text-sky-700 dark:text-sky-400",
    badge: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    ring: "border-sky-600 ring-1 ring-sky-600 dark:border-sky-400 dark:ring-sky-400",
    bar: "bg-sky-600 dark:bg-sky-400",
  },
}

/** Maps any attendance / job / review status string to a tone. */
export function attendanceStatusTone(status: unknown): AttendanceTone {
  const key = String(status ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_")
  if (!key) return "neutral"
  if (/^(PRESENT|ON_TIME|APPROVED|RESOLVED|COMPLETED|SUCCESS|SUCCEEDED|DONE|SYNCED|ACTIVE|MATCHED)$/.test(key)) return "ok"
  if (/LATE/.test(key)) return "late"
  if (/(EARLY|HALF_DAY|PARTIAL|PENDING|OPEN|QUEUED|RUNNING|PROCESSING|MISSING|REVIEW|INCOMPLETE|WARNING)/.test(key)) return "warn"
  if (/(ABSENT|REJECTED|FAILED|ERROR|IGNORED|CANCELLED|CANCELED|EXPIRED|INVALID|DUPLICATE)/.test(key)) return "bad"
  if (/(LEAVE|HOLIDAY|OFF|WEEKEND|EXEMPT|WFH|WORK_FROM_HOME|TRIP|FIELD)/.test(key)) return "info"
  return "neutral"
}

export function prettifyStatus(status: unknown) {
  const raw = String(status ?? "").trim()
  if (!raw) return "—"
  return raw
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

export function AttendanceStatusBadge({
  status,
  label,
  tone,
  className,
}: {
  status: unknown
  label?: React.ReactNode
  tone?: AttendanceTone
  className?: string
}) {
  const resolved = TONE[tone ?? attendanceStatusTone(status)]
  if (status == null || String(status).trim() === "" || String(status).trim() === "—") {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
        resolved.badge,
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label ?? prettifyStatus(status)}
    </span>
  )
}

/** Breadcrumb, page title and the page-level actions (date, export, refresh). */
export function AttendancePageHead({
  section = "Attendance operations",
  title,
  description,
  actions,
  className,
}: {
  section?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <p className="mb-0.5 text-xs text-muted-foreground">
          {section} <span aria-hidden="true">/</span> {title}
        </p>
        <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-[22px]">{title}</h1>
        {description ? <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end [&>*]:max-sm:flex-1">
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export type AttendanceCounter = {
  /** Value passed to onChange; use "" for the "All" counter. */
  key: string
  label: string
  count: number
  tone?: AttendanceTone
}

/** Clickable count boxes; the pressed one narrows the list to that status. */
export function AttendanceStatusCounters({
  items,
  value,
  onChange,
  note,
  className,
}: {
  items: AttendanceCounter[]
  value: string
  onChange?: (key: string) => void
  note?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const pressed = value === item.key
          const tone = TONE[item.tone ?? "neutral"]
          return (
            <button
              key={item.key || "all"}
              type="button"
              aria-pressed={pressed}
              disabled={!onChange}
              onClick={() => onChange?.(pressed && item.key ? "" : item.key)}
              className={cn(
                "flex min-w-[7rem] flex-1 flex-col gap-0.5 rounded-xl border border-border bg-card px-3 py-2 text-left transition sm:min-w-[8rem]",
                "hover:border-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                pressed && tone.ring,
              )}
            >
              <span
                className={cn(
                  "text-lg font-extrabold leading-tight tabular-nums tracking-tight sm:text-[22px]",
                  pressed ? tone.text : "text-foreground",
                )}
              >
                {item.count}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                {item.tone && item.tone !== "neutral" ? (
                  <span aria-hidden="true" className={cn("size-2 rounded-full", tone.dot)} />
                ) : null}
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
      {note ? <p className="text-[11px] text-muted-foreground">{note}</p> : null}
    </div>
  )
}

/** Builds counters from rows: an "All" box plus one box per status present. */
export function buildStatusCounters<T>(
  rows: T[],
  readStatus: (row: T) => unknown,
  options: { order?: string[]; labels?: Record<string, string>; allLabel?: string } = {},
): AttendanceCounter[] {
  const counts = new Map<string, number>()
  rows.forEach((row) => {
    const key = normalizeStatusKey(readStatus(row))
    if (!key) return
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  const order = options.order ?? []
  const keys = [
    ...order.filter((key) => counts.has(key) || order.length <= 6),
    ...[...counts.keys()].filter((key) => !order.includes(key)).sort(),
  ]
  return [
    { key: "", label: options.allLabel ?? "All", count: rows.length },
    ...keys.map((key) => ({
      key,
      label: options.labels?.[key] ?? prettifyStatus(key),
      count: counts.get(key) ?? 0,
      tone: attendanceStatusTone(key),
    })),
  ]
}

export function normalizeStatusKey(status: unknown) {
  return String(status ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_")
}

const TIMELINE_START = 6 * 60
const TIMELINE_END = 20 * 60

function parseClock(value: unknown): number | null {
  if (value == null) return null
  const text = String(value).trim()
  if (!text || text === "—") return null
  const iso = /^\d{4}-\d{2}-\d{2}T/.test(text) ? new Date(text) : null
  if (iso && !Number.isNaN(iso.getTime())) return iso.getHours() * 60 + iso.getMinutes()
  const match = text.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?/)
  if (!match) return null
  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = match[3]?.toUpperCase()
  if (meridiem === "PM" && hours < 12) hours += 12
  if (meridiem === "AM" && hours === 12) hours = 0
  return hours * 60 + minutes
}

const pct = (minutes: number) =>
  `${(((Math.min(Math.max(minutes, TIMELINE_START), TIMELINE_END) - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100).toFixed(2)}%`

/**
 * A 06:00–20:00 bar showing the scheduled shift (dashed box) and the time
 * actually worked. An open span (checked in, no check out) is hatched when
 * the row is for today.
 */
export function AttendanceShiftTimeline({
  checkIn,
  checkOut,
  shiftStart,
  shiftEnd,
  status,
  isToday = false,
  showScale = false,
  className,
}: {
  checkIn: unknown
  checkOut: unknown
  shiftStart?: unknown
  shiftEnd?: unknown
  status?: unknown
  isToday?: boolean
  showScale?: boolean
  className?: string
}) {
  const [now, setNow] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (!isToday) return
    const tick = () => {
      const date = new Date()
      setNow(date.getHours() * 60 + date.getMinutes())
    }
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [isToday])

  const inMin = parseClock(checkIn)
  const outMin = parseClock(checkOut)
  const startMin = parseClock(shiftStart) ?? 8 * 60
  const endMin = parseClock(shiftEnd) ?? 17 * 60
  const open = inMin != null && outMin == null
  const spanEnd = outMin ?? (open && isToday && now != null ? now : null)
  const tone = TONE[attendanceStatusTone(status)]
  const fmt = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
  const label =
    inMin == null
      ? `${prettifyStatus(status)}, no punches`
      : `In ${fmt(inMin)}, ${outMin != null ? `out ${fmt(outMin)}` : isToday ? "still in" : "no check out"}`

  return (
    <div className={cn("w-[110px] lg:w-[140px] xl:w-[170px]", className)}>
      <div className="relative h-[22px]" role="img" aria-label={label} title={label}>
        <div className="absolute inset-x-0 top-2 bottom-2 rounded bg-muted/70" />
        <div
          className="absolute top-2 bottom-2 border-x border-dashed border-muted-foreground/60 bg-muted"
          style={{ left: pct(startMin), right: `calc(100% - ${pct(endMin)})` }}
        />
        {inMin != null && spanEnd != null ? (
          <div
            className={cn("absolute top-1.5 bottom-1.5 rounded-[5px]", tone.bar, open && "opacity-70")}
            style={{ left: pct(inMin), width: `calc(${pct(spanEnd)} - ${pct(inMin)})` }}
          />
        ) : inMin != null ? (
          <div className={cn("absolute top-1.5 bottom-1.5 w-1 rounded-full", tone.bar)} style={{ left: pct(inMin) }} />
        ) : null}
        {isToday && now != null ? (
          <div className="absolute top-0.5 bottom-0.5 w-0.5 rounded bg-foreground/60" style={{ left: pct(now) }} />
        ) : null}
      </div>
      {showScale ? (
        <div className="flex justify-between text-[10.5px] font-semibold text-muted-foreground">
          <span>06:00</span>
          <span>12:00</span>
          <span>20:00</span>
        </div>
      ) : null}
    </div>
  )
}

/** Strip shown above the table while rows are selected. */
export function AttendanceBulkBar({
  count,
  onClear,
  children,
}: {
  count: number
  onClear: () => void
  children?: React.ReactNode
}) {
  if (count <= 0) return null
  return (
    <div className="flex items-center gap-2 rounded-xl bg-primary py-2 pr-2 pl-3.5 text-sm font-bold text-primary-foreground">
      <span>{count} selected</span>
      <span className="flex-1" />
      {children}
      <button
        type="button"
        aria-label="Clear selection"
        onClick={onClear}
        className="inline-flex h-8 items-center rounded-lg bg-white/15 px-2.5 text-xs font-semibold"
      >
        Clear
      </button>
    </div>
  )
}

/** Primary/secondary head button with the design's 36px sizing. */
export function AttendanceHeadButton({
  primary = false,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        primary
          ? "border-primary bg-primary text-primary-foreground hover:brightness-95"
          : "border-border bg-card text-foreground hover:border-muted-foreground/60",
        className,
      )}
    />
  )
}

export type AttendanceExportColumn<T> = { label: string; value: (row: T) => unknown }

/** Downloads the given rows as a CSV file (opens in Excel). */
export function downloadAttendanceCsv<T>(filename: string, columns: AttendanceExportColumn<T>[], rows: T[]) {
  const cell = (value: unknown) => {
    const text =
      value == null
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value)
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const lines = [
    columns.map((column) => cell(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => cell(column.value(row))).join(",")),
  ]
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The header's Export button. Disabled when there is nothing to export. */
export function AttendanceExportButton({
  onExport,
  disabled,
  count,
}: {
  onExport: () => void
  disabled?: boolean
  count?: number
}) {
  return (
    <AttendanceHeadButton
      primary
      onClick={onExport}
      disabled={disabled || count === 0}
      title={count != null ? `Export ${count} row${count === 1 ? "" : "s"} to CSV` : "Export to CSV"}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
      </svg>
      Export
    </AttendanceHeadButton>
  )
}
