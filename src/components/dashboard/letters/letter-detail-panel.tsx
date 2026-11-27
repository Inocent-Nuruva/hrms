"use client"

import * as React from "react"

import { ProfileSidePanel } from "@/components/dashboard/employee-profile/profile-side-panel"
import { RecordFieldGrid, RecordTag } from "@/components/dashboard/employee-profile/profile-record-views"
import {
  LetterStatusTag,
  MissingPlaceholders,
  PdfFrame,
  errorText,
  formatLetterDate,
  missingFromError,
  saveBlobAs,
  useBlobUrl,
} from "@/components/dashboard/letters/letter-shared"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FormField } from "@/components/ui/form-field"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/fluent-toast-store"
import {
  approveLetter,
  cancelLetter,
  downloadLetterPdf,
  getLetter,
  issueLetter,
  previewLetterPdf,
  rejectLetter,
  reviseLetter,
  submitLetter,
  type Letter,
} from "@/lib/letters-api"

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Draft created",
  UPDATED: "Draft updated",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ISSUED: "Issued",
  EMAILED: "Emailed",
  CANCELLED: "Cancelled",
  REVISED: "Revision started",
  SUPERSEDED: "Superseded",
  DOWNLOADED: "Downloaded",
  VERIFICATION_REVOKED: "Verification revoked",
}

type PendingAction = "reject" | "cancel" | "issue" | null

