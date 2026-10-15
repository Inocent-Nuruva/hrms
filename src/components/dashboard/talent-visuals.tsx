"use client"

import * as React from "react"
import { motion } from "framer-motion"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AdminRecord } from "@/lib/admin-api"
import { fadeUp, useDashboardMotion } from "@/lib/dashboard-motion"

export const inputClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background"
export const textareaClass =
  "min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background"
export const actionButtonClass =
  "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded border border-border bg-background px-3 text-sm font-semibold text-foreground shadow-xs transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
export const primaryButtonClass =
  "inline-flex h-8 min-w-24 items-center justify-center gap-1 rounded border border-transparent bg-primary px-3 text-sm font-semibold !text-white transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
export const secondaryButtonClass =
  "inline-flex h-8 min-w-24 items-center justify-center gap-1 rounded border border-border bg-background px-3 text-sm font-semibold text-foreground shadow-xs transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
export const heroActionButtonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-md bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-white/90 disabled:opacity-60"
export const heroGhostButtonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 text-sm font-medium text-white no-underline transition hover:bg-white/20 hover:text-white hover:no-underline disabled:opacity-60"
export const pageBleedClass =
  "-mx-3 w-[calc(100%+1.5rem)] sm:-mx-4 sm:w-[calc(100%+2rem)]"
export const heroPanelClass =
  "relative min-w-0 overflow-hidden rounded-none px-5 py-5 text-white sm:px-6"

export function readString(row: AdminRecord | null | undefined, keys: string[], fallback = "") {
  if (!row) return fallback
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    if (typeof value === "boolean") return value ? "true" : "false"
  }
  return fallback
}

export function readNumber(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

export function readBoolean(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return false
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "boolean") return value
    if (value === 1 || value === "1" || value === "true") return true
    if (value === 0 || value === "0" || value === "false") return false
  }
  return false
}

export function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : null
}

export function asRecordArray(value: unknown): AdminRecord[] {
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is AdminRecord =>
        typeof entry === "object" && entry !== null && !Array.isArray(entry),
    )
  }
  const nested = asRecord(value)
  if (!nested) return []
  for (const key of ["items", "data", "rows", "results", "records"]) {
    const candidate = nested[key]
    if (Array.isArray(candidate)) return asRecordArray(candidate)
  }
  return []
}

export function rowId(row: AdminRecord | null | undefined, extraKeys: string[] = []) {
  const id = readNumber(row, ["id", ...extraKeys])
  return id !== null ? String(id) : ""
}

export function prettify(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

export function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export function clampScore(value: number | null | undefined, max = 100) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(max, value))
}

export function employeeLabel(row: AdminRecord | null | undefined) {
  if (!row) return "—"
  const nested = asRecord(row.employee ?? row.employeeSnapshot ?? row.employee_snapshot)
  return (
    readString(row, ["employee_name", "employeeName", "full_name", "fullName", "name"]) ||
    readString(nested, ["full_name", "fullName", "name"]) ||
    (readNumber(row, ["employee_id", "employeeId"]) !== null
      ? `Employee #${readNumber(row, ["employee_id", "employeeId"])}`
      : "—")
  )
}

export function optionLabel(row: AdminRecord | null | undefined) {
  if (!row) return "—"
  return (
    readString(row, ["name", "title", "code", "label", "display_name", "displayName"]) ||
    `#${readNumber(row, ["id"]) ?? "record"}`
  )
}

