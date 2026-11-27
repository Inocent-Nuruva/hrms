"use client"

import * as React from "react"

import { RecordTag } from "@/components/dashboard/employee-profile/profile-record-views"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { getLetterCatalogue, letterStatusMeta, type LetterCatalogue } from "@/lib/letters-api"
import { readStoredSessionTokens } from "@/lib/session-client"

/** Status tag with the module's tone mapping (Draft neutral … Issued success). */
export function LetterStatusTag({ status }: { status: string }) {
  const meta = letterStatusMeta(status)
  return <RecordTag tone={meta.tone}>{meta.label}</RecordTag>
}

/** Access token, read after mount so server and first client render match. */
export function useLettersToken() {
  const [token, setToken] = React.useState("")
  React.useEffect(() => {
    setToken(readStoredSessionTokens().accessToken.trim())
  }, [])
  return token
}

export type LetterPermissions = {
  ready: boolean
  read: boolean
  create: boolean
  approve: boolean
  issue: boolean
  cancel: boolean
  manageTemplates: boolean
}

export function useLetterPermissions(): LetterPermissions {
  const actor = useDashboardActor()
  const has = (permission: string) => actor.ready && canPerformPermission(actor.permissionLabels, permission)
  return {
    ready: actor.ready,
    read: has("employee_letters:read"),
    create: has("employee_letters:create"),
    approve: has("employee_letters:approve"),
    issue: has("employee_letters:issue"),
    cancel: has("employee_letters:cancel"),
    manageTemplates: has("letter_templates:manage"),
  }
}

export function useLetterCatalogue(token: string) {
  const [catalogue, setCatalogue] = React.useState<LetterCatalogue | null>(null)
  React.useEffect(() => {
    if (!token) return
    let active = true
    getLetterCatalogue(token)
      .then((result) => {
        if (active) setCatalogue(result)
      })
      .catch(() => {
        if (active) setCatalogue({ letter_types: [], placeholders: [] })
      })
    return () => {
      active = false
    }
  }, [token])
  return catalogue
}

export function errorText(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

/** Missing placeholder keys from an API error (400 { missing_placeholders }). */
export function missingFromError(cause: unknown): string[] {
  const payload = (cause as { payload?: unknown; missing?: unknown } | null)?.payload
  const fromPayload = (payload as { missing_placeholders?: unknown } | null)?.missing_placeholders
  if (Array.isArray(fromPayload)) return fromPayload.map(String)
  const direct = (cause as { missing?: unknown } | null)?.missing
  return Array.isArray(direct) ? direct.map(String) : []
}

export function formatLetterDate(value: string | null | undefined, withTime = false) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}

/** Holds a PDF blob URL and revokes the previous one. */
export function useBlobUrl() {
  const [url, setUrl] = React.useState<string | null>(null)
  const current = React.useRef<string | null>(null)
  const set = React.useCallback((blob: Blob | null) => {
    if (current.current) URL.revokeObjectURL(current.current)
    current.current = blob ? URL.createObjectURL(blob) : null
    setUrl(current.current)
  }, [])
  React.useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current)
    },
    [],
  )
  return [url, set] as const
}

export const PdfFrame = React.forwardRef<HTMLIFrameElement, { url: string | null; loading?: boolean; title: string; empty?: string }>(
  function PdfFrame({ url, loading, title, empty = "No preview yet." }, ref) {
    return (
      <div className="relative h-[60vh] min-h-80 w-full overflow-hidden rounded-md border border-border bg-muted/30">
        {url ? <iframe ref={ref} title={title} src={url} className="size-full" /> : null}
        {!url || loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground" aria-live="polite">
            {loading ? "Loading preview…" : empty}
          </div>
        ) : null}
      </div>
    )
  },
)

export function saveBlobAs(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function MissingPlaceholders({ keys, labels }: { keys: string[]; labels?: Record<string, string> }) {
  if (!keys.length) return null
  return (
    <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-medium">These placeholders have no value yet:</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {keys.map((key) => (
          <li key={key}>
            <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs dark:bg-amber-900/40">{labels?.[key] ?? key}</code>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs">Fill them in on the Details step or edit the wording before submitting.</p>
    </div>
  )
}
