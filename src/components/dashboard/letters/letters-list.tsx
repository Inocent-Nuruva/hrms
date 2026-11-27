"use client"

import * as React from "react"
import { DownloadIcon, EyeIcon } from "lucide-react"

import {
  ProfileRecordCollection,
  RecordActionButton,
  RecordBadges,
  RecordTag,
  type ProfileRecordDisplay,
  type ProfileRecordView,
} from "@/components/dashboard/employee-profile/profile-record-views"
import { LetterStatusTag, errorText, formatLetterDate, saveBlobAs } from "@/components/dashboard/letters/letter-shared"
import { toast } from "@/components/ui/fluent-toast-store"
import { downloadLetterPdf, type Letter } from "@/lib/letters-api"

export async function downloadLetter(token: string, letter: Letter) {
  try {
    const { blob, fileName } = await downloadLetterPdf(token, letter.id)
    saveBlobAs(blob, fileName || `${letter.reference_no}.pdf`)
  } catch (cause) {
    toast.error(errorText(cause, "Could not download the letter"))
  }
}

export function letterRecord(letter: Letter, actions: React.ReactNode, showRecipient = true): ProfileRecordDisplay {
  return {
    key: String(letter.id),
    heading: showRecipient ? `${letter.recipient_name} — ${letter.letter_type_label}` : letter.letter_type_label,
    badges: (
      <RecordBadges inline>
        <LetterStatusTag status={letter.status} />
        {letter.recipient_kind === "candidate" ? <RecordTag tone="primary">Candidate</RecordTag> : null}
      </RecordBadges>
    ),
    fields: [
      { label: "Reference", value: letter.reference_no },
      ...(showRecipient ? [{ label: "Employee no", value: letter.employee_no ?? "" }] : []),
      { label: "Subject", value: letter.subject ?? "" },
      { label: "Issued", value: formatLetterDate(letter.issued_at) },
      { label: "Template", value: letter.template_name ?? "" },
    ].filter((entry) => entry.value),
    meta: `Updated ${formatLetterDate(letter.updated_at)}`,
    searchText: [letter.reference_no, letter.recipient_name, letter.employee_no, letter.letter_type_label, letter.subject].join(" "),
    actions,
  }
}

/** Letters as profile-style cards or list rows with View / Download. */
export function LettersCollection({
  token,
  letters,
  view,
  onView,
  showRecipient = true,
}: {
  token: string
  letters: Letter[]
  view: ProfileRecordView
  onView: (letter: Letter) => void
  showRecipient?: boolean
}) {
  return (
    <ProfileRecordCollection
      title="Letters"
      view={view}
      records={letters.map((letter) =>
        letterRecord(
          letter,
          <div className="flex items-center gap-1">
            <RecordActionButton label="View" icon={<EyeIcon className="size-4" aria-hidden="true" />} onClick={() => onView(letter)} />
            {letter.can?.download && letter.status === "ISSUED" ? (
              <RecordActionButton
                label="Download"
                icon={<DownloadIcon className="size-4" aria-hidden="true" />}
                onClick={() => void downloadLetter(token, letter)}
              />
            ) : null}
          </div>,
          showRecipient,
        ),
      )}
    />
  )
}
