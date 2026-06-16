"use client"

import * as React from "react"

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import type { AdminRecord } from "@/lib/admin-api"
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

export function formatAdminValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-"
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) {
      return "-"
    }
    if (isIsoDateString(trimmed)) {
      return formatDisplayDate(trimmed)
    }
    if (isTimeValue(trimmed)) {
      return formatDisplayTime(trimmed)
    }
    return trimmed
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return "-"
    }
    return value
      .map((entry) => formatAdminValue(entry))
      .filter((entry) => entry !== "-")
      .join(", ")
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>
    const labelCandidate = [
      "name",
      "title",
      "label",
      "display_name",
      "displayName",
      "branch_name",
      "department_name",
      "code",
    ]
      .map((key) => objectValue[key])
      .find((entry) => typeof entry === "string" && entry.trim())

    if (typeof labelCandidate === "string") {
      return labelCandidate
    }

    return JSON.stringify(value)
  }

  return "-"
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  row: AdminRecord | null
  resolveLabel?: (key: string) => string
  resolveValue?: (key: string, row: AdminRecord) => string
}) {
  const entries = React.useMemo(() => {
    if (!row) {
      return []
    }

    return Object.entries(row).filter(([, value]) => value !== null && value !== undefined && formatAdminValue(value) !== "-")
  }, [row])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No details available for this record.</p>
        ) : (
          <div className="max-h-[65vh] overflow-auto pr-1">
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-[minmax(10rem,13rem)_1fr]">
              {entries.map(([key]) => (
                <React.Fragment key={key}>
                  <div className="border-b border-slate-100 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    {resolveLabel ? resolveLabel(key) : key.replaceAll("_", " ")}
                  </div>
                  <div className="border-b border-slate-100 py-2 text-sm text-slate-800 dark:border-slate-800 dark:text-slate-100">
                    {row ? resolveValue?.(key, row) ?? formatAdminValue(row[key]) : "-"}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </DialogPopup>
    </Dialog>
  )
}
