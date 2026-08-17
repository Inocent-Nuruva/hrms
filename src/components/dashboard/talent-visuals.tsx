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
  "inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-muted"
export const primaryButtonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold !text-white transition hover:brightness-95 disabled:opacity-60"
export const secondaryButtonClass =
  "inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-muted"

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
  const nested = asRecord(row.employee)
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
}: {
  eyebrow: string
  title: string
  description: string
  actions?: React.ReactNode
}) {
  const motionPreset = useDashboardMotion()
  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl px-5 py-5 text-white sm:px-6"
      style={{ backgroundColor: "var(--primary)" }}
      variants={motionPreset.rise}
      initial="hidden"
      animate="show"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10"
        animate={
          motionPreset.reduce
            ? undefined
            : { x: [0, 10, 0], y: [0, 8, 0], scale: [1, 1.06, 1] }
        }
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <TalentDoodle />
      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-1.5">
          <motion.p
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70"
            initial={motionPreset.reduce ? false : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.32 }}
          >
            {eyebrow}
          </motion.p>
          <motion.h1
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
            initial={motionPreset.reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06 }}
          >
            {title}
          </motion.h1>
          <motion.p
            className="text-sm text-white/75"
            initial={motionPreset.reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.12 }}
          >
            {description}
          </motion.p>
        </div>
        {actions ? (
          <motion.div
            className="relative z-10 flex flex-wrap gap-2"
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
      className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
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
              "rounded-xl border px-3 py-2.5",
              active
                ? "border-primary/40 bg-primary/10"
                : done
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30"
                  : "border-border bg-card",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Step {index + 1}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{prettify(step)}</p>
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
  const message = error instanceof Error ? error.message : String(error ?? "")
  return /do not have permission|forbidden|not allowed to perform/i.test(message)
}

export function collectNumeric(row: AdminRecord | null | undefined, keys: string[]) {
  return readNumber(row, keys)
}
