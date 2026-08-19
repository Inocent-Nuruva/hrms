"use client"

import * as React from "react"

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import type { AdminRecord } from "@/lib/admin-api"
import { cn } from "@/lib/utils"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const FORM_DRAFT_PREFIX = "hrms.form-draft"

function isIsoDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}T/.test(value)
}

function isTimeValue(value: string) {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(value)
}

function formatDisplayDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date)
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function formatDisplayTime(value: string) {
  const [hours, minutes] = value.split(":")
  const hourNumber = Number(hours)
  const minuteNumber = Number(minutes)
  if (!Number.isInteger(hourNumber) || !Number.isInteger(minuteNumber)) {
    return value
  }

  const date = new Date()
  date.setHours(hourNumber, minuteNumber, 0, 0)
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

const HIDDEN_DETAIL_KEYS = new Set([
  "id",
  "companyid",
  "company_id",
  "tenantid",
  "tenant_id",
  "createdby",
  "created_by",
  "updatedby",
  "updated_by",
  "deletedat",
  "deleted_at",
  "deletedby",
  "deleted_by",
])

function normalizeDetailKey(key: string) {
  return key.replace(/[_-]+/g, "").toLowerCase()
}

function prettifyDetailKey(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function parseMaybeJson(value: string) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed) as unknown
    } catch {
      return value
    }
  }
  return value
}

function objectLabel(value: Record<string, unknown>) {
  const candidate = [
    "name",
    "title",
    "label",
    "display_name",
    "displayName",
    "branch_name",
    "department_name",
    "code",
  ]
    .map((key) => value[key])
    .find((entry) => typeof entry === "string" && entry.trim())
  return typeof candidate === "string" ? candidate.trim() : ""
}

function formatReadableDetailValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "—"
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return "—"
    const parsed = parseMaybeJson(trimmed)
    if (parsed !== trimmed) return formatReadableDetailValue(parsed)
    if (isIsoDateString(trimmed)) return formatDisplayDate(trimmed)
    if (isTimeValue(trimmed)) return formatDisplayTime(trimmed)
    if (trimmed === "true") return "Yes"
    if (trimmed === "false") return "No"
    return trimmed
  }
  if (Array.isArray(value)) {
    if (!value.length) return "—"
    return value
      .map((entry) => formatReadableDetailValue(entry))
      .filter((entry) => entry && entry !== "—")
      .join(", ") || "—"
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const label = objectLabel(record)
    if (label) return label
    const flattened = Object.entries(record)
      .filter(([key]) => !HIDDEN_DETAIL_KEYS.has(normalizeDetailKey(key)))
      .map(([key, entry]) => `${prettifyDetailKey(key)}: ${formatReadableDetailValue(entry)}`)
      .filter((entry) => !entry.endsWith(": —"))
    return flattened.join(" · ") || "—"
  }
  return "—"
}

function collectReadableDetailSections(row: AdminRecord) {
  const lead: string[] = []
  const fields: Array<{ key: string; label: string; value: string }> = []
  const lists: Array<{ title: string; items: string[] }> = []

  for (const [key, raw] of Object.entries(row)) {
    if (HIDDEN_DETAIL_KEYS.has(normalizeDetailKey(key))) continue
    if (raw === null || raw === undefined) continue

    const parsed = typeof raw === "string" ? parseMaybeJson(raw) : raw
    const pretty = prettifyDetailKey(key)

    if (normalizeDetailKey(key) === "description" && typeof parsed === "string" && parsed.trim()) {
      lead.push(parsed.trim())
      continue
    }

    if (normalizeDetailKey(key) === "metadata" && typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      for (const [metaKey, metaValue] of Object.entries(parsed as Record<string, unknown>)) {
        if (HIDDEN_DETAIL_KEYS.has(normalizeDetailKey(metaKey))) continue
        const value = formatReadableDetailValue(metaValue)
        if (value !== "—") fields.push({ key: metaKey, label: prettifyDetailKey(metaKey), value })
      }
      continue
    }

    if (Array.isArray(parsed) && parsed.some((entry) => typeof entry === "object" && entry !== null)) {
      const items = parsed
        .map((entry) => formatReadableDetailValue(entry))
        .filter((entry) => entry && entry !== "—")
      if (items.length) lists.push({ title: pretty, items })
      continue
    }

    const value = formatReadableDetailValue(parsed)
    if (value !== "—") fields.push({ key, label: pretty, value })
  }

  return { lead, fields, lists }
}

