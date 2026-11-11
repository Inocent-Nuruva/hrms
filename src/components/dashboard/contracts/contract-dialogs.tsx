"use client"

import * as React from "react"
import { Dialog as FluentDialog, DialogSurface, DialogTitle } from "@fluentui/react-components"

import { cn } from "@/lib/utils"

type ConfirmOptions = {
  title: string
  message: React.ReactNode
  confirmLabel?: string
  tone?: "primary" | "danger"
}

type ReasonOptions = ConfirmOptions & { label?: string; placeholder?: string; minLength?: number }

type Pending =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: "reason"; options: ReasonOptions; resolve: (value: string | null) => void }

/**
 * In-app replacements for window.confirm / window.prompt.
 * `const { confirm, askReason, dialog } = useContractDialogs()` and render `{dialog}`.
 */
export function useContractDialogs() {
  const [pending, setPending] = React.useState<Pending | null>(null)
  const [reason, setReason] = React.useState("")

  const confirm = React.useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ kind: "confirm", options, resolve })),
    [],
  )
  const askReason = React.useCallback(
    (options: ReasonOptions) =>
      new Promise<string | null>((resolve) => {
        setReason("")
        setPending({ kind: "reason", options, resolve })
      }),
    [],
  )

  const close = (accepted: boolean) => {
    if (!pending) return
    if (pending.kind === "confirm") pending.resolve(accepted)
    else pending.resolve(accepted ? reason.trim() : null)
    setPending(null)
  }

  const options = pending?.options
  const minLength = pending?.kind === "reason" ? (pending.options.minLength ?? 3) : 0
  const canAccept = pending?.kind !== "reason" || reason.trim().length >= minLength

  const dialog = (
    <FluentDialog open={Boolean(pending)} onOpenChange={(_event, data) => !data.open && close(false)}>
      <DialogSurface className="!w-[min(480px,calc(100vw-2rem))] !max-w-[480px] !p-0">
        <div className="grid gap-3 px-5 py-4">
          <DialogTitle as="h2" className="!text-lg !font-semibold">
            {options?.title}
          </DialogTitle>
          <div className="text-sm text-slate-700">{options?.message}</div>
          {pending?.kind === "reason" ? (
            <label className="grid gap-1 text-sm">
              <span className="font-medium">{pending.options.label ?? "Reason"}</span>
              <textarea
                autoFocus
                className="min-h-20 rounded-md border border-border px-2.5 py-1.5 text-sm"
                placeholder={pending.options.placeholder}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              {minLength ? <span className="text-xs text-muted-foreground">At least {minLength} characters.</span> : null}
            </label>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => close(false)}>
            Back
          </button>
          <button
            type="button"
            disabled={!canAccept}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50",
              options?.tone === "danger" ? "bg-rose-600" : "bg-primary",
            )}
            onClick={() => close(true)}
          >
            {options?.confirmLabel ?? "Continue"}
          </button>
        </div>
      </DialogSurface>
    </FluentDialog>
  )

  return { confirm, askReason, dialog }
}