export function statusTone(label: string) {
  const normalized = label.toUpperCase()
  if (
    [
      "ACTIVE",
      "APPROVED",
      "COMPLETED",
      "CONFIRMED",
      "PUBLISHED",
      "LOCKED",
      "SUCCESS",
      "OPEN",
      "READY",
    ].includes(normalized)
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
  }
  if (
    [
      "PENDING",
      "DRAFT",
      "IN_PROGRESS",
      "IN_REVIEW",
      "SELF_REVIEW",
      "SELF_REVIEW_PENDING",
      "MANAGER_REVIEW",
      "MANAGER_REVIEW_PENDING",
      "HR_REVIEW",
      "HR_REVIEW_PENDING",
      "MODERATION",
      "MODERATION_PENDING",
      "ACHIEVEMENT_ENTRY",
      "EXTENDED",
    ].includes(normalized)
  ) {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300"
  }
  if (
    [
      "FAILED",
      "REJECTED",
      "ERROR",
      "NOT_CONFIRMED",
      "TERMINATION_RECOMMENDED",
      "CANCELLED",
      "APPEALED",
    ].includes(normalized)
  ) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
  }
  if (["SUPERSEDED", "CLOSED", "INACTIVE", "LOCKED"].includes(normalized)) {
    return "border-slate-200 bg-slate-50 text-slate-600 dark:border-border dark:bg-muted/40 dark:text-muted-foreground"
  }
  return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
}

export function StatusChip({ value }: { value: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", statusTone(value))}>
      {prettify(value || "Unknown")}
    </Badge>
  )
}

export function TalentDoodleSprites() {
  return (
    <svg width="0" height="0" className="hidden" aria-hidden="true">
      <symbol id="talent-doodle-arcs" viewBox="0 0 316 316">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="5" opacity="0.28">
          <path d="M 323.074 256.963 C 312.956 263.991 295.834 280.024 295.479 292.107 C 294.971 309.41 311.806 311.371 322.384 317.098" />
          <path d="M 322.384 225.723 C 303.276 230.431 291.393 236.843 273.403 256.963 C 252.542 280.29 261.674 308.503 261.674 315.536" />
          <path d="M 320.316 193.268 C 285.716 194.491 258.866 221.733 245.117 244.813 C 225.414 277.888 238.218 316.923 236.839 320.568" />
        </g>
      </symbol>
    </svg>
  )
}

export function TalentDoodle() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full text-white" aria-hidden="true">
      <use href="#talent-doodle-arcs" />
    </svg>
  )
}

export function HeroBand({
  eyebrow,
  title,
  description,
  actions,
  identity,
  identityInline = false,
  variant = "brand",
}: {
  eyebrow: string
  title: React.ReactNode
  description?: string
  actions?: React.ReactNode
  identity?: React.ReactNode
  identityInline?: boolean
  variant?: "brand" | "dashboard"
}) {
  const motionPreset = useDashboardMotion()
  const dashboardStyle = variant === "dashboard"
  return (
    <motion.div
      className={cn(
        dashboardStyle
          ? "relative min-w-0 overflow-hidden border-b border-border/70 bg-card px-4 py-4 text-foreground sm:px-5 sm:py-5"
          : cn(heroPanelClass, pageBleedClass),
      )}
      style={dashboardStyle ? undefined : { backgroundColor: "var(--primary)" }}
      variants={motionPreset.rise}
      initial="hidden"
      animate="show"
    >
      {dashboardStyle ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden text-sky-500/60 dark:text-sky-300/50">
          <span className="absolute left-[29%] top-4 text-xs text-blue-400/60 dark:text-blue-200/45">✧</span>
          <span className="absolute left-[43%] bottom-3 text-sm">✦</span>
          <span className="absolute right-[42%] top-3 text-[10px] text-blue-400/60 dark:text-blue-200/45">✧</span>
          <span className="absolute right-[34%] top-9 text-xs text-blue-400/70 dark:text-blue-200/50">✧</span>
          <span className="absolute right-[26%] bottom-3 text-[10px] text-sky-400/60 dark:text-sky-200/45">✧</span>
          <span className="absolute right-[18%] top-3 text-lg">✦</span>
          <span className="absolute right-[8%] bottom-2 text-sm">✦</span>
        </div>
      ) : (
        <>
          <TalentDoodleSprites />
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <motion.div
              className="absolute -left-8 top-1/2 h-28 w-44 -translate-y-1/2 bg-white/12"
              style={{ clipPath: "polygon(0% 18%, 78% 0%, 100% 42%, 22% 100%)" }}
              animate={motionPreset.reduce ? undefined : { x: [0, 8, 0], y: [0, -6, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute right-[22%] -top-6 h-24 w-36 bg-white/10"
              style={{ clipPath: "polygon(18% 0%, 100% 22%, 72% 100%, 0% 68%)" }}
              animate={motionPreset.reduce ? undefined : { x: [0, -6, 0], y: [0, 8, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="absolute inset-y-0 left-0 w-[68%] text-white/35">
              <TalentDoodle />
            </div>
          </div>
        </>
      )}
      <div className="relative z-10 flex w-full min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className={cn("min-w-0 flex-1", identityInline && "flex items-start gap-3 sm:gap-4")}>
          {identity ? <div className={identityInline ? "shrink-0 pt-1" : "mb-3"}>{identity}</div> : null}
          <div className="min-w-0 space-y-1.5">
            <motion.p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.18em]",
                dashboardStyle ? "text-muted-foreground" : "text-white/70",
              )}
              initial={motionPreset.reduce ? false : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.32 }}
            >
              {eyebrow}
            </motion.p>
            <motion.h1
              className={cn(
                "flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl",
                dashboardStyle ? "text-foreground" : "text-white",
              )}
              initial={motionPreset.reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.06 }}
            >
              {title}
            </motion.h1>
            {description ? (
              <motion.p
                className={cn("text-sm", dashboardStyle ? "text-muted-foreground" : "text-white/75")}
                initial={motionPreset.reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: 0.12 }}
              >
                {description}
              </motion.p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <motion.div
            className={cn(
              "relative z-10 flex flex-wrap gap-2 [&_button.bg-white]:!text-slate-900",
              dashboardStyle && "[&_a]:!border-border [&_a]:!bg-background [&_a]:!text-foreground [&_a]:hover:!bg-muted [&_button]:!border-border [&_button]:!bg-background [&_button]:!text-foreground [&_button]:hover:!bg-muted",
            )}
            initial={motionPreset.reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.16 }}
          >
            {actions}
          </motion.div>
        ) : null}
      </div>
    </motion.div>
  )
}

