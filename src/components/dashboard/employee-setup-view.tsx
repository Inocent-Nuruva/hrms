"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFluentToastState } from "@/components/ui/use-fluent-toast-state"
import {
  getEmployeeNumbering,
  updateEmployeeNumbering,
  type AdminRecord,
} from "@/lib/admin-api"
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function readString(row: AdminRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return fallback
}

function readNumber(row: AdminRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return null
}

function apiErrorMessage(errorObject: unknown, fallback: string) {
  if (errorObject instanceof Error && errorObject.message.trim()) {
    return errorObject.message
  }

  if (typeof errorObject === "object" && errorObject !== null && "payload" in errorObject) {
    const payload = (errorObject as { payload?: unknown }).payload
    if (payload && typeof payload === "object") {
      const record = payload as Record<string, unknown>
      if (typeof record.message === "string" && record.message.trim()) {
        return record.message
      }
      if (Array.isArray(record.message)) {
        const joined = record.message.map(String).filter(Boolean).join(". ")
        if (joined) {
          return joined
        }
      }
    }
  }

  return fallback
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "—"
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
}

function sampleEmployeeNumber(prefix: string, padding: string, nextNumber: string) {
  const numericPadding = Number(padding)
  const numericNext = Number(nextNumber)
  if (!Number.isFinite(numericPadding) || !Number.isFinite(numericNext)) {
    return "-"
  }
  const body = String(Math.max(1, numericNext)).padStart(Math.max(1, numericPadding), "0")
  return `${prefix.trim()}${body}`
}

function normalizeNumberingForm(record: AdminRecord | null) {
  const normalized = record ?? {}
  return {
    prefix: readString(normalized, ["prefix"]),
    padding: String(readNumber(normalized, ["padding"]) ?? 5),
    next_number: String(readNumber(normalized, ["next_number", "nextNumber"]) ?? 1),
  }
}

