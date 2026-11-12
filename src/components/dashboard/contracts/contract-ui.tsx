"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import type { ContractStatus, ContractType, ContractValidity } from "@/lib/contracts-api"
import { errorMessage, fetchContractFile } from "@/lib/contracts-api"
import { cn } from "@/lib/utils"

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  UNSPECIFIED: "Unspecified period (permanent)",
  FIXED_TERM: "Fixed term",
  SPECIFIC_TASK: "Specific task",
}

const STATUS: Record<ContractStatus, { label: string; tone: string }> = {
  DRAFT: { label: "Draft", tone: "border-slate-300 bg-slate-100 text-slate-700" },
  PENDING_HR_SIGNATURE: { label: "Awaiting company signature", tone: "border-amber-300 bg-amber-50 text-amber-800" },
  PENDING_EMPLOYEE_SIGNATURE: { label: "Awaiting employee signature", tone: "border-amber-300 bg-amber-50 text-amber-800" },
  PENDING_VERIFICATION: { label: "Upload to verify", tone: "border-sky-300 bg-sky-50 text-sky-800" },
  SIGNED: { label: "Signed", tone: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  CANCELLED: { label: "Cancelled", tone: "border-slate-300 bg-slate-50 text-slate-500" },
  SUPERSEDED: { label: "Superseded", tone: "border-slate-300 bg-slate-50 text-slate-500" },
  TERMINATED: { label: "Ended (exit)", tone: "border-rose-300 bg-rose-50 text-rose-700" },
  ISSUED: { label: "Awaiting employee signature", tone: "border-amber-300 bg-amber-50 text-amber-800" },
}

const VALIDITY: Record<ContractValidity, { label: string; tone: string }> = {
  NOT_EFFECTIVE: { label: "Not in force", tone: "text-slate-500" },
  NOT_STARTED: { label: "Starts later", tone: "text-sky-700" },
  ACTIVE: { label: "Active", tone: "text-emerald-700" },
  EXPIRING: { label: "Expiring soon", tone: "text-amber-700" },
  EXPIRED: { label: "Expired", tone: "text-rose-700" },
  SUPERSEDED: { label: "Superseded", tone: "text-slate-500" },
  TERMINATED: { label: "Ended", tone: "text-rose-700" },
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const meta = STATUS[status] ?? { label: status, tone: "border-slate-300 bg-slate-50 text-slate-600" }
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", meta.tone)}>
      {meta.label}
    </span>
  )
}

export function ContractValidityText({ validity }: { validity?: ContractValidity }) {
  if (!validity) return null
  const meta = VALIDITY[validity] ?? { label: validity, tone: "text-slate-500" }
  return <span className={cn("text-xs font-medium", meta.tone)}>{meta.label}</span>
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

/**
 * Inline PDF viewer for a contract file. Phones get an "Open PDF" link
 * because many mobile browsers do not render PDFs inside a frame.
 */
export function ContractPdfViewer({
  token,
  contractId,
  documentId,
  onLoaded,
  className,
}: {
  token: string
  contractId: number
  documentId?: number | null
  onLoaded?: (info: { sha256: string | null; fileName: string; url: string }) => void
  className?: string
}) {
  const [url, setUrl] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const onLoadedRef = React.useRef(onLoaded)
  React.useEffect(() => {
    onLoadedRef.current = onLoaded
  }, [onLoaded])

  React.useEffect(() => {
    if (!token) return
    let revoked: string | null = null
    let cancelled = false
    setUrl(null)
    setError(null)
    fetchContractFile(token, contractId, documentId)
      .then(({ blob, sha256, fileName }) => {
        if (cancelled) return
        revoked = URL.createObjectURL(blob)
        setUrl(revoked)
        onLoadedRef.current?.({ sha256, fileName, url: revoked })
      })
      .catch((cause: unknown) => !cancelled && setError(errorMessage(cause, "The contract could not be loaded")))
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [token, contractId, documentId])

  if (error) return <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
  if (!url)
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading document…
      </p>
    )
  return (
    <div className={cn("grid gap-2", className)}>
      <iframe
        title="Contract document"
        src={url}
        className="hidden h-[70vh] w-full rounded-md border border-border bg-white sm:block"
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center rounded-md border border-border px-3 py-2 text-sm font-medium sm:hidden"
      >
        Open PDF
      </a>
    </div>
  )
}