export function ScoreRing({
  value,
  label,
  size = 112,
  max = 100,
}: {
  value: number | null
  label: string
  size?: number
  max?: number
}) {
  const score = clampScore(value, max)
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / max) * circumference
  const tone =
    score >= 80 ? "#10b981" : score >= 60 ? "var(--primary)" : score >= 40 ? "#f59e0b" : "#f43f5e"

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 112 112" className="shrink-0">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="currentColor" className="text-muted/40" strokeWidth="10" />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 56 56)"
        />
        <text
          x="56"
          y="52"
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: 22, fontWeight: 700 }}
        >
          {value === null ? "—" : Math.round(score)}
        </text>
        <text
          x="56"
          y="70"
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 10, fontWeight: 600 }}
        >
          / {max}
        </text>
      </svg>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

export function StatusStack({
  items,
}: {
  items: Array<{ label: string; value: number; color: string }>
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {items.map((item) => {
          const width = total > 0 ? (item.value / total) * 100 : 0
          if (width <= 0) return null
          return (
            <div
              key={item.label}
              className="h-full"
              style={{ width: `${width}%`, backgroundColor: item.color }}
              title={`${item.label}: ${item.value}`}
            />
          )
        })}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
            <span className="font-semibold text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CycleRail({
  steps,
  current,
}: {
  steps: string[]
  current?: string
}) {
  const motionPreset = useDashboardMotion()
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.toUpperCase() === (current ?? "").toUpperCase()),
  )
  return (
    <motion.ol
      className={cn(
        "grid overflow-hidden rounded-none border-y border-border bg-card sm:border-x",
        pageBleedClass,
      )}
      style={{ gridTemplateColumns: `repeat(${Math.max(steps.length, 1)}, minmax(0, 1fr))` }}
      variants={motionPreset.fast}
      initial="hidden"
      animate="show"
    >
      {steps.map((step, index) => {
        const done = index < activeIndex
        const active = index === activeIndex
        return (
          <motion.li
            key={step}
            variants={motionPreset.item}
            className={cn(
              "min-w-0 px-3 py-2.5",
              index > 0 && "border-l border-border",
              active
                ? "bg-primary/10"
                : done
                  ? "bg-emerald-50 dark:bg-emerald-950/30"
                  : "bg-card",
            )}
          >
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Step {index + 1}
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-foreground">{prettify(step)}</p>
          </motion.li>
        )
      })}
    </motion.ol>
  )
}

