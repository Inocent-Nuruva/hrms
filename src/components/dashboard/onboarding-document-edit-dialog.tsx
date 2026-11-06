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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type OnboardingDocumentEditTarget = {
  title: string
  description: string
  expiryDate: string
}

export type OnboardingDocumentUpdate = {
  title?: string
  description?: string | null
  expiry_date?: string | null
}

/** Only send changed fields; an emptied description or expiry clears it. */
export function buildDocumentUpdate(
  current: OnboardingDocumentEditTarget,
  next: OnboardingDocumentEditTarget,
): OnboardingDocumentUpdate {
  const payload: OnboardingDocumentUpdate = {}
  const title = next.title.trim()
  const description = next.description.trim()
  if (title && title !== current.title.trim()) payload.title = title
  if (description !== current.description.trim()) payload.description = description || null
  if (next.expiryDate !== current.expiryDate) payload.expiry_date = next.expiryDate || null
  return payload
}

export function OnboardingDocumentEditDialog({
  target,
  saving,
  onClose,
  onSubmit,
}: {
  target: OnboardingDocumentEditTarget | null
  saving: boolean
  onClose: () => void
  onSubmit: (payload: OnboardingDocumentUpdate) => void
}) {
  const [draft, setDraft] = React.useState<OnboardingDocumentEditTarget>({
    title: "",
    description: "",
    expiryDate: "",
  })

  React.useEffect(() => {
    if (target) setDraft(target)
  }, [target])

  const payload = target ? buildDocumentUpdate(target, draft) : {}
  const hasChanges = Object.keys(payload).length > 0

  return (
    <Dialog open={target !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogPopup from="bottom" className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit document details</DialogTitle>
          <DialogDescription>
            Correct the title, notes or expiry date. The file itself is unchanged; upload a new document to replace it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Title
            <Input
              value={draft.title}
              maxLength={255}
              onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Description
            <Input
              value={draft.description}
              maxLength={2000}
              onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Expiry date
            <Input
              type="date"
              value={draft.expiryDate}
              onChange={(event) => setDraft((prev) => ({ ...prev, expiryDate: event.target.value }))}
            />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || !hasChanges || !draft.title.trim()}
            onClick={() => onSubmit(payload)}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