export function EmployeeSetupView() {
  const leaveIfForbidden = useLeaveIfForbidden()
  const [numbering, setNumbering] = React.useState<AdminRecord | null>(null)
  const [numberingForm, setNumberingForm] = React.useState({
    prefix: "",
    padding: "5",
    next_number: "1",
  })
  const [savedNumberingForm, setSavedNumberingForm] = React.useState({
    prefix: "",
    padding: "5",
    next_number: "1",
  })
  const [loading, setLoading] = React.useState(false)
  const [numberingSaving, setNumberingSaving] = React.useState(false)
  const [numberingError, setNumberingError] = React.useState<string | null>(null)
  const [numberingMessage, setNumberingMessage] = React.useState<string | null>(null)

  useFluentToastState(numberingMessage, setNumberingMessage, "success")

  const loadData = React.useCallback(async () => {
    const accessToken = readStoredToken()
    if (!accessToken) {
      setNumberingError("Authentication token not found. Please log in again.")
      setNumbering(null)
      return
    }

    setLoading(true)
    setNumberingError(null)
    setNumberingMessage(null)
    try {
      const numberingRecord = await getEmployeeNumbering(accessToken)
      const nextForm = normalizeNumberingForm(numberingRecord)

      setNumbering(numberingRecord)
      setNumberingForm(nextForm)
      setSavedNumberingForm(nextForm)
    } catch (errorObject) {
      if (leaveIfForbidden(errorObject)) {
        return
      }
      setNumberingError(apiErrorMessage(errorObject, "Failed to load employee numbering."))
      setNumbering(null)
      setSavedNumberingForm({
        prefix: "",
        padding: "5",
        next_number: "1",
      })
    } finally {
      setLoading(false)
    }
  }, [leaveIfForbidden])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  const saveNumbering = React.useCallback(async () => {
    const accessToken = readStoredToken()
    if (!accessToken) {
      setNumberingError("Authentication token not found. Please log in again.")
      return
    }

    const prefix = numberingForm.prefix.trim().toUpperCase()
    const padding = Number(numberingForm.padding)
    const nextNumber = Number(numberingForm.next_number)

    if (!/^$|^[A-Z0-9]{2,20}$/.test(prefix)) {
      setNumberingError("Prefix must be blank or 2-20 uppercase letters or digits.")
      return
    }
    if (!Number.isInteger(padding) || padding < 3 || padding > 12) {
      setNumberingError("Padding must be a whole number between 3 and 12.")
      return
    }
    if (!Number.isInteger(nextNumber) || nextNumber < 1) {
      setNumberingError("Next number must be a whole number greater than 0.")
      return
    }

    setNumberingSaving(true)
    setNumberingError(null)
    setNumberingMessage(null)
    try {
      const updated = await updateEmployeeNumbering(accessToken, {
        prefix,
        padding,
        next_number: nextNumber,
      })
      const nextForm = normalizeNumberingForm(updated)
      setNumbering(updated)
      setNumberingForm(nextForm)
      setSavedNumberingForm(nextForm)
      setNumberingMessage("Employee numbering updated.")
    } catch (errorObject) {
      setNumberingError(apiErrorMessage(errorObject, "Failed to update employee numbering."))
    } finally {
      setNumberingSaving(false)
    }
  }, [numberingForm])

  const numberingPreview = React.useMemo(
    () => sampleEmployeeNumber(numberingForm.prefix, numberingForm.padding, numberingForm.next_number),
    [numberingForm.next_number, numberingForm.padding, numberingForm.prefix]
  )
  const previewPrefix = numberingForm.prefix.trim()
  const previewDigits =
    numberingPreview === "-" ? [] : numberingPreview.slice(previewPrefix.length).split("")
  const isDirty =
    numberingForm.prefix !== savedNumberingForm.prefix ||
    numberingForm.padding !== savedNumberingForm.padding ||
    numberingForm.next_number !== savedNumberingForm.next_number

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="relative overflow-hidden px-5 py-5 sm:px-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-primary/10"
          />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Next employee number
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Updates as you type. Saved only when you confirm.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => void loadData()} disabled={loading}>
                {loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              </Button>
            </div>
            <div className="mt-5 flex flex-wrap items-end gap-2.5">
              {previewPrefix ? (
                <span className="pb-1.5 text-2xl font-semibold tracking-[0.22em] text-primary">
                  {previewPrefix}
                </span>
              ) : null}
              {previewDigits.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {previewDigits.map((digit, index) => (
                    <span
                      key={`${digit}-${index}`}
                      className="flex h-12 w-9 items-center justify-center rounded-lg border border-border bg-background font-mono text-xl font-semibold tabular-nums shadow-sm"
                    >
                      {digit}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                  Enter a valid padding and next number
                </span>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <p>
                Last saved{" "}
                <span className="font-medium text-foreground">
                  {numbering ? formatDateTime(numbering.updated_at ?? numbering.updatedAt) : "—"}
                </span>
              </p>
              <p>
                Stored next{" "}
                <span className="font-medium text-foreground">
                  {numbering ? (readNumber(numbering, ["next_number", "nextNumber"]) ?? "—") : "—"}
                </span>
              </p>
              <p>
                Status{" "}
                <span className="font-medium text-foreground">
                  {loading ? "Refreshing..." : numberingSaving ? "Saving..." : isDirty ? "Unsaved changes" : "Synced"}
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="grid content-start gap-3 border-t border-border bg-muted/20 p-5 lg:border-l lg:border-t-0">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="employee-number-prefix">Prefix</Label>
              <Input
                id="employee-number-prefix"
                value={numberingForm.prefix}
                onChange={(event) => {
                  setNumberingMessage(null)
                  setNumberingError(null)
                  setNumberingForm((current) => ({ ...current, prefix: event.target.value.toUpperCase() }))
                }}
                placeholder="EMP"
                className="font-mono uppercase"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="employee-number-padding">Digits</Label>
              <Input
                id="employee-number-padding"
                inputMode="numeric"
                value={numberingForm.padding}
                onChange={(event) => {
                  setNumberingMessage(null)
                  setNumberingError(null)
                  setNumberingForm((current) => ({ ...current, padding: event.target.value }))
                }}
                placeholder="5"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="employee-number-next">Next</Label>
              <Input
                id="employee-number-next"
                inputMode="numeric"
                value={numberingForm.next_number}
                onChange={(event) => {
                  setNumberingMessage(null)
                  setNumberingError(null)
                  setNumberingForm((current) => ({ ...current, next_number: event.target.value }))
                }}
                placeholder="1"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Prefix can be blank, or 2–20 letters and digits. Digit width is 3–12.
          </p>
          {numberingError ? <p className="text-sm text-rose-600">{numberingError}</p> : null}
          <div className="flex justify-end">
            <Button type="button" onClick={() => void saveNumbering()} disabled={numberingSaving || loading || !isDirty}>
              {numberingSaving ? <FluentLoadingIndicator className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              {isDirty ? "Save numbering" : "Saved"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
