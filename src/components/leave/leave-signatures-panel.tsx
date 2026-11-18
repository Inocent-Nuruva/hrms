"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  AlertDialog as Dialog,
  AlertDialogContent as DialogContent,
  AlertDialogDescription as DialogDescription,
  AlertDialogFooter as DialogFooter,
  AlertDialogHeader as DialogHeader,
  AlertDialogTitle as DialogTitle,
} from "@/components/ui/alert-dialog"
import { showErrorAlert } from "@/lib/error-alert"
import {
  getLeaveVerificationState,
  listLeaveSignatures,
  listMyLeaveSignatures,
  signLeaveApplication,
  signMyLeaveApplication,
  signLeaveApproval,
  type LeaveSignatureView,
} from "@/lib/leave-engine-api"
import { showSuccessAlert } from "@/lib/success-alert"
import { cn } from "@/lib/utils"

type ApprovalLike = Record<string, unknown>

const DECIDED = ["approved", "rejected", "returned"]
const ROLE_LABEL: Record<string, string> = { EMPLOYEE: "Applicant", APPROVER: "Approver" }

const when = (v: string) => new Date(v).toLocaleString()

/**
 * Electronic signatures on a leave application: the applicant signs the
 * application, each officer signs the decision they recorded. A signature is
 * an audited confirmation bound to the current version of the application
 * (not a cryptographic certificate); it shows as invalid if the application
 * or decision changes afterwards. The server enforces who may sign.
 */
export function LeaveSignaturesPanel({
  token,
  requestId,
  approvals = [],
  currentCompanyUserId,
  isApplicant,
  canViewVerification = false,
  status,
  selfService = false,
}: {
  token: string
  requestId: number
  approvals?: ApprovalLike[]
  currentCompanyUserId: number | null
  isApplicant: boolean
  canViewVerification?: boolean
  status?: string | null
  /** Employee self-service: uses the /me routes (own applications only). */
  selfService?: boolean
}) {
  const [signatures, setSignatures] = React.useState<LeaveSignatureView[] | null>(null)
  const [verification, setVerification] = React.useState<{ has_active_code?: boolean } | null>(null)
  const [pending, setPending] = React.useState<{ kind: "application" } | { kind: "approval"; approvalId: number; label: string } | null>(null)
  const [agreed, setAgreed] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      setSignatures(
        await (selfService ? listMyLeaveSignatures(token, requestId) : listLeaveSignatures(token, requestId)),
      )
      if (canViewVerification) setVerification((await getLeaveVerificationState(token, requestId)) as { has_active_code?: boolean })
    } catch (error) {
      setSignatures([])
      showErrorAlert(error instanceof Error ? error.message : "Could not load signatures.")
    }
  }, [token, requestId, canViewVerification, selfService])

  React.useEffect(() => {
    void load()
  }, [load])

  const validApplicant = signatures?.find((s) => s.role === "EMPLOYEE" && s.valid)
  const signableApprovals = approvals.filter((a) => {
    const id = Number(a.id)
    return (
      currentCompanyUserId != null &&
      Number(a.approver_company_user_id) === currentCompanyUserId &&
      DECIDED.includes(String(a.status).toLowerCase()) &&
      !signatures?.some((s) => s.approval_id === id && s.valid)
    )
  })
  const closed = ["cancelled", "rejected"].includes(String(status ?? "").toLowerCase())

  async function confirmSign() {
    if (!pending) return
    setBusy(true)
    try {
      if (pending.kind === "application")
        await (selfService ? signMyLeaveApplication(token, requestId) : signLeaveApplication(token, requestId))
      else await signLeaveApproval(token, requestId, pending.approvalId)
      showSuccessAlert("Signed. The signature is recorded with its audit reference.")
      setPending(null)
      setAgreed(false)
      await load()
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not sign.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-2 border-t border-border pt-3" aria-label="Electronic signatures">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold">Electronic signatures</h4>
        {verification ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              verification.has_active_code ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700",
            )}
          >
            {verification.has_active_code ? "PDF QR code active" : "No active PDF QR code"}
          </span>
        ) : null}
      </div>
      {signatures === null ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : signatures.length ? (
        <ul className="space-y-1">
          {signatures.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
              <div>
                <div className="font-medium">
                  {s.signer_name} · {ROLE_LABEL[s.role] ?? s.role}
                  {s.decision ? ` · ${s.decision.toLowerCase()}` : ""}
                </div>
                <div className="text-muted-foreground">
                  {when(s.signed_at)} · ref {s.reference}
                </div>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-medium",
                  s.valid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800",
                )}
                title={s.invalid_reason ?? "Matches the current application"}
              >
                {s.valid ? "Valid" : s.invalid_reason ?? "Not valid"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No one has signed this application yet.</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {isApplicant && !validApplicant && !closed ? (
          <Button size="sm" variant="outline" onClick={() => setPending({ kind: "application" })}>
            Sign my application
          </Button>
        ) : null}
        {signableApprovals.map((a) => {
          const label = `level ${String(a.approval_level ?? "")} decision`
          return (
            <Button
              key={String(a.id)}
              size="sm"
              variant="outline"
              onClick={() => setPending({ kind: "approval", approvalId: Number(a.id), label })}
            >
              Sign my {label}
            </Button>
          )
        })}
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => (!open ? (setPending(null), setAgreed(false)) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.kind === "application" ? "Sign this leave application" : `Sign your ${pending && "label" in pending ? pending.label : "decision"}`}</DialogTitle>
            <DialogDescription>
              Your signature is recorded with your name, the time, your device details and a reference, and is tied to
              the application as it is now. If the application or decision changes later, the signature is shown as no
              longer valid.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              {pending?.kind === "application"
                ? "I confirm the details of this leave application are correct and I sign it electronically."
                : "I confirm the decision I recorded on this application and sign it electronically."}
            </span>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void confirmSign()} disabled={!agreed || busy}>
              {busy ? "Signing…" : "Sign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