/** Letter detail: header, recipient, PDF, timeline and the actions the actor may take. */
export function LetterDetailPanel({
  open,
  onOpenChange,
  token,
  letterId,
  onEdit,
  onChanged,
  onOpenLetter,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
  letterId: number | null
  onEdit: (letter: Letter) => void
  onChanged?: () => void
  /** Called with a new letter id (after Revise). */
  onOpenLetter?: (id: number) => void
}) {
  const [letter, setLetter] = React.useState<Letter | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [pending, setPending] = React.useState<PendingAction>(null)
  const [reason, setReason] = React.useState("")
  const [reasonError, setReasonError] = React.useState<string | null>(null)
  const [sendEmail, setSendEmail] = React.useState(true)
  const [missing, setMissing] = React.useState<string[]>([])
  const [pdfUrl, setPdf] = useBlobUrl()
  const [pdfLoading, setPdfLoading] = React.useState(false)
  const pdfBlob = React.useRef<{ blob: Blob; fileName: string } | null>(null)
  const frameRef = React.useRef<HTMLIFrameElement | null>(null)

  const load = React.useCallback(async () => {
    if (!token || !letterId) return
    setError(null)
    try {
      const row = await getLetter(token, letterId)
      setLetter(row)
      setMissing(row.missing_placeholders ?? [])
      setPdfLoading(true)
      try {
        const file = row.status === "ISSUED" && row.can.download ? await downloadLetterPdf(token, row.id) : await previewLetterPdf(token, row.id)
        pdfBlob.current = file
        setPdf(file.blob)
      } catch (cause) {
        pdfBlob.current = null
        setPdf(null)
        setError(errorText(cause, "The PDF could not be loaded"))
      } finally {
        setPdfLoading(false)
      }
    } catch (cause) {
      setError(errorText(cause, "Could not load the letter"))
    }
  }, [token, letterId, setPdf])

  React.useEffect(() => {
    if (!open) return
    setLetter(null)
    setPending(null)
    setReason("")
    setSendEmail(true)
    void load()
  }, [open, load])

  const run = async (action: () => Promise<Letter>, success: string) => {
    setBusy(true)
    try {
      const result = await action()
      toast.success(success)
      setPending(null)
      setReason("")
      onChanged?.()
      if (result.id !== letterId) onOpenLetter?.(result.id)
      else await load()
    } catch (cause) {
      const keys = missingFromError(cause)
      if (keys.length) setMissing(keys)
      toast.error(errorText(cause, "The action failed"))
    } finally {
      setBusy(false)
    }
  }

  const confirmPending = () => {
    if (!letter || !pending) return
    if (pending === "issue") return void run(() => issueLetter(token, letter.id, sendEmail), `Letter ${letter.reference_no} issued`)
    if (!reason.trim()) {
      setReasonError("Give a reason.")
      return
    }
    setReasonError(null)
    if (pending === "reject") void run(() => rejectLetter(token, letter.id, reason.trim()), "Letter rejected")
    else void run(() => cancelLetter(token, letter.id, reason.trim()), "Letter cancelled")
  }

  const print = () => {
    const frame = frameRef.current
    try {
      frame?.contentWindow?.focus()
      frame?.contentWindow?.print()
    } catch {
      if (pdfUrl) window.open(pdfUrl, "_blank", "noopener")
    }
  }

  const can = letter?.can
  const actions = letter && can ? (
    <div className="flex w-full flex-wrap justify-end gap-2">
      {can.edit ? <Button variant="outline" disabled={busy} onClick={() => onEdit(letter)}>Edit</Button> : null}
      {can.revise ? (
        <Button variant="outline" disabled={busy} onClick={() => void run(() => reviseLetter(token, letter.id), "Revision draft created")}>Revise</Button>
      ) : null}
      {can.cancel ? <Button variant="outline" disabled={busy} onClick={() => setPending("cancel")}>Cancel letter</Button> : null}
      {pdfUrl ? <Button variant="outline" disabled={busy} onClick={print}>Print</Button> : null}
      {can.download && letter.status === "ISSUED" ? (
        <Button
          variant="outline"
          disabled={busy || !pdfUrl}
          onClick={() => pdfBlob.current && saveBlobAs(pdfBlob.current.blob, pdfBlob.current.fileName || `${letter.reference_no}.pdf`)}
        >
          Download
        </Button>
      ) : null}
      {can.reject ? <Button variant="outline" disabled={busy} onClick={() => setPending("reject")}>Reject</Button> : null}
      {can.submit ? <Button disabled={busy} onClick={() => void run(() => submitLetter(token, letter.id), "Letter submitted")}>Submit</Button> : null}
      {can.approve ? <Button disabled={busy} onClick={() => void run(() => approveLetter(token, letter.id), "Letter approved")}>Approve</Button> : null}
      {can.issue ? <Button disabled={busy} onClick={() => setPending("issue")}>Issue</Button> : null}
    </div>
  ) : null

  return (
    <ProfileSidePanel
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={
        letter ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{letter.reference_no}</span>
            <LetterStatusTag status={letter.status} />
          </span>
        ) : (
          "Letter"
        )
      }
      description={letter ? letter.letter_type_label : undefined}
      footer={actions}
    >
      {error ? <p role="alert" className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {!letter ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-6">
          {pending ? (
            <section aria-label="Confirm action" className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-4">
              {pending === "issue" ? (
                <>
                  <p className="text-sm text-foreground">Issue {letter.reference_no}? The final PDF with its verification QR is generated and the recipient is notified.</p>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={sendEmail} onCheckedChange={(checked) => setSendEmail(Boolean(checked))} />
                    Email the PDF to the recipient
                  </label>
                </>
              ) : (
                <FormField label={pending === "reject" ? "Reason for rejecting" : "Reason for cancelling"} required error={reasonError}>
                  <Textarea formatting={false} rows={3} value={reason} onChange={(_event, data) => setReason(data.value)} />
                </FormField>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" disabled={busy} onClick={() => setPending(null)}>Back</Button>
                <Button variant={pending === "issue" ? "default" : "destructive"} disabled={busy} onClick={confirmPending}>
                  {pending === "issue" ? "Issue letter" : pending === "reject" ? "Reject letter" : "Cancel letter"}
                </Button>
              </div>
            </section>
          ) : null}

          <MissingPlaceholders keys={letter.status === "DRAFT" || letter.status === "REJECTED" ? missing : []} />

          <section aria-label="Recipient">
            <RecordFieldGrid
              fields={[
                { label: "Recipient", value: letter.recipient_name },
                { label: letter.recipient_kind === "candidate" ? "Recipient type" : "Employee no", value: letter.recipient_kind === "candidate" ? "Candidate" : letter.employee_no ?? "" },
                { label: "Subject", value: letter.subject },
                { label: "Template", value: letter.template_name ? `${letter.template_name} (v${letter.template_version ?? 1})` : "" },
                { label: "Signatory", value: [letter.signatory_name, letter.signatory_title].filter(Boolean).join(", ") },
                { label: "Approval", value: letter.requires_approval ? "Required" : "Not required" },
                { label: "Rejection reason", value: letter.status === "REJECTED" ? letter.rejection_reason ?? "" : "" },
                { label: "Cancellation reason", value: letter.cancellation_reason ?? "" },
                { label: "Emailed", value: letter.emailed_at ? formatLetterDate(letter.emailed_at, true) : "" },
              ].filter((entry) => entry.value)}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {letter.revision_of_letter_id ? <RecordTag>Revision</RecordTag> : null}
              {letter.include_acknowledgement ? <RecordTag>Acknowledgement section</RecordTag> : null}
            </div>
          </section>

          <section aria-label="PDF">
            <h3 className="mb-2 text-sm font-semibold text-foreground">{letter.status === "ISSUED" ? "Issued letter" : "Preview"}</h3>
            <PdfFrame ref={frameRef} url={pdfUrl} loading={pdfLoading} title={`Letter ${letter.reference_no}`} empty="No PDF available." />
          </section>

          <section aria-label="History">
            <h3 className="mb-2 text-sm font-semibold text-foreground">History</h3>
            {letter.events?.length ? (
              <ol className="relative ml-2 border-l border-border">
                {letter.events.map((event) => (
                  <li key={event.id} className="mb-3 ml-4">
                    <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border border-background bg-primary" aria-hidden="true" />
                    <p className="text-sm font-medium text-foreground">{EVENT_LABELS[event.action] ?? event.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {[event.actor_name, formatLetterDate(event.created_at, true)].filter(Boolean).join(" · ")}
                    </p>
                    {event.note ? <p className="mt-0.5 text-xs text-foreground">{event.note}</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No history yet.</p>
            )}
          </section>
        </div>
      )}
    </ProfileSidePanel>
  )
}