export function formatAdminValue(value: unknown): string {
  const readable = formatReadableDetailValue(value)
  return readable === "—" ? "-" : readable
}

export function buildFormDraftStorageKey(scope: string) {
  return `${FORM_DRAFT_PREFIX}:${scope}`
}

export function readPersistedFormState(
  storageKey: string,
  fallback: Record<string, string>
) {
  if (typeof window === "undefined") {
    return fallback
  }

  const raw = window.localStorage.getItem(storageKey)
  if (!raw) {
    return fallback
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const next = { ...fallback }
    for (const key of Object.keys(fallback)) {
      const value = parsed[key]
      if (typeof value === "string") {
        next[key] = value
      }
    }
    return next
  } catch {
    return fallback
  }
}

export function persistFormState(storageKey: string, values: Record<string, string>) {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.setItem(storageKey, JSON.stringify(values))
}

export function clearPersistedFormState(storageKey: string) {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.removeItem(storageKey)
}

export function readStoredCompanyName() {
  if (typeof window === "undefined") {
    return null
  }

  const rawUser = window.localStorage.getItem(AUTH_STORAGE_KEYS.user)
  if (!rawUser) {
    return null
  }

  try {
    const parsed = JSON.parse(rawUser) as Record<string, unknown>
    const candidates = [
      parsed,
      typeof parsed.company === "object" && parsed.company ? (parsed.company as Record<string, unknown>) : null,
      typeof parsed.organization === "object" && parsed.organization ? (parsed.organization as Record<string, unknown>) : null,
      typeof parsed.tenant === "object" && parsed.tenant ? (parsed.tenant as Record<string, unknown>) : null,
    ].filter((entry): entry is Record<string, unknown> => Boolean(entry))

    for (const candidate of candidates) {
      const value = [
        candidate.companyName,
        candidate.company_name,
        candidate.display_name,
        candidate.company,
        candidate.organization_name,
        candidate.tenant_name,
        candidate.name,
      ].find((entry) => typeof entry === "string" && entry.trim())

      if (typeof value === "string") {
        return value.trim()
      }
    }
  } catch {
    return null
  }

  return null
}

export function RecordDetailsDialog({
  open,
  onOpenChange,
  title,
  description,
  row,
  resolveLabel,
  resolveValue,
  content,
  footer,
  popupClassName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  row: AdminRecord | null
  resolveLabel?: (key: string) => string
  resolveValue?: (key: string, row: AdminRecord) => string
  content?: React.ReactNode
  footer?: React.ReactNode
  popupClassName?: string
}) {
  const sections = React.useMemo(() => (row ? collectReadableDetailSections(row) : null), [row])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className={cn("sm:max-w-2xl", popupClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {content ? (
          content
        ) : !sections || (sections.fields.length === 0 && sections.lists.length === 0 && sections.lead.length === 0) ? (
          <p className="text-sm text-muted-foreground">No details available for this record.</p>
        ) : (
          <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
            {sections.lead.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-6 text-muted-foreground">
                {paragraph}
              </p>
            ))}
            {sections.fields.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {sections.fields.map((field) => (
                  <div key={`${field.key}-${field.value}`} className="rounded-xl border border-border bg-card px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {resolveLabel ? resolveLabel(field.key) : field.label}
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {row && resolveValue ? resolveValue(field.key, row) : field.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            {sections.lists.map((list) => (
              <div key={list.title} className="rounded-xl border border-border bg-card p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {list.title}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {list.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogPopup>
    </Dialog>
  )
}