export function TimelineRail({
  items,
}: {
  items: Array<{ label: string; value: string; hint?: string }>
}) {
  const motionPreset = useDashboardMotion()
  return (
    <motion.ol className="space-y-0" variants={motionPreset.fast} initial="hidden" animate="show">
      {items.map((item, index) => (
        <motion.li key={`${item.label}-${index}`} className="flex gap-3" variants={motionPreset.item}>
          <div className="flex flex-col items-center">
            <span className="mt-1 size-2.5 rounded-full bg-primary" />
            {index < items.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
          </div>
          <div className="pb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className="text-sm font-medium text-foreground">{item.value}</p>
            {item.hint ? <p className="text-xs text-muted-foreground">{item.hint}</p> : null}
          </div>
        </motion.li>
      ))}
    </motion.ol>
  )
}

export function MetricTile({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: string
}) {
  const motionPreset = useDashboardMotion()
  return (
    <motion.div
      className="rounded-xl border border-border bg-card p-4"
      variants={fadeUp}
      initial="hidden"
      animate="show"
      whileHover={motionPreset.hover}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </motion.div>
  )
}

export function CompactStatStrip({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>
}) {
  return (
    <CompactFactGrid items={items} columns={3} />
  )
}

export function CompactFactGrid({
  items,
  columns = 3,
  title,
  aside,
}: {
  items: Array<{ label: string; value: React.ReactNode }>
  columns?: 3 | 4
  title?: string
  aside?: React.ReactNode
}) {
  return (
    <div className={cn("overflow-hidden rounded-none border-y border-border bg-card sm:border-x", pageBleedClass)}>
      {title ? (
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          {aside ? <p className="truncate text-xs font-semibold text-foreground">{aside}</p> : null}
        </div>
      ) : null}
      <div
        className={cn(
          "grid divide-x divide-y divide-border",
          columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
        )}
      >
        {items.map((field) => (
          <div key={field.label} className="min-w-0 px-3 py-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              {field.label}
            </p>
            <p className="truncate text-xs font-semibold text-foreground">{field.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StatStrip({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode; hint?: string }>
}) {
  const columns = items.length === 3 ? 3 : 4
  return (
    <div className="rounded-xl border border-border bg-card">
      <div
        className={cn(
          "grid",
          columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4",
        )}
      >
        {items.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              "border-border px-5 py-4",
              columns === 3
                ? index > 0 && "border-t sm:border-t-0 sm:border-l"
                : [
                    index > 0 && "border-t",
                    "sm:border-t-0",
                    index >= 2 && "sm:border-t",
                    index % 2 === 1 && "sm:border-l",
                    "xl:border-t-0",
                    index > 0 && "xl:border-l",
                  ],
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{item.value}</p>
            {item.hint ? <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  )
}

export function countByStatus(rows: AdminRecord[], keys = ["status", "state"]) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const status = readString(row, keys, "UNKNOWN")
    counts.set(status, (counts.get(status) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([label, value]) => ({ label, value }))
}

const STATUS_COLORS = [
  "var(--primary)",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
  "#64748b",
]

export function statusChartItems(rows: AdminRecord[]) {
  return countByStatus(rows).map((item, index) => ({
    ...item,
    label: prettify(item.label),
    color: STATUS_COLORS[index % STATUS_COLORS.length],
  }))
}

export function isPermissionError(error: unknown) {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : null
  const status = Number(record?.status ?? record?.statusCode)
  if (status === 403) return true
  const payload = record?.payload
  const payloadRecord =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null
  const message = [
    error instanceof Error ? error.message : String(error ?? ""),
    typeof payloadRecord?.message === "string" ? payloadRecord.message : "",
    typeof payloadRecord?.error === "string" ? payloadRecord.error : "",
  ].join(" ")
  return /do not have permission|forbidden|not allowed to perform|platform access is required/i.test(
    message,
  )
}

export function collectNumeric(row: AdminRecord | null | undefined, keys: string[]) {
  return readNumber(row, keys)
}
