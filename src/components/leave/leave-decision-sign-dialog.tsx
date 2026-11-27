"use client"

import * as React from "react"

import { SignaturePad } from "@/components/dashboard/contracts/contract-signing-panel"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/** Typed name or drawn image (PNG data URL) sent with a leave decision. */
export type LeaveSignatureMark =
  | { kind: "TYPED"; text: string }
  | { kind: "DRAWN"; png_base64: string }

export type LeaveDecisionSignRequest = {
  title: string
  /** e.g. "Approve", "Reject", "Return for correction". */
  confirmLabel: string
  description?: string
  /** Remarks shown on the leave form. */
  commentLabel?: string
  commentRequired?: boolean
  defaultComment?: string
  /** Pre-filled typed signature (the signer's name). */
  signerName?: string
  destructive?: boolean
}

export type LeaveDecisionSignResult = { signature: LeaveSignatureMark; comments: string }

/**
 * Approve = sign: every leave decision is signed with a typed name or a
 * drawn signature, which appears on the leave application form.
 *
 *   const [dialog, askSignature] = useLeaveDecisionSignature()
 *   const signed = await askSignature({ title: "Approve leave", confirmLabel: "Approve" })
 *   if (!signed) return
 */
export function useLeaveDecisionSignature(): [
  React.ReactNode,
  (request: LeaveDecisionSignRequest) => Promise<LeaveDecisionSignResult | null>,
] {
  const [request, setRequest] = React.useState<LeaveDecisionSignRequest | null>(null)
  const resolver = React.useRef<((value: LeaveDecisionSignResult | null) => void) | null>(null)

  const ask = React.useCallback((next: LeaveDecisionSignRequest) => {
    resolver.current?.(null)
    setRequest(next)
    return new Promise<LeaveDecisionSignResult | null>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const finish = React.useCallback((value: LeaveDecisionSignResult | null) => {
    resolver.current?.(value)
    resolver.current = null
    setRequest(null)
  }, [])

  const element = request ? (
    <LeaveDecisionSignDialog key={request.title} request={request} onDone={finish} />
  ) : null
  return [element, ask]
}

function LeaveDecisionSignDialog({
  request,
  onDone,
}: {
  request: LeaveDecisionSignRequest
  onDone: (value: LeaveDecisionSignResult | null) => void
}) {
  const [kind, setKind] = React.useState<"TYPED" | "DRAWN">("TYPED")
  const [typed, setTyped] = React.useState(request.signerName ?? "")
  const [drawn, setDrawn] = React.useState<string | null>(null)
  const [comments, setComments] = React.useState(request.defaultComment ?? "")
  const [agreed, setAgreed] = React.useState(false)

  const signatureReady = kind === "TYPED" ? typed.trim().length > 1 : Boolean(drawn)
  const commentReady = !request.commentRequired || comments.trim().length >= 3
  const ready = signatureReady && commentReady && agreed

  return (
    <AlertDialog open onOpenChange={(open) => (!open ? onDone(null) : null)}>
      <AlertDialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{request.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {request.description ??
              "Your remarks and signature are recorded with this decision and printed on the leave application form."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">
            {request.commentLabel ?? "Remarks"}
            {request.commentRequired ? " (required)" : " (optional)"}
          </span>
          <Textarea
            value={comments}
            maxLength={2000}
            onChange={(event) => setComments(event.target.value)}
            placeholder="These remarks appear on the leave form."
            aria-label={request.commentLabel ?? "Remarks"}
          />
        </label>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Your signature</span>
            <div className="inline-flex rounded-md border border-border p-0.5" role="tablist" aria-label="Signature type">
              {(["TYPED", "DRAWN"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={kind === value}
                  onClick={() => setKind(value)}
                  className={cn(
                    "rounded px-3 py-1 text-xs font-medium",
                    kind === value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {value === "TYPED" ? "Type" : "Draw"}
                </button>
              ))}
            </div>
          </div>
          {kind === "TYPED" ? (
            <div className="grid gap-2">
              <Input
                value={typed}
                maxLength={100}
                onChange={(event) => setTyped(event.target.value)}
                placeholder="Type your full name"
                aria-label="Type your full name"
              />
              <div className="flex h-16 items-center justify-end rounded-md border border-dashed border-border px-4 font-serif text-3xl italic">
                {typed.trim() || <span className="text-sm not-italic text-muted-foreground">Signature preview</span>}
              </div>
            </div>
          ) : (
            <SignaturePad onChange={setDrawn} />
          )}
        </div>

        <label className="flex items-start gap-2 text-sm">
          <Checkbox className="mt-0.5" checked={agreed} onCheckedChange={(checked) => setAgreed(checked)} />
          <span>I confirm this decision and sign it electronically.</span>
        </label>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onDone(null)}>
            Cancel
          </Button>
          <Button
            variant={request.destructive ? "destructive" : "default"}
            disabled={!ready}
            onClick={() =>
              onDone({
                signature: kind === "TYPED" ? { kind, text: typed.trim() } : { kind, png_base64: drawn ?? "" },
                comments: comments.trim(),
              })
            }
          >
            Sign and {request.confirmLabel.toLowerCase()}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
